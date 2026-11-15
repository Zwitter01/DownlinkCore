import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Satellite, LayoutDashboard, Radio, BarChart2, Cpu, Database,
  Settings, Wifi, WifiOff, Loader2, AlertTriangle, Clock, Package,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMissionStore } from '../stores/missionStore';
import { sensorRegistry } from '../features/sensors/registry';
import { format } from 'date-fns';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// App Layout â€” Black Hole VYOMAASTRA + Apple Liquid Glass
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/explorer', icon: Radio, label: 'Telemetry Explorer' },
  { to: '/plots', icon: BarChart2, label: 'Plot Builder' },
  { to: '/sensors', icon: Cpu, label: 'Sensors' },
  { to: '/history', icon: Database, label: 'Data History' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

function ConnectionBadge() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const lastTs = diag.lastTimestamp;

  const config = {
    idle:         { icon: Wifi, color: 'text-white/40', bg: 'bg-white/[0.04]', dot: 'bg-white/40', label: 'Idle' },
    connecting:   { icon: Loader2, color: 'text-[#c026d3]', bg: 'bg-[#7c3aed]/10', dot: 'bg-[#c026d3] animate-pulse', label: 'Connecting' },
    connected:    { icon: Wifi, color: 'text-[#c026d3]', bg: 'bg-[#7c3aed]/15', dot: 'bg-[#c026d3] shadow-[0_0_10px_#c026d3] animate-VYOMAASTRA-pulse', label: 'Connected' },
    disconnected: { icon: WifiOff, color: 'text-[#FF453A]', bg: 'bg-[#FF453A]/10', dot: 'bg-[#FF453A]', label: 'Disconnected' },
    stale:        { icon: AlertTriangle, color: 'text-[#FF9F0A]', bg: 'bg-[#FF9F0A]/10', dot: 'bg-[#FF9F0A]', label: 'Stale Data' },
    error:        { icon: WifiOff, color: 'text-[#FF453A]', bg: 'bg-[#FF453A]/10', dot: 'bg-[#FF453A]', label: 'Error' },
  }[state];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${config.bg} border border-white/[0.1] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <Icon size={13} className={`${config.color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <span className={`text-xs font-medium ${config.color} hidden sm:block tracking-tight`}>{config.label}</span>
      {lastTs && state === 'connected' && (
        <span className="text-xs text-white/40 hidden lg:block font-mono">
          Â· {format(new Date(lastTs), 'HH:mm:ss')}
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
    <div className="flex items-center gap-1.5 text-white/40 text-xs font-mono hidden md:flex">
      <Clock size={12} className="text-[#c026d3]/60" />
      <span>{format(time, 'yyyy-MM-dd HH:mm:ss')} UTC</span>
    </div>
  );
}

function PacketCounter() {
  const received = useTelemetryStore(s => s.diagnostics.received);
  const invalid = useTelemetryStore(s => s.diagnostics.invalid);
  const lastPacketNo = useTelemetryStore(s => s.diagnostics.lastPacketNo);
  return (
    <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-white/50">
      {lastPacketNo !== null && (
        <span className="text-[#c026d3] bg-[#7c3aed]/15 border border-[#c026d3]/30 px-2 py-0.5 rounded-lg text-[11px] font-medium tracking-tight shadow-[0_0_12px_rgba(192,38,211,0.2)]">
          PKT #{lastPacketNo}
        </span>
      )}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] backdrop-blur-md rounded-xl">
        <Package size={12} className="text-[#7c3aed]" />
        <span className="text-white/80 font-medium">{received.toLocaleString()}</span>
        {invalid > 0 && <span className="text-[#FF453A]">/ {invalid} bad</span>}
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

        const dotColor = isLive ? 'bg-[#c026d3] shadow-[0_0_8px_#c026d3]'
          : isStale ? 'bg-[#FF9F0A]'
          : 'bg-white/20';

        const textColor = isLive ? 'text-white/90'
          : isStale ? 'text-[#FF9F0A]'
          : 'text-white/40';

        return (
          <div
            key={s.sensorId}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] font-mono tracking-tight backdrop-blur-md"
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const missionName = useMissionStore(s => s.missionName);

  return (
    <div className="flex flex-col h-screen text-[#f5f5f7] overflow-hidden bg-transparent">
      {/* Header */}
      <header
        className="flex items-center gap-4 px-5 py-2.5 shrink-0 z-30 transition-all duration-300"
        style={{
          background: 'rgba(7, 5, 20, 0.65)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo with accretion spinning satellite */}
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-[#7c3aed]/30 to-[#c026d3]/30 border border-[#c026d3]/40 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(124,58,237,0.35)]">
            <Satellite size={16} className="text-[#c026d3] animate-accretion-spin" />
            <div className="absolute inset-0 rounded-xl border border-white/20 pointer-events-none" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold tracking-tight text-sm heading-singularity">VYOMAASTRA</span>
            <span className="text-white/40 text-xs ml-2 hidden md:inline font-medium tracking-normal">{missionName}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-3">
          <SensorIndicators />
          <UtcClock />
          <PacketCounter />
          <ConnectionBadge />
          <NavLink
            to="/settings"
            className="p-2 text-white/50 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] border border-transparent hover:border-white/10"
            title="Settings"
          >
            <Settings size={15} />
          </NavLink>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className={`flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] shrink-0 border-r border-white/[0.06] z-20 ${
            sidebarCollapsed ? 'w-[60px]' : 'w-[220px]'
          }`}
          style={{
            background: 'rgba(6, 4, 16, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <nav className="flex-1 py-3 space-y-1 overflow-y-auto px-2">
            {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group ${
                    isActive
                      ? 'bg-gradient-to-r from-[#7c3aed]/20 to-transparent text-white font-medium border-l-2 border-[#c026d3] pl-3'
                      : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={17}
                      className={`shrink-0 transition-all duration-300 ${
                        isActive
                          ? 'text-[#c026d3] drop-shadow-[0_0_8px_rgba(192,38,211,0.6)]'
                          : 'text-white/40 group-hover:text-white/70'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate tracking-[-0.01em]">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="p-2 border-t border-white/[0.06]">
            <button
              onClick={() => setSidebarCollapsed(c => !c)}
              className="w-full flex items-center justify-center p-2 text-white/40 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto min-w-0 bg-transparent">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
