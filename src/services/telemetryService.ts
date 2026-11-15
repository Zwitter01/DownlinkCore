import { z } from 'zod';
import { useTelemetryStore } from '../stores/telemetryStore';
import { sensorRegistry } from '../features/sensors/registry';
import type { NormalizedPacket, ConnectionState } from '../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// VYOMAASTRA Telemetry Service
//
// - Single shared WebSocket connection (no per-chart connections)
// - Parses flat legacy + future nested packet formats
// - Bounded exponential backoff reconnection (max 30s)
// - Stale detection: marks 'stale' if no packet for 10s
// - Distributes readings to Zustand store
// - Posts readings to backend for persistence
// ─────────────────────────────────────────────────────────────────────────────

// ── Zod schemas ───────────────────────────────────────────────────────────────
const FlatPacketSchema = z.object({
  packetNo: z.number(),
  timestamp: z.number().optional(),
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  ax: z.number().optional(),
  ay: z.number().optional(),
  az: z.number().optional(),
  totalAcc: z.number().optional(),
  gx: z.number().optional(),
  gy: z.number().optional(),
  gz: z.number().optional(),
  roll: z.number().optional(),
  pitch: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  altitude: z.number().optional(),
  speed: z.number().optional(),
  satellites: z.number().optional(),
  gpsFix: z.number().optional(),
}).passthrough();

const NestedPacketSchema = z.object({
  schemaVersion: z.literal(1),
  missionId: z.string().optional(),
  deviceId: z.string().optional(),
  packetNo: z.number(),
  timestamp: z.number().optional(),
  sensors: z.record(z.unknown()).optional(),
});

// ── Config ────────────────────────────────────────────────────────────────────
const STALE_TIMEOUT_MS = 10_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_MULTIPLIER = 1.5;
const BACKEND_URL = 'http://localhost:3001';

class TelemetryService {
  private ws: WebSocket | null = null;
  private wsUrl: string = 'ws://localhost:8081';
  private deviceId: string = 'esp8266-rx';
  private missionId: string = 'VYOMAASTRA';
  private enabledSensorIds: string[] = ['dht11'];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private simTimer: ReturnType<typeof setInterval> | null = null;
  private simPacketNo = 0;

