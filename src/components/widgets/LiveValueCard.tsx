import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';
import { formatDistanceToNow } from 'date-fns';
import type { FieldSample } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Live Value Card Widget
// Displays the latest numeric value for a single telemetry field.
// Never shows a fabricated value — shows "awaiting data" if no reading.
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
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-blue-400' : 'text-slate-500';

  const valueColor = alertState === 'critical' ? 'text-red-400'
    : alertState === 'warning' ? 'text-amber-400'
    : 'bg-gradient-to-r from-violet-200 to-fuchsia-300 bg-clip-text text-transparent';

  const cardBorder = alertState === 'critical' ? 'border-red-500/40'
    : alertState === 'warning' ? 'border-amber-500/40'
    : 'border-slate-700/50';

  const formattedValue = value !== null
    ? value.toFixed(precision)
    : null;

  return (
    <div className={`h-full flex flex-col px-4 pb-4 pt-1 relative overflow-hidden`}>
      {/* Background shimmer for active data */}
      {value !== null && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/5 pointer-events-none" />
      )}

      <div className="flex items-start justify-between mb-auto">
        <div>
          <p className="text-slate-500 text-[10px] font-medium uppercase tracking-[0.25em]">{displayTitle}</p>
          {alertState !== 'none' && (
            <div className="flex items-center gap-1 mt-0.5">
              <AlertTriangle size={10} className={alertState === 'critical' ? 'text-red-400' : 'text-amber-400'} />
              <span className={`text-xs ${alertState === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                {alertState === 'critical' ? 'Critical' : 'Warning'}
              </span>
            </div>
          )}
        </div>
        <TrendIcon size={14} className={trendColor} />
      </div>

      <div className="flex items-end gap-2 mt-3">
        {formattedValue !== null ? (
          <>
            <span className={`font-bold tabular-nums leading-none ${compact ? 'text-3xl' : 'text-5xl'} ${valueColor}`}>
              {formattedValue}
            </span>
            <span className="text-slate-400 text-base mb-1">{unit}</span>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-slate-600 text-2xl font-bold">—</span>
            <span className="text-slate-600 text-xs">Awaiting telemetry</span>
          </div>
        )}
      </div>

      {timestamp && (
        <div className="flex items-center gap-1 mt-2 text-slate-600 text-xs">
          <Clock size={10} />
          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
        </div>
      )}

      {/* Range indicator bar */}
      {fieldDef?.min !== undefined && fieldDef.max !== undefined && value !== null && (
        <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              alertState === 'critical' ? 'bg-red-500'
              : alertState === 'warning' ? 'bg-amber-500'
              : 'bg-gradient-to-r from-violet-500 to-fuchsia-400'
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
