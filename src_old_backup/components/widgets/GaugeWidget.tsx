import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';

// ─────────────────────────────────────────────────────────────────────────────
// Gauge Widget — Black Hole Accretion Disk Radial Gauge
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  fieldRef: string;
  title?: string;
}

export function GaugeWidget({ fieldRef, title }: Props) {
  const value = useTelemetryStore(s => s.latestValues[fieldRef] ?? null);
  const fieldDef = sensorRegistry.getField(fieldRef);
  const label = title ?? fieldDef?.label ?? fieldRef;
  const unit = fieldDef?.unit ?? '';
  const min = fieldDef?.min ?? 0;
  const max = fieldDef?.max ?? 100;
  const precision = fieldDef?.precision ?? 1;

  const pct = value !== null ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  const fillStyle = pct > 90 ? '#ef4444' : 'url(#accretionDiskGradient)';

  const data = [{ name: label, value: pct, fill: fillStyle }];

  return (
    <div className="h-full flex flex-col items-center justify-center p-3 bg-transparent">
      <div className="w-full flex-1 min-h-0 relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="68%"
            outerRadius="100%"
            data={data}
            startAngle={180}
            endAngle={0}
          >
            <defs>
              <linearGradient id="accretionDiskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#ff6b00" />
                <stop offset="100%" stopColor="#c026d3" />
              </linearGradient>
            </defs>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: 'rgba(124, 58, 237, 0.12)' }}
              dataKey="value"
              angleAxisId={0}
              cornerRadius={6}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center -mt-4 pb-1 z-10">
        {value !== null ? (
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-bold tracking-tight text-white tabular-nums drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]">
              {value.toFixed(precision)}
            </span>
            <span className="text-white/40 text-xs font-medium">{unit}</span>
          </div>
        ) : (
          <span className="text-white/20 text-xl font-bold">—</span>
        )}
        <p className="text-[#c026d3]/80 text-[10px] font-semibold mt-0.5 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
