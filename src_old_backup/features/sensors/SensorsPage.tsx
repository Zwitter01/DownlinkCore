import { useState } from 'react';
import { Cpu, Clock, ToggleLeft, ToggleRight, RefreshCw, Thermometer, Compass, Gauge, MapPin, AlertTriangle } from 'lucide-react';
import { sensorRegistry } from './registry';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { useMissionStore } from '../../stores/missionStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { telemetryService } from '../../services/telemetryService';
import { SetupWizard } from '../setup/SetupWizard';
import { formatDistanceToNow } from 'date-fns';
import type { SensorStatus } from '../../types/telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Sensors Management Page — Black Hole Singularity + Apple Liquid Glass
// ─────────────────────────────────────────────────────────────────────────────

const SENSOR_ICONS: Record<string, typeof Thermometer> = {
  dht11: Thermometer,
  mpu6050: Compass,
  bmp280: Gauge,
  gps: MapPin,
};

function StatusBadge({ status }: { status: SensorStatus }) {
  const cfg: Record<SensorStatus, { color: string; label: string }> = {
    configured:  { color: 'text-white/50 bg-white/[0.04] border-white/[0.08]', label: 'Configured — awaiting telemetry' },
    receiving:   { color: 'text-[#30D158] bg-[#30D158]/10 border-[#30D158]/25 shadow-[0_0_8px_rgba(48,209,88,0.2)]', label: 'Receiving' },
    stale:       { color: 'text-[#FF9F0A] bg-[#FF9F0A]/10 border-[#FF9F0A]/25', label: 'Stale' },
    error:       { color: 'text-[#FF453A] bg-[#FF453A]/10 border-[#FF453A]/25', label: 'Error' },
    disabled:    { color: 'text-white/30 bg-white/[0.02] border-white/[0.06]', label: 'Disabled' },
  };
  const c = cfg[status];
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full border backdrop-blur-md ${c.color}`}>{c.label}</span>
  );
}

export function SensorsPage() {
  const latestValues = useTelemetryStore(s => s.latestValues);
  const latestTimestamps = useTelemetryStore(s => s.latestTimestamps);
  const mission = useMissionStore();
  const [sensors, setSensors] = useState(() => sensorRegistry.getAllSensors());
  const [showWizard, setShowWizard] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = () => setSensors(sensorRegistry.getAllSensors());

  const toggleSensor = (sensorId: string, enabled: boolean) => {
    sensorRegistry.updateSensor(sensorId, { enabled, status: enabled ? 'configured' : 'disabled' });
    const newEnabled = sensors.filter(s => s.enabled).map(s => s.sensorId);
    const updated = enabled
      ? [...newEnabled.filter(id => id !== sensorId), sensorId]
      : newEnabled.filter(id => id !== sensorId);
    mission.updateConfig({ configuredSensorIds: updated });
    useDashboardStore.getState().syncSensorsWithLayout(updated);
    telemetryService.configure({
      wsUrl: mission.wsUrl,
      deviceId: mission.deviceId,
      missionId: mission.missionName,
      enabledSensorIds: updated,
    });
    refresh();
  };

  if (showWizard) {
    return (
      <div>
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-3 bg-black/60 backdrop-blur-md">
          <button onClick={() => setShowWizard(false)} className="text-white/50 hover:text-white text-sm flex items-center gap-1.5 transition-all">
            ← Back to Sensors
          </button>
        </div>
        <SetupWizard />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 bg-transparent">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight heading-gradient flex items-center gap-2">
            <Cpu size={20} className="text-[#c026d3]" /> Sensors
          </h1>
          <p className="text-white/40 text-sm mt-1">Manage registered sensor adapters and view telemetry status</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 text-white/40 hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/10 rounded-xl transition-all" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 liquid-glass-btn-primary text-sm font-semibold transition-all"
          >
            <RefreshCw size={13} /> Reconfigure Mission
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {sensors.map(sensor => {
          const Icon = SENSOR_ICONS[sensor.sensorId] ?? Cpu;
          const isExpanded = expandedId === sensor.sensorId;
          const lastSeen = sensor.lastSeenTimestamp
            ? formatDistanceToNow(new Date(sensor.lastSeenTimestamp), { addSuffix: true })
            : null;

          return (
            <div key={sensor.sensorId} className="liquid-glass-card overflow-hidden">
              <div
                className="flex items-center gap-4 px-4 py-4 cursor-pointer hover:bg-white/[0.03] transition-all"
                onClick={() => setExpandedId(isExpanded ? null : sensor.sensorId)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sensor.enabled ? 'bg-gradient-to-br from-[#7c3aed]/30 to-[#c026d3]/30 border border-[#c026d3]/40 text-[#c026d3]' : 'bg-white/[0.03] border border-white/[0.06] text-white/30'}`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${sensor.enabled ? 'text-white' : 'text-white/40'}`}>{sensor.displayName}</span>
                    <StatusBadge status={sensor.status} />
                  </div>
                  <p className="text-white/50 text-xs mt-0.5 truncate">{sensor.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {lastSeen && (
                    <div className="flex items-center gap-1 text-xs font-mono text-white/40 hidden sm:flex">
                      <Clock size={11} className="text-[#c026d3]/60" />
                      {lastSeen}
                    </div>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); toggleSensor(sensor.sensorId, !sensor.enabled); }}
                    className="transition-all"
                    title={sensor.enabled ? 'Disable sensor' : 'Enable sensor'}
                  >
                    {sensor.enabled
                      ? <ToggleRight size={26} className="text-[#c026d3] drop-shadow-[0_0_8px_#c026d3]" />
                      : <ToggleLeft size={26} className="text-white/30" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-white/[0.06] px-4 py-4 space-y-4 bg-black/30 backdrop-blur-md">
                  {/* Fields */}
                  <div>
                    <p className="text-xs text-[#c026d3]/80 mb-2 uppercase tracking-wider font-semibold">Registered Fields</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sensor.fields.map(field => {
                        const ref = `${sensor.sensorId}.${field.fieldKey}`;
                        const value = latestValues[ref] ?? null;
                        return (
                          <div key={field.fieldKey} className="bg-white/[0.03] rounded-xl p-2.5 border border-white/[0.06] backdrop-blur-md">
                            <p className="text-white/40 text-xs">{field.label}</p>
                            {value !== null ? (
                              <p className="text-[#c026d3] text-sm font-mono font-semibold mt-0.5 drop-shadow-[0_0_6px_rgba(192,38,211,0.3)]">
                                {value.toFixed(field.precision ?? 2)} {field.unit}
                              </p>
                            ) : (
                              <p className="text-white/30 text-xs italic mt-0.5">awaiting data</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!sensor.enabled && (
                    <div className="flex items-center gap-2 text-xs text-[#FF9F0A] bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 rounded-xl px-3 py-2 backdrop-blur-md">
                      <AlertTriangle size={12} className="text-[#FF9F0A]" />
                      Sensor is disabled. Enable it to receive telemetry for its fields.
                    </div>
                  )}

                  {sensor.enabled && sensor.status === 'configured' && (
                    <div className="flex items-center gap-2 text-xs text-white/50 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 backdrop-blur-md font-mono">
                      <Clock size={12} className="text-[#c026d3]/60" />
                      Configured and awaiting first telemetry packet. Verify hardware is connected and bridge is running.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
