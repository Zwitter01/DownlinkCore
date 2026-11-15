import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Plus, Edit3, RotateCcw, LayoutGrid, ChevronDown, Thermometer, Compass, Gauge, MapPin } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../sensors/registry';
import { useDashboardStore, selectActiveLayout } from '../../stores/dashboardStore';
import { useMissionStore } from '../../stores/missionStore';
import { WidgetRenderer } from './WidgetRenderer';
import { AddWidgetModal } from './AddWidgetModal';
import type { GridItemLayout } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Page — React Grid Layout with drag-and-drop widgets
// ─────────────────────────────────────────────────────────────────────────────

const COLS = 12;
const ROW_HEIGHT = 60;

/** Minimal shape of what react-grid-layout v1 passes to onLayoutChange */
interface RGLItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}


// ── Mission hero: orbit scope + radial instrument cluster ───────────────────
const VITALS: Record<string, { ref: string; label: string; icon: typeof Gauge; color: string; lo: number; hi: number }> = {
  mpu6050: { ref: 'mpu6050.roll', label: 'Attitude / Roll', icon: Compass, color: '#a78bfa', lo: -180, hi: 180 },
  bmp280: { ref: 'bmp280.pressure', label: 'Ambient Pressure', icon: Gauge, color: '#22d3ee', lo: 300, hi: 1100 },
  dht11: { ref: 'dht11.temperature', label: 'Hull Temperature', icon: Thermometer, color: '#34d399', lo: -20, hi: 60 },
  gps: { ref: 'gps.speed', label: 'Ground Speed', icon: MapPin, color: '#fbbf24', lo: 0, hi: 100 },
};

const R = 42, CIRC = 2 * Math.PI * R, ARC = CIRC * 0.75; // 270deg gauge

function RadialVital({ sensorId }: { sensorId: string }) {
  const v = VITALS[sensorId];
  const value = useTelemetryStore(s => (v ? s.latestValues[v.ref] ?? null : null));
  const connState = useTelemetryStore(s => s.connectionState);
  const isStale = connState === 'stale' || connState === 'disconnected';

  if (!v) return null;
  const def = sensorRegistry.getField(v.ref);
  const lo = def?.min ?? v.lo, hi = def?.max ?? v.hi;
  const f = value === null ? 0 : Math.min(1, Math.max(0, (value - lo) / (hi - lo || 1)));
  const Icon = v.icon;
  return (
    <div className={`liquid-glass group flex items-center gap-4 rounded-[28px] p-4 transition-all duration-300 hover:-translate-y-1 ${isStale ? 'border-amber-500/20' : ''}`}>
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[225deg]">
          <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${ARC} ${CIRC}`} />
          <circle cx="50" cy="50" r={R} fill="none" stroke={isStale ? '#f59e0b' : v.color} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${ARC * f} ${CIRC}`}
            style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${isStale ? '#f59e0b' : v.color})` }} />
        </svg>
        <Icon size={18} className="absolute inset-0 m-auto" style={{ color: isStale ? '#f59e0b' : v.color }} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">{v.label}</p>
          {isStale && (
            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.5 text-[8px] font-mono tracking-widest text-amber-300">
              HELD
            </span>
          )}
        </div>
        <p className="mt-1 text-3xl font-light tabular-nums text-white">
          {value === null ? '--' : value.toFixed(def?.precision ?? 1)}
          <span className="ml-1 text-sm text-slate-400">{def?.unit}</span>
        </p>
      </div>
    </div>
  );
}

function OrbitScope() {
  const name = useMissionStore(s => s.missionName);
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const received = diag.received;
  const lastTs = diag.lastTimestamp;
  const isTransmitterLinked = state === 'connected' && received > 0 && lastTs !== null && (Date.now() - lastTs < 6000);

  return (
    <div className="liquid-glass relative flex min-h-[18rem] flex-col items-center justify-center overflow-hidden rounded-[36px] p-6 text-center">
      {/* planet */}
      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle at 32% 28%, #e9d5ff 0%, #7c3aed 38%, #2e1065 72%, #0c0620 100%)', boxShadow: '0 0 70px 8px rgba(124,58,237,.5), inset -20px -16px 40px rgba(0,0,0,.6)' }} />
      {/* orbits */}
      {[
        { size: '15rem', dur: 18, cw: true, dot: 'bg-amber-300 shadow-[0_0_14px_5px_rgba(252,211,77,.7)]' },
        { size: '19rem', dur: 30, cw: false, dot: 'bg-fuchsia-300 shadow-[0_0_12px_4px_rgba(240,171,252,.7)]' },
      ].map((o, i) => (
        <div key={i} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15"
          style={{ width: o.size, height: o.size, animation: `${o.cw ? 'spin-cw' : 'spin-ccw'} ${o.dur}s linear infinite` }}>
          <span className={`absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${o.dot}`} />
        </div>
      ))}
      <div className="relative z-10 mt-auto w-full pt-48">
        <p className="flex items-center justify-center gap-2 text-[10px] tracking-[0.4em] text-violet-100/80">
          <span className={`h-2 w-2 rounded-full ${isTransmitterLinked ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ animation: 'pulse-core 1.6s infinite' }} />
          {isTransmitterLinked ? 'DOWNLINK ACTIVE' : state === 'connected' ? 'AWAITING TRANSMITTER LINK' : state.toUpperCase()}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-wide">{name}</h1>
        <p className="text-[11px] text-slate-400">Mission control overview</p>
        <p className="mt-0.5 font-mono text-xs text-slate-300/80">{received.toLocaleString()} packets downlinked</p>
      </div>
    </div>
  );
}

