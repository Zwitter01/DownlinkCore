import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SetupWizard } from '../features/setup/SetupWizard';
import { AppLayout } from './AppLayout';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { TelemetryExplorerPage } from '../features/telemetry/TelemetryExplorerPage';
import { PlotBuilderPage } from '../features/plots/PlotBuilderPage';
import { SensorsPage } from '../features/sensors/SensorsPage';
import { DataHistoryPage } from '../features/history/DataHistoryPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useMissionStore } from '../stores/missionStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { telemetryService } from '../services/telemetryService';
import { sensorRegistry } from '../features/sensors/registry';
import { BlackHoleTransition } from '../components/BlackHoleTransition';

// ─────────────────────────────────────────────────────────────────────────────
// Transition states:
// 'setup'       → SetupWizard showing
// 'blackhole'   → Black hole overlay + wizard is sucked in
// 'sphere'      → Dashboard revealed via sphere expand from centre
// 'dashboard'   → Normal dashboard (no animation class)
// ─────────────────────────────────────────────────────────────────────────────

type TransitionPhase = 'setup' | 'blackhole' | 'sphere' | 'dashboard';

export function App() {
  const mission = useMissionStore();
  const initDefaultLayout = useDashboardStore(s => s.initDefaultLayout);

  // If already set up (e.g. page refresh), skip animation entirely
  const [phase, setPhase] = useState<TransitionPhase>(
    mission.isSetupComplete ? 'dashboard' : 'setup'
  );

  const sphereTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Called by SetupWizard when user clicks "Launch" — kicks off the cinematic sequence
  const handleLaunchAnimation = useCallback(() => {
    setPhase('blackhole');
  }, []);

  // Called by BlackHoleTransition when the hole has fully consumed the screen
  const handleBlackHoleComplete = useCallback(() => {
    // Actually complete the mission setup (wizard has already gathered the data)
    // We need the wizard to have stored its pending config. It does so via completeMission.
    // setPhase triggers sphere reveal on the now-mounted dashboard.
    setPhase('sphere');
    // After sphere reveal animation finishes, settle to normal
    sphereTimerRef.current = setTimeout(() => setPhase('dashboard'), 1800);
  }, []);

  useEffect(() => () => { if (sphereTimerRef.current) clearTimeout(sphereTimerRef.current); }, []);

  // Start telemetry once mission is configured
  useEffect(() => {
    if (!mission.isSetupComplete) return;
    sensorRegistry.enableSensors(mission.configuredSensorIds);
    initDefaultLayout(mission.configuredSensorIds);
    telemetryService.configure({
      wsUrl: mission.wsUrl,
      deviceId: mission.deviceId,
      missionId: mission.missionName,
      enabledSensorIds: mission.configuredSensorIds,
    });
    telemetryService.start();
    return () => { telemetryService.stop(); };
  }, [mission.isSetupComplete, mission.wsUrl, mission.deviceId, mission.missionName, mission.configuredSensorIds, initDefaultLayout]);

  // ── Setup phase ─────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return <SetupWizard onLaunch={handleLaunchAnimation} />;
  }

  // ── Black hole transition overlay ───────────────────────────────────────────
  if (phase === 'blackhole') {
    return (
      <div className="relative w-full h-full">
        {/* Wizard stays mounted, will be sucked in by the overlay darkness */}
        <div className="animate-black-hole-suck absolute inset-0">
          <SetupWizard onLaunch={handleLaunchAnimation} launchingMode />
        </div>
        <BlackHoleTransition onComplete={handleBlackHoleComplete} />
      </div>
    );
  }

  // ── Dashboard (sphere reveal or normal) ─────────────────────────────────────
  return (
    <div
      className={phase === 'sphere' ? 'animate-sphere-reveal' : ''}
      style={{ width: '100%', height: '100%' }}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="explorer" element={<TelemetryExplorerPage />} />
            <Route path="plots" element={<PlotBuilderPage />} />
            <Route path="sensors" element={<SensorsPage />} />
            <Route path="history" element={<DataHistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}
