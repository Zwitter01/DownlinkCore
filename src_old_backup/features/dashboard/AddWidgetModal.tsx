import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { sensorRegistry } from '../sensors/registry';
import { useDashboardStore } from '../../stores/dashboardStore';
import { nanoid } from '../../stores/utils/nanoid';
import type { WidgetConfig, GridItemLayout, ChartType, TimeRange } from '../../types/telemetry';

interface Props { onClose: () => void; }

const CHART_TYPES: { value: ChartType; label: string; desc: string }[] = [
  { value: 'value', label: 'Live Value', desc: 'Current reading with trend' },
  { value: 'timeseries', label: 'Line Chart', desc: 'Time-series line plot' },
  { value: 'area', label: 'Area Chart', desc: 'Filled area time-series' },
  { value: 'bar', label: 'Bar Chart', desc: 'Bar chart over time' },
  { value: 'gauge', label: 'Gauge', desc: 'Radial gauge' },
  { value: 'cubesat', label: 'CubeSat 3D', desc: 'Real-time 3D attitude viewer' },
  { value: 'map', label: 'GPS Map', desc: 'Geospatial position and ground track' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live (last 5m)' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
];

export function AddWidgetModal({ onClose }: Props) {
  const addWidget = useDashboardStore(s => s.addWidget);
  const fields = sensorRegistry.getAllFields();
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartType>('timeseries');
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [title, setTitle] = useState('');

  const toggleField = (ref: string) => {
    setSelectedFields(prev => {
      if (prev.includes(ref)) return prev.filter(f => f !== ref);
      if (chartType === 'value' || chartType === 'gauge') return [ref];
      return [...prev, ref];
    });
    if (selectedFields.length === 0 && !title) {
      const fieldDef = sensorRegistry.getField(ref);
      if (fieldDef) setTitle(fieldDef.label);
    }
  };

  const handleAdd = () => {
    const id = `widget-${nanoid()}`;
    const fieldTitle = title || (selectedFields.length > 0
      ? (sensorRegistry.getField(selectedFields[0])?.label ?? selectedFields[0])
      : 'Widget');

    const isLarge = chartType === 'cubesat' || chartType === 'map';
    const isSmall = chartType === 'value' || chartType === 'gauge';

    const widget: WidgetConfig = {
      id,
      type: (chartType === 'cubesat' || chartType === 'map') ? chartType : (selectedFields.length === 0 ? 'value' : chartType),
      title: fieldTitle,
      fields: selectedFields,
      timeRange,
      autoScale: true,
      showGrid: true,
      showLegend: selectedFields.length > 1,
    };

    const gridItem: GridItemLayout = {
      i: id,
      x: 0, y: 999,
      w: isSmall ? 3 : (isLarge ? 6 : 6),
      h: isSmall ? 3 : (isLarge ? 5 : 6),
      minW: 2, minH: 2,
    };

    addWidget(widget, gridItem);
    onClose();
  };

  const grouped = fields.reduce<Record<string, typeof fields>>((acc, f) => {
    acc[f.sensorId] = acc[f.sensorId] ?? [];
    acc[f.sensorId].push(f);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md" onClick={onClose}>
      <div
        className="rounded-[24px] p-6 w-full max-w-lg shadow-2xl animate-scale-in"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(124,58,237,0.06) 50%, rgba(0,0,0,0.85) 100%)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 50px rgba(124,58,237,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold tracking-tight text-base heading-gradient">Add Widget</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-all"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Widget Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto from field…"
              className="w-full liquid-glass-input px-3.5 py-2 text-sm"
            />
          </div>

          {/* Chart type */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Visualization Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => setChartType(ct.value)}
                  className={`px-2.5 py-2 rounded-xl text-xs border transition-all ${
                    chartType === ct.value
                      ? 'bg-[#7c3aed]/25 border-[#c026d3]/60 text-[#c026d3] font-semibold shadow-[0_0_12px_rgba(192,38,211,0.2)]'
                      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <div className="font-medium">{ct.label}</div>
                  <div className="text-white/40 text-[10px] mt-0.5 hidden sm:block">{ct.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          {fields.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Telemetry Fields</label>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {Object.entries(grouped).map(([sensorId, sensorFields]) => {
                  const sensor = sensorRegistry.getSensor(sensorId);
                  return (
                    <div key={sensorId}>
                      <p className="text-[11px] text-[#c026d3]/80 px-1 mb-1 font-semibold uppercase tracking-wider">{sensor?.displayName ?? sensorId}</p>
                      {sensorFields.map(({ sensorId: sid, fieldDef }) => {
                        const ref = `${sid}.${fieldDef.fieldKey}`;
                        const selected = selectedFields.includes(ref);
                        return (
                          <button
                            key={ref}
                            onClick={() => toggleField(ref)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm transition-all ${
                              selected
                                ? 'bg-white/[0.08] border border-white/[0.14] text-white'
                                : 'text-white/60 hover:bg-white/[0.04] border border-transparent'
                            }`}
                          >
                            <div className={`w-3.5 h-3.5 rounded-md border shrink-0 flex items-center justify-center ${selected ? 'bg-[#c026d3] border-[#c026d3]' : 'border-white/30'}`}>
                              {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                            <span className="flex-1 text-left text-xs">{fieldDef.label}</span>
                            <span className="text-white/30 font-mono text-[11px]">{fieldDef.unit}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-white/40 text-sm py-4 border border-dashed border-white/10 rounded-xl">
              No sensor fields available. Configure sensors first.
            </div>
          )}

          {/* Time range (for chart types) */}
          {!['value', 'gauge'].includes(chartType) && (
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Time Range</label>
              <select
                value={timeRange}
                onChange={e => setTimeRange(e.target.value as TimeRange)}
                className="w-full liquid-glass-input px-3 py-2 text-sm bg-black/70"
              >
                {TIME_RANGES.map(r => <option key={r.value} value={r.value} className="bg-black text-white">{r.label}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.1] text-white/70 rounded-xl transition-all text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 liquid-glass-btn-primary text-sm font-semibold transition-all"
          >
            <Plus size={14} /> Add Widget
          </button>
        </div>
      </div>
    </div>
  );
}
