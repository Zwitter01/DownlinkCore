import { useState } from 'react'
import { useMissionStore } from './stores/missionStore'

export interface Driver { id: string; name: string; chip: string; desc: string; fields: string[]; color: string; unit: string; base: number; range: number }

export const DRIVERS: Driver[] = [
  { id: 'mpu6050', name: 'MPU6050', chip: 'IMU', desc: 'Accelerometer and gyroscope for attitude and motion.', fields: ['Accel XYZ', 'Gyro XYZ', 'Temp'], color: '#a78bfa', unit: 'g', base: 1, range: 0.3 },
  { id: 'bmp280', name: 'BMP280', chip: 'BARO', desc: 'Barometric pressure, temperature and altitude.', fields: ['Pressure', 'Temperature', 'Altitude'], color: '#22d3ee', unit: 'hPa', base: 1008, range: 6 },
  { id: 'dht11', name: 'DHT11', chip: 'CLIMATE', desc: 'Onboard humidity and temperature monitoring.', fields: ['Humidity', 'Temperature'], color: '#34d399', unit: '%', base: 48, range: 8 },
  { id: 'gps', name: 'GPS / NEO-6M', chip: 'NAV', desc: 'Position, speed, satellites and fix status.', fields: ['Lat / Lon', 'Speed', 'Satellites', 'Fix'], color: '#fbbf24', unit: 'km/h', base: 42, range: 14 },
]

export default function DriverSelect({ onContinue }: { onContinue: (ids: string[]) => void }) {
  const mission = useMissionStore()
  const [sel, setSel] = useState<string[]>(
    mission.configuredSensorIds && mission.configuredSensorIds.length >= 2
      ? mission.configuredSensorIds
      : ['dht11', 'mpu6050', 'bmp280', 'gps']
  )
  const [name, setName] = useState(mission.missionName || 'VYOMAASTRA-1')
  const [simulate, setSimulate] = useState(false)
  const [wsUrl, setWsUrl] = useState(
    mission.wsUrl && !mission.wsUrl.startsWith('sim') ? mission.wsUrl : 'ws://localhost:8081'
  )
  const [device, setDevice] = useState(mission.deviceId || 'esp32-rx')
  const field = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/70 focus:bg-white/[0.07]'
  const go = () => {
    mission.completeMission({ missionName: name || 'VYOMAASTRA-1', deviceId: device, wsUrl: simulate ? 'sim://demo' : wsUrl, configuredSensorIds: sel })
    onContinue(sel)
  }
  const toggle = (id: string) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const all = sel.length === DRIVERS.length

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #150a35 0%, #06050e 60%, #020208 100%)' }}>
      <div className="absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />
      <div className="absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[120px]" />

      <div className="relative z-10 w-full max-w-4xl">
        <p className="rise text-center text-xs tracking-[0.4em] text-violet-300/70">STEP 2 OF 2 · PAYLOAD CONFIGURATION</p>
        <h1 className="rise mt-3 text-center text-3xl font-semibold sm:text-4xl" style={{ animationDelay: '.1s' }}>Select your sensor drivers</h1>
        <p className="rise mt-2 text-center text-white/50" style={{ animationDelay: '.2s' }}>Choose the drivers your CubeSat carries. Only these will stream into the dashboard.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {DRIVERS.map((d, i) => {
            const on = sel.includes(d.id)
            return (
              <button key={d.id} onClick={() => toggle(d.id)} aria-pressed={on}
                className="rise group relative overflow-hidden rounded-2xl border p-6 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 active:scale-[.98]"
                style={{
                  animationDelay: `${0.25 + i * 0.1}s`,
                  borderColor: on ? d.color : 'rgba(255,255,255,.1)',
                  background: on ? `linear-gradient(135deg, ${d.color}26, rgba(255,255,255,.03))` : 'rgba(255,255,255,.03)',
                  boxShadow: on ? `0 0 40px -8px ${d.color}99, inset 0 1px 0 rgba(255,255,255,.1)` : 'inset 0 1px 0 rgba(255,255,255,.06)',
                }}>
                <div className="flex items-start justify-between">
                  <span className="rounded-full border px-2.5 py-0.5 text-[10px] tracking-[0.25em]" style={{ borderColor: `${d.color}80`, color: d.color }}>{d.chip}</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300"
                    style={{ borderColor: on ? d.color : 'rgba(255,255,255,.25)', background: on ? d.color : 'transparent', transform: on ? 'scale(1.1)' : 'scale(1)' }}>
                    {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#000" strokeWidth="2.2"><path d="M2 6.5l2.5 2.5L10 3" /></svg>}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold">{d.name}</h3>
                <p className="mt-1 text-sm text-white/55">{d.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {d.fields.map(f => <span key={f} className="rounded-md bg-white/[0.06] px-2 py-1 text-xs text-white/60">{f}</span>)}
                </div>
              </button>
            )
          })}
        </div>

        <div className="rise mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl" style={{ animationDelay: '.65s' }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-white/50">Mission name<input value={name} onChange={e => setName(e.target.value)} className={`${field} mt-1`} /></label>
            <label className="text-xs text-white/50">Device ID<input value={device} onChange={e => setDevice(e.target.value)} className={`${field} mt-1`} /></label>
            <label className="text-xs text-white/50">Bridge WebSocket
              <input value={simulate ? 'Simulated telemetry' : wsUrl} disabled={simulate} onChange={e => setWsUrl(e.target.value)} className={`${field} mt-1 disabled:opacity-40`} /></label>
          </div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-white/60">
            <input type="checkbox" checked={simulate} onChange={e => setSimulate(e.target.checked)} className="h-4 w-4 accent-violet-500" />
            Use simulated telemetry (no hardware needed)
          </label>
        </div>

        <div className="rise mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row" style={{ animationDelay: '.7s' }}>
          <button onClick={() => setSel(all ? [] : DRIVERS.map(d => d.id))} className="text-sm text-violet-300 transition hover:text-fuchsia-300">
            {all ? 'Clear all' : 'Select all'} · {sel.length} of {DRIVERS.length} selected
          </button>
          <button disabled={!sel.length} onClick={go}
            className="sheen relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 px-8 py-3.5 font-medium text-white shadow-[0_10px_40px_-8px_rgba(192,38,211,.7)] transition-all hover:-translate-y-0.5 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
            <span className="relative z-10">Dive into the sphere</span>
          </button>
        </div>
      </div>
    </div>
  )
}