function MissionHero() {
  const ids = useMissionStore(s => s.configuredSensorIds);
  return (
    <section className="grid shrink-0 gap-4 px-4 pt-4 lg:grid-cols-2">
      <OrbitScope />
      <div className="grid content-center gap-4 sm:grid-cols-2">
        {ids.map(id => <RadialVital key={id} sensorId={id} />)}
      </div>
    </section>
  );
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
          setGridWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    observer.observe(gridContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const compact = gridWidth < 900;
  const displayLayout = useMemo(() => {
    let nextY = 0;
    return (activeLayout?.gridLayout ?? []).map(item => {
      const widget = activeLayout?.widgets.find(w => w.id === item.i);
      const isConnection = widget?.fields.length === 0;
      const h = isConnection ? Math.max(item.h, 6) : item.h;
      if (!compact) return { ...item, h };
      const result = { ...item, x: 0, y: nextY, w: COLS, h, minW: 1 };
      nextY += h;
      return result;
    });
  }, [activeLayout, compact]);

  const handleLayoutChange = useCallback(
    (layout: RGLItem[]) => {
      // Narrow-screen presentation must not overwrite the user's desktop layout.
      if (!activeLayout || compact || !store.isEditing) return;
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
    [activeLayout, store, compact]
  );

  if (!activeLayout) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <div className="text-center">
          <LayoutGrid size={40} className="mx-auto mb-3 opacity-30" />
          <p>No layout found. Reload to initialize.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page flex min-w-0 flex-col">
      <MissionHero />
      {/* Toolbar */}
      <div className="mx-4 mt-4 flex flex-wrap items-center gap-2 liquid-glass rounded-2xl px-3 py-3 shrink-0">
        {/* Layout selector */}
        <div className="relative">
          <button
            onClick={() => setShowLayoutMenu(m => !m)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 rounded-lg text-sm transition-all"
          >
            <LayoutGrid size={13} />
            {activeLayout.name}
            <ChevronDown size={12} />
          </button>
          {showLayoutMenu && (
            <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-slate-700/50 rounded-xl shadow-xl z-30 w-52 overflow-hidden">
              {store.layouts.map(l => (
                <button
                  key={l.id}
                  onClick={() => { store.setActiveLayout(l.id); setShowLayoutMenu(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-all ${l.id === activeLayout.id ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'}`}
                >
                  {l.name}
                  {l.isDefault && <span className="text-slate-600 text-xs ml-1">(default)</span>}
                </button>
              ))}
              <div className="border-t border-slate-800 p-2">
                <div className="flex gap-1.5">
                  <input
                    value={newLayoutName}
                    onChange={e => setNewLayoutName(e.target.value)}
                    placeholder="New layout name…"
                    className="flex-1 text-xs bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none focus:border-cyan-500/50"
                    onKeyDown={e => { if (e.key === 'Enter' && newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                  />
                  <button
                    onClick={() => { if (newLayoutName) { store.saveLayout(newLayoutName); setNewLayoutName(''); } }}
                    className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30 transition-all"
                  >Save</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setShowAddWidget(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm transition-all"
        >
          <Plus size={13} /> Add Instrument
        </button>

        <button
          onClick={() => store.setEditing(!store.isEditing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-all ${
            store.isEditing
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'border-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Edit3 size={13} /> {store.isEditing ? 'Rearranging…' : 'Rearrange Deck'}
        </button>

        <button
          onClick={() => store.resetToDefault(configuredSensorIds)}
          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded-lg transition-all"
          title="Reset to default layout"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {store.isEditing && (
        <div className="px-4 py-1.5 bg-amber-500/5 border-b border-amber-500/20 text-amber-400/70 text-xs shrink-0">
          {compact ? 'Expand the preview to rearrange the desktop layout.' : 'Rearrange mode — drag to reposition, resize from corners, use settings to configure'}
        </div>
      )}

      {/* Grid */}
      <div className="px-4 pb-8 pt-4">
      <div ref={gridContainerRef} className="min-w-0">
        <GridLayout
          className="layout"
          layout={displayLayout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={gridWidth}
          isDraggable={store.isEditing && !compact}
          isResizable={store.isEditing && !compact}
          onLayoutChange={handleLayoutChange as (layout: ReactGridLayoutItem[]) => void}
          draggableHandle=".widget-drag-handle"
          margin={[16, 16]}
          containerPadding={[0, 0]}
          compactType={null}
          useCSSTransforms={true}
        >
          {activeLayout.widgets.map((widget) => (
            <div key={widget.id} className="overflow-hidden">
              <WidgetRenderer widget={widget} isEditing={store.isEditing} />
            </div>
          ))}
        </GridLayout>

        {activeLayout.widgets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-slate-600 gap-3">
            <LayoutGrid size={40} className="opacity-30" />
            <p className="text-sm">The deck is empty</p>
            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm hover:bg-cyan-500/25 transition-all"
            >
              <Plus size={14} /> Add your first instrument
            </button>
          </div>
        )}
      </div>
      </div>

      {showAddWidget && <AddWidgetModal onClose={() => setShowAddWidget(false)} />}
    </div>
  );
}

// Alias to silence any leftover type alias references
type ReactGridLayoutItem = RGLItem;
