import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './LoginPage'
import DriverSelect from './DriverSelect'
import Descent from './Descent'
import { AppLayout } from './app/AppLayout'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { TelemetryExplorerPage } from './features/telemetry/TelemetryExplorerPage'
import { PlotBuilderPage } from './features/plots/PlotBuilderPage'
import { SensorsPage } from './features/sensors/SensorsPage'
import { DataHistoryPage } from './features/history/DataHistoryPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { SpaceOpsPage } from './features/space-ops/SpaceOpsPage'
import { useMissionStore } from './stores/missionStore'
import { useDashboardStore } from './stores/dashboardStore'
import { telemetryService } from './services/telemetryService'
import { sensorRegistry } from './features/sensors/registry'

type Phase = 'login' | 'drivers' | 'descent' | 'dashboard'

export default function App() {
  const mission = useMissionStore()
  const initDefaultLayout = useDashboardStore(s => s.initDefaultLayout)
  const [phase, setPhase] = useState<Phase>('login')
  const [reveal, setReveal] = useState(false)
  const arrive = useCallback(() => { setReveal(true); setPhase('dashboard') }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [phase])

  // Start telemetry as soon as the mission (drivers + connection) is configured
  useEffect(() => {
    if (!mission.isSetupComplete) return
    sensorRegistry.enableSensors(mission.configuredSensorIds)
    initDefaultLayout(mission.configuredSensorIds)
    telemetryService.configure({
      wsUrl: mission.wsUrl,
      deviceId: mission.deviceId,
      missionId: mission.missionName,
      enabledSensorIds: mission.configuredSensorIds,
    })
    telemetryService.start()
    return () => { telemetryService.stop() }
  }, [mission.isSetupComplete, mission.wsUrl, mission.deviceId, mission.missionName, mission.configuredSensorIds, initDefaultLayout])

  if (phase === 'login') return <LoginPage onEnter={() => setPhase('drivers')} />
  if (phase === 'drivers') return <DriverSelect onContinue={() => setPhase('descent')} />
  if (phase === 'descent') return <Descent onArrive={arrive} />

  return (
    <div className="h-screen bg-[#06050e] overflow-hidden">
    <div className={`h-screen bg-[#06050e] ${reveal ? 'sphere-reveal' : ''}`}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="orbit" element={<SpaceOpsPage />} />
            <Route path="explorer" element={<TelemetryExplorerPage />} />
            <Route path="plots" element={<PlotBuilderPage />} />
            <Route path="sensors" element={<SensorsPage />} />
            <Route path="history" element={<DataHistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
    </div>
  )
}
