import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../sensors/registry';
import { formatDistanceToNow } from 'date-fns';
import { Radio, CheckCircle2, Clock } from 'lucide-react';
import { DiagnosticsPanel } from './DiagnosticsPanel';

// ─────────────────────────────────────────────────────────────────────────────
// Telemetry Explorer Page — Black Hole Singularity + Apple Liquid Glass
// ─────────────────────────────────────────────────────────────────────────────

export function TelemetryExplorerPage() {
  const latestValues = useTelemetryStore(s => s.latestValues);
  const latestTimestamps = useTelemetryStore(s => s.latestTimestamps);
  const fields = sensorRegistry.getAllFields();
  const sensors = sensorRegistry.getAllSensors();

  return (
    <div className="p-6 space-y-6 bg-transparent">
      <div>
        <h1 className="text-xl font-bold tracking-tight heading-gradient flex items-center gap-2">
          <Radio size={20} className="text-[#c026d3]" /> Telemetry Explorer
        </h1>
        <p className="text-white/40 text-sm mt-1">Live view of all registered sensor fields</p>
      </div>

      {/* Fields table */}
      <div className="liquid-glass-card overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-0 text-xs text-[#c026d3] px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.02] uppercase tracking-wider font-semibold">
          <span>Sensor · Field</span>
          <span>Latest Value</span>
          <span>Unit</span>
          <span>Quality</span>
          <span>Last Seen</span>
        </div>

        {fields.length === 0 && (
          <div className="px-4 py-8 text-center text-white/40 text-sm">
            No sensor fields registered. Configure sensors in the Sensors page.
          </div>
        )}

        {fields.map(({ sensorId, fieldDef }) => {
          const ref = `${sensorId}.${fieldDef.fieldKey}`;
          const value = latestValues[ref] ?? null;
          const ts = latestTimestamps[ref] ?? null;
          const sensor = sensors.find(s => s.sensorId === sensorId);
          const hasData = value !== null;

          return (
            <div
              key={ref}
              className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-0 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.04] transition-all items-center"
            >
              <div>
                <p className="text-white/90 text-sm font-medium">{fieldDef.label}</p>
                <p className="text-white/40 text-xs font-mono">{sensor?.displayName ?? sensorId}</p>
              </div>

              <div>
                {hasData ? (
                  <span className="text-[#c026d3] font-mono font-semibold text-sm drop-shadow-[0_0_8px_rgba(192,38,211,0.35)]">
                    {value!.toFixed(fieldDef.precision ?? 2)}
                  </span>
                ) : (
                  <span className="text-white/30 text-sm italic">Configured — awaiting telemetry</span>
                )}
              </div>

              <span className="text-white/40 text-xs font-mono px-2">{fieldDef.unit}</span>

              <div className="px-2">
                {hasData ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-[#30D158]" />
                    <span className="text-xs text-[#30D158] font-mono">ok</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-white/40" />
                    <span className="text-xs text-white/40 font-mono">waiting</span>
                  </div>
                )}
              </div>

              <div className="pl-2">
                {ts ? (
                  <span className="text-white/40 text-xs font-mono">{formatDistanceToNow(new Date(ts), { addSuffix: true })}</span>
                ) : (
                  <span className="text-white/20 text-xs font-mono">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagnostics */}
      <DiagnosticsPanel />
    </div>
  );
}
