import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { formatDistanceToNow } from 'date-fns';
import { Compass, AlertTriangle } from 'lucide-react';

interface Props {
  title?: string;
}

export function CubeSatViewer({ title = 'CubeSat Attitude 3D' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Live telemetry subscriptions
  const roll = useTelemetryStore(s => s.latestValues['mpu6050.roll'] ?? null);
  const pitch = useTelemetryStore(s => s.latestValues['mpu6050.pitch'] ?? null);
  const ax = useTelemetryStore(s => s.latestValues['mpu6050.ax'] ?? s.latestValues['mpu6050.accel_x'] ?? null);
  const ay = useTelemetryStore(s => s.latestValues['mpu6050.ay'] ?? s.latestValues['mpu6050.accel_y'] ?? null);
  const az = useTelemetryStore(s => s.latestValues['mpu6050.az'] ?? s.latestValues['mpu6050.accel_z'] ?? null);
  const mpuTimestamp = useTelemetryStore(s => s.latestTimestamps['mpu6050.roll'] ?? s.latestTimestamps['mpu6050.ax'] ?? null);
  const connState = useTelemetryStore(s => s.connectionState);

  const [webGlSupported, setWebGlSupported] = useState(true);

  // References for animation loop
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const currentEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const satelliteGroupRef = useRef<THREE.Group | null>(null);

  // Update target angles whenever live telemetry changes
  useEffect(() => {
    if (roll !== null && pitch !== null) {
      const radPitch = THREE.MathUtils.degToRad(-pitch);
      const radRoll = THREE.MathUtils.degToRad(roll);
      targetEuler.current.set(radPitch, 0, radRoll, 'YXZ');
    }
  }, [roll, pitch]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030206);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(2.8, 2.2, 3.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }

    // Lights - Accretion illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xe879f9, 2.0); // Fuchsia accretion beam
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x818cf8, 1.0); // Violet secondary reflection
    dirLight2.position.set(-5, -3, -4);
    scene.add(dirLight2);

    // ── Build 1U CubeSat Spacecraft Model ────────────────────────────────────
    const satGroup = new THREE.Group();
    satelliteGroupRef.current = satGroup;
    scene.add(satGroup);

    // 1. Chassis Body (anodized dark space frame with violet undertones)
    const chassisGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x161226,
      roughness: 0.35,
      metalness: 0.85,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    satGroup.add(chassis);

    // 2. Gold/Amber rails along 12 edges
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const railThick = 0.08;
    const railLen = 1.42;

    const createRail = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const geo = new THREE.BoxGeometry(railThick, railLen, railThick);
      const m = new THREE.Mesh(geo, railMat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      satGroup.add(m);
    };

    // Vertical rails
    createRail(0.7, 0, 0.7);
    createRail(-0.7, 0, 0.7);
    createRail(0.7, 0, -0.7);
    createRail(-0.7, 0, -0.7);
    // Horizontal top/bottom rails
    createRail(0, 0.7, 0.7, 0, 0, Math.PI / 2);
    createRail(0, -0.7, 0.7, 0, 0, Math.PI / 2);
    createRail(0, 0.7, -0.7, 0, 0, Math.PI / 2);
    createRail(0, -0.7, -0.7, 0, 0, Math.PI / 2);
    createRail(0.7, 0.7, 0, Math.PI / 2, 0, 0);
    createRail(-0.7, 0.7, 0, Math.PI / 2, 0, 0);
    createRail(0.7, -0.7, 0, Math.PI / 2, 0, 0);
    createRail(-0.7, -0.7, 0, Math.PI / 2, 0, 0);

    // 3. Solar Panels on faces (Deep crystalline indigo with high reflectivity)
    const solarGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1e1548,
      roughness: 0.1,
      metalness: 0.85,
    });

    const addSolarPanel = (pos: [number, number, number], rot: [number, number, number]) => {
      const p = new THREE.Mesh(solarGeo, solarMat);
      p.position.set(...pos);
      p.rotation.set(...rot);
      satGroup.add(p);
    };

    addSolarPanel([0, 0, 0.71], [0, 0, 0]);           // +Z Face
    addSolarPanel([0, 0, -0.71], [0, Math.PI, 0]);    // -Z Face
    addSolarPanel([0.71, 0, 0], [0, Math.PI / 2, 0]); // +X Face
    addSolarPanel([-0.71, 0, 0], [0, -Math.PI / 2, 0]);// -X Face

    // 4. Optical Camera / Payload Aperture on +Z top-center
    const lensRingGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24);
    const lensRingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const lensRing = new THREE.Mesh(lensRingGeo, lensRingMat);
    lensRing.position.set(0, 0, 0.74);
    lensRing.rotation.x = Math.PI / 2;
    satGroup.add(lensRing);

    const lensGlassGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.09, 24);
    const lensGlassMat = new THREE.MeshStandardMaterial({ color: 0xc026d3, metalness: 0.95, roughness: 0.05 });
    const lensGlass = new THREE.Mesh(lensGlassGeo, lensGlassMat);
    lensGlass.position.set(0, 0, 0.74);
    lensGlass.rotation.x = Math.PI / 2;
    satGroup.add(lensGlass);

    // 5. Deployable Monopole Antenna on top (+Y)
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 12);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.1 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(0.4, 1.1, 0.4);
    satGroup.add(antenna);

    // 6. 3D Body Axes (X=Red, Y=Green, Z=Blue)
    const axes = new THREE.AxesHelper(1.1);
    satGroup.add(axes);

    // Cosmic coordinate reference grid
    const grid = new THREE.GridHelper(8, 16, 0x4c1d95, 0x1e1038);
    grid.position.y = -1.5;
    scene.add(grid);

    // ── Animation Loop ───────────────────────────────────────────────────────
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (satGroup) {
        currentEuler.current.x = THREE.MathUtils.lerp(currentEuler.current.x, targetEuler.current.x, 0.12);
        currentEuler.current.y = THREE.MathUtils.lerp(currentEuler.current.y, targetEuler.current.y, 0.12);
        currentEuler.current.z = THREE.MathUtils.lerp(currentEuler.current.z, targetEuler.current.z, 0.12);

        satGroup.rotation.copy(currentEuler.current);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Compute status
  const isStale = connState === 'stale' || (mpuTimestamp && Date.now() - mpuTimestamp > 10000);
  const isLive = (roll !== null || ax !== null) && connState === 'connected' && !isStale;
  const statusLabel = isLive ? 'LIVE' : isStale ? 'STALE' : 'WAITING';
  const statusColor = isLive
    ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
    : isStale
    ? 'text-amber-300 bg-amber-500/15 border-amber-500/35 shadow-[0_0_8px_rgba(251,191,36,0.25)]'
    : 'text-violet-300/70 bg-violet-950/40 border-violet-800/30';

  if (!webGlSupported) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-black/60 rounded-2xl border border-violet-500/20">
        <AlertTriangle size={32} className="text-amber-400 mb-2 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        <p className="text-slate-200 font-semibold text-sm">WebGL Hardware Acceleration Offline</p>
        <p className="text-violet-300/60 text-xs mt-1">Please enable WebGL in your browser to render the 3D CubeSat orientation mesh.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-transparent overflow-hidden select-none rounded-2xl">
      {/* 3D Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full min-h-0 relative" />

      {/* Floating HUD Telemetry Readout */}
      <div className="absolute top-2.5 left-3 pointer-events-none">
        <div className="flex items-center gap-2 mb-1.5">
          <Compass size={14} className="text-fuchsia-400 drop-shadow-[0_0_6px_rgba(232,121,249,0.8)]" />
          <span className="text-[11px] font-bold uppercase tracking-widest bg-gradient-to-r from-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
            CubeSat Attitude
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div
          className="rounded-xl p-2.5 font-mono text-[11px] space-y-1 shadow-2xl transition-all"
          style={{
            background: 'rgba(14, 10, 26, 0.80)',
            backdropFilter: 'blur(24px) saturate(190%)',
            WebkitBackdropFilter: 'blur(24px) saturate(190%)',
            border: '1px solid rgba(192, 38, 211, 0.28)',
            boxShadow: 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.12), 0 12px 30px -6px rgba(0, 0, 0, 0.75), 0 0 20px -5px rgba(192, 38, 211, 0.25)',
          }}
        >
          <div className="flex justify-between gap-5">
            <span className="text-violet-300/70">Roll (X):</span>
            <span className="text-fuchsia-300 font-bold tabular-nums">
              {roll !== null ? `${roll > 0 ? '+' : ''}${roll.toFixed(1)}°` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-violet-300/70">Pitch (Y):</span>
            <span className="text-fuchsia-300 font-bold tabular-nums">
              {pitch !== null ? `${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}°` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-slate-500">Yaw (Z):</span>
            <span className="text-slate-500 font-mono">N/A</span>
          </div>
          {ax !== null && (
            <div className="pt-1.5 border-t border-violet-500/20 flex justify-between gap-3 text-[10px] text-violet-300/70">
              <span>Accel:</span>
              <span className="text-slate-200 font-mono font-medium">
                {ax.toFixed(2)}, {ay?.toFixed(2) ?? '0'}, {az?.toFixed(2) ?? '0'} m/s²
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last update footer */}
      {mpuTimestamp && (
        <div className="absolute bottom-2 right-2 text-[10px] text-violet-400/60 font-mono pointer-events-none px-2 py-0.5 rounded-md bg-black/40 border border-violet-500/20">
          {formatDistanceToNow(new Date(mpuTimestamp), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}
