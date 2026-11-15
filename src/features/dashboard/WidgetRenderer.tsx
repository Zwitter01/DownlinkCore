import { useState } from 'react';
import { Settings, X, Copy } from 'lucide-react';
import type { WidgetConfig } from '../../types/telemetry';
import { useDashboardStore } from '../../stores/dashboardStore';
import { LiveValueCard } from '../../components/widgets/LiveValueCard';
import { TimeSeriesChart } from '../../components/widgets/TimeSeriesChart';
import { GaugeWidget } from '../../components/widgets/GaugeWidget';
import { ConnectionStatusWidget } from '../../components/widgets/ConnectionStatusWidget';
import { CubeSatViewer } from '../../components/widgets/CubeSatViewer';
import { GpsMapWidget } from '../../components/widgets/GpsMapWidget';
import { WidgetEditModal } from './WidgetEditModal';

// ─────────────────────────────────────────────────────────────────────────────
// Widget Renderer — maps WidgetConfig to the correct widget component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  widget: WidgetConfig;
  isEditing: boolean;
}

export function WidgetRenderer({ widget, isEditing }: Props) {
  const removeWidget = useDashboardStore(s => s.removeWidget);
  const duplicateWidget = useDashboardStore(s => s.duplicateWidget);
  const [showEdit, setShowEdit] = useState(false);

  const series = widget.fields.map((f, i) => ({
    fieldRef: f,
    color: widget.color && i === 0 ? widget.color : undefined,
  }));

  const renderContent = () => {
    if (widget.type === 'cubesat') {
      return <CubeSatViewer title={widget.title} />;
    }

    if (widget.type === 'map') {
      return <GpsMapWidget title={widget.title} />;
    }

    // Connection status widget has no fields
    if (widget.fields.length === 0) {
      return <ConnectionStatusWidget />;
    }

    switch (widget.type) {
      case 'value':
        return (
          <LiveValueCard
            fieldRef={widget.fields[0]}
            title={widget.title}
          />
        );
      case 'gauge':
        return (
          <GaugeWidget
            fieldRef={widget.fields[0]}
            title={widget.title}
          />
        );
      case 'timeseries':
        return (
          <TimeSeriesChart
            series={series}
            title={widget.title}
            chartType="timeseries"
            timeRange={widget.timeRange}
            autoScale={widget.autoScale}
            yMin={widget.yMin}
            yMax={widget.yMax}
            showGrid={widget.showGrid ?? true}
            showLegend={widget.showLegend ?? false}
            smoothing={widget.smoothing ?? false}
          />
        );
      case 'area':
        return (
          <TimeSeriesChart
            series={series}
            title={widget.title}
            chartType="area"
            timeRange={widget.timeRange}
            autoScale={widget.autoScale}
            yMin={widget.yMin}
            yMax={widget.yMax}
            showGrid={widget.showGrid ?? true}
            showLegend={widget.showLegend ?? false}
            smoothing={widget.smoothing ?? false}
          />
        );
      case 'bar':
        return (
          <TimeSeriesChart
            series={series}
            title={widget.title}
            chartType="bar"
            timeRange={widget.timeRange}
            autoScale={widget.autoScale}
            showGrid={widget.showGrid ?? true}
          />
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
            Unknown widget type: {widget.type}
          </div>
        );
    }
  };

  return (
    <div className={`group/w relative h-full flex flex-col rounded-2xl border bg-white/[0.04] backdrop-blur-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-[0_18px_50px_-20px_rgba(168,85,247,.7)] ${isEditing ? 'border-dashed border-amber-400/40' : 'border-white/10'}`}>
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/60 to-transparent opacity-0 transition-opacity group-hover/w:opacity-100" />
      {/* Widget title bar */}
      <div className={`widget-drag-handle flex items-center justify-between px-4 py-2 shrink-0 ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        <span className="flex items-center gap-2 text-slate-300 text-[11px] font-medium uppercase tracking-[0.18em] truncate">
          <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_8px_2px_rgba(217,70,239,.7)]" />{widget.title}
        </span>
        {isEditing && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setShowEdit(true)}
              className="p-0.5 text-slate-500 hover:text-slate-300 transition-all"
              onMouseDown={e => e.stopPropagation()}
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => duplicateWidget(widget.id)}
              className="p-0.5 text-slate-500 hover:text-slate-300 transition-all"
              onMouseDown={e => e.stopPropagation()}
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => removeWidget(widget.id)}
              className="p-0.5 text-slate-500 hover:text-red-400 transition-all"
              onMouseDown={e => e.stopPropagation()}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Widget content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {renderContent()}
      </div>

      {showEdit && (
        <WidgetEditModal widget={widget} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
