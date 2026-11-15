import { useEffect, useState } from 'react';
import { useLocation, NavLink, Outlet } from 'react-router-dom';
import {
  Satellite, LayoutDashboard, Radio, BarChart2, Cpu, Database,
  Settings, Wifi, WifiOff, Loader2, AlertTriangle, Clock, Package, Orbit,
} from 'lucide-react';
import { Cosmos } from '../components/Cosmos';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMissionStore } from '../stores/missionStore';
import { sensorRegistry } from '../features/sensors/registry';
import { format } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// App Layout — Header + Sidebar + Content
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Flight Deck', sub: 'Mission overview', exact: true },
  { to: '/orbit', icon: Orbit, label: 'Space Ops', sub: 'Orbital & Weather' },
  { to: '/explorer', icon: Radio, label: 'Deep Space Link', sub: 'Telemetry explorer' },
  { to: '/plots', icon: BarChart2, label: 'Trajectory Plots', sub: 'Plot builder' },
  { to: '/sensors', icon: Cpu, label: 'Instruments', sub: 'Onboard sensors' },
  { to: '/history', icon: Database, label: 'Flight Records', sub: 'Data history' },
  { to: '/settings', icon: Settings, label: 'Systems Config', sub: 'Settings' },
];
function MissionElapsed() {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(v => v + 1), 1000); return () => clearInterval(id); }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  return <span className="font-mono tabular-nums">T+ {p(Math.floor(t / 3600))}:{p(Math.floor(t / 60) % 60)}:{p(t % 60)}</span>;
}