  configure(options: {
    wsUrl: string;
    deviceId: string;
    missionId: string;
    enabledSensorIds: string[];
  }): void {
    this.wsUrl = options.wsUrl;
    this.deviceId = options.deviceId;
    this.missionId = options.missionId;
    this.enabledSensorIds = options.enabledSensorIds;
    // Apply to registry
    sensorRegistry.enableSensors(options.enabledSensorIds);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    this.clearReconnectTimer();
    this.clearStaleTimer();
    this.stopSimulation();
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close();
      } else {
        ws.onopen = null;
        ws.close();
      }
    }
    this.setConnectionState('disconnected');
  }

  private connect(): void {
    if (!this.running) return;
    if (this.wsUrl.startsWith('sim')) { this.startSimulation(); return; }
    this.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.setConnectionState('error', detail);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
      this.resetStaleTimer();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(typeof event.data === 'string' ? event.data : '');
    };

    this.ws.onerror = () => {
      // onerror always followed by onclose; handle in onclose
    };

    this.ws.onclose = (event) => {
      const detail = `Code ${event.code}${event.reason ? ': ' + event.reason : ''}`;
      this.setConnectionState('disconnected', detail);
      this.clearStaleTimer();
      if (this.running) this.scheduleReconnect();
    };
  }

  private handleMessage(rawJson: string): void {
    const store = useTelemetryStore.getState();

    // ── Parse JSON ──────────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      store.incrementInvalidPacket('JSON parse error');
      return;
    }

    // ── Build normalized packet shell ───────────────────────────────────────
    const packet: NormalizedPacket = {
      raw: parsed,
      packetNo: null,
      timestamp: Date.now(),
      timestampSource: 'fallback',
      readings: [],
      parseWarnings: [],
    };

    // ── Try flat legacy schema ──────────────────────────────────────────────
    const flat = FlatPacketSchema.safeParse(parsed);
    if (flat.success) {
      packet.packetNo = flat.data.packetNo;
      // Bridge sets timestamp to Date.now() — always valid
      if (typeof flat.data.timestamp === 'number' && isFinite(flat.data.timestamp) && flat.data.timestamp >= 1_000_000_000) {
        packet.timestamp = flat.data.timestamp < 100_000_000_000
          ? flat.data.timestamp * 1000 : flat.data.timestamp;
        packet.timestampSource = 'bridge';
      }
    } else {
      // ── Try nested schema ─────────────────────────────────────────────────
      const nested = NestedPacketSchema.safeParse(parsed);
      if (nested.success) {
        packet.packetNo = nested.data.packetNo;
        if (typeof nested.data.timestamp === 'number' && isFinite(nested.data.timestamp) && nested.data.timestamp >= 1_000_000_000) {
          packet.timestamp = nested.data.timestamp < 100_000_000_000
            ? nested.data.timestamp * 1000 : nested.data.timestamp;
          packet.timestampSource = 'packet';
        }
      } else {
        store.incrementInvalidPacket(`Unknown packet format: ${rawJson.slice(0, 120)}`);
        return;
      }
    }

    // Device uptime, invalid dates, and clock skew must not hide live samples
    // outside the chart's wall-clock window.
    if (Math.abs(packet.timestamp - Date.now()) > 24 * 60 * 60 * 1000) {
      packet.timestamp = Date.now();
      packet.timestampSource = 'fallback';
    }

    // ── Run adapters ────────────────────────────────────────────────────────
    const readings = sensorRegistry.normalizePacket(
      packet,
      this.enabledSensorIds,
      this.deviceId,
      this.missionId
    );
    packet.readings = readings;
    if (readings.length > 0) {
      this.resetStaleTimer();
      if (store.connectionState === 'stale') {
        this.setConnectionState('connected', 'Telemetry resumed');
      }
    }

    // Update store
    store.processReadings(readings, rawJson);

    // Update registry sensor status
    if (readings.length > 0) {
      const seenSensors = new Set(readings.map(r => r.sensorId));
      for (const sensorId of seenSensors) {
        sensorRegistry.updateSensor(sensorId, {
          status: 'receiving',
          lastSeenTimestamp: packet.timestamp,
        });
      }
    }

    // ── Persist to backend ──────────────────────────────────────────────────
    if (readings.length > 0 && !this.wsUrl.startsWith('sim')) {
      this.persistReadings(readings).catch(() => {
        // Backend unavailable — silently continue; data still in memory buffer
      });
    }
  }

  private async persistReadings(readings: Array<{
    sensorId: string; fieldKey: string; value: number;
    timestamp: number; packetNo: number | null; quality: string;
  }>): Promise<void> {
    await fetch(`${BACKEND_URL}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId: this.missionId,
        deviceId: this.deviceId,
        readings,
      }),
      signal: AbortSignal.timeout(2000),
    });
  }

  // ── Built-in simulator: lets the dashboard run without hardware or a bridge ──
  private startSimulation(): void {
    this.stopSimulation();
    this.setConnectionState('connected', 'Simulated telemetry');
    this.simTimer = setInterval(() => {
      const t = Date.now() / 1000;
      const n = ++this.simPacketNo;
      const ax = Math.sin(t / 3) * 1.2, ay = Math.cos(t / 4) * 0.9, az = 9.81 + Math.sin(t / 2) * 0.4;
      const packet = {
        packetNo: n,
        timestamp: Date.now(),
        temperature: 24 + Math.sin(t / 30) * 2 + Math.random() * 0.2,
        humidity: 48 + Math.sin(t / 25) * 6 + Math.random() * 0.5,
        ax, ay, az, totalAcc: Math.sqrt(ax * ax + ay * ay + az * az),
        gx: Math.sin(t / 2) * 25, gy: Math.cos(t / 3) * 18, gz: Math.sin(t / 5) * 40,
        roll: Math.sin(t / 4) * 30, pitch: Math.cos(t / 5) * 20,
        pressure: 1008 + Math.sin(t / 40) * 3 + Math.random() * 0.2,
        bmpTemperature: 23.5 + Math.sin(t / 30) * 2,
        bmpAltitude: 120 + Math.sin(t / 20) * 15,
        latitude: 28.6139 + Math.sin(t / 60) * 0.01,
        longitude: 77.209 + Math.cos(t / 60) * 0.01,
        altitude: 220 + Math.sin(t / 20) * 15,
        speed: 40 + Math.sin(t / 10) * 12,
        satellites: 8 + Math.round(Math.sin(t / 15) * 2),
        gpsFix: 1,
      };
      this.handleMessage(JSON.stringify(packet));
    }, 1000);
  }

  private stopSimulation(): void {
    if (this.simTimer !== null) { clearInterval(this.simTimer); this.simTimer = null; }
  }

  private resetStaleTimer(): void {
    this.clearStaleTimer();
    this.staleTimer = setTimeout(() => {
      const state = useTelemetryStore.getState().connectionState;
      if (state === 'connected') {
        this.setConnectionState('stale', 'No packets received for 10 seconds');
        // Update all receiving sensors to stale
        const sensors = sensorRegistry.getAllSensors();
        for (const sensor of sensors) {
          if (sensor.status === 'receiving') {
            sensorRegistry.updateSensor(sensor.sensorId, { status: 'stale' });
          }
        }
      }
    }, STALE_TIMEOUT_MS);
  }

  private clearStaleTimer(): void {
    if (this.staleTimer !== null) {
      clearTimeout(this.staleTimer);
      this.staleTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(
      BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempts),
      BACKOFF_MAX_MS
    );
    this.reconnectAttempts++;
    useTelemetryStore.getState().setConnectionState('connecting', `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      if (this.running) this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setConnectionState(state: ConnectionState, detail?: string): void {
    useTelemetryStore.getState().setConnectionState(state, detail);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────
export const telemetryService = new TelemetryService();
