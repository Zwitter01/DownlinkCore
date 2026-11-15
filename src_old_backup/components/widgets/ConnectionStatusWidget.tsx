import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMissionStore } from '../../stores/missionStore';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Wifi, WifiOff, Loader2, AlertTriangle, CheckCircle2,
  Package, Clock, AlertCircle, Hash,
} from 'lucide-react';
import type { ConnectionState } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Connection Status Widget — Singularity Black Hole Health Monitor
// ─────────────────────────────────────────────────────────────────────────────

function StateDisplay({ state }: { state: ConnectionState }) {
  const configs: Record<ConnectionState, { icon: typeof Wifi; color: string; bg: string; border: string; label: string; desc: string }> = {
    idle:         { icon: Wifi, color: 'text-white/40', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]', label: 'Idle', desc: 'Not started' },
    connecting:   { icon: Loader2, color: 'text-[#c026d3]', bg: 'bg-[#7c3aed]/10', border: 'border-[#c026d3]/30', label: 'Connecting', desc: 'Establishing connection…' },
    connected:    { icon: CheckCircle2, color: 'text-[#c026d3]', bg: 'bg-[#7c3aed]/15', border: 'border-[#c026d3]/35 shadow-[0_0_15px_rgba(192,38,211,0.2)]', label: 'Connected', desc: 'Live telemetry active' },
    disconnected: { icon: WifiOff, color: 'text-[#FF453A]', bg: 'bg-[#FF453A]/10', border: 'border-[#FF453A]/30', label: 'Disconnected', desc: 'Reconnecting with backoff…' },
    stale:        { icon: AlertTriangle, color: 'text-[#FF9F0A]', bg: 'bg-[#FF9F0A]/10', border: 'border-[#FF9F0A]/30', label: 'Stale Data', desc: 'No packets for >10 seconds' },
    error:        { icon: AlertCircle, color: 'text-[#FF453A]', bg: 'bg-[#FF453A]/10', border: 'border-[#FF453A]/30', label: 'Error', desc: 'Connection error' },
  };
  const cfg = configs[state];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl ${cfg.bg} border ${cfg.border} backdrop-blur-md transition-all duration-300`}>
      <Icon size={18} className={`${cfg.color} ${state === 'connecting' ? 'animate-spin' : ''}`} />
      <div>
        <p className={`text-sm font-semibold tracking-tight ${cfg.color}`}>{cfg.label}</p>
        <p className="text-xs text-white/40 mt-0.5">{cfg.desc}</p>
      </div>
    </div>
  );
}

export function ConnectionStatusWidget() {
  const state = useTelemetryStore(s => s.connectionState);
  const diag = useTelemetryStore(s => s.diagnostics);
  const wsUrl = useMissionStore(s => s.wsUrl);

  const lastSeen = diag.lastTimestamp
    ? formatDistanceToNow(new Date(diag.lastTimestamp), { addSuffix: true })
    : '—';

  const stats = [
    { icon: Package, label: 'Received', value: diag.received.toLocaleString(), color: 'text-[#c026d3] drop-shadow-[0_0_8px_rgba(192,38,211,0.4)]' },
    { icon: AlertTriangle, label: 'Invalid', value: diag.invalid.toString(), color: diag.invalid > 0 ? 'text-[#FF453A]' : 'text-white/40' },
    { icon: Hash, label: 'Last Pkt#', value: diag.lastPacketNo?.toString() ?? '—', color: 'text-white/80' },
    { icon: Clock, label: 'Last Seen', value: lastSeen, color: 'text-white/80' },
  ];

  return (
    <div className="h-full flex flex-col p-4 space-y-3 bg-transparent">
      <StateDisplay state={state} />

      <div className="text-xs text-white/40 font-mono truncate px-1">{wsUrl}</div>

      <div className="grid grid-cols-2 gap-2">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white/[0.04] rounded-xl p-2.5 border border-white/[0.06] backdrop-blur-md">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon size={11} className="text-[#c026d3]/60" />
              <span className="text-white/40 text-[11px] font-medium">{label}</span>
            </div>
            <p className={`text-sm font-mono font-semibold tracking-tight ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {diag.lastRawJson && (
        <div className="flex-1 min-h-0">
          <p className="text-[11px] uppercase tracking-wider text-[#c026d3]/70 mb-1 px-1 font-semibold">Last Raw Packet</p>
          <pre className="text-xs text-[#c026d3] bg-black/80 border border-[#7c3aed]/25 rounded-xl p-2.5 overflow-auto h-full font-mono leading-relaxed shadow-inner">
            {(() => { try { return JSON.stringify(JSON.parse(diag.lastRawJson), null, 2); } catch { return diag.lastRawJson; } })()}
          </pre>
        </div>
      )}

      {diag.connectionEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-white/40 px-1 font-semibold">Recent Events</p>
          {diag.connectionEvents.slice(0, 3).map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                ev.type === 'connected' ? 'bg-[#c026d3] shadow-[0_0_6px_#c026d3]'
                : ev.type === 'error' ? 'bg-[#FF453A]'
                : ev.type === 'disconnected' ? 'bg-[#FF453A]/80'
                : 'bg-[#7c3aed]'
              }`} />
              <span className="text-white/40 font-mono text-[11px]">{format(new Date(ev.at), 'HH:mm:ss')}</span>
              <span className="text-white/70 capitalize font-medium">{ev.type}</span>
              {ev.detail && <span className="text-white/30 truncate">{ev.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
