import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';
import { formatDistanceToNow } from 'date-fns';
import type { FieldSample } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Live Value Card Widget — Black Hole Singularity + Apple Liquid Glass
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_SAMPLES: FieldSample[] = [];

interface Props {
  fieldRef: string;     // "sensorId.fieldKey"
  title?: string;
  compact?: boolean;
}

export function LiveValueCard({ fieldRef, title, compact = false }: Props) {
  const value = useTelemetryStore(s => s.latestValues[fieldRef] ?? null);
  const timestamp = useTelemetryStore(s => s.latestTimestamps[fieldRef] ?? null);
  const samples = useTelemetryStore(s => s.sampleBuffers[fieldRef] ?? EMPTY_SAMPLES);

  const fieldDef = sensorRegistry.getField(fieldRef);
  const displayTitle = title ?? fieldDef?.label ?? fieldRef;
  const unit = fieldDef?.unit ?? '';
  const precision = fieldDef?.precision ?? 1;

  // Trend: compare last two samples
  let trend = 'neutral';
  if (samples.length >= 2) {
    const last = samples[samples.length - 1].value;
    const prev = samples[samples.length - 2].value;
    const diff = last - prev;
    if (Math.abs(diff) >= 0.01) trend = diff > 0 ? 'up' : 'down';
  }

  // Alert state
  const thresholds = fieldDef?.alertThresholds;
  let alertState = 'none';
  if (value !== null && thresholds) {
    if (
      (thresholds.critical_high !== undefined && value >= thresholds.critical_high)
      || (thresholds.critical_low !== undefined && value <= thresholds.critical_low)
    ) {
      alertState = 'critical';
    } else if (
      (thresholds.high !== undefined && value >= thresholds.high)
      || (thresholds.low !== undefined && value <= thresholds.low)
    ) {
      alertState = 'warning';
    }
  }

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-[#c026d3]' : trend === 'down' ? 'text-[#7c3aed]' : 'text-white/20';

  const valueColor = alertState === 'critical' ? 'text-[#FF453A]'
    : alertState === 'warning' ? 'text-[#FF9F0A]'
    : 'text-white';

  const formattedValue = value !== null
    ? value.toFixed(precision)
    : null;

  return (
    <div className="h-full flex flex-col p-4 bg-transparent relative overflow-hidden transition-all duration-300">
      {/* Background accretion glow when active telemetry data exists */}
      {value !== null && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/[0.08] via-transparent to-[#c026d3]/[0.05] pointer-events-none animate-shimmer-glass" />
      )}

      <div className="flex items-start justify-between mb-auto z-10">
        <div>
          <p className="text-[#c026d3]/80 text-[10px] font-semibold uppercase tracking-wider">{displayTitle}</p>
          {alertState !== 'none' && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle size={11} className={alertState === 'critical' ? 'text-[#FF453A]' : 'text-[#FF9F0A]'} />
              <span className={`text-[11px] font-medium tracking-tight ${alertState === 'critical' ? 'text-[#FF453A]' : 'text-[#FF9F0A]'}`}>
                {alertState === 'critical' ? 'Critical' : 'Warning'}
              </span>
            </div>
          )}
        </div>
        <TrendIcon size={14} className={`${trendColor} shrink-0 mt-0.5 drop-shadow-[0_0_6px_currentColor]`} />
      </div>

      <div className="flex items-end gap-1.5 mt-2 z-10">
        {formattedValue !== null ? (
          <>
            <span className={`font-bold tabular-nums tracking-tight leading-none ${compact ? 'text-2xl' : 'text-3xl'} ${valueColor} drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]`}>
              {formattedValue}
            </span>
            <span className="text-white/40 text-sm mb-0.5 font-medium">{unit}</span>
          </>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-white/20 text-2xl font-bold">—</span>
            <span className="text-white/30 text-[11px] tracking-tight">Awaiting telemetry</span>
          </div>
        )}
      </div>

      {timestamp && (
        <div className="flex items-center gap-1.5 mt-2 text-white/40 text-[11px] font-mono z-10">
          <Clock size={10} className="text-[#c026d3]/60" />
          <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true })}</span>
        </div>
      )}

      {/* Range indicator bar */}
      {fieldDef?.min !== undefined && fieldDef.max !== undefined && value !== null && (
        <div className="mt-2.5 h-1 bg-[#7c3aed]/15 rounded-full overflow-hidden z-10 border border-white/[0.04]">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              alertState === 'critical' ? 'bg-[#FF453A]'
              : alertState === 'warning' ? 'bg-[#FF9F0A]'
              : 'bg-gradient-to-r from-[#ff6b00] via-[#c026d3] to-[#7c3aed]'
            }`}
            style={{
              width: `${Math.min(100, Math.max(0, ((value - fieldDef.min) / (fieldDef.max - fieldDef.min)) * 100))}%`
            }}
          />
        </div>
      )}
    </div>
  );
}