// Floating dock: icons magnify toward the pointer, labels float above.
function Dock({ activeIndex }: { activeIndex: number }) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <div className="liquid-glass pointer-events-auto flex items-end gap-1.5 rounded-[28px] px-3 py-2.5" onMouseLeave={() => setHover(null)}>
        {NAV_ITEMS.map(({ to, icon: Icon, label, sub, exact }, i) => {
          const d = hover === null ? 9 : Math.abs(hover - i);
          const scale = d === 0 ? 1.45 : d === 1 ? 1.2 : d === 2 ? 1.06 : 1;
          const active = i === activeIndex;
          return (
            <NavLink key={to} to={to} end={exact} onMouseEnter={() => setHover(i)} aria-label={label}
              className="group relative flex flex-col items-center" style={{ transform: `scale(${scale}) translateY(${(1 - scale) * 6}px)`, transition: 'transform .22s cubic-bezier(.3,1.5,.5,1)', transformOrigin: 'bottom center' }}>
              <span className={`pointer-events-none absolute -top-12 whitespace-nowrap rounded-xl bg-black/70 px-3 py-1.5 text-center text-xs text-white opacity-0 backdrop-blur-md transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100`}>
                {label}<span className="block text-[9px] uppercase tracking-[0.2em] text-violet-200/60">{sub}</span>
              </span>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-colors duration-300 ${active ? 'border-white/40 bg-gradient-to-br from-violet-400/50 to-fuchsia-500/30 text-white shadow-[0_0_28px_-4px_rgba(192,38,211,.9)]' : 'border-white/10 bg-white/[0.05] text-slate-300 group-hover:text-white'}`}>
                <Icon size={20} />
              </span>
              <span className={`mt-1 h-1 w-1 rounded-full transition-all ${active ? 'bg-amber-300 shadow-[0_0_8px_2px_rgba(252,211,77,.8)]' : 'bg-transparent'}`} />
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}


function ConnectionBadge() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const lastTs = diag.lastTimestamp;

  // Real transmitter downlink check:
  // Receiver is connected to PC (state === 'connected'), BUT transmitter is only considered active
  // when packets have actually been received and the last packet was within 6 seconds!
  const hasTransmitterSignal = state === 'connected' && diag.received > 0 && lastTs !== null && (Date.now() - lastTs < 6000);

  let label = 'Disconnected';
  let color = 'text-red-400';
  let bg = 'bg-red-500/10';
  let dot = 'bg-red-500';
  let Icon = WifiOff;

  if (state === 'connecting') {
    label = 'Connecting Ground Station...';
    color = 'text-cyan-400';
    bg = 'bg-cyan-500/10';
    dot = 'bg-cyan-400 animate-pulse';
    Icon = Loader2;
  } else if (state === 'connected') {
    if (hasTransmitterSignal) {
      label = 'Transmitter Linked';
      color = 'text-emerald-400';
      bg = 'bg-emerald-500/10';
      dot = 'bg-emerald-400 animate-pulse';
      Icon = Wifi;
    } else {
      label = 'Receiver Online (Awaiting Transmitter)';
      color = 'text-amber-400';
      bg = 'bg-amber-500/10';
      dot = 'bg-amber-400 animate-pulse';
      Icon = AlertTriangle;
    }
  } else if (state === 'stale') {
    label = 'Signal Stale';
    color = 'text-amber-400';
    bg = 'bg-amber-500/10';
    dot = 'bg-amber-400';
    Icon = AlertTriangle;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${bg} border border-slate-700/40`}>
      <div className={`w-2 h-2 rounded-full ${dot}`} />
      <Icon size={14} className={`${color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <span className={`text-xs font-medium ${color} hidden sm:block`}>{label}</span>
      {lastTs && hasTransmitterSignal && (
        <span className="text-xs text-slate-500 hidden lg:block">
          · {format(new Date(lastTs), 'HH:mm:ss')}
        </span>
      )}
    </div>
  );
}

function UtcClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono hidden md:flex">
      <Clock size={13} />
      {format(time, 'yyyy-MM-dd HH:mm:ss')} UTC
    </div>
  );
}

function PacketCounter() {
  const received = useTelemetryStore(s => s.diagnostics.received);
  const invalid = useTelemetryStore(s => s.diagnostics.invalid);
  const lastPacketNo = useTelemetryStore(s => s.diagnostics.lastPacketNo);
  return (
    <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
      {lastPacketNo !== null && (
        <span className="text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded text-[11px]">
          PKT #{lastPacketNo}
        </span>
      )}
      <div className="flex items-center gap-1">
        <Package size={13} />
        <span className="text-slate-300">{received.toLocaleString()}</span>
        {invalid > 0 && <span className="text-red-400">/ {invalid} bad</span>}
      </div>
    </div>
  );
}

function SensorIndicators() {
  const configuredIds = useMissionStore(s => s.configuredSensorIds);
  const connState = useTelemetryStore(s => s.connectionState);
  const sensors = sensorRegistry.getAllSensors();

  return (
    <div className="hidden xl:flex items-center gap-1.5">
      {sensors.map(s => {
        const isConfigured = configuredIds.includes(s.sensorId);
        if (!isConfigured) return null;

        const isLive = s.status === 'receiving' && connState === 'connected';
        const isStale = s.status === 'stale' || connState === 'stale';

        const dotColor = isLive ? 'bg-emerald-400 animate-pulse'
          : isStale ? 'bg-amber-400'
          : 'bg-slate-600';

        const textColor = isLive ? 'text-emerald-300'
          : isStale ? 'text-amber-300'
          : 'text-slate-400';

        return (
          <div
            key={s.sensorId}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/70 border border-slate-700/50 text-[11px] font-mono"
            title={`${s.displayName}: ${s.status}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className={textColor}>{s.displayName}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const missionName = useMissionStore(s => s.missionName);
  const activeIndex = NAV_ITEMS.findIndex(n => (n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)));
  const current = NAV_ITEMS[Math.max(0, activeIndex)];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden text-white"
      style={{ background: 'radial-gradient(ellipse at 50% -10%, #1a0b3d 0%, #07051a 55%, #020208 100%)' }}>
      <Cosmos />
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-[120px]" style={{ animation: 'drift 18s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-[120px]" style={{ animation: 'drift 22s ease-in-out infinite reverse' }} />

      {/* Mission HUD: identity | current section | live status */}
      <header className="relative z-30 mx-3 mt-3 grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-4 rounded-full liquid-glass px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0">
            <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #c4b5fd, #5b21b6 55%, #0c0620 100%)', boxShadow: '0 0 16px 2px rgba(168,85,247,.55)' }} />
            <div className="absolute -inset-1 rounded-full border border-dashed border-white/25" style={{ animation: 'orbit 14s linear infinite' }}>
              <Satellite size={10} className="absolute -top-1 left-1/2 -translate-x-1/2 rotate-45 text-amber-300" />
            </div>
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="bg-gradient-to-r from-white via-violet-200 to-amber-300 bg-clip-text text-sm font-semibold tracking-[0.25em] text-transparent">VYOMAASTRA</p>
            <p className="text-[10px] uppercase tracking-[0.25em] text-violet-200/60">{missionName} · <MissionElapsed /></p>
          </div>
        </div>

        <div key={current.to} className="rise flex flex-col items-center leading-tight">
          <span className="text-sm font-medium tracking-[0.3em] text-white">{current.label.toUpperCase()}</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{current.sub}</span>
        </div>

        <div className="flex items-center gap-3">
          <SensorIndicators />
          <UtcClock />
          <PacketCounter />
          <ConnectionBadge />
        </div>
      </header>

      <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-auto pb-28">
        <div key={location.pathname} className={`animate-fade-in ${location.pathname === '/plots' ? 'h-full' : ''}`}>
          <Outlet />
        </div>
      </main>

      <Dock activeIndex={activeIndex} />
    </div>
  );
}
