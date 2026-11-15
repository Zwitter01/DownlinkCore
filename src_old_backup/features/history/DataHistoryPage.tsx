import { useState, useEffect } from 'react';
import { Database, Download, RefreshCw } from 'lucide-react';
import { format, subHours, subMinutes } from 'date-fns';
import { sensorRegistry } from '../sensors/registry';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Data History Page â€” Black Hole Singularity + Apple Liquid Glass Table
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BACKEND = 'http://localhost:3001';

interface HistoryRow {
  id: number;
  ts: number;
  sensor_id: string;
  field_key: string;
  value: number;
  packet_no: number | null;
  quality: string;
}

const PRESETS = [
  { label: 'Last 15m', from: () => subMinutes(Date.now(), 15).getTime() },
  { label: 'Last 1h', from: () => subHours(Date.now(), 1).getTime() },
  { label: 'Last 6h', from: () => subHours(Date.now(), 6).getTime() },
  { label: 'Last 24h', from: () => subHours(Date.now(), 24).getTime() },
];

export function DataHistoryPage() {
  const fields = sensorRegistry.getAllFields();
  const [selectedField, setSelectedField] = useState(fields[0] ? `${fields[0].sensorId}.${fields[0].fieldDef.fieldKey}` : '');
  const [from, setFrom] = useState(subHours(Date.now(), 1).getTime());
  const [to, setTo] = useState(Date.now());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const [sensorId, fieldKey] = selectedField.split('.');

  const fetchHistory = async () => {
    if (!selectedField) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${BACKEND}/api/telemetry/range?sensorId=${sensorId}&fieldKey=${fieldKey}&from=${from}&to=${to}&limit=500`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { rows: HistoryRow[]; total: number };
      setRows(data.rows ?? []);
      setTotalCount(data.total ?? 0);
    } catch (err) {
      setError(`Backend unavailable: ${err instanceof Error ? err.message : String(err)}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedField) fetchHistory(); }, [selectedField, from, to]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleExportCSV = async () => {
    if (!selectedField) return;
    try {
      const res = await fetch(
        `${BACKEND}/api/telemetry/export?sensorId=${sensorId}&fieldKey=${fieldKey}&from=${from}&to=${to}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vyomaastra_${sensorId}_${fieldKey}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="p-6 space-y-5 bg-transparent">
      <div>
        <h1 className="text-xl font-bold tracking-tight heading-gradient flex items-center gap-2">
          <Database size={20} className="text-[#c026d3]" /> Data History
        </h1>
        <p className="text-white/40 text-sm mt-1">Query and export historical telemetry from persistent storage</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 liquid-glass-card p-4">
        {/* Field selector */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Field</label>
          <select
            value={selectedField}
            onChange={e => setSelectedField(e.target.value)}
            className="liquid-glass-input px-3 py-2 text-sm bg-black/60"
          >
            {fields.map(({ sensorId, fieldDef }) => (
              <option key={`${sensorId}.${fieldDef.fieldKey}`} value={`${sensorId}.${fieldDef.fieldKey}`} className="bg-black text-white">
                {sensorRegistry.getSensor(sensorId)?.displayName} Â· {fieldDef.label}
              </option>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs text-white/50 mb-1">Quick range</label>
          <div className="flex gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setFrom(p.from()); setTo(Date.now()); }}
                className="px-2.5 py-1.5 text-xs rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white/70 hover:text-white transition-all backdrop-blur-md"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 px-3.5 py-2 liquid-glass-btn-primary text-sm font-semibold transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.1] text-white/80 rounded-xl text-sm transition-all disabled:opacity-40 backdrop-blur-md"
          >
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#FF453A]/10 border border-[#FF453A]/30 text-[#FF453A] text-sm rounded-xl px-4 py-3 backdrop-blur-md">
          {error}. <span className="text-white/40">Start the backend: <code className="font-mono text-xs text-white/60">cd server && npm run dev</code></span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs font-mono text-white/40 px-1">
        <span>{totalCount.toLocaleString()} total records</span>
        <span>Showing {rows.length}</span>
        {rows.length > 0 && (
          <>
            <span>From {format(new Date(rows[0].ts), 'HH:mm:ss')}</span>
            <span>To {format(new Date(rows[rows.length - 1].ts), 'HH:mm:ss')}</span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="liquid-glass-card overflow-hidden">
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-0 text-xs text-[#c026d3] px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02] uppercase tracking-wider font-semibold">
          <span className="w-24">Timestamp</span>
          <span className="w-16 ml-4">Pkt#</span>
          <span className="ml-4">Value</span>
          <span className="w-16">Unit</span>
          <span className="w-16">Quality</span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-white/40 text-sm">Loading telemetry historyâ€¦</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="px-4 py-8 text-center text-white/40 text-sm">
              No data in selected range.{' '}
              {error ? 'Backend not running.' : 'Ensure bridge is running and telemetry is flowing.'}
            </div>
          )}
          {rows.map((row) => {
            const fd = sensorRegistry.getField(`${row.sensor_id}.${row.field_key}`);
            return (
              <div
                key={row.id}
                className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-0 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.04] transition-all items-center text-xs"
              >
                <span className="text-white/50 font-mono w-24">{format(new Date(row.ts), 'HH:mm:ss.SSS')}</span>
                <span className="text-white/30 font-mono w-16 ml-4">{row.packet_no ?? 'â€”'}</span>
                <span className="text-[#c026d3] font-mono font-semibold ml-4 drop-shadow-[0_0_6px_rgba(192,38,211,0.3)]">
                  {row.value.toFixed(fd?.precision ?? 2)}
                </span>
                <span className="text-white/40 w-16 font-mono">{fd?.unit}</span>
                <span className={`w-16 font-medium ${row.quality === 'ok' ? 'text-[#30D158]' : 'text-[#FF9F0A]'}`}>
                  {row.quality}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
