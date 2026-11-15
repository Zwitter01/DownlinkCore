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
// Widget Renderer — Black Hole Singularity + Apple Liquid Glass Card
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
          <div className="h-full flex items-center justify-center text-white/40 text-sm">
            Unknown widget type: {widget.type}
          </div>
        );
    }
  };

  return (
    <div
      className="h-full flex flex-col rounded-[20px] overflow-hidden group transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(124,58,237,0.04) 100%)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.05)',
      }}
    >
      {/* Widget title bar */}
      <div className={`widget-drag-handle flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] shrink-0 select-none bg-black/20 ${isEditing ? 'cursor-grab active:cursor-grabbing bg-[#c026d3]/5' : ''}`}>
        <span className="text-white/85 text-xs font-semibold tracking-tight truncate flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c026d3]/60 shrink-0" />
          {widget.title}
        </span>
        {isEditing && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setShowEdit(true)}
              className="p-1 text-white/40 hover:text-[#c026d3] hover:bg-[#c026d3]/15 rounded-lg transition-all duration-200"
              onMouseDown={e => e.stopPropagation()}
              title="Settings"
            >
              <Settings size={12} />
            </button>
            <button
              onClick={() => duplicateWidget(widget.id)}
              className="p-1 text-white/40 hover:text-white hover:bg-white/[0.08] rounded-lg transition-all duration-200"
              onMouseDown={e => e.stopPropagation()}
              title="Duplicate"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => removeWidget(widget.id)}
              className="p-1 text-white/40 hover:text-[#FF453A] hover:bg-[#FF453A]/15 rounded-lg transition-all duration-200"
              onMouseDown={e => e.stopPropagation()}
              title="Remove"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Widget content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {renderContent()}
      </div>

      {showEdit && (
        <WidgetEditModal widget={widget} onClose={() => setShowEdit(false)} />
      )}
    </div>
  );
}
