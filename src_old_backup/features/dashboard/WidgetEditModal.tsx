import { useState } from 'react';
import { X, Sparkles, Sliders } from 'lucide-react';
import type { WidgetConfig, TimeRange } from '../../types/telemetry';
import { useDashboardStore } from '../../stores/dashboardStore';
import { sensorRegistry } from '../sensors/registry';

interface Props {
  widget: WidgetConfig;
  onClose: () => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '6h', label: '6 hours' },
];

export function WidgetEditModal({ widget, onClose }: Props) {
  const updateWidget = useDashboardStore(s => s.updateWidget);
  const [title, setTitle] = useState(widget.title);
  const [timeRange, setTimeRange] = useState<TimeRange>(widget.timeRange);
  const [autoScale, setAutoScale] = useState(widget.autoScale);
  const [showGrid, setShowGrid] = useState(widget.showGrid ?? true);
  const [showLegend, setShowLegend] = useState(widget.showLegend ?? false);
  const [smoothing, setSmoothing] = useState(widget.smoothing ?? false);
  const [color, setColor] = useState(widget.color ?? '#c026d3');

  const handleSave = () => {
    updateWidget(widget.id, { title, timeRange, autoScale, showGrid, showLegend, smoothing, color });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative overflow-hidden rounded-3xl p-6 w-full max-w-md text-white select-none transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(22, 14, 38, 0.90) 0%, rgba(8, 6, 18, 0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(190%)',
          WebkitBackdropFilter: 'blur(40px) saturate(190%)',
          border: '1px solid rgba(192, 38, 211, 0.28)',
          boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.15), 0 24px 60px -12px rgba(0, 0, 0, 0.85), 0 0 40px -10px rgba(192, 38, 211, 0.28)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Accretion glow orb */}
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-fuchsia-600/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 shadow-[0_0_12px_rgba(192,38,211,0.3)]">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold bg-gradient-to-r from-fuchsia-300 via-violet-200 to-indigo-200 bg-clip-text text-transparent">
                Edit Telemetry Widget
              </h3>
              <p className="text-[11px] text-violet-300/60 font-mono tracking-wider">PARAMETERS & VISUALIZATION</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4 relative z-10">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Widget Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-black/50 border border-fuchsia-500/20 text-white placeholder-slate-500 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-fuchsia-400/60 focus:ring-1 focus:ring-fuchsia-500/30 transition-all font-medium"
            />
          </div>

          {widget.fields.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Subscribed Telemetry Fields</label>
              <div className="space-y-1.5">
                {widget.fields.map(f => {
                  const fd = sensorRegistry.getField(f);
                  return (
                    <div
                      key={f}
                      className="flex items-center justify-between text-xs bg-black/40 border border-violet-500/20 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]" />
                        <span className="text-slate-200 font-medium">{fd?.label ?? f}</span>
                      </div>
                      <span className="text-violet-400/70 font-mono text-[11px]">{fd?.unit ?? 'raw'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Temporal Range</label>
            <select
              value={timeRange}
              onChange={e => setTimeRange(e.target.value as TimeRange)}
              className="w-full bg-black/50 border border-fuchsia-500/20 text-white rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-fuchsia-400/60 focus:ring-1 focus:ring-fuchsia-500/30 transition-all"
            >
              {TIME_RANGES.map(r => (
                <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {widget.fields.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Accretion Glow Color</label>
              <div className="flex items-center gap-3 bg-black/40 border border-violet-500/20 rounded-xl p-2">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="h-8 w-12 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="font-mono text-xs text-violet-300 uppercase">{color}</span>
              </div>
            </div>
          )}

          {/* Toggle Switches */}
          <div className="space-y-2.5 pt-1">
            {[
              { key: 'autoScale', label: 'Auto-scale Y Axis', value: autoScale, set: setAutoScale },
              { key: 'showGrid', label: 'Event Horizon Grid', value: showGrid, set: setShowGrid },
              { key: 'showLegend', label: 'Display Series Legend', value: showLegend, set: setShowLegend },
              { key: 'smoothing', label: 'Singularity Smoothing Filter', value: smoothing, set: setSmoothing },
            ].map(({ key, label, value, set }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer p-2 rounded-xl hover:bg-white/5 transition-all">
                <span className="text-xs font-medium text-slate-300">{label}</span>
                <div
                  onClick={() => set(!value)}
                  className={`w-9 h-5 rounded-full transition-all relative ${
                    value
                      ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 shadow-[0_0_12px_rgba(192,38,211,0.6)]'
                      : 'bg-white/10 border border-white/10'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      value ? 'left-4 shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'left-0.5'
                    }`}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 mt-6 relative z-10">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium transition-all text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-fuchsia-500 hover:to-indigo-500 shadow-[0_0_20px_rgba(192,38,211,0.45)] hover:shadow-[0_0_28px_rgba(192,38,211,0.6)] transition-all text-xs flex items-center justify-center gap-1.5"
          >
            <Sparkles size={14} />
            Commit Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
