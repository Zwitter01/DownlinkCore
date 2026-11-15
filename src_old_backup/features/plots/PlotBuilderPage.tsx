import { useState } from 'react';
import { BarChart2, Play, Plus } from 'lucide-react';
import { sensorRegistry } from '../sensors/registry';
import { TimeSeriesChart } from '../../components/widgets/TimeSeriesChart';
import { LiveValueCard } from '../../components/widgets/LiveValueCard';
import { GaugeWidget } from '../../components/widgets/GaugeWidget';
import { CubeSatViewer } from '../../components/widgets/CubeSatViewer';
import { GpsMapWidget } from '../../components/widgets/GpsMapWidget';
import { useDashboardStore } from '../../stores/dashboardStore';
import { nanoid } from '../../stores/utils/nanoid';
import type { ChartType, TimeRange, WidgetConfig, GridItemLayout } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Plot Builder Page — Black Hole Singularity + Apple Liquid Glass
// ─────────────────────────────────────────────────────────────────────────────

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'timeseries', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'value', label: 'Live Value Card' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'cubesat', label: 'CubeSat 3D Orientation' },
  { value: 'map', label: 'GPS Ground Track Map' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: '1m', label: '1 min' },
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
];

const COLORS = ['#c026d3', '#7c3aed', '#f59e0b', '#06b6d4', '#f472b6', '#ef4444'];

