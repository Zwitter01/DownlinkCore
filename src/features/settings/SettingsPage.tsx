import { useEffect, useRef, useState } from 'react';
import { Settings, RotateCcw, Trash2, Wifi, RefreshCw, AlertTriangle, ExternalLink, Rocket, Cpu, LayoutGrid, ShieldAlert, Fingerprint, Radio, Satellite, Tag, Link2, Zap } from 'lucide-react';
import { useMissionStore } from '../../stores/missionStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { telemetryService } from '../../services/telemetryService';
import { sensorRegistry } from '../sensors/registry';

// ─────────────────────────────────────────────────────────────────────────────
// Settings Page
// ─────────────────────────────────────────────────────────────────────────────


// Press-and-hold control: the fill sweeps across, the action fires only when it completes.
function HoldButton({ label, onComplete, ms = 1400 }: { label: string; onComplete: () => void; ms?: number }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const start = useRef(0);
  const stop = () => { cancelAnimationFrame(raf.current); setP(0); };
  const tick = () => {
    const v = Math.min(1, (performance.now() - start.current) / ms);
    setP(v);
    if (v >= 1) { onComplete(); setP(0); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const go = () => { start.current = performance.now(); raf.current = requestAnimationFrame(tick); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <button onPointerDown={go} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      className="liquid-glass relative flex w-full select-none items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-left text-sm text-red-200">
      <span className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/50 to-orange-400/50" style={{ width: `${p * 100}%` }} />
      <Fingerprint size={20} className="relative shrink-0 text-red-300" style={{ transform: `scale(${1 + p * 0.25})` }} />
      <span className="relative">
        <span className="block font-medium">{label}</span>
        <span className="block text-[10px] uppercase tracking-[0.25em] text-red-200/60">{p > 0 ? `Hold… ${Math.round(p * 100)}%` : 'Press and hold to confirm'}</span>
      </span>
    </button>
  );
}

function Stat({ k, v, mono = true }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-white/10 py-2.5 last:border-0">
      <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">{k}</span>
      <span className={`truncate text-right text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  );
}

export function SettingsPage() {
  const mission = useMissionStore();
  const clearHistory = useTelemetryStore(s => s.clearHistory);
  const resetLayout = useDashboardStore(s => s.resetToDefault);

  const [wsUrl, setWsUrl] = useState(mission.wsUrl);
  const [missionName, setMissionName] = useState(mission.missionName);
  const [deviceId, setDeviceId] = useState(mission.deviceId);
  const [saved, setSaved] = useState(false);
  
  const handleSave = () => {
    mission.updateConfig({ wsUrl, missionName, deviceId });
    telemetryService.stop();
    setTimeout(() => {
      telemetryService.configure({
        wsUrl, deviceId, missionId: missionName,
        enabledSensorIds: mission.configuredSensorIds,
      });
      telemetryService.start();
    }, 300);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetAll = () => {
    clearHistory();
    resetLayout(mission.configuredSensorIds);
  };

  const handleReconfigureMission = () => {
    mission.resetSetup();
    window.location.reload();
  };

  const connState = useTelemetryStore(st => st.connectionState);
  const received = useTelemetryStore(st => st.diagnostics.received);
  const link = {
    idle: { label: 'IDLE', live: false, dot: 'bg-slate-500', cls: 'border-white/15 text-slate-300' },
    connecting: { label: 'ACQUIRING SIGNAL', live: false, dot: 'bg-violet-300 animate-pulse', cls: 'border-violet-300/40 text-violet-200' },
    connected: { label: 'LINK NOMINAL', live: true, dot: 'bg-emerald-400 animate-pulse', cls: 'border-emerald-400/40 text-emerald-300' },
    disconnected: { label: 'SIGNAL LOST', live: false, dot: 'bg-red-500', cls: 'border-red-400/40 text-red-300' },
    stale: { label: 'STALE DATA', live: false, dot: 'bg-amber-400', cls: 'border-amber-400/40 text-amber-300' },
    error: { label: 'LINK ERROR', live: false, dot: 'bg-red-500', cls: 'border-red-400/40 text-red-300' },
  }[connState];
  const sensors = mission.configuredSensorIds.map(id => ({ id, name: sensorRegistry.getSensor(id)?.displayName ?? id }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-violet-200/60">Systems configuration</p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-light tracking-wide text-white">
          <Settings size={24} className="text-cyan-400" /> Systems Config
        </h1>
        <p className="mt-1 text-sm text-slate-400">Link settings, the mission dossier and deck controls</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          {/* Uplink console */}
          <section className="liquid-glass overflow-hidden rounded-[28px]">
            <div className="relative px-6 pb-5 pt-6" style={{ background: 'linear-gradient(160deg, rgba(124,58,237,.28), transparent 70%)' }}>
              <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-violet-100/80"><Wifi size={13} className="text-cyan-400" /> Telemetry connection</h2>

              {/* ground station -> satellite link */}
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06]"><Radio size={20} className="text-violet-200" /></div>
                <div className="relative h-px flex-1 overflow-hidden" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.25) 0 6px, transparent 6px 12px)' }}>
                  {link.live && [0, 1, 2].map(i => (
                    <span key={i} className="absolute -top-[2px] h-[5px] w-[5px] rounded-full bg-cyan-300 shadow-[0_0_10px_3px_rgba(216,180,254,.8)]" style={{ animation: `link-packet 1.8s linear ${i * 0.6}s infinite` }} />
                  ))}
                </div>
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06]">
                  <Satellite size={20} className={link.live ? 'text-emerald-300' : 'text-slate-400'} />
                  {link.live && <span className="absolute inset-0 rounded-2xl border border-emerald-300/50" style={{ animation: 'ping-ring 2s ease-out infinite' }} />}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${link.cls}`}><span className={`h-1.5 w-1.5 rounded-full ${link.dot}`} />{link.label}</span>
                <span className="text-slate-500">{received.toLocaleString()} packets</span>
              </div>
            </div>

            <div className="space-y-4 px-6 pb-6 pt-2">
              {[
                { label: 'Mission name', icon: Tag, value: missionName, set: setMissionName, mono: false },
                { label: 'Device ID', icon: Fingerprint, value: deviceId, set: setDeviceId, mono: true },
              ].map(f => (
                <label key={f.label} className="block">
                  <span className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-slate-500">{f.label}</span>
                  <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 transition focus-within:border-violet-300/60 focus-within:shadow-[0_0_0_4px_rgba(168,85,247,.15)]">
                    <f.icon size={15} className="shrink-0 text-slate-500" />
                    <input value={f.value} onChange={e => f.set(e.target.value)} className={`w-full bg-transparent py-3 text-sm text-white outline-none ${f.mono ? 'font-mono' : ''}`} />
                  </span>
                </label>
              ))}

              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-[0.3em] text-slate-500">WebSocket URL</span>
                <span className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 transition focus-within:border-violet-300/60 focus-within:shadow-[0_0_0_4px_rgba(168,85,247,.15)]">
                  <Link2 size={15} className="shrink-0 text-slate-500" />
                  <span className="font-mono text-sm text-violet-300">$</span>
                  <input value={wsUrl} onChange={e => setWsUrl(e.target.value)} spellCheck={false} className="w-full bg-transparent py-3 font-mono text-sm text-white outline-none" />
                </span>
                <span className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Bridge endpoint</span>
                  <button type="button" onClick={() => setWsUrl('ws://localhost:8081')} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[11px] text-slate-300 transition hover:bg-white/10">
                    <Zap size={10} /> ws://localhost:8081
                  </button>
                </span>
              </label>

              <button onClick={handleSave}
                className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-sm font-semibold transition-all ${
                  saved ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-300' : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 text-white shadow-[0_10px_40px_-12px_rgba(192,38,211,.9)] hover:brightness-110'}`}>
                {!saved && <span className="sheen absolute inset-0 overflow-hidden" />}
                <RefreshCw size={15} className={`relative ${saved ? 'animate-spin' : 'transition-transform duration-500 group-hover:rotate-180'}`} />
                <span className="relative">{saved ? 'Saved & Reconnecting…' : 'Save & Reconnect'}</span>
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Mission dossier */}
          <section className="liquid-glass overflow-hidden rounded-[28px]">
            <div className="relative flex items-center justify-between gap-4 px-6 py-5" style={{ background: 'linear-gradient(120deg, rgba(124,58,237,.35), rgba(192,38,211,.12) 60%, rgba(251,146,60,.12))' }}>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.4em] text-violet-100/70">Mission dossier</p>
                <h2 className="mt-1 truncate text-2xl font-semibold tracking-wide text-white">{mission.missionName}</h2>
                <p className="mt-0.5 font-mono text-xs text-slate-300/70">{mission.deviceId}</p>
              </div>
              <div className="relative h-14 w-14 shrink-0">
                <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #c4b5fd, #5b21b6 55%, #0c0620 100%)', boxShadow: '0 0 20px 2px rgba(168,85,247,.5)' }} />
                <Rocket size={18} className="absolute inset-0 m-auto text-white" />
              </div>
            </div>
            <div className="px-6 py-3">
              <Stat k="Status" v={mission.isSetupComplete ? 'Cleared for flight' : 'Setup pending'} mono={false} />
              <Stat k="Setup version" v={`v${mission.setupVersion}`} />
              <Stat k="Created" v={new Date(mission.createdAt).toLocaleString()} />
              <Stat k="Last updated" v={new Date(mission.updatedAt).toLocaleString()} />
            </div>
            <div className="border-t border-white/10 px-6 py-4">
              <p className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-slate-500"><Cpu size={12} /> Payload instruments ({sensors.length})</p>
              <div className="flex flex-wrap gap-2">
                {sensors.map(x => (
                  <span key={x.id} className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-xs text-slate-200" title={x.id}>{x.name}</span>
                ))}
                {sensors.length === 0 && <span className="text-xs text-slate-500">None configured</span>}
              </div>
            </div>
            <button onClick={handleReconfigureMission}
              className="group flex w-full items-center justify-between border-t border-white/10 px-6 py-4 text-sm text-amber-300 transition hover:bg-amber-400/10">
              <span className="flex items-center gap-2"><RotateCcw size={14} className="transition-transform duration-500 group-hover:-rotate-180" /> Reconfigure mission wizard</span>
              <span className="text-xs text-amber-300/60 transition-transform group-hover:translate-x-1">→</span>
            </button>
          </section>

          {/* Deck controls */}
          <section className="liquid-glass rounded-[28px] p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06]"><LayoutGrid size={18} className="text-violet-200" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-white">Flight deck layout</h3>
                <p className="mt-0.5 text-xs text-slate-400">Restore every instrument to its default position. Historical telemetry is not deleted.</p>
                <button onClick={() => resetLayout(mission.configuredSensorIds)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-xs text-slate-200 transition hover:bg-white/10">
                  <RotateCcw size={12} /> Reset to default layout
                </button>
              </div>
            </div>
          </section>

          {/* Abort sequence */}
          <section className="rounded-[28px] border border-red-400/25 bg-red-950/20 p-6">
            <h3 className="flex items-center gap-2 text-sm font-medium text-red-300"><ShieldAlert size={15} /> Abort sequence</h3>
            <p className="mb-4 mt-1 text-xs text-red-200/60">Clears the in-memory sample buffer, so charts reset. Persisted database data is not deleted.</p>
            <HoldButton label="Clear in-memory telemetry buffer" onComplete={handleResetAll} />
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-red-200/40"><Trash2 size={10} /> Cannot be undone</p>
          </section>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 font-mono text-[11px] text-slate-500">
            <span>VYOMAASTRA TELEMETRY PLATFORM v1.0.0</span>
            <a href="https://github.com" className="inline-flex items-center gap-1 hover:text-slate-300" target="_blank" rel="noopener noreferrer">vyomaastra-telemetry-bridge <ExternalLink size={10} /></a>
          </p>
        </div>
      </div>
    </div>
  );
}
