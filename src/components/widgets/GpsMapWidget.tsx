import { useEffect, useRef, useState, useMemo } from 'react';
import { MapPin, Navigation, Signal, Globe, AlertCircle, CheckCircle2, Radio, Layers, Crosshair } from 'lucide-react';
import { useTelemetryStore } from '../../stores/telemetryStore';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  title?: string;
}

type MapLayerType = 'satellite' | 'dark' | 'street';

const MAP_LAYERS: Record<MapLayerType, { name: string; url: string; attribution: string; maxZoom: number }> = {
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri World Imagery',
    maxZoom: 19,
  },
  dark: {
    name: 'Dark Space',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB & OpenStreetMap',
    maxZoom: 19,
  },
  street: {
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

export function GpsMapWidget({ title = 'GPS Position & Ground Track' }: Props) {
  const [layerType, setLayerType] = useState<MapLayerType>('satellite');
  const [autoCenter, setAutoCenter] = useState(true);

  const rawLat = useTelemetryStore(s => s.latestValues['gps.latitude'] ?? null);
  const rawLon = useTelemetryStore(s => s.latestValues['gps.longitude'] ?? null);
  const rawAlt = useTelemetryStore(s => {
    const gpsAlt = s.latestValues['gps.altitude'];
    const bmpAlt = s.latestValues['bmp280.altitude'];
    return (gpsAlt !== null && gpsAlt !== undefined && gpsAlt > 0) ? gpsAlt : (bmpAlt ?? null);
  });
  const rawSpeed = useTelemetryStore(s => s.latestValues['gps.speed'] ?? null);
  const rawSats = useTelemetryStore(s => s.latestValues['gps.satellites'] ?? null);
  const rawGpsFix = useTelemetryStore(s => s.latestValues['gps.gpsFix'] ?? s.latestValues['gps.fix'] ?? null);
  const timestamp = useTelemetryStore(s => s.latestTimestamps['gps.latitude'] ?? s.latestTimestamps['gps.gpsFix'] ?? null);
  const connState = useTelemetryStore(s => s.connectionState);

  // Check if real hardware has a valid GPS satellite lock
  const hasLock = Boolean(rawGpsFix && rawGpsFix > 0 && rawLat && rawLon && !(rawLat === 0 && rawLon === 0));

  // Ground altitude tare calibration (QFE - Above Ground Level vs MSL)
  const [altTare, setAltTare] = useState<number | null>(() => {
    const v = localStorage.getItem('vyoma_alt_tare');
    return v ? parseFloat(v) : null;
  });

  const latitude = hasLock ? rawLat : null;
  const longitude = hasLock ? rawLon : null;
  const mslAltitude = rawAlt;

  // Calculate Above Ground Level (AGL) altitude
  const aglAltitude = altTare !== null && mslAltitude !== null
    ? (mslAltitude - altTare)
    : (mslAltitude !== null ? Math.max(0, mslAltitude - 50.8) : null);

  const speed = rawSpeed;
  const satellites = rawSats;
  const gpsFix = rawGpsFix;

  const isConnected = connState === 'connected';
  const isStale = connState === 'stale' || (timestamp && Date.now() - timestamp > 10000);

  const status = !isConnected
    ? 'DISCONNECTED'
    : hasLock
    ? '3D FIX (LIVE)'
    : 'ACQUIRING (INDOORS)';

  const statusColor = !isConnected
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : hasLock
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  // ── Leaflet Map Refs ────────────────────────────────────────────────────────
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const trackRef = useRef<L.Polyline | null>(null);
  const trackHistoryRef = useRef<[number, number][]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = latitude ?? 28.6139;
    const initialLon = longitude ?? 77.2090;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // Add initial tile layer
    const layerConf = MAP_LAYERS[layerType];
    const tileLayer = L.tileLayer(layerConf.url, {
      maxZoom: layerConf.maxZoom,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Track Polyline
    const track = L.polyline([], {
      color: '#22d3ee',
      weight: 3,
      opacity: 0.85,
      dashArray: '4, 6',
    }).addTo(map);
    trackRef.current = track;

    // Satellite / Ground Beacon Icon
    const customIcon = L.divIcon({
      className: 'vyoma-sat-beacon',
      html: `
        <div style="position: relative; width: 36px; height: 36px; transform: translate(-18px, -18px);">
          <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(34, 211, 238, 0.25); border: 1.5px solid #22d3ee; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; top: 10px; left: 10px; width: 16px; height: 16px; border-radius: 50%; background: #22d3ee; border: 2.5px solid #0f172a; box-shadow: 0 0 14px 4px rgba(34, 211, 238, 0.9); display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; border-radius: 50%; background: #ffffff;"></div>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([initialLat, initialLon], { icon: customIcon, opacity: hasLock ? 1 : 0 }).addTo(map);
    markerRef.current = marker;

    // Coverage Footprint Circle (simulates nadir horizon footprint)
    const circle = L.circle([initialLat, initialLon], {
      radius: Math.max(300, (aglAltitude || 10) * 15),
      color: '#06b6d4',
      fillColor: '#06b6d4',
      fillOpacity: hasLock ? 0.12 : 0,
      opacity: hasLock ? 1 : 0,
      weight: 1.5,
    }).addTo(map);
    circleRef.current = circle;

    mapInstanceRef.current = map;

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when layerType changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const map = mapInstanceRef.current;
    map.removeLayer(tileLayerRef.current);

    const layerConf = MAP_LAYERS[layerType];
    const newTileLayer = L.tileLayer(layerConf.url, {
      maxZoom: layerConf.maxZoom,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
  }, [layerType]);

  // Update Coordinates, Marker Position, Coverage Circle & Track History
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (markerRef.current) {
      if (hasLock && latitude !== null && longitude !== null) {
        markerRef.current.setLatLng([latitude, longitude]);
        markerRef.current.setOpacity(1);
      } else {
        markerRef.current.setOpacity(0);
      }
    }

    if (circleRef.current) {
      if (hasLock && latitude !== null && longitude !== null) {
        circleRef.current.setLatLng([latitude, longitude]);
        const footprintRadius = Math.max(250, (aglAltitude || 15) * 18);
        circleRef.current.setRadius(footprintRadius);
        circleRef.current.setStyle({ opacity: 1, fillOpacity: 0.12 });
      } else {
        circleRef.current.setStyle({ opacity: 0, fillOpacity: 0 });
      }
    }

    if (trackRef.current && hasLock && latitude !== null && longitude !== null) {
      const newPos: [number, number] = [latitude, longitude];
      const history = trackHistoryRef.current;
      const lastPoint = history[history.length - 1];
      if (!lastPoint || lastPoint[0] !== latitude || lastPoint[1] !== longitude) {
        history.push(newPos);
        if (history.length > 300) history.shift();
        trackRef.current.setLatLngs(history);
      }
    }

    if (autoCenter && hasLock && latitude !== null && longitude !== null) {
      map.panTo([latitude, longitude], { animate: true, duration: 0.8 });
    }
  }, [latitude, longitude, aglAltitude, hasLock, autoCenter]);

  const handleCenter = () => {
    if (!mapInstanceRef.current || latitude === null || longitude === null) return;
    mapInstanceRef.current.setView([latitude, longitude], 15, { animate: true });
    setAutoCenter(true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-950/70 p-3 overflow-hidden select-none">
      {/* Top Bar Readout */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <Globe size={14} className="text-cyan-400" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${statusColor}`}>
            {status}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          {/* Layer switcher */}
          <div className="flex rounded-lg bg-slate-900/90 border border-slate-700/60 p-0.5">
            {(['satellite', 'dark', 'street'] as MapLayerType[]).map((type) => (
              <button
                key={type}
                onClick={() => setLayerType(type)}
                className={`px-2 py-0.5 text-[10px] rounded transition-all capitalize font-sans ${
                  layerType === type
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {type === 'satellite' ? '🛰️ Earth' : type === 'dark' ? '🌌 Cosmos' : '🗺️ Streets'}
              </button>
            ))}
          </div>

          {/* Hardware Connection Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-sans border bg-slate-900/90 border-slate-700/60">
            <div className={`w-1.5 h-1.5 rounded-full ${!isConnected ? 'bg-red-400' : hasLock ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
            <span className={!isConnected ? 'text-red-400' : hasLock ? 'text-emerald-300' : 'text-amber-300'}>
              {!isConnected ? 'Bridge Offline' : hasLock ? 'GPS Locked' : 'Searching SVs'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="flex-1 min-h-0 my-2 relative rounded-lg border border-slate-800 bg-[#06050e] overflow-hidden">
        {/* Leaflet Map DOM Node */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Center / Recenter Floating Button */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          <button
            onClick={handleCenter}
            title="Center on CubeSat coordinates"
            className="p-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-cyan-300 shadow-lg backdrop-blur-md transition-all cursor-pointer"
          >
            <Crosshair size={14} />
          </button>
        </div>

        {/* Coordinate HUD Tag */}
        <div className="absolute bottom-2 left-2 z-10 bg-slate-950/90 backdrop-blur-md border border-slate-700/70 rounded-lg px-2.5 py-1.5 font-mono text-[10px] text-slate-300 flex items-center gap-3 shadow-2xl">
          <div className="flex items-center gap-1 text-cyan-400 font-semibold">
            <MapPin size={11} />
            <span>{hasLock ? 'TARGET LOCK' : 'SEARCHING'}</span>
          </div>
          <span>Lat: <strong className="text-cyan-300">{hasLock && latitude !== null ? latitude.toFixed(5) : 'N/A'}</strong></span>
          <span>Lon: <strong className="text-cyan-300">{hasLock && longitude !== null ? longitude.toFixed(5) : 'N/A'}</strong></span>
          <span>Track: <strong className="text-emerald-400">{trackHistoryRef.current.length} pts</strong></span>
        </div>

        {/* No Fix / Disconnected Notice */}
        {!hasLock && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 p-4 text-center backdrop-blur-[2px] pointer-events-none">
            <AlertCircle size={26} className={!isConnected ? 'text-red-400 mb-2' : 'text-amber-400 mb-2 animate-pulse'} />
            <p className="text-xs font-semibold text-slate-100 uppercase tracking-wider">
              {!isConnected
                ? 'Ground Station Telemetry Offline'
                : 'Searching For GPS Satellites'}
            </p>
            <p className="text-[11px] text-slate-400 max-w-sm mt-1">
              {!isConnected
                ? 'Connect USB Receiver to PC and launch bridge (node bridge.js COM9) to stream real telemetry.'
                : 'Module is indoors (0 SVs visible through ceiling). Take CubeSat outdoors for open-sky 3D lock.'}
            </p>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-slate-800/60 font-mono text-center text-xs">
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase">Latitude</p>
          <p className="font-semibold text-white truncate">{hasLock && latitude !== null ? `${latitude.toFixed(4)}°` : 'NO LOCK'}</p>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase">Longitude</p>
          <p className="font-semibold text-white truncate">{hasLock && longitude !== null ? `${longitude.toFixed(4)}°` : 'NO LOCK'}</p>
        </div>
        <div
          onClick={() => {
            if (mslAltitude !== null) {
              setAltTare(mslAltitude);
              localStorage.setItem('vyoma_alt_tare', mslAltitude.toString());
            }
          }}
          title="Click to Tare (Zero) Ground Altitude"
          className="bg-slate-900/60 p-1.5 rounded border border-slate-800 cursor-pointer hover:border-cyan-500/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-500 uppercase">Altitude (AGL)</p>
            <span className="text-[8px] text-cyan-400 font-sans">ZERO</span>
          </div>
          <p className="font-semibold text-cyan-300 truncate">
            {aglAltitude !== null ? `${Math.max(0, aglAltitude).toFixed(1)} m` : mslAltitude !== null ? `${mslAltitude.toFixed(1)} m` : 'N/A'}
          </p>
          <p className="text-[9px] text-slate-500 truncate">MSL: {mslAltitude !== null ? `${mslAltitude.toFixed(0)}m` : 'N/A'}</p>
        </div>
        <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800">
          <p className="text-[10px] text-slate-500 uppercase">Speed</p>
          <p className="font-semibold text-emerald-300 truncate">{speed !== null ? `${speed.toFixed(1)} km/h` : '0.0 km/h'}</p>
        </div>
        <div className={`p-1.5 rounded border transition-colors ${satellites && satellites > 0 ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="flex items-center justify-center gap-1">
            <Signal size={10} className={satellites && satellites >= 4 ? 'text-emerald-400' : 'text-amber-400'} />
            <p className="text-[10px] text-slate-400 uppercase">Satellites</p>
          </div>
          <p className={`font-semibold truncate ${satellites && satellites >= 4 ? 'text-emerald-300' : satellites && satellites > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
            {satellites !== null ? `${satellites} ${satellites === 1 ? 'SV' : 'SVs'}` : isConnected ? '0 SVs' : 'OFFLINE'}
          </p>
          <p className="text-[9px] text-slate-500 truncate">{hasLock ? '3D Lock' : isConnected ? 'Indoors (0 Fix)' : 'Disconnected'}</p>
        </div>
      </div>
    </div>
  );
}
