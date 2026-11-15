import { useState } from 'react';
import { Settings, RotateCcw, Trash2, Wifi, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMissionStore } from '../../stores/missionStore';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { telemetryService } from '../../services/telemetryService';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Settings Page â€” Black Hole Singularity + Apple Liquid Glass UI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function SettingsPage() {
  const mission = useMissionStore();
  const clearHistory = useTelemetryStore(s => s.clearHistory);
  const resetLayout = useDashboardStore(s => s.resetToDefault);

  const [wsUrl, setWsUrl] = useState(mission.wsUrl);
  const [missionName, setMissionName] = useState(mission.missionName);
  const [deviceId, setDeviceId] = useState(mission.deviceId);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

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
    setConfirmReset(false);
  };

  const handleReconfigureMission = () => {
    mission.resetSetup();
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl bg-transparent">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c3aed]/30 to-[#c026d3]/30 border border-[#c026d3]/40 flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.3)]">
          <Settings size={18} className="text-[#c026d3]" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight heading-gradient">Settings</h1>
          <p className="text-white/40 text-xs mt-0.5">Configure telemetry connection and dashboard preferences</p>
        </div>
      </div>

      {/* Connection */}
      <div className="liquid-glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wifi size={14} className="text-[#c026d3]" />
          <h2 className="text-xs uppercase font-semibold tracking-wider text-[#c026d3]">Telemetry Connection</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Mission Name</label>
            <input
              value={missionName}
              onChange={e => setMissionName(e.target.value)}
              className="w-full liquid-glass-input px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Device ID</label>
            <input
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              className="w-full liquid-glass-input px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">WebSocket URL</label>
            <input
              value={wsUrl}
              onChange={e => setWsUrl(e.target.value)}
              className="w-full liquid-glass-input px-3.5 py-2.5 text-sm font-mono"
            />
            <p className="text-xs text-white/30 mt-1 font-mono">Bridge endpoint: ws://localhost:8081 (default)</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
            saved
              ? 'bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/30 shadow-md shadow-[#30D158]/10'
              : 'liquid-glass-btn-primary'
          }`}
        >
          <RefreshCw size={14} className={saved ? 'animate-spin' : ''} />
          {saved ? 'Saved & Reconnectingâ€¦' : 'Save & Reconnect'}
        </button>
      </div>

      {/* Mission configuration */}
      <div className="liquid-glass-card p-5 space-y-4">
        <h2 className="text-xs uppercase font-semibold tracking-wider text-[#c026d3]">Mission Configuration</h2>
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {[
            ['Setup complete', mission.isSetupComplete ? 'Yes' : 'No'],
            ['Setup version', String(mission.setupVersion)],
            ['Configured sensors', mission.configuredSensorIds.join(', ')],
            ['Created', new Date(mission.createdAt).toLocaleString()],
            ['Updated', new Date(mission.updatedAt).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-2.5 backdrop-blur-md">
              <p className="text-white/40 text-[11px] font-medium">{k}</p>
              <p className="text-white font-mono mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <button
          onClick={handleReconfigureMission}
          className="flex items-center gap-2 px-4 py-2 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 rounded-xl text-sm transition-all duration-300 font-medium"
        >
          <RotateCcw size={14} /> Reconfigure Mission Wizard
        </button>
      </div>

      {/* Dashboard */}
      <div className="liquid-glass-card p-5 space-y-3">
        <h2 className="text-xs uppercase font-semibold tracking-wider text-[#c026d3]">Dashboard Layout</h2>
        <button
          onClick={() => resetLayout(mission.configuredSensorIds)}
          className="flex items-center gap-2 px-4 py-2 border border-white/[0.12] bg-white/[0.06] text-white/80 hover:text-white hover:bg-white/[0.1] rounded-xl text-sm transition-all duration-300 font-medium backdrop-blur-md"
        >
          <RotateCcw size={14} /> Reset to Default Layout
        </button>
        <p className="text-xs text-white/40">This resets widget positions to the default. Historical telemetry is preserved.</p>
      </div>

      {/* Danger zone */}
      <div className="bg-[#FF453A]/5 border border-[#FF453A]/20 rounded-2xl p-5 space-y-4 backdrop-blur-md">
        <h2 className="text-xs uppercase font-semibold tracking-wider text-[#FF453A] flex items-center gap-2">
          <AlertTriangle size={14} /> Danger Zone
        </h2>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 px-4 py-2 border border-[#FF453A]/30 text-[#FF453A] hover:bg-[#FF453A]/10 rounded-xl text-sm transition-all duration-300 font-medium"
          >
            <Trash2 size={14} /> Clear In-Memory Telemetry Buffer
          </button>
        ) : (
          <div className="space-y-2.5">
            <p className="text-xs text-[#FF453A]/90">This clears the in-memory sample buffer (charts reset). Persisted DB data is not deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="px-3.5 py-1.5 border border-white/[0.1] text-white/70 hover:bg-white/[0.06] rounded-xl text-xs transition-all duration-200">Cancel</button>
              <button onClick={handleResetAll} className="px-3.5 py-1.5 bg-[#FF453A] hover:bg-[#FF453A]/90 text-white rounded-xl text-xs font-semibold shadow-md shadow-[#FF453A]/25 transition-all duration-200">Confirm Clear</button>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-white/30 space-y-1 px-1 font-mono">
        <p>VYOMAASTRA Telemetry Platform Â· Black Hole Singularity Edition</p>
        <p>Bridge: <a href="https://github.com" className="text-white/50 hover:text-white inline-flex items-center gap-0.5" target="_blank" rel="noopener noreferrer">singularity-telemetry-bridge <ExternalLink size={10} /></a></p>
      </div>
    </div>
  );
}
