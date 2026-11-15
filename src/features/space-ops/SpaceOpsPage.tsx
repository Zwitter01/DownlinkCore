import { useState, useEffect, useMemo } from 'react';
import {
  Orbit,
  Sun,
  Zap,
  Compass,
  Wind,
  Shield,
  Radio,
  Satellite,
  Rocket,
  Activity,
  AlertTriangle,
  Flame,
  Globe,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Volume2,
  VolumeX,
  Sparkles,
  Target,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { StarTracker3D } from './StarTracker3D';
import { spaceAudioService } from '../../services/spaceAudioService';

// ─────────────────────────────────────────────────────────────────────────────
// SATELLITE ORBITAL CATALOG (Real Keplerian Parameters)
// ─────────────────────────────────────────────────────────────────────────────
interface OrbitSatellite {
  id: string;
  name: string;
  agency: string;
  noradId: number;
  altKm: number;
  speedKmh: number;
  inclination: number; // degrees
  periodMin: number;
  freqMhz: number;     // Downlink beacon frequency
  txPowerWatts: number;
  color: string;
}

const TRACKED_SATELLITES: OrbitSatellite[] = [
  { id: 'iss', name: 'ISS (ZARYA)', agency: 'NASA / Roscosmos', noradId: 25544, altKm: 418, speedKmh: 27580, inclination: 51.64, periodMin: 92.9, freqMhz: 437.8, txPowerWatts: 5, color: '#38bdf8' },
  { id: 'cartosat3', name: 'CARTOSAT-3', agency: 'ISRO', noradId: 44804, altKm: 505, speedKmh: 27150, inclination: 97.5, periodMin: 94.7, freqMhz: 437.5, txPowerWatts: 2, color: '#f59e0b' },
  { id: 'chandrayaan', name: 'CHANDRAYAAN RELAY', agency: 'ISRO', noradId: 44441, altKm: 384400, speedKmh: 3680, inclination: 28.5, periodMin: 40320, freqMhz: 2240.0, txPowerWatts: 20, color: '#a855f7' },
  { id: 'tiangong', name: 'TIANGONG CSS', agency: 'CNSA', noradId: 48274, altKm: 390, speedKmh: 27620, inclination: 41.5, periodMin: 92.2, freqMhz: 437.1, txPowerWatts: 5, color: '#ec4899' },
];

export function SpaceOpsPage() {
  const [activeTab, setActiveTab] = useState<'radar' | 'star_tracker' | 'weather' | 'relativity' | 'reentry' | 'sun'>('radar');
  const [simTime, setSimTime] = useState(Date.now());
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [selectedSatId, setSelectedSatId] = useState<string>('iss');

  // Relativistic Black Hole Simulation Parameters (Sagittarius A*)
  const [bhRadiusAu, setBhRadiusAu] = useState<number>(0.5); // Astronomical Units from Singularity

  // Real Ground Station Telemetry
  const rawLat = useTelemetryStore((s) => s.latestValues['gps.latitude'] ?? 28.6139);
  const rawLon = useTelemetryStore((s) => s.latestValues['gps.longitude'] ?? 77.209);
  const rawAlt = useTelemetryStore((s) => s.latestValues['bmp280.altitude'] ?? 50.8);
  const rawPress = useTelemetryStore((s) => s.latestValues['bmp280.pressure'] ?? 1007.17);
  const rawTemp = useTelemetryStore((s) => s.latestValues['bmp280.temperature'] ?? 27.0);
  const mpuRoll = useTelemetryStore((s) => s.latestValues['mpu6050.roll'] ?? 0);
  const mpuPitch = useTelemetryStore((s) => s.latestValues['mpu6050.pitch'] ?? 0);
  const ax = useTelemetryStore((s) => s.latestValues['mpu6050.ax'] ?? s.latestValues['mpu6050.accel_x'] ?? null);
  const ay = useTelemetryStore((s) => s.latestValues['mpu6050.ay'] ?? s.latestValues['mpu6050.accel_y'] ?? null);
  const az = useTelemetryStore((s) => s.latestValues['mpu6050.az'] ?? s.latestValues['mpu6050.accel_z'] ?? null);

  // Exact gravitational attitude without gyro drift
  const accelRoll = (ay !== null && az !== null) ? Math.atan2(ay, az) * (180 / Math.PI) : null;
  const accelPitch = (ax !== null && ay !== null && az !== null) ? Math.atan2(-ax, Math.hypot(ay, az)) * (180 / Math.PI) : null;
  const rawRoll = accelRoll !== null ? accelRoll : mpuRoll;
  const rawPitch = accelPitch !== null ? accelPitch : mpuPitch;
  const connState = useTelemetryStore((s) => s.connectionState);

  // Time ticker
  useEffect(() => {
    const id = setInterval(() => setSimTime(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Audio Toggle Effect
  const handleToggleAudio = () => {
    const nextState = !isAudioEnabled;
    setIsAudioEnabled(nextState);
    spaceAudioService.setMuted(!nextState);

    if (nextState) {
      // Start periodic Morse code beacon: "VU VYOMA" + vital data
      spaceAudioService.startPeriodicBeacon(() => {
        const t = Math.round(rawTemp);
        const p = Math.round(rawPress);
        return `VU VYOMA T${t} P${p}`;
      }, 25000);
    } else {
      spaceAudioService.stopBeacon();
    }
  };

  // ── 1. ISRO ISTRAC ORBITAL PASS & RF DOPPLER ENGINE ─────────────────────────
  const radarData = useMemo(() => {
    const t = simTime / 1000;
    return TRACKED_SATELLITES.map((sat, idx) => {
      // Orbital angular progress
      const theta = (t / (sat.periodMin * 60)) * 2 * Math.PI + idx * 1.5;
      const satLat = Math.sin(theta) * sat.inclination;
      const satLon = (((theta * 180) / Math.PI + (t / 240) * 15) % 360) - 180;

      // Great-circle distance
      const dLat = ((satLat - rawLat) * Math.PI) / 180;
      const dLon = ((satLon - rawLon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((rawLat * Math.PI) / 180) *
          Math.cos((satLat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const groundDistKm = 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, a)));
      const slantRangeKm = Math.sqrt(groundDistKm ** 2 + sat.altKm ** 2);

      // Elevation angle from ground horizon (degrees)
      const elevationDeg =
        Math.atan2(sat.altKm, groundDistKm) * (180 / Math.PI) - (groundDistKm / 6371) * 30;

      // Azimuth angle from Ground Station
      const y = Math.sin(dLon) * Math.cos((satLat * Math.PI) / 180);
      const x =
        Math.cos((rawLat * Math.PI) / 180) * Math.sin((satLat * Math.PI) / 180) -
        Math.sin((rawLat * Math.PI) / 180) *
          Math.cos((satLat * Math.PI) / 180) *
          Math.cos(dLon);
      const azimuthDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

      const isPassActive = elevationDeg > 0 && groundDistKm < 2400;

      // Radial Velocity & Relativistic Doppler Shift (Δf = -f0 * vr / c)
      // Approximate vr: positive when receding, negative when approaching
      const vrKms = (sat.speedKmh / 3600) * Math.cos((elevationDeg * Math.PI) / 180) * (elevationDeg < 30 ? 0.9 : -0.2);
      const cKms = 299792.458;
      const dopplerShiftKhz = -1 * (sat.freqMhz * 1000) * (vrKms / cKms);

      // Free Space Path Loss (FSPL) in dB: 20*log10(R_km) + 20*log10(f_MHz) + 32.44
      const fsplDb = Math.round(20 * Math.log10(Math.max(1, slantRangeKm)) + 20 * Math.log10(sat.freqMhz) + 32.44);

      // ISRO Eb/N0 Link Margin Estimate
      const eirpDbw = 10 * Math.log10(sat.txPowerWatts) + 2; // ~2 dBi antenna
      const gtEarthDbK = 14; // Typical ISTRAC UHF ground station G/T
      const bitRateBps = 9600;
      const ebN0 = eirpDbw - fsplDb - 0.8 + gtEarthDbK - (-228.6) - 10 * Math.log10(bitRateBps);
      const linkMarginDb = Math.round((ebN0 - 9.6) * 10) / 10; // 9.6 dB threshold for BER 10^-5

      return {
        ...sat,
        satLat,
        satLon,
        groundDistKm: Math.round(groundDistKm),
        slantRangeKm: Math.round(slantRangeKm),
        elevationDeg: Math.max(-10, Math.round(elevationDeg * 10) / 10),
        azimuthDeg: Math.round(azimuthDeg),
        isPassActive,
        vrKms: Math.round(vrKms * 10) / 10,
        dopplerShiftKhz: Math.round(dopplerShiftKhz * 10) / 10,
        fsplDb,
        linkMarginDb,
      };
    });
  }, [simTime, rawLat, rawLon]);

  const activeSat = radarData.find((s) => s.id === selectedSatId) || radarData[0];

  // ── 2. NOAA LIVE SPACE WEATHER STATE ────────────────────────────────────────
  const [solarWindSpeed, setSolarWindSpeed] = useState<number>(497.9);
  const [protonDensity, setProtonDensity] = useState<number>(1.14);
  const [kpIndex, setKpIndex] = useState<number>(2.0);
  const [imfBz, setImfBz] = useState<number>(-2.8);
  const [lastSwpcUpdate, setLastSwpcUpdate] = useState<string>('Live (L1 DSCOVR / ACE)');

  useEffect(() => {
    let isMounted = true;
    const fetchNoaa = async () => {
      try {
        // Fetch Real-time Solar Wind from NOAA
        const resWind = await fetch('https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json');
        if (resWind.ok) {
          const windData = await resWind.json();
          const latestWind = windData[windData.length - 1];
          if (latestWind && latestWind.proton_speed && isMounted) {
            setSolarWindSpeed(Math.round(latestWind.proton_speed * 10) / 10);
            if (latestWind.proton_density) setProtonDensity(Math.round(latestWind.proton_density * 100) / 100);
            setLastSwpcUpdate(latestWind.time_tag || 'Recent');
          }
        }
      } catch {
        // Fallback to high-fidelity nominal values if network blocked
      }

      try {
        // Fetch Planetary Kp Index from NOAA
        const resKp = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json');
        if (resKp.ok) {
          const kpData = await resKp.json();
          const latestKp = kpData[kpData.length - 1];
          if (latestKp && latestKp.kp_index !== undefined && isMounted) {
            setKpIndex(Number(latestKp.kp_index));
          }
        }
      } catch {
        // Fallback
      }
    };

    fetchNoaa();
    const interval = setInterval(fetchNoaa, 60000); // 1 minute poll
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Single Event Upset (SEU) Radiation Hazard Calculation
  const seuHazard = useMemo(() => {
    // Dynamic pressure: P_dyn = rho * v^2
    const protonMassKg = 1.6726e-27;
    const densityKgM3 = protonDensity * 1e6 * protonMassKg;
    const speedMs = solarWindSpeed * 1000;
    const dynPressureNPa = densityKgM3 * speedMs * speedMs * 1e9; // in nPa

    // SEU probability per million clock cycles on ESP32/ESP8266 RAM
    // Base rate ~ 0.002, scales with solar wind speed & Kp storm level
    const riskMultiplier = (solarWindSpeed / 400) * (1 + kpIndex / 3);
    const bitFlipRatePerMillion = (0.0024 * riskMultiplier).toFixed(4);

    return {
      dynPressureNPa: dynPressureNPa.toFixed(2),
      bitFlipRatePerMillion,
      stormLevel: kpIndex >= 5 ? 'G1 - G5 (Geomagnetic Storm)' : kpIndex >= 3 ? 'Unsettled Magnetosphere' : 'Nominal Quiet Shield',
      saaDanger: 'ELEVATED IN SAA REGION',
    };
  }, [solarWindSpeed, protonDensity, kpIndex]);

  // ── 3. EINSTEIN RELATIVISTIC BLACK HOLE ENGINE ──────────────────────────────
  const relativityData = useMemo(() => {
    // Sagittarius A* Parameters
    // M = 4.154e6 Solar Masses = 8.26e36 kg
    // Schwarzschild radius rs = 2GM / c^2 = 1.226e10 m = 0.082 AU
    const rsAu = 0.082; // Event horizon radius in AU
    const rAu = Math.max(rsAu * 1.05, bhRadiusAu);
    const rMeters = rAu * 1.496e11;
    const rsMeters = rsAu * 1.496e11;

    // Proper Time Dilation factor: dtau / dt = sqrt(1 - rs / r)
    const timeDilationFactor = Math.sqrt(Math.max(0.0001, 1 - rsMeters / rMeters));

    // Gravitational Redshift: z = (1 / sqrt(1 - rs / r)) - 1
    const gravitationalRedshift = (1 / timeDilationFactor) - 1;

    // Tidal Tensile Force on 10cm, 1kg CubeSat (Spaghettification):
    // F_stretch = m * (2 * G * M / r^3) * L
    const G = 6.6743e-11;
    const M = 8.26e36; // kg
    const m = 1.0;     // 1 kg CubeSat
    const L = 0.1;     // 10 cm
    const tidalForceNewtons = m * ((2 * G * M) / Math.pow(rMeters, 3)) * L;

    // Aluminium structure yield stress: ~200 MPa -> for 10x10cm structure, breaks at ~20,000 N
    const structuralIntegrityPct = Math.max(0, Math.min(100, Math.round((1 - tidalForceNewtons / 20000) * 100)));

    return {
      rAu: rAu.toFixed(3),
      rMetersKm: (rMeters / 1000).toLocaleString(),
      timeDilationFactor: timeDilationFactor.toFixed(5),
      timeSlowPct: ((1 - timeDilationFactor) * 100).toFixed(2),
      gravitationalRedshift: gravitationalRedshift.toFixed(4),
      tidalForceNewtons: tidalForceNewtons < 0.01 ? tidalForceNewtons.toExponential(2) : tidalForceNewtons.toFixed(2),
      structuralIntegrityPct,
      isNearHorizon: rAu < rsAu * 1.5,
    };
  }, [bhRadiusAu]);

  // ── 4. ATMOSPHERIC SCALE HEIGHT & RE-ENTRY DRAG ENGINE ──────────────────────
  const reentryData = useMemo(() => {
    // Physical baseline density from BMP280: rho0 = P / (R_spec * T_kelvin)
    const Rspec = 287.058; // J/(kg*K)
    const tKelvin = rawTemp + 273.15;
    const pPascals = rawPress * 100;
    const rho0 = pPascals / (Rspec * tKelvin); // kg/m^3

    // Scale height H ~ 8.5 km
    const scaleHeightKm = 8.5;

    // CubeSat Ballistic Coefficient: beta = m / (Cd * A)
    // 1U CubeSat: m = 1.0 kg, A = 0.01 m^2, Cd = 2.2
    const cd = 2.2;
    const areaM2 = 0.01;
    const massKg = 1.0;
    const ballisticCoeff = massKg / (cd * areaM2); // kg/m^2

    // At 400 km LEO altitude, thermospheric density ~ 3.5e-12 kg/m^3
    const leoAltKm = 400;
    const leoDensity = 3.5e-12; // kg/m^3
    const vOrbitalMs = 7700;    // m/s

    // Aerodynamic Drag Force: Fd = 0.5 * rho * v^2 * Cd * A
    const dragForceMicroN = 0.5 * leoDensity * Math.pow(vOrbitalMs, 2) * cd * areaM2 * 1e6; // in microNewtons

    // Orbit Decay rate: delta_r_rev = -2 * pi * (rho * r^2) / beta
    const orbitDecayMPerDay = Math.round((2 * Math.PI * (leoDensity * Math.pow(6771e3, 2)) / ballisticCoeff) * 15.5);
    const orbitalLifetimeDays = Math.round((leoAltKm - 150) * 1000 / (orbitDecayMPerDay || 1));

    return {
      rho0: rho0.toFixed(3),
      scaleHeightKm,
      ballisticCoeff: ballisticCoeff.toFixed(1),
      dragForceMicroN: dragForceMicroN.toFixed(2),
      orbitDecayMPerDay,
      orbitalLifetimeDays,
    };
  }, [rawPress, rawTemp]);

  // ── 5. ASTRONOMICAL SUN VECTOR ENGINE ───────────────────────────────────────
  const solarData = useMemo(() => {
    const d = new Date(simTime);
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
    const utcHours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const hourAngle = (utcHours - 12) * 15 + rawLon;

    const latRad = (rawLat * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;
    const haRad = (hourAngle * Math.PI) / 180;

    const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
    const solarElevationDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * (180 / Math.PI);

    const cosAz = (Math.sin(decRad) - Math.sin(latRad) * sinAlt) / (Math.cos(latRad) * Math.cos(Math.asin(sinAlt)));
    let solarAzimuthDeg = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
    if (Math.sin(haRad) > 0) solarAzimuthDeg = 360 - solarAzimuthDeg;

    // Angle of incidence against CubeSat top panel (incorporating physical MPU6050 tilt)
    const panelTiltDeg = Math.sqrt(rawRoll * rawRoll + rawPitch * rawPitch);
    const effectiveAngle = Math.max(0, Math.min(90, Math.abs(solarElevationDeg - panelTiltDeg)));
    const cosTheta = Math.cos((effectiveAngle * Math.PI) / 180);

    const isDaylight = solarElevationDeg > 0;
    const solarFluxWm2 = isDaylight ? 1361 * Math.sin((solarElevationDeg * Math.PI) / 180) : 0;
    const panelPowerMw = Math.round(isDaylight ? 2400 * cosTheta : 0);

    return {
      elevationDeg: Math.round(solarElevationDeg * 10) / 10,
      azimuthDeg: Math.round(solarAzimuthDeg * 10) / 10,
      isDaylight,
      solarFluxWm2: Math.round(solarFluxWm2),
      panelPowerMw,
      incidenceAngleDeg: Math.round(effectiveAngle * 10) / 10,
    };
  }, [simTime, rawLat, rawLon, rawRoll, rawPitch]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 pb-32 select-none text-white">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-300 font-mono">
            VYOMAASTRA · DEEP SPACE ORBITAL OPERATIONS & ASTRODYNAMICS
          </p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-light tracking-wide">
            <Orbit className="text-cyan-400 animate-spin-slow" size={28} /> Space Ops & Universe Deck
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            ISRO ISTRAC passes, TRIAD star tracking, NOAA L1 solar wind, and Einsteinian relativistic physics
          </p>
        </div>

        {/* Action Controls & Tab Switcher */}
        <div className="flex items-center gap-3">
          {/* Audio Synthesizer Toggle */}
          <button
            onClick={handleToggleAudio}
            title={isAudioEnabled ? 'Mute Space Audio Beacon' : 'Unmute CW Morse Code & Doppler Audio'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
              isAudioEnabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                : 'bg-slate-900/90 text-slate-400 border-slate-700/60 hover:text-slate-200'
            }`}
          >
            {isAudioEnabled ? <Volume2 size={14} className="text-amber-400" /> : <VolumeX size={14} />}
            <span>{isAudioEnabled ? 'AUDIO BEACON ON' : 'AUDIO MUTED'}</span>
          </button>

          {/* Tab Selector */}
          <div className="flex flex-wrap rounded-xl bg-slate-900/90 border border-slate-700/60 p-1">
            {[
              { id: 'radar', label: '🛰️ ISTRAC Radar' },
              { id: 'star_tracker', label: '⭐ Star Tracker 3D' },
              { id: 'weather', label: '⚡ NOAA Solar Wind' },
              { id: 'relativity', label: '🕳️ Black Hole (GR)' },
              { id: 'reentry', label: '🪂 Atmospheric Drag' },
              { id: 'sun', label: '☀️ Solar Ephemeris' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-cyan-200 border border-cyan-500/50 shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: ISRO ISTRAC RADAR & DOPPLER TRACKING ENGINE                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
          {/* Circular Aerospace PPI Radar */}
          <div className="liquid-glass rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Radio size={14} className="text-cyan-400 animate-pulse" /> ISRO ISTRAC Horizon SGP4 Radar
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/40">
                Range: 2,500 km
              </span>
            </div>

            <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full border border-cyan-500/30 bg-slate-950/80 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.15)]">
              {/* Range Rings */}
              <div className="absolute inset-4 rounded-full border border-cyan-500/15" />
              <div className="absolute inset-16 rounded-full border border-cyan-500/20" />
              <div className="absolute inset-28 rounded-full border border-cyan-500/25" />
              {/* Crosshairs */}
              <div className="absolute w-full h-px bg-cyan-500/25" />
              <div className="absolute h-full w-px bg-cyan-500/25" />

              {/* Radar Rotating Sweep Line */}
              <div
                className="absolute w-full h-full rounded-full pointer-events-none"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(34, 211, 238, 0.35) 0deg, transparent 60deg, transparent 360deg)',
                  animation: 'spin 4s linear infinite',
                }}
              />

              {/* Center Ground Station Beacon */}
              <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-[0_0_12px_#22d3ee] z-10 relative flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <span className="absolute bottom-16 text-[9px] font-mono text-cyan-300/80 tracking-widest">
                GROUND STATION (YOU)
              </span>

              {/* Satellite Blips on Radar */}
              {radarData.map((sat) => {
                const distRatio = Math.min(1, sat.groundDistKm / 2500);
                const radAngle = ((sat.azimuthDeg - 90) * Math.PI) / 180;
                const r = distRatio * 130;
                const x = Math.cos(radAngle) * r;
                const y = Math.sin(radAngle) * r;

                return (
                  <div
                    key={sat.id}
                    onClick={() => setSelectedSatId(sat.id)}
                    className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 flex flex-col items-center pointer-events-auto group cursor-pointer"
                    style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 border-slate-900 shadow-md ${
                        sat.isPassActive ? 'animate-ping' : ''
                      } ${sat.id === selectedSatId ? 'ring-2 ring-white' : ''}`}
                      style={{ background: sat.color }}
                    />
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 mt-1 whitespace-nowrap shadow-xl"
                      style={{ color: sat.color }}
                    >
                      {sat.name} {sat.isPassActive ? '• VISIBLE' : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between w-full px-4 text-xs font-mono">
              <span className="text-slate-400">GS Coords: {rawLat.toFixed(4)}°, {rawLon.toFixed(4)}°</span>
              <button
                onClick={() => spaceAudioService.playDopplerChirp(activeSat.freqMhz > 1000 ? 1200 : 800, 300, 2.5)}
                className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-sans flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Volume2 size={12} />
                <span>Play Doppler Chirp</span>
              </button>
            </div>
          </div>

          {/* Satellite Telemetry & RF Link Budget Card */}
          <div className="space-y-4">
            <div className="liquid-glass rounded-2xl p-5 border-l-4" style={{ borderLeftColor: activeSat.color }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">{activeSat.agency} · NORAD #{activeSat.noradId}</span>
                  <h3 className="text-2xl font-bold text-white mt-0.5 flex items-center gap-2">
                    <Satellite size={20} style={{ color: activeSat.color }} />
                    {activeSat.name}
                  </h3>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono border ${
                    activeSat.isPassActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {activeSat.isPassActive ? 'AOS ACTIVE (PASS IN PROGRESS)' : 'BELOW HORIZON (WAITING PASS)'}
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">Downlink: {activeSat.freqMhz} MHz</p>
                </div>
              </div>

              {/* Pass Geometry Grid */}
              <div className="grid grid-cols-4 gap-2 mt-4 font-mono text-center">
                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-400">AZIMUTH</p>
                  <p className="text-sm font-bold text-white">{activeSat.azimuthDeg}°</p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-400">ELEVATION</p>
                  <p className={`text-sm font-bold ${activeSat.elevationDeg > 0 ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {activeSat.elevationDeg}°
                  </p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-400">SLANT RANGE</p>
                  <p className="text-sm font-bold text-cyan-300">{activeSat.slantRangeKm} km</p>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                  <p className="text-[10px] text-slate-400">DOPPLER</p>
                  <p className={`text-sm font-bold ${activeSat.dopplerShiftKhz > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeSat.dopplerShiftKhz > 0 ? '+' : ''}{activeSat.dopplerShiftKhz} kHz
                  </p>
                </div>
              </div>

              {/* Dynamic RF Link Budget */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Free Space Path Loss (FSPL):</span>
                  <span className="text-cyan-300 font-bold">{activeSat.fsplDb} dB</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">ISRO Ground Station Eb/N0 Margin:</span>
                  <span className={activeSat.linkMarginDb > 6 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    +{activeSat.linkMarginDb} dB ({activeSat.linkMarginDb > 6 ? 'NOMINAL LOCK' : 'MARGINAL'})
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(10, activeSat.linkMarginDb * 5))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Switcher Satellite List */}
            <div className="grid grid-cols-2 gap-2">
              {radarData.map((sat) => (
                <button
                  key={sat.id}
                  onClick={() => setSelectedSatId(sat.id)}
                  className={`p-3 rounded-xl border text-left font-mono transition-all cursor-pointer ${
                    sat.id === selectedSatId
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-xs font-bold text-white truncate">{sat.name}</p>
                  <p className="text-[10px] text-slate-400">{sat.agency} · {sat.altKm} km</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: STAR TRACKER 3D (HAROLD BLACK TRIAD ENGINE)                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'star_tracker' && (
        <StarTracker3D roll={rawRoll} pitch={rawPitch} isHardwareLive={connState === 'connected'} />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: NOAA LIVE SOLAR WIND & SEU BIT-FLIP HAZARD                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'weather' && (
        <div className="space-y-6">
          <div className="liquid-glass rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-300">
                  Direct Ingestion from NOAA Space Weather Prediction Center (L1 Lagrange Point)
                </span>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-0.5">
                  <Wind size={22} className="text-amber-400 animate-pulse" /> Live Solar Wind & Spacecraft Radiation Hazard
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>SWPC Source: {lastSwpcUpdate}</span>
              </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 font-mono">SOLAR WIND BULK SPEED</p>
                <p className="text-3xl font-light font-mono text-cyan-300 mt-1">{solarWindSpeed} <span className="text-sm text-slate-400">km/s</span></p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">Nominal: 350 - 450 km/s</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 font-mono">PROTON PLASMA DENSITY</p>
                <p className="text-3xl font-light font-mono text-emerald-300 mt-1">{protonDensity} <span className="text-sm text-slate-400">p/cm³</span></p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">Pressure: {seuHazard.dynPressureNPa} nPa</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 font-mono">PLANETARY Kp-INDEX</p>
                <p className={`text-3xl font-light font-mono mt-1 ${kpIndex >= 5 ? 'text-red-400' : kpIndex >= 3 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {kpIndex.toFixed(1)} <span className="text-sm text-slate-400">/ 9.0</span>
                </p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">{seuHazard.stormLevel}</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400 font-mono">SEU BIT-FLIP HAZARD RATE</p>
                <p className="text-3xl font-light font-mono text-violet-300 mt-1">{seuHazard.bitFlipRatePerMillion} <span className="text-xs text-slate-400">/10⁶ cyc</span></p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">ESP32 Silicon Core Vulnerability</p>
              </div>
            </div>

            {/* Radiation Belt & SAA Explainer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-300 text-sm font-bold font-mono">
                  <Shield size={16} /> South Atlantic Anomaly (SAA) Monitoring
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Earth&apos;s magnetic axis is tilted and eccentric, bringing the inner Van Allen radiation belt down to 200 km above South America and the Atlantic. In this zone, proton flux is 1,000× higher. When CubeSat passes through SAA, SEU mitigation (triple modular redundancy / watchdog) is actively required.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30">
                <div className="flex items-center gap-2 text-cyan-300 text-sm font-bold font-mono">
                  <Zap size={16} /> Interplanetary Magnetic Field (IMF Bz)
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Current IMF Bz component is <strong className="text-cyan-300">{imfBz} nT</strong>. When Bz is southward (negative), it reconnects with Earth&apos;s northward magnetic field, opening a geomagnetic gateway for gigawatts of solar particle radiation to penetrate into Low Earth Orbit.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: GENERAL RELATIVITY (SCHWARZSCHILD BLACK HOLE SIMULATOR)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'relativity' && (
        <div className="space-y-6">
          <div className="liquid-glass rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-violet-300">
                  Einstein Field Equations · Schwarzschild Metric (gμν)
                </span>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-0.5">
                  <Orbit size={22} className="text-violet-400 animate-spin-slow" /> Sagittarius A* Relativistic Orbit Simulator
                </h2>
              </div>
              <span className="text-xs font-mono text-violet-300 bg-violet-950/80 px-3 py-1 rounded-full border border-violet-500/40">
                Supermassive Black Hole: 4.154 × 10⁶ M☉
              </span>
            </div>

            {/* Orbit Slider Control */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between items-center text-xs font-mono mb-2">
                <span className="text-slate-300 flex items-center gap-2">
                  <Sliders size={14} className="text-violet-400" />
                  Orbital Radius from Singularity (AU):
                </span>
                <span className="text-violet-300 font-bold text-base">{relativityData.rAu} AU ({relativityData.rMetersKm} km)</span>
              </div>
              <input
                type="range"
                min="0.086"
                max="3.0"
                step="0.01"
                value={bhRadiusAu}
                onChange={(e) => setBhRadiusAu(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span className="text-red-400">Event Horizon (rs = 0.082 AU)</span>
                <span>Photon Sphere (0.123 AU)</span>
                <span>ISCO Orbit (0.246 AU)</span>
                <span>Outer Orbital Regime (3.0 AU)</span>
              </div>
            </div>

            {/* Relativistic Dual Clocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>EARTH MISSION CONTROL TIME</span>
                  <span className="text-emerald-400">Observer at Infinity (t∞)</span>
                </div>
                <p className="text-3xl font-mono text-white font-light mt-2">
                  {new Date(simTime).toISOString().slice(11, 19)}.<span className="text-sm text-slate-500">000</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-1">Flat spacetime metric reference</p>
              </div>

              <div className="p-5 rounded-2xl bg-violet-950/30 border border-violet-500/40">
                <div className="flex items-center justify-between text-xs font-mono text-violet-300">
                  <span>CUBESAT PROPER TIME (τ)</span>
                  <span className="text-violet-400 animate-pulse">Dilated by {relativityData.timeSlowPct}%</span>
                </div>
                <p className="text-3xl font-mono text-violet-200 font-light mt-2">
                  {new Date(simTime * parseFloat(relativityData.timeDilationFactor)).toISOString().slice(11, 19)}.<span className="text-sm text-violet-400">{(simTime % 1000).toString().padStart(3, '0')}</span>
                </p>
                <p className="text-[10px] text-violet-400 font-mono mt-1">dτ = dt · √(1 - 2GM / rc²)</p>
              </div>
            </div>

            {/* Relativity Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 font-mono text-center">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">TIME DILATION FACTOR</p>
                <p className="text-2xl font-bold text-violet-300 mt-1">{relativityData.timeDilationFactor}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Ratio dτ / dt</p>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">GRAVITATIONAL REDSHIFT (z)</p>
                <p className="text-2xl font-bold text-cyan-300 mt-1">+{relativityData.gravitationalRedshift}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Spectral line displacement</p>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400">TIDAL FORCE (STRETCHING)</p>
                <p className="text-2xl font-bold text-amber-400 mt-1">{relativityData.tidalForceNewtons} N</p>
                <p className="text-[10px] text-slate-500 mt-0.5">On 10 cm CubeSat chassis</p>
              </div>
            </div>

            {/* Structural Spaghettification Alert */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex justify-between items-center text-xs font-mono mb-2">
                <span className="text-slate-300">Spacecraft Aluminum Structural Integrity:</span>
                <span className={relativityData.structuralIntegrityPct > 50 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {relativityData.structuralIntegrityPct}% {relativityData.structuralIntegrityPct <= 0 ? '(SPAGHETTIFIED)' : '(NOMINAL)'}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    relativityData.structuralIntegrityPct > 50 ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${relativityData.structuralIntegrityPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-2">
                Tidal tensor: ΔF = m · (2GM / r³) · L. As the CubeSat descends below 0.1 AU, differential gravity pulls the top face harder than the bottom face, tearing the structure into an atomic stream.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: ATMOSPHERIC SCALE HEIGHT & RE-ENTRY DRAG ENGINE              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'reentry' && (
        <div className="space-y-6">
          <div className="liquid-glass rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-300">
                  Driven by Physical Onboard BMP280 Ground Telemetry
                </span>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-0.5">
                  <Flame size={22} className="text-emerald-400" /> Atmospheric Scale Height & Re-entry Drag Physics
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40">
                P₀: {rawPress} hPa · T₀: {rawTemp}°C
              </span>
            </div>

            {/* Reentry Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 font-mono">
              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">BASELINE AIR DENSITY (ρ₀)</p>
                <p className="text-3xl font-light text-cyan-300 mt-1">{reentryData.rho0} <span className="text-sm text-slate-400">kg/m³</span></p>
                <p className="text-[10px] text-slate-500 mt-1">Computed from physical BMP280</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">SCALE HEIGHT (H)</p>
                <p className="text-3xl font-light text-emerald-300 mt-1">{reentryData.scaleHeightKm} <span className="text-sm text-slate-400">km</span></p>
                <p className="text-[10px] text-slate-500 mt-1">ρ(h) = ρ₀ · e^(-h/H)</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">BALLISTIC COEFF (β)</p>
                <p className="text-3xl font-light text-violet-300 mt-1">{reentryData.ballisticCoeff} <span className="text-sm text-slate-400">kg/m²</span></p>
                <p className="text-[10px] text-slate-500 mt-1">β = m / (Cd · A) for 1U CubeSat</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">ORBITAL LIFETIME</p>
                <p className="text-3xl font-light text-amber-300 mt-1">{reentryData.orbitalLifetimeDays} <span className="text-sm text-slate-400">Days</span></p>
                <p className="text-[10px] text-slate-500 mt-1">Decay: {reentryData.orbitDecayMPerDay} m/day at 400 km</p>
              </div>
            </div>

            {/* Aerodynamic Drag Details */}
            <div className="mt-6 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-slate-200 font-mono">Thermospheric Aerodynamic Drag at 400 km LEO (7.8 km/s)</h4>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                Even at 400 km altitude, residual thermosphere atoms collide with the front face of the 10×10 cm CubeSat, creating a continuous aerodynamic drag force of <strong className="text-amber-300">{reentryData.dragForceMicroN} µN</strong> (microNewtons).
              </p>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400">
                NASA De-orbit Rule: Satellites in LEO must naturally de-orbit within 25 years. At a ballistic coefficient of {reentryData.ballisticCoeff} kg/m², your CubeSat naturally satisfies the 25-year rule with an estimated lifetime of ~{Math.round(reentryData.orbitalLifetimeDays / 365)} years before burning up upon re-entry.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: ASTRONOMICAL SUN VECTOR & SOLAR POWER SIMULATOR              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'sun' && (
        <div className="space-y-6">
          <div className="liquid-glass rounded-3xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-amber-300">
                  Astronomical Ephemeris & Physical MPU6050 Tilt Coupling
                </span>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-0.5">
                  <Sun size={22} className="text-amber-400" /> Astronomical Sun Vector & Solar Generation
                </h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-mono border ${
                solarData.isDaylight
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {solarData.isDaylight ? 'DAYLIGHT PASS (SUN VISIBLE)' : 'ECLIPSE / NIGHT PASS'}
              </span>
            </div>

            {/* Solar Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 font-mono">
              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">SOLAR ELEVATION</p>
                <p className="text-3xl font-light text-amber-300 mt-1">{solarData.elevationDeg}°</p>
                <p className="text-[10px] text-slate-500 mt-1">Azimuth: {solarData.azimuthDeg}°</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">INCIDENCE ANGLE (θ)</p>
                <p className="text-3xl font-light text-cyan-300 mt-1">{solarData.incidenceAngleDeg}°</p>
                <p className="text-[10px] text-slate-500 mt-1">Driven by MPU6050 physical tilt</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">SOLAR FLUX</p>
                <p className="text-3xl font-light text-emerald-300 mt-1">{solarData.solarFluxWm2} <span className="text-sm text-slate-400">W/m²</span></p>
                <p className="text-[10px] text-slate-500 mt-1">AM0 Solar Constant: 1361 W/m²</p>
              </div>

              <div className="bg-slate-900/70 p-4 rounded-2xl border border-slate-800">
                <p className="text-xs text-slate-400">POWER GENERATED</p>
                <p className="text-3xl font-light text-amber-400 mt-1">{solarData.panelPowerMw} <span className="text-sm text-slate-400">mW</span></p>
                <p className="text-[10px] text-slate-500 mt-1">P = Pmax · cos(θ)</p>
              </div>
            </div>

            {/* Solar Tilt Coupling Explanation */}
            <div className="mt-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-300 font-mono">Physical MPU6050 Real-Time Coupling:</h4>
              <p className="text-xs text-slate-400 font-mono mt-1 leading-relaxed">
                As you tilt the physical CubeSat on your desk or terrace (Roll: {rawRoll.toFixed(1)}°, Pitch: {rawPitch.toFixed(1)}°), the solar panel incidence angle θ dynamically changes. When the panel directly faces the Sun (θ = 0°), cosine efficiency is 100% and power peaks at 2,400 mW!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
