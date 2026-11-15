import { useMemo } from 'react';
import { Globe, Signal, AlertCircle } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';

// ─────────────────────────────────────────────────────────────────────────────
// GPS Map Widget — Black Hole / Deep Space Geospatial Tracker
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  title?: string;
}

export function GpsMapWidget({ title = 'GPS Position & Ground Track' }: Props) {
  const latitude = useTelemetryStore(s => s.latestValues['gps.latitude'] ?? null);
  const longitude = useTelemetryStore(s => s.latestValues['gps.longitude'] ?? null);
  const altitude = useTelemetryStore(s => s.latestValues['gps.altitude'] ?? null);
  const speed = useTelemetryStore(s => s.latestValues['gps.speed'] ?? null);
  const satellites = useTelemetryStore(s => s.latestValues['gps.satellites'] ?? null);
  const gpsFix = useTelemetryStore(s => s.latestValues['gps.gpsFix'] ?? s.latestValues['gps.fix'] ?? null);
  const timestamp = useTelemetryStore(s => s.latestTimestamps['gps.latitude'] ?? s.latestTimestamps['gps.gpsFix'] ?? null);
  const connState = useTelemetryStore(s => s.connectionState);

  const hasData = gpsFix !== null || satellites !== null;
  const hasLock = (gpsFix !== null && gpsFix > 0) && latitude !== null && longitude !== null && !(latitude === 0 && longitude === 0);
  const isStale = connState === 'stale' || (timestamp && Date.now() - timestamp > 10000);

  const status = !hasData ? 'WAITING' : !hasLock ? 'NO FIX' : isStale ? 'STALE' : 'LIVE';
  const statusColor = status === 'LIVE'
    ? 'text-[#c026d3] bg-[#7c3aed]/15 border-[#c026d3]/40 shadow-[0_0_10px_rgba(192,38,211,0.3)]'
    : status === 'NO FIX'
    ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
    : status === 'STALE'
    ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30'
    : 'text-white/40 bg-white/[0.04] border-white/[0.08]';

  // Map projection: Equirectangular mapping from [-180, 180] and [-90, 90] to percent [0, 100%]
  const mapPoint = useMemo(() => {
    if (!hasLock || latitude === null || longitude === null) return null;
    const x = ((longitude + 180) / 360) * 100;
    const y = ((90 - latitude) / 180) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }, [hasLock, latitude, longitude]);

  return (
    <div className="h-full flex flex-col bg-transparent p-3.5 overflow-hidden select-none">
      {/* Top Bar Readout */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-[#c026d3]" />
          <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">{title}</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border font-medium ${statusColor}`}>
            {status}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-white/50">
            <Signal size={12} className={satellites && satellites >= 4 ? 'text-[#c026d3]' : 'text-white/30'} />
            <span>Sats: <strong className="text-white font-medium">{satellites !== null ? satellites : '—'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-white/50">
            <span>Fix: <strong className={hasLock ? 'text-[#c026d3]' : 'text-[#f59e0b]'}>{gpsFix !== null ? (gpsFix === 1 ? '3D' : gpsFix === 2 ? 'DGPS' : 'None') : '—'}</strong></span>
          </div>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="flex-1 min-h-0 my-2 relative rounded-xl border border-white/[0.08] bg-[#000000] overflow-hidden flex items-center justify-center shadow-inner">
        {/* Deep space coordinate grid & continents */}
        <svg className="w-full h-full opacity-80" viewBox="0 0 360 180" preserveAspectRatio="none">
          <defs>
            <pattern id="gps-void-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(124, 58, 237, 0.08)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="360" height="180" fill="url(#gps-void-grid)" />
          {/* Prime meridian and equator */}
          <line x1="180" y1="0" x2="180" y2="180" stroke="rgba(192, 38, 211, 0.3)" strokeWidth="0.75" strokeDasharray="3 3" />
          <line x1="0" y1="90" x2="360" y2="90" stroke="rgba(192, 38, 211, 0.3)" strokeWidth="0.75" strokeDasharray="3 3" />

          {/* Stylized continent outlines with violet singularity glow */}
          <path
            d="M 60,35 Q 85,25 100,45 T 70,80 T 50,50 Z
               M 75,95 Q 90,90 100,115 T 85,155 T 70,120 Z
               M 160,30 Q 190,20 220,35 T 190,65 T 155,50 Z
               M 170,75 Q 195,70 200,95 T 185,140 T 160,105 Z
               M 230,35 Q 290,25 320,50 T 270,85 T 225,55 Z
               M 280,110 Q 315,105 320,135 T 275,145 Z"
            fill="rgba(124, 58, 237, 0.08)"
            stroke="rgba(124, 58, 237, 0.25)"
            strokeWidth="0.75"
          />
        </svg>

        {/* Live Coordinate Crosshair Beacon */}
        {hasLock && mapPoint ? (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700 pointer-events-none"
            style={{ left: `${mapPoint.x}%`, top: `${mapPoint.y}%` }}
          >
            {/* Pulsing ring */}
            <div className="w-8 h-8 rounded-full bg-[#c026d3]/25 border border-[#c026d3] animate-ping absolute -top-4 -left-4" />
            {/* Center target point */}
            <div className="w-3.5 h-3.5 rounded-full bg-[#c026d3] border-2 border-black shadow-[0_0_12px_#c026d3] relative flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
            {/* Crosshair lines */}
            <div className="w-12 h-px bg-[#c026d3]/60 absolute top-1.5 -left-4 pointer-events-none" />
            <div className="h-12 w-px bg-[#c026d3]/60 absolute -top-4 left-1.5 pointer-events-none" />
          </div>
        ) : (
          /* No Fix / Waiting Overlay */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center">
            <AlertCircle size={22} className="text-[#f59e0b] mb-1.5 animate-pulse" />
            <p className="text-xs font-semibold text-white/80">
              {status === 'WAITING' ? 'Awaiting GPS Telemetry' : 'No Valid GPS Fix'}
            </p>
            <p className="text-[11px] text-white/40 max-w-xs mt-0.5">
              {status === 'WAITING'
                ? 'Check that receiver ESP8266 is transmitting GPS packets.'
                : 'GPS receiver is active. Satellite lock in progress.'}
            </p>
          </div>
        )}

        {/* Coordinate HUD Tag */}
        <div className="absolute bottom-2 left-2 bg-black/85 backdrop-blur-md border border-white/[0.1] rounded-xl px-2.5 py-1 font-mono text-[10px] text-white/70 flex gap-3 shadow-lg">
          <span>Lat: <strong className="text-[#c026d3] font-medium">{hasLock && latitude !== null ? latitude.toFixed(5) : 'N/A'}</strong></span>
          <span>Lon: <strong className="text-[#c026d3] font-medium">{hasLock && longitude !== null ? longitude.toFixed(5) : 'N/A'}</strong></span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/[0.06] font-mono text-center text-xs">
        <div className="bg-white/[0.04] p-2 rounded-xl border border-white/[0.06] backdrop-blur-md">
          <p className="text-[10px] text-white/40 uppercase font-medium">Latitude</p>
          <p className="font-semibold text-white truncate mt-0.5">{hasLock && latitude !== null ? `${latitude.toFixed(4)}°` : 'N/A'}</p>
        </div>
        <div className="bg-white/[0.04] p-2 rounded-xl border border-white/[0.06] backdrop-blur-md">
          <p className="text-[10px] text-white/40 uppercase font-medium">Longitude</p>
          <p className="font-semibold text-white truncate mt-0.5">{hasLock && longitude !== null ? `${longitude.toFixed(4)}°` : 'N/A'}</p>
        </div>
        <div className="bg-white/[0.04] p-2 rounded-xl border border-white/[0.06] backdrop-blur-md">
          <p className="text-[10px] text-white/40 uppercase font-medium">Altitude</p>
          <p className="font-semibold text-[#c026d3] truncate mt-0.5">{altitude !== null ? `${altitude.toFixed(1)} m` : 'N/A'}</p>
        </div>
        <div className="bg-white/[0.04] p-2 rounded-xl border border-white/[0.06] backdrop-blur-md">
          <p className="text-[10px] text-white/40 uppercase font-medium">Speed</p>
          <p className="font-semibold text-white truncate mt-0.5">{speed !== null ? `${speed.toFixed(1)} km/h` : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
