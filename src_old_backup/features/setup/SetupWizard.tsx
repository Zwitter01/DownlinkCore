import { useState, useEffect } from 'react';
import { Satellite, Wifi, Loader2, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Thermometer, Compass, Gauge, MapPin, Zap } from 'lucide-react';
import { useMissionStore } from '../../stores/missionStore';
import { useDashboardStore } from '../../stores/dashboardStore';
import { sensorRegistry } from '../sensors/registry';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Setup Wizard â€” Black Hole Singularity + Apple Liquid Glass
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Step = 'welcome' | 'connection' | 'sensors' | 'confirm';
type TestState = 'idle' | 'connecting' | 'connected' | 'failed' | 'stale';

const SENSOR_CARDS = [
  {
    id: 'dht11',
    name: 'DHT11',
    icon: Thermometer,
    description: 'Digital temperature & humidity sensor',
    fields: ['Temperature (Â°C)', 'Relative Humidity (%)'],
    color: 'from-[#c026d3]/20 via-[#7c3aed]/10 to-transparent',
    border: 'border-[#c026d3]/40',
    iconColor: 'text-[#c026d3]',
    required: true,
  },
  {
    id: 'mpu6050',
    name: 'MPU6050',
    icon: Compass,
    description: '6-axis IMU with accelerometer & gyroscope',
    fields: ['Accel X/Y/Z (m/sÂ²)', 'Gyro X/Y/Z (Â°/s)'],
    color: 'from-[#7c3aed]/25 via-[#4c1d95]/15 to-transparent',
    border: 'border-[#7c3aed]/40',
    iconColor: 'text-[#a78bfa]',
  },
  {
    id: 'bmp280',
    name: 'BMP280',
    icon: Gauge,
    description: 'Barometric pressure & temperature sensor',
    fields: ['Pressure (hPa)', 'Temperature (Â°C)', 'bmpAltitude (m)'],
    color: 'from-[#ff6b00]/20 via-[#f59e0b]/10 to-transparent',
    border: 'border-[#f59e0b]/40',
    iconColor: 'text-[#f59e0b]',
  },
  {
    id: 'gps',
    name: 'GPS / NEO-6M',
    icon: MapPin,
    description: 'GPS receiver for position & velocity',
    fields: ['Latitude/Longitude', 'Altitude (m)', 'Speed (km/h)', 'Satellites'],
    color: 'from-[#06b6d4]/20 via-[#3b82f6]/10 to-transparent',
    border: 'border-[#06b6d4]/40',
    iconColor: 'text-[#22d3ee]',
  },
];

interface ConnectionTestResult {
  state: TestState;
  message: string;
  latestPacket: string | null;
  latencyMs?: number;
}

