import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../storage/db';

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry Routes
// Statements are prepared lazily (inside route handlers) so that migrations
// have already run by the time any route is first called.
// ─────────────────────────────────────────────────────────────────────────────

export const telemetryRouter = Router();

// ── Schema ───────────────────────────────────────────────────────────────────
const IngestSchema = z.object({
  missionId: z.string().default('ORBITRA'),
  deviceId: z.string().default('esp8266-rx'),
  readings: z.array(z.object({
    sensorId: z.string(),
    fieldKey: z.string(),
    value: z.number(),
    timestamp: z.number(),
    packetNo: z.number().nullable().optional(),
    quality: z.string().default('ok'),
  })),
});

// ── Lazy prepared statements ──────────────────────────────────────────────────
function getInsertMany() {
  const stmt = db.prepare(`
    INSERT INTO telemetry (ts, mission_id, device_id, sensor_id, field_key, value, packet_no, quality)
    VALUES (@ts, @missionId, @deviceId, @sensorId, @fieldKey, @value, @packetNo, @quality)
  `);
  return db.transaction((readings: Array<{
    ts: number; missionId: string; deviceId: string;
    sensorId: string; fieldKey: string; value: number;
    packetNo: number | null; quality: string;
  }>) => {
    for (const r of readings) stmt.run(r);
  });
}

let _insertMany: ReturnType<typeof getInsertMany> | null = null;
function insertMany() {
  if (!_insertMany) _insertMany = getInsertMany();
  return _insertMany;
}

// ── POST /api/telemetry — ingest normalized readings ─────────────────────────
telemetryRouter.post('/', (req: Request, res: Response) => {
  const parsed = IngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { missionId, deviceId, readings } = parsed.data;
  insertMany()(readings.map(r => ({
    ts: r.timestamp,
    missionId, deviceId,
    sensorId: r.sensorId,
    fieldKey: r.fieldKey,
    value: r.value,
    packetNo: r.packetNo ?? null,
    quality: r.quality,
  })));
  res.json({ inserted: readings.length });
});

// ── GET /api/telemetry/latest — latest value per field ───────────────────────
telemetryRouter.get('/latest', (req: Request, res: Response) => {
  const { sensorId, fieldKey } = req.query;
  if (!sensorId || !fieldKey) {
    res.status(400).json({ error: 'sensorId and fieldKey required' });
    return;
  }
  const row = db.prepare(`
    SELECT * FROM telemetry
    WHERE sensor_id = ? AND field_key = ?
    ORDER BY ts DESC LIMIT 1
  `).get(sensorId as string, fieldKey as string);
  res.json({ row: row ?? null });
});

// ── GET /api/telemetry/range — time range query ───────────────────────────────
telemetryRouter.get('/range', (req: Request, res: Response) => {
  const { sensorId, fieldKey, from, to, limit = '500' } = req.query;
  if (!sensorId || !fieldKey) {
    res.status(400).json({ error: 'sensorId and fieldKey required' });
    return;
  }
  const fromTs = from ? Number(from) : Date.now() - 3600_000;
  const toTs = to ? Number(to) : Date.now();
  const limitN = Math.min(Number(limit), 5000);

  const rows = db.prepare(`
    SELECT id, ts, sensor_id, field_key, value, packet_no, quality
    FROM telemetry
    WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(sensorId as string, fieldKey as string, fromTs, toTs, limitN);

  const total = (db.prepare(`
    SELECT COUNT(*) as cnt FROM telemetry
    WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ?
  `).get(sensorId as string, fieldKey as string, fromTs, toTs) as { cnt: number }).cnt;

  res.json({ rows: (rows as unknown[]).reverse(), total });
});

// ── GET /api/telemetry/export — CSV export ────────────────────────────────────
telemetryRouter.get('/export', (req: Request, res: Response) => {
  const { sensorId, fieldKey, from, to } = req.query;
  if (!sensorId || !fieldKey) {
    res.status(400).json({ error: 'sensorId and fieldKey required' });
    return;
  }
  const fromTs = from ? Number(from) : Date.now() - 86400_000;
  const toTs = to ? Number(to) : Date.now();

  const rows = db.prepare(`
    SELECT ts, sensor_id, field_key, value, packet_no, quality, mission_id, device_id
    FROM telemetry
    WHERE sensor_id = ? AND field_key = ? AND ts >= ? AND ts <= ?
    ORDER BY ts ASC
  `).all(sensorId as string, fieldKey as string, fromTs, toTs) as Array<Record<string, unknown>>;

  const headers = ['timestamp_ms', 'timestamp_iso', 'mission_id', 'device_id', 'sensor_id', 'field_key', 'value', 'packet_no', 'quality'];
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r['ts'],
      new Date(r['ts'] as number).toISOString(),
      r['mission_id'],
      r['device_id'],
      r['sensor_id'],
      r['field_key'],
      r['value'],
      r['packet_no'] ?? '',
      r['quality'],
    ].join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="orbitra_${String(sensorId)}_${String(fieldKey)}_${Date.now()}.csv"`);
  res.send(csv);
});
