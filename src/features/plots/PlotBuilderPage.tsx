import { useState, useEffect, useRef } from 'react';
import { BarChart2, Play, Plus } from 'lucide-react';
import { sensorRegistry } from '../sensors/registry';
import { TimeSeriesChart, CHART_COLORS } from '../../components/widgets/TimeSeriesChart';
import { LiveValueCard } from '../../components/widgets/LiveValueCard';
import { GaugeWidget } from '../../components/widgets/GaugeWidget';
import { CubeSatViewer } from '../../components/widgets/CubeSatViewer';
import { GpsMapWidget } from '../../components/widgets/GpsMapWidget';
import { useDashboardStore } from '../../stores/dashboardStore';
import { nanoid } from '../../stores/utils/nanoid';
import type { ChartType, TimeRange, WidgetConfig, GridItemLayout } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Plot Builder Page
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

const COLORS = CHART_COLORS;

export function PlotBuilderPage() {
  const addWidget = useDashboardStore(s => s.addWidget);
  const fields = sensorRegistry.getAllFields();
  const sensors = sensorRegistry.getAllSensors();

  // Default to BMP280 Temperature so a live chart displays immediately!
  const [selectedFields, setSelectedFields] = useState<string[]>(['bmp280.temperature']);
  const [chartType, setChartType] = useState<ChartType>('timeseries');
  const [timeRange, setTimeRange] = useState<TimeRange>('live');
  const [title, setTitle] = useState('');
  const [added, setAdded] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

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
    if (!canAdd) return;
    const dashboard = useDashboardStore.getState();
    const active = dashboard.layouts.find(layout => layout.id === dashboard.activeLayoutId);
    if (!active) return;
    const id = `widget-${nanoid()}`;
    const displayTitle = title.trim() || (
      chartType === 'cubesat' ? 'CubeSat Attitude 3D'
      : chartType === 'map' ? 'GPS Ground Track Map'
      : (selectedFields[0] ? sensorRegistry.getField(selectedFields[0])?.label ?? 'Widget' : 'Widget')
    );
    const widget: WidgetConfig = {
      id, type: chartType, title: displayTitle,
      fields: chartType === 'cubesat' ? ['mpu6050.roll', 'mpu6050.pitch']
        : chartType === 'map' ? ['gps.latitude', 'gps.longitude', 'gps.altitude'] : selectedFields,
      timeRange, autoScale: true,
      showGrid: true, showLegend: selectedFields.length > 1,
    };
    const isLarge = chartType === 'cubesat' || chartType === 'map';
    const isSmall = chartType === 'value' || chartType === 'gauge';
    const gridItem: GridItemLayout = {
      i: id, x: 0, y: active.gridLayout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0),
      w: isSmall ? 3 : 6,
      h: isSmall ? 3 : (isLarge ? 5 : 6),
      minW: 2, minH: 2,
    };
    addWidget(widget, gridItem);
    setAdded(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setAdded(false), 2000);
  };

  const series = selectedFields.map((f, i) => ({
    fieldRef: f,
    color: COLORS[i % COLORS.length],
  }));

  const canAdd = selectedFields.length > 0 || chartType === 'cubesat' || chartType === 'map';

  return (
    <div className="h-full flex">
      {/* Left panel — field picker + config */}
      <div className="w-72 shrink-0 border-r border-slate-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart2 size={15} className="text-cyan-400" /> Plot Builder
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">Build custom charts from sensor fields</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* 1. Field picker — placed first so user can choose what to plot! */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-200">
                1. Sensor Fields {(chartType === 'value' || chartType === 'gauge') ? '(single)' : '(multi)'}
              </label>
              <span className="text-[10px] text-cyan-400 font-mono">
                {selectedFields.length} selected
              </span>
            </div>
            {fields.length === 0 ? (
              <div className="text-xs text-slate-600 italic border border-dashed border-slate-700 rounded-lg px-3 py-4 text-center">
                No fields. Configure sensors first.
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([sensorId, sensorFields]) => {
                  const sensor = sensors.find(s => s.sensorId === sensorId);
                  return (
                    <div key={sensorId} className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                      <p className="text-[11px] text-cyan-400 mb-1.5 font-bold uppercase tracking-wide">{sensor?.displayName ?? sensorId}</p>
                      <div className="space-y-1">
                        {sensorFields.map(({ sensorId: sid, fieldDef }) => {
                          const ref = `${sid}.${fieldDef.fieldKey}`;
                          const selected = selectedFields.includes(ref);
                          const colorIdx = selectedFields.indexOf(ref);
                          return (
                            <button key={ref} onClick={() => toggleField(ref)}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${selected ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-medium' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200 border border-transparent'}`}>
                              <div className="w-2 h-2 rounded-full shrink-0" style={{
                                background: selected ? COLORS[colorIdx % COLORS.length] : '#475569'
                              }} />
                              <span className="flex-1 text-left">{fieldDef.label}</span>
                              <span className="text-[10px] font-mono text-slate-500">{fieldDef.unit}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Chart type */}
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1.5">2. Chart Type</label>
            <div className="grid grid-cols-2 gap-1">
              {CHART_TYPES.map(ct => (
                <button key={ct.value} onClick={() => { setChartType(ct.value); if (['value','gauge'].includes(ct.value) && selectedFields.length > 1) setSelectedFields([selectedFields[0]]); }}
                  className={`text-left px-2 py-1.5 rounded-lg text-xs transition-all truncate ${chartType === ct.value ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-medium' : 'text-slate-400 hover:bg-slate-800/60 border border-slate-800'}`}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Time range */}
          {!['value', 'gauge'].includes(chartType) && (
            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">3. Time Window</label>
              <div className="flex flex-wrap gap-1">
                {TIME_RANGES.map(r => (
                  <button key={r.value} onClick={() => setTimeRange(r.value)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-all ${timeRange === r.value ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800/60 text-slate-400 border border-slate-700/30 hover:border-slate-600'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Title (optional) */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Chart Title (Optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Auto from selected field…"
              className="w-full bg-slate-800/60 border border-slate-700/50 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        {/* Add to dashboard */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleAddToDashboard}
            disabled={!canAdd}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              added ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : canAdd ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {added ? <><Play size={14} /> Added!</> : <><Plus size={14} /> Add to Dashboard</>}
          </button>
        </div>
      </div>

      {/* Right panel — live preview */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
          <Play size={14} className="text-cyan-400" />
          <span className="text-sm text-slate-300 font-medium">Live Preview</span>
          {selectedFields.length > 0 && (
            <div className="flex flex-wrap gap-1.5 ml-2">
              {selectedFields.map((f, i) => {
                const fd = sensorRegistry.getField(f);
                return (
                  <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300" style={{ borderLeft: `3px solid ${COLORS[i % COLORS.length]}` }}>
                    {fd?.label ?? f}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {selectedFields.length === 0 && chartType !== 'cubesat' && chartType !== 'map' ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 p-6 text-center">
              <BarChart2 size={44} className="text-cyan-400/40 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-slate-200">No Sensor Fields Selected</p>
                <p className="text-xs text-slate-400 mt-1">Click a quick preset below or choose fields from the left panel to plot live telemetry:</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                <button onClick={() => setSelectedFields(['bmp280.temperature'])} className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition-all cursor-pointer">
                  🌡️ Temperature (°C)
                </button>
                <button onClick={() => setSelectedFields(['bmp280.pressure'])} className="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-xs font-mono transition-all cursor-pointer">
                  💨 Pressure (hPa)
                </button>
                <button onClick={() => setSelectedFields(['bmp280.altitude'])} className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-mono transition-all cursor-pointer">
                  📐 Altitude (m)
                </button>
                <button onClick={() => setSelectedFields(['mpu6050.roll', 'mpu6050.pitch'])} className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-xs font-mono transition-all cursor-pointer">
                  🔄 Roll & Pitch
                </button>
                <button onClick={() => setSelectedFields(['dht11.humidity'])} className="px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-xs font-mono transition-all cursor-pointer">
                  💧 Humidity (%)
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full">
              {chartType === 'cubesat' && (
                <div className="h-full min-h-[300px]">
                  <CubeSatViewer title={title || 'CubeSat Attitude 3D'} />
                </div>
              )}
              {chartType === 'map' && (
                <div className="h-full min-h-[300px]">
                  <GpsMapWidget title={title || 'GPS Ground Track Map'} />
                </div>
              )}
              {chartType === 'value' && (
                <div className="max-w-xs h-64">
                  <LiveValueCard fieldRef={selectedFields[0]} title={title.trim() || undefined} />
                </div>
              )}
              {chartType === 'gauge' && (
                <div className="max-w-xs h-64">
                  <GaugeWidget fieldRef={selectedFields[0]} title={title.trim() || undefined} />
                </div>
              )}
              {['timeseries', 'area', 'bar'].includes(chartType) && (
                <TimeSeriesChart
                  series={series}
                  title={title}
                  chartType={chartType as 'timeseries' | 'area' | 'bar'}
                  timeRange={timeRange}
                  autoScale={true}
                  showGrid={true}
                  showLegend={selectedFields.length > 1}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