export function PlotBuilderPage() {
  const addWidget = useDashboardStore(s => s.addWidget);
  const fields = sensorRegistry.getAllFields();
  const sensors = sensorRegistry.getAllSensors();

  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [chartType, setChartType] = useState<ChartType>('timeseries');
  const [timeRange, setTimeRange] = useState<TimeRange>('5m');
  const [title, setTitle] = useState('');
  const [added, setAdded] = useState(false);

  const grouped = fields.reduce<Record<string, typeof fields>>((acc, f) => {
    acc[f.sensorId] = acc[f.sensorId] ?? [];
    acc[f.sensorId].push(f);
    return acc;
  }, {});

  const toggleField = (ref: string) => {
    if (chartType === 'value' || chartType === 'gauge') {
      setSelectedFields([ref]);
    } else {
      setSelectedFields(p => p.includes(ref) ? p.filter(f => f !== ref) : [...p, ref]);
    }
  };

  const handleAddToDashboard = () => {
    const id = `widget-${nanoid()}`;
    const displayTitle = title || (
      chartType === 'cubesat' ? 'CubeSat Attitude 3D'
      : chartType === 'map' ? 'GPS Ground Track Map'
      : (selectedFields[0] ? sensorRegistry.getField(selectedFields[0])?.label ?? 'Widget' : 'Widget')
    );
    const widget: WidgetConfig = {
      id, type: chartType, title: displayTitle,
      fields: selectedFields, timeRange, autoScale: true,
      showGrid: true, showLegend: selectedFields.length > 1,
    };
    const isLarge = chartType === 'cubesat' || chartType === 'map';
    const isSmall = chartType === 'value' || chartType === 'gauge';
    const gridItem: GridItemLayout = {
      i: id, x: 0, y: 999,
      w: isSmall ? 3 : 6,
      h: isSmall ? 3 : (isLarge ? 5 : 6),
      minW: 2, minH: 2,
    };
    addWidget(widget, gridItem);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const series = selectedFields.map((f, i) => ({
    fieldRef: f,
    color: COLORS[i % COLORS.length],
  }));

  const canAdd = selectedFields.length > 0 || chartType === 'cubesat' || chartType === 'map';

  return (
    <div className="h-full flex bg-transparent">
      {/* Left panel — field picker + config */}
      <div className="w-72 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden bg-black/40 backdrop-blur-xl">
        <div className="p-4 border-b border-white/[0.06]">
          <h1 className="text-sm font-bold tracking-tight heading-gradient flex items-center gap-2">
            <BarChart2 size={16} className="text-[#c026d3]" /> Plot Builder
          </h1>
          <p className="text-white/40 text-xs mt-0.5">Build custom charts from sensor fields</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs text-white/50 mb-1">Chart Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Auto from field…"
              className="w-full liquid-glass-input px-3 py-2 text-xs"
            />
          </div>

          {/* Chart type */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium">Chart Type</label>
            <div className="space-y-1">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.value}
                  onClick={() => {
                    setChartType(ct.value);
                    if (['value','gauge'].includes(ct.value) && selectedFields.length > 1) {
                      setSelectedFields([selectedFields[0]]);
                    }
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                    chartType === ct.value
                      ? 'bg-[#7c3aed]/20 text-[#c026d3] border border-[#c026d3]/40 font-semibold shadow-[0_0_12px_rgba(192,38,211,0.2)]'
                      : 'text-white/50 hover:bg-white/[0.05] hover:text-white border border-transparent'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          {!['value', 'gauge'].includes(chartType) && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium">Time Range</label>
              <div className="flex flex-wrap gap-1">
                {TIME_RANGES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setTimeRange(r.value)}
                    className={`px-2.5 py-1 rounded-xl text-xs transition-all ${
                      timeRange === r.value
                        ? 'bg-gradient-to-r from-[#7c3aed] to-[#c026d3] text-white shadow-sm font-medium'
                        : 'bg-white/[0.04] text-white/50 border border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Field picker */}
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium">
              Fields {(chartType === 'value' || chartType === 'gauge') ? '(single)' : '(multi)'}
            </label>
            {fields.length === 0 ? (
              <div className="text-xs text-white/40 italic border border-dashed border-white/10 rounded-xl px-3 py-4 text-center">
                No fields. Configure sensors first.
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(grouped).map(([sensorId, sensorFields]) => {
                  const sensor = sensors.find(s => s.sensorId === sensorId);
                  return (
                    <div key={sensorId}>
                      <p className="text-xs text-[#c026d3]/80 mb-1 font-semibold uppercase tracking-wider">{sensor?.displayName ?? sensorId}</p>
                      {sensorFields.map(({ sensorId: sid, fieldDef }) => {
                        const ref = `${sid}.${fieldDef.fieldKey}`;
                        const selected = selectedFields.includes(ref);
                        const colorIdx = selectedFields.indexOf(ref);
                        return (
                          <button
                            key={ref}
                            onClick={() => toggleField(ref)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                              selected
                                ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                                : 'text-white/50 hover:bg-white/[0.04] hover:text-white border border-transparent'
                            }`}
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_6px_currentColor]"
                              style={{
                                background: selected ? COLORS[colorIdx % COLORS.length] : 'rgba(255,255,255,0.2)',
                                color: selected ? COLORS[colorIdx % COLORS.length] : 'transparent',
                              }}
                            />
                            <span className="flex-1 text-left">{fieldDef.label}</span>
                            <span className="text-white/30 font-mono text-[10px]">{fieldDef.unit}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add to dashboard */}
        <div className="p-4 border-t border-white/[0.06]">
          <button
            onClick={handleAddToDashboard}
            disabled={!canAdd}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              added
                ? 'bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/40 shadow-[0_0_15px_rgba(48,209,88,0.2)]'
                : canAdd
                ? 'liquid-glass-btn-primary'
                : 'bg-white/[0.03] text-white/30 border border-white/[0.06] cursor-not-allowed'
            }`}
          >
            {added ? <><Play size={14} /> Added!</> : <><Plus size={14} /> Add to Dashboard</>}
          </button>
        </div>
      </div>

      {/* Right panel — live preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-2 bg-black/40 backdrop-blur-md">
          <Play size={14} className="text-[#c026d3]" />
          <span className="text-sm text-white/80 font-medium">Live Preview</span>
          {selectedFields.length > 0 && (
            <div className="flex gap-1.5 ml-2">
              {selectedFields.map((f, i) => {
                const fd = sensorRegistry.getField(f);
                return (
                  <span
                    key={f}
                    className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/80 backdrop-blur-md"
                    style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}
                  >
                    {fd?.label ?? f}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 p-5 overflow-auto">
          {selectedFields.length === 0 && chartType !== 'cubesat' && chartType !== 'map' ? (
            <div className="h-full flex flex-col items-center justify-center text-white/30 gap-3">
              <BarChart2 size={48} className="opacity-20 text-[#c026d3]" />
              <p className="text-sm">Select fields from the left panel to preview</p>
            </div>
          ) : (
            <div className="h-full">
              {chartType === 'cubesat' && (
                <div className="h-full min-h-[350px] liquid-glass-card p-1">
                  <CubeSatViewer title={title || 'CubeSat Attitude 3D'} />
                </div>
              )}
              {chartType === 'map' && (
                <div className="h-full min-h-[350px] liquid-glass-card p-1">
                  <GpsMapWidget title={title || 'GPS Ground Track Map'} />
                </div>
              )}
              {chartType === 'value' && (
                <div className="max-w-xs h-40 liquid-glass-card">
                  <LiveValueCard fieldRef={selectedFields[0]} title={title} />
                </div>
              )}
              {chartType === 'gauge' && (
                <div className="max-w-xs h-64 liquid-glass-card">
                  <GaugeWidget fieldRef={selectedFields[0]} title={title} />
                </div>
              )}
              {['timeseries', 'area', 'bar'].includes(chartType) && (
                <div className="h-full min-h-[350px] liquid-glass-card p-2">
                  <TimeSeriesChart
                    series={series}
                    title={title}
                    chartType={chartType as 'timeseries' | 'area' | 'bar'}
                    timeRange={timeRange}
                    autoScale={true}
                    showGrid={true}
                    showLegend={selectedFields.length > 1}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