function ConnectionTester({ wsUrl }: { wsUrl: string }) {
  const [result, setResult] = useState<ConnectionTestResult>({
    state: 'idle',
    message: 'Click "Test Connection" to verify your WebSocket endpoint.',
    latestPacket: null,
  });
  const [ws, setWs] = useState<WebSocket | null>(null);

  const runTest = () => {
    if (ws) { ws.close(); setWs(null); }
    setResult({ state: 'connecting', message: `Connecting to ${wsUrl}â€¦`, latestPacket: null });
    const start = Date.now();
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      setResult({ state: 'failed', message: `Invalid URL: ${(e as Error).message}`, latestPacket: null });
      return;
    }
    setWs(socket);
    const timeout = setTimeout(() => {
      socket.close();
      setResult({ state: 'failed', message: 'Connection timed out (5 seconds). Is the bridge running?', latestPacket: null });
    }, 5000);

    socket.onopen = () => {
      clearTimeout(timeout);
      const latencyMs = Date.now() - start;
      setResult((r) => ({ ...r, state: 'connected', message: `Connected in ${latencyMs}ms. Waiting for first packetâ€¦`, latencyMs }));
    };
    socket.onmessage = (e) => {
      clearTimeout(timeout);
      setResult((r) => ({ ...r, state: 'connected', message: 'Live data confirmed.', latestPacket: e.data }));
    };
    socket.onerror = () => {
      clearTimeout(timeout);
      setResult({ state: 'failed', message: `Cannot reach ${wsUrl}. Ensure the bridge is running: node bridge.js`, latestPacket: null });
    };
    socket.onclose = (ev) => {
      if (result.state !== 'connected') {
        setResult({ state: 'failed', message: `Connection closed (code ${ev.code}). Bridge may have rejected the connection.`, latestPacket: null });
      }
    };
  };

  useEffect(() => () => { ws?.close(); }, [ws]);

  const Icon = result.state === 'connecting' ? Loader2
    : result.state === 'connected' ? CheckCircle2
    : result.state === 'failed' ? XCircle
    : Wifi;

  const iconClass = result.state === 'connected' ? 'text-[#c026d3]'
    : result.state === 'failed' ? 'text-[#FF453A]'
    : result.state === 'connecting' ? 'text-[#a78bfa] animate-spin'
    : 'text-white/40';

  return (
    <div className="space-y-3">
      <button
        onClick={runTest}
        disabled={result.state === 'connecting'}
        className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] text-white rounded-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium shadow-[0_2px_10px_rgba(0,0,0,0.4)]"
      >
        <Wifi size={14} className="text-[#c026d3]" />
        Test Connection
      </button>

      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
        <Icon size={18} className={`mt-0.5 shrink-0 ${iconClass}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/80">{result.message}</p>
          {result.latestPacket && (
            <pre className="mt-2 text-xs text-[#c026d3] bg-black/80 border border-[#7c3aed]/25 p-3 rounded-xl overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(JSON.parse(result.latestPacket), null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

interface SetupWizardProps {
  onLaunch?: () => void;
  launchingMode?: boolean;
}

export function SetupWizard({ onLaunch, launchingMode = false }: SetupWizardProps = {}) {
  const mission = useMissionStore();
  const [step, setStep] = useState<Step>('welcome');
  const [missionName, setMissionName] = useState(mission.missionName);
  const [deviceId, setDeviceId] = useState(mission.deviceId);
  const [wsUrl, setWsUrl] = useState(mission.wsUrl);
  const [selectedSensors, setSelectedSensors] = useState<string[]>(
    mission.isSetupComplete ? mission.configuredSensorIds : ['dht11']
  );

  const toggleSensor = (id: string) => {
    if (id === 'dht11') return; // DHT11 always selected in initial config
    setSelectedSensors((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleComplete = () => {
    sensorRegistry.enableSensors(selectedSensors);
    useDashboardStore.getState().syncSensorsWithLayout(selectedSensors);
    mission.completeMission({
      missionName,
      deviceId,
      wsUrl,
      configuredSensorIds: selectedSensors,
    });
    if (onLaunch) {
      onLaunch();
    }
  };

  const steps: Step[] = ['welcome', 'connection', 'sensors', 'confirm'];
  const stepIdx = steps.indexOf(step);

  return (
    <div
      className={`min-h-screen relative flex items-center justify-center p-4 overflow-hidden ${
        launchingMode ? 'animate-grav-warp pointer-events-none' : ''
      }`}
      style={{
        backgroundColor: '#06050e',
        backgroundImage:
          'radial-gradient(ellipse 90% 60% at 15% 10%, rgba(139, 92, 246, 0.30) 0%, transparent 65%), radial-gradient(ellipse 85% 55% at 85% 25%, rgba(217, 70, 239, 0.25) 0%, transparent 65%), radial-gradient(ellipse 80% 50% at 75% 85%, rgba(6, 182, 212, 0.22) 0%, transparent 60%), radial-gradient(ellipse 70% 45% at 20% 80%, rgba(245, 158, 11, 0.15) 0%, transparent 55%)',
      }}
    >
      {/* Gargantua Accretion Horizon Glow in Background (Interstellar style) */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: '750px',
          height: '750px',
          background: 'radial-gradient(circle, rgba(255, 170, 70, 0.09) 0%, rgba(200, 110, 40, 0.04) 40%, transparent 70%)',
          filter: 'blur(55px)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div className="relative w-full max-w-2xl z-10">
        {/* Step Progress */}
        <div className="mb-6 flex items-center gap-2 px-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                  i < stepIdx
                    ? 'bg-[#7c3aed] border-[#c026d3] text-white shadow-[0_0_12px_rgba(124,58,237,0.6)]'
                    : i === stepIdx
                    ? 'border-[#c026d3] text-[#c026d3] bg-[#7c3aed]/15 shadow-[0_0_16px_rgba(192,38,211,0.5)]'
                    : 'border-white/10 text-white/30 bg-white/[0.02]'
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${
                    i < stepIdx ? 'bg-gradient-to-r from-[#7c3aed] to-[#c026d3]' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main Liquid Glass Container */}
        <div
          className="rounded-[32px] p-8 shadow-2xl relative overflow-hidden transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(124,58,237,0.05) 50%, rgba(0,0,0,0.4) 100%)',
            backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.08)',
          }}
        >
          {/* â”€â”€ Welcome â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                {/* Large satellite icon with accretion spin decoration */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  {/* Outer accretion ring */}
                  <div
                    className="absolute inset-0 rounded-full border border-dashed border-[#c026d3]/40 animate-accretion-spin"
                    style={{ animationDuration: '24s' }}
                  />
                  {/* Middle event horizon pulse glow */}
                  <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-[#ff6b00]/15 via-[#c026d3]/25 to-[#7c3aed]/20 animate-event-horizon" />
                  {/* Center glass container */}
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#7c3aed]/30 to-[#c026d3]/30 border border-[#c026d3]/50 flex items-center justify-center shadow-[0_0_30px_rgba(124,58,237,0.5)]">
                    <Satellite size={42} className="text-[#c026d3]" />
                  </div>
                  {/* Hawking radiation point */}
                  <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#c026d3] border-2 border-black shadow-[0_0_10px_#c026d3]" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight heading-singularity">VYOMAASTRA</h1>
                <p className="text-white/50 mt-1 text-sm font-normal">Modular CubeSat & Aerospace Telemetry Platform</p>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 text-left space-y-2 backdrop-blur-md">
                <h2 className="text-base font-semibold text-white">Configure Your VYOMAASTRA Mission</h2>
                <p className="text-white/60 text-sm leading-relaxed">
                  Select the sensors currently connected to your telemetry system and configure your mission parameters.
                  This setup wizard runs once and can be reconfigured at any time from Settings.
                </p>
              </div>
              <button
                onClick={() => setStep('connection')}
                className="w-full flex items-center justify-center gap-2 py-3.5 liquid-glass-btn-primary font-semibold text-sm transition-all duration-300"
              >
                Begin Mission Configuration <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* â”€â”€ Connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'connection' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight heading-gradient">Mission Parameters</h2>
                <p className="text-white/50 text-sm mt-1">Configure your mission identity and telemetry endpoint.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Mission Name</label>
                  <input
                    value={missionName}
                    onChange={e => setMissionName(e.target.value)}
                    className="w-full liquid-glass-input px-3.5 py-2.5 text-sm"
                    placeholder="VYOMAASTRA"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Device ID</label>
                  <input
                    value={deviceId}
                    onChange={e => setDeviceId(e.target.value)}
                    className="w-full liquid-glass-input px-3.5 py-2.5 text-sm"
                    placeholder="esp8266-rx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">WebSocket URL</label>
                  <input
                    value={wsUrl}
                    onChange={e => setWsUrl(e.target.value)}
                    className="w-full liquid-glass-input px-3.5 py-2.5 text-sm font-mono"
                    placeholder="ws://localhost:8081"
                  />
                </div>
                <ConnectionTester wsUrl={wsUrl} />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('welcome')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white rounded-xl transition-all duration-300 text-sm font-medium"
                >
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  onClick={() => setStep('sensors')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 liquid-glass-btn-primary font-semibold text-sm transition-all duration-300"
                >
                  Next: Select Sensors <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Sensor Selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'sensors' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight heading-gradient">Select Connected Sensors</h2>
                <p className="text-white/50 text-sm mt-1">
                  Select the sensors <em>currently connected</em> to your device. Selecting a sensor registers it for monitoring.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {SENSOR_CARDS.map((card) => {
                  const selected = selectedSensors.includes(card.id);
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.id}
                      onClick={() => toggleSensor(card.id)}
                      className={`relative w-full text-left p-4 rounded-2xl border transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        selected
                          ? `bg-gradient-to-r ${card.color} ${card.border} shadow-[0_4px_24px_rgba(0,0,0,0.5)]`
                          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]'
                      } ${card.required ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 ${card.iconColor}`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{card.name}</span>
                            {card.required && (
                              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-[#c026d3]/20 text-[#c026d3] border border-[#c026d3]/40 font-medium">Required</span>
                            )}
                          </div>
                          <p className="text-white/50 text-xs mt-0.5">{card.description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {card.fields.map(f => (
                              <span key={f} className="text-[11px] px-2 py-0.5 rounded-lg bg-black/40 text-white/70 border border-white/[0.08] font-mono">{f}</span>
                            ))}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center transition-all duration-300 ${
                          selected ? 'border-[#c026d3] bg-[#c026d3] shadow-[0_0_8px_#c026d3]' : 'border-white/20'
                        }`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-2xl p-3.5 flex gap-2.5 backdrop-blur-md">
                <Zap size={15} className="text-[#f59e0b] mt-0.5 shrink-0" />
                <p className="text-xs text-[#f59e0b]/90 leading-relaxed">
                  Sensors will show <strong>"Configured â€” awaiting telemetry"</strong> until real data arrives. No readings will be fabricated for unconnected sensors.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('connection')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white rounded-xl transition-all duration-300 text-sm font-medium"
                >
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 liquid-glass-btn-primary font-semibold text-sm transition-all duration-300"
                >
                  Review & Launch <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ Confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          {step === 'confirm' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight heading-gradient">Mission Summary</h2>
                <p className="text-white/50 text-sm mt-1">Review your configuration before launching the dashboard.</p>
              </div>
              <div className="space-y-3 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 backdrop-blur-md">
                {[
                  ['Mission Name', missionName],
                  ['Device ID', deviceId],
                  ['WebSocket URL', wsUrl],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <span className="text-white/50 text-sm">{label}</span>
                    <span className="text-white text-sm font-mono font-medium">{value}</span>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="text-white/50 text-xs mb-2 uppercase tracking-wider font-medium">Configured Sensors</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedSensors.map(id => {
                      const card = SENSOR_CARDS.find(c => c.id === id);
                      return card ? (
                        <span key={id} className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl border bg-gradient-to-r ${card.color} ${card.border}`}>
                          <card.icon size={12} className={card.iconColor} />
                          <span className="text-white font-medium">{card.name}</span>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-3.5 backdrop-blur-md">
                <p className="text-xs text-white/50 leading-relaxed">
                  All configured sensors will display <strong className="text-white/80">"Configured â€” awaiting telemetry"</strong> until real data arrives from your hardware. You can reconfigure this at any time from the Settings page.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('sensors')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white rounded-xl transition-all duration-300 text-sm font-medium"
                >
                  <ChevronLeft size={15} /> Back
                </button>
                <button
                  onClick={handleComplete}
                  className="flex-1 flex items-center justify-center gap-2 py-3 liquid-glass-btn-primary font-bold transition-all duration-300"
                >
                  <Satellite size={17} /> Launch VYOMAASTRA Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-4 font-mono">
          VYOMAASTRA Telemetry Platform Â· Singularity Edition
        </p>
      </div>
    </div>
  );
}
