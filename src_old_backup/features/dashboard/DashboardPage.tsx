import { useCallback, useState, useRef, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Plus, Edit3, RotateCcw, LayoutGrid, ChevronDown, Check, Satellite } from 'lucide-react';
import { useDashboardStore, selectActiveLayout } from '../../stores/dashboardStore';
import { useMissionStore } from '../../stores/missionStore';
import { WidgetRenderer } from './WidgetRenderer';
import { AddWidgetModal } from './AddWidgetModal';
import type { GridItemLayout } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Page — Black Hole Singularity + Apple Liquid Glass
// ─────────────────────────────────────────────────────────────────────────────

const COLS = 12;
const ROW_HEIGHT = 60;

interface RGLItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export function DashboardPage() {
  const store = useDashboardStore();
  const activeLayout = useDashboardStore(selectActiveLayout);
  const configuredSensorIds = useMissionStore(s => s.configuredSensorIds);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [newLayoutName, setNewLayoutName] = useState('');

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(1200);

  useEffect(() => {
    if (!gridContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50) {
          setGridWidth(Math.floor(entry.contentRect.width - 24));
        }
      }
    });
    observer.observe(gridContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLayoutChange = useCallback(
    (layout: RGLItem[]) => {
      if (!activeLayout) return;
      const updated: GridItemLayout[] = layout.map(item => {
        const existing = activeLayout.gridLayout.find(g => g.i === item.i);
        return {
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: existing?.minW,
          minH: existing?.minH,
        };
      });
      store.updateGridLayout(activeLayout.id, updated);
    },
    [activeLayout, store]
  );

  if (!activeLayout) {
    return (
      <div className="h-full flex items-center justify-center text-white/40">
        <div className="text-center p-8 liquid-glass-card">
          <LayoutGrid size={40} className="mx-auto mb-3 opacity-40 text-[#c026d3]" />
          <p className="text-sm font-medium">No layout found. Reload to initialize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* VYOMAASTRA Large Header Banner on Main Dashboard */}
      <div
        className="px-6 py-3.5 border-b border-white/[0.08] shrink-0 flex flex-wrap items-center justify-between gap-4 z-10"
        style={{
          background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.15) 0%, rgba(192, 38, 211, 0.08) 35%, rgba(0, 0, 0, 0.6) 100%)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div className="flex items-center gap-3.5">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7c3aed]/40 to-[#c026d3]/30 border border-[#c026d3]/50 flex items-center justify-center shrink-0 shadow-[0_0_28px_rgba(192,38,211,0.45)]">
            <Satellite size={24} className="text-[#c026d3] animate-accretion-spin" />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#30D158] border-2 border-black shadow-[0_0_8px_#30D158]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black tracking-widest heading-singularity uppercase">
                VYOMAASTRA
              </h1>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#c026d3]/20 border border-[#c026d3]/40 text-[#f0abfc] shadow-[0_0_14px_rgba(192,38,211,0.3)]">
                CUBESAT MISSION CONTROL
              </span>
            </div>
            <p className="text-white/50 text-xs font-mono tracking-wider mt-0.5">
              ORBITAL TELEMETRY · AEROSPACE PROPULSION & SENSOR DYNAMICS
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="hidden lg:flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white/80 flex items-center gap-2 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-[#30D158] animate-pulse" />
            <span>FLIGHT READY</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white/80">
            SYS: <strong className="text-white">ONLINE</strong>
          </div>
        </div>
      </div>

      {/* Liquid Glass Toolbar */}
      <div
        className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.06] shrink-0 z-20"
        style={{
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Layout selector */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutMenu(m => !m)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-white/90 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] rounded-xl text-sm transition-all duration-300 font-medium backdrop-blur-md shadow-sm"
          >
            <LayoutGrid size={13} className="text-[#c026d3]" />
            <span>{activeLayout.name}</span>
            <ChevronDown size={12} className="text-white/40" />
          </button>
          {showLayoutMenu && (
            <div
              className="absolute top-full left-0 mt-2 rounded-2xl shadow-2xl z-30 w-60 overflow-hidden p-1.5 animate-scale-in"
              style={{
                background: 'rgba(10, 0, 24, 0.95)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 40px rgba(124, 58, 237, 0.15)',
              }}
            >
              <div className="space-y-0.5">
                {store.layouts.map(l => (
                  <button
                    key={l.id}
                    onClick={() => { store.setActiveLayout(l.id); setShowLayoutMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-all duration-200 flex items-center justify-between ${
                      l.id === activeLayout.id
                        ? 'bg-gradient-to-r from-[#7c3aed] to-[#c026d3] text-white font-medium shadow-md shadow-[#7c3aed]/30'
                        : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{l.name}</span>
                    <div className="flex items-center gap-1">
                      {l.isDefault && <span className="text-[10px] text-white/50">(default)</span>}
                      {l.id === activeLayout.id && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-white/[0.08] mt-1.5 pt-1.5 px-1 pb-0.5">
                <div className="flex gap-1.5">
                  <input
                    value={newLayoutName}
                    onChange={e => setNewLayoutName(e.target.value)}
                    placeholder="New layout name…"
                    className="flex-1 text-xs liquid-glass-input px-2.5 py-1.5 text-white"
                    onKeyDown={e => { if (e.key === 'Enter' && newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                  />
                  <button
                    onClick={() => { if (newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                    className="px-3 py-1.5 liquid-glass-btn-primary text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowAddWidget(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 liquid-glass-btn-primary text-sm font-semibold transition-all duration-300"
        >
          <Plus size={13} /> Add Widget
        </button>

        <button
          onClick={() => store.setEditing(!store.isEditing)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-xl text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            store.isEditing
              ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'border-white/[0.1] bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.1] backdrop-blur-md'
          }`}
        >
          <Edit3 size={13} /> {store.isEditing ? 'Editing…' : 'Edit Layout'}
        </button>

        <button
          onClick={() => store.resetToDefault(configuredSensorIds)}
          className="p-2 text-white/40 hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/10 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          title="Reset to default layout"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {store.isEditing && (
        <div className="px-5 py-2 bg-[#f59e0b]/10 border-b border-[#f59e0b]/25 text-[#f59e0b] text-xs font-medium shrink-0 flex items-center justify-between backdrop-blur-md">
          <span>Edit mode active — drag widgets from headers to rearrange, resize from corner handles, configure with ⚙.</span>
        </div>
      )}

      {/* Grid */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto p-4">
        <GridLayout
          className="layout"
          layout={activeLayout.gridLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={gridWidth}
          isDraggable={store.isEditing}
          isResizable={store.isEditing}
          onLayoutChange={handleLayoutChange as (layout: ReactGridLayoutItem[]) => void}
          draggableHandle=".widget-drag-handle"
          margin={[14, 14]}
          useCSSTransforms={true}
        >
          {activeLayout.widgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              <WidgetRenderer widget={widget} isEditing={store.isEditing} />
            </div>
          ))}
        </GridLayout>

        {activeLayout.widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-72 text-white/40 gap-3.5 liquid-glass-card p-8 border-dashed border-white/20">
            <LayoutGrid size={40} className="opacity-40 text-[#c026d3]" />
            <p className="text-sm font-medium text-white/70">No widgets in this layout</p>
            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-2 px-4 py-2 liquid-glass-btn-primary text-sm font-semibold transition-all duration-300"
            >
              <Plus size={14} /> Add your first widget
            </button>
          </div>
        )}
      </div>

      {showAddWidget && <AddWidgetModal onClose={() => setShowAddWidget(false)} />}
    </div>
  );
}

type ReactGridLayoutItem = RGLItem;
