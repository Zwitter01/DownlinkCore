import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { sensorRegistry } from '../../features/sensors/registry';
import { formatDistanceToNow } from 'date-fns';
import { Compass, AlertTriangle, Eye, RotateCcw, Target } from 'lucide-react';

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
  const lastPacketNo = useTelemetryStore(s => s.diagnostics.lastPacketNo);

  const [webGlSupported, setWebGlSupported] = useState(true);
  const [isManualRotate, setIsManualRotate] = useState(false);

  // Tare offsets (calibrates current physical resting position to 0° Roll, 0° Pitch)
  const [tareRoll, setTareRoll] = useState<number>(() => {
    const v = localStorage.getItem('vyoma_cubesat_tare_roll');
    return v ? parseFloat(v) : 0;
  });
  const [tarePitch, setTarePitch] = useState<number>(() => {
    const v = localStorage.getItem('vyoma_cubesat_tare_pitch');
    return v ? parseFloat(v) : 0;
  });

  // Axis inversion controls (defaults invertRoll = true to fix left/right inversion)
  const [invertRoll, setInvertRoll] = useState<boolean>(() => {
    const v = localStorage.getItem('vyoma_invert_roll');
    return v !== null ? v === 'true' : true;
  });
  const [invertPitch, setInvertPitch] = useState<boolean>(() => {
    const v = localStorage.getItem('vyoma_invert_pitch');
    return v !== null ? v === 'true' : false;
  });

  const toggleInvertRoll = () => {
    setInvertRoll(prev => {
      const next = !prev;
      localStorage.setItem('vyoma_invert_roll', next.toString());
      return next;
    });
  };

  const toggleInvertPitch = () => {
    setInvertPitch(prev => {
      const next = !prev;
      localStorage.setItem('vyoma_invert_pitch', next.toString());
      return next;
    });
  };

  // References for animation loop
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const currentEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const satelliteGroupRef = useRef<THREE.Group | null>(null);

  // Drift-free physical orientation calculation:
  // Gravity vector (atan2 of accelerometer axes) provides absolute physical attitude relative to Earth.
  const accelRoll = (ay !== null && az !== null) ? Math.atan2(ay, az) * (180 / Math.PI) : null;
  const accelPitch = (ax !== null && ay !== null && az !== null) ? Math.atan2(-ax, Math.hypot(ay, az)) * (180 / Math.PI) : null;

  // Use pure gravity vector by default, with graceful fallback to roll/pitch
  const rawRoll = accelRoll !== null ? accelRoll : (roll !== null ? roll : null);
  const rawPitch = accelPitch !== null ? accelPitch : (pitch !== null ? pitch : null);

  // Calibrated Euler angles relative to desk level tare
  const displayRoll = rawRoll !== null ? ((rawRoll - tareRoll + 540) % 360) - 180 : null;
  const displayPitch = rawPitch !== null ? ((rawPitch - tarePitch + 540) % 360) - 180 : null;

  const handleTare = () => {
    if (rawRoll !== null && rawPitch !== null) {
      setTareRoll(rawRoll);
      setTarePitch(rawPitch);
      localStorage.setItem('vyoma_cubesat_tare_roll', rawRoll.toString());
      localStorage.setItem('vyoma_cubesat_tare_pitch', rawPitch.toString());
    }
  };

  const handleResetTare = () => {
    setTareRoll(0);
    setTarePitch(0);
    localStorage.removeItem('vyoma_cubesat_tare_roll');
    localStorage.removeItem('vyoma_cubesat_tare_pitch');
  };

  // Update target angles whenever live telemetry changes
  useEffect(() => {
    if (displayRoll !== null && displayPitch !== null) {
      const effectiveRoll = invertRoll ? -displayRoll : displayRoll;
      const effectivePitch = invertPitch ? displayPitch : -displayPitch;
      targetEuler.current.set(
        THREE.MathUtils.degToRad(effectivePitch),
        0,
        THREE.MathUtils.degToRad(effectiveRoll),
        'YXZ'
      );
    }
  }, [displayRoll, displayPitch, invertRoll, invertPitch]);

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
    scene.background = new THREE.Color(0x02030a);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 200);

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    // Studio reflections so the metal reads as metal
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    // Sun key light, cold rim from Earthshine
    const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
    sun.position.set(6, 5, 4);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6d8cff, 1.1);
    rim.position.set(-6, -2, -5);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x8890b0, 0.18));

    // ── Textures ─────────────────────────────────────────────────────────────
    const tex = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const mkCanvas = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')!] as const; };

    // Triple-junction solar cells: 2 x 4 grid of cells, each with busbars and fine gridlines
    const solarTexture = () => {
      const [cv, g] = mkCanvas(512, 512);
      g.fillStyle = '#0a0f24'; g.fillRect(0, 0, 512, 512);
      const cols = 2, rows = 4, gap = 8, cw = 512 / cols, ch = 512 / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = c * cw + gap, y = r * ch + gap, w = cw - gap * 2, h = ch - gap * 2;
        const grad = g.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, '#2b55d4'); grad.addColorStop(0.5, '#1a3aa6'); grad.addColorStop(1, '#3a66e0');
        g.fillStyle = grad; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y, w, 5);                 // clipped-corner shading
        g.strokeStyle = 'rgba(190,210,255,.28)'; g.lineWidth = 1;
        for (let k = 3; k < h; k += 5) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + w, y + k); g.stroke(); }
        g.fillStyle = 'rgba(225,232,250,.9)';                                      // silver busbars
        for (const f of [0.25, 0.5, 0.75]) g.fillRect(x + w * f - 1.5, y, 3, h);
      }
      return tex(cv);
    };
    const labelTexture = (text: string, sub: string) => {
      const [cv, g] = mkCanvas(512, 96);
      g.fillStyle = '#10131c'; g.fillRect(0, 0, 512, 96);
      g.fillStyle = '#f5f7fb'; g.font = '700 44px sans-serif'; g.textAlign = 'center'; g.fillText(text, 256, 46);
      g.fillStyle = '#d9a22e'; g.font = '500 20px monospace'; g.fillText(sub, 256, 78);
      g.strokeStyle = '#d9a22e'; g.lineWidth = 3; g.strokeRect(3, 3, 506, 90);
      return tex(cv);
    };

    // ── Materials: brushed aluminium frame, gold Kapton, dark anodized hardware ─
    const alu = new THREE.MeshStandardMaterial({ color: 0xcfd3da, roughness: 0.32, metalness: 1 });
    const aluDark = new THREE.MeshStandardMaterial({ color: 0x8c93a1, roughness: 0.4, metalness: 1 });
    const anod = new THREE.MeshStandardMaterial({ color: 0x1b2030, roughness: 0.45, metalness: 0.85 });
    const goldFoil = new THREE.MeshStandardMaterial({ color: 0xe0a92e, roughness: 0.18, metalness: 1 });
    const solarMat = new THREE.MeshStandardMaterial({ map: solarTexture(), metalness: 0.55, roughness: 0.2 });
    const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0d4d33, roughness: 0.5, metalness: 0.3 });
    const chipMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0f, roughness: 0.6, metalness: 0.4 });
    const screwMat = new THREE.MeshStandardMaterial({ color: 0xd9a22e, metalness: 1, roughness: 0.25 });
    const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x1a2f8f, roughness: 0.02, metalness: 0.3, clearcoat: 1, emissive: 0x0a1a66, emissiveIntensity: 0.7 });

    // ── 1U CubeSat (kept as a cube, scaled up so attitude changes are easy to read) ─
    const S = 1.0, H = S / 2, POST = 0.15, BAR = 0.075, DEPTH = 0.07;
    const satGroup = new THREE.Group();
    satGroup.scale.setScalar(1.3);
    satelliteGroupRef.current = satGroup;
    scene.add(satGroup);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, parent: THREE.Object3D = satGroup) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
    };

    // Corner posts: dark anodized blocks with gold screws; raised feet top and bottom
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const c = H - POST / 2;
      add(new THREE.BoxGeometry(POST, POST, POST), anod, sx * c, sy * c, sz * c);
      add(new THREE.BoxGeometry(0.085, 0.07, 0.085), aluDark, sx * c, sy * (H + 0.025), sz * c);
      add(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 12), screwMat, sx * c, sy * (H + 0.065), sz * c);
      // screw heads on the two outward-facing sides of each post
      const sx1 = add(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), screwMat, sx * (H + 0.002), sy * c, sz * c);
      sx1.rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12), screwMat, sx * c, sy * c, sz * (H + 0.002)).rotation.x = Math.PI / 2;
    }
    // Edge bars: brushed aluminium, with gold Kapton tape stripes on the vertical ones
    const bl = S - POST * 2;
    for (const a1 of [-1, 1]) for (const a2 of [-1, 1]) {
      add(new THREE.BoxGeometry(bl, BAR, BAR), alu, 0, a1 * (H - BAR / 2), a2 * (H - BAR / 2));
      add(new THREE.BoxGeometry(BAR, BAR, bl), alu, a1 * (H - BAR / 2), a2 * (H - BAR / 2), 0);
      const v = add(new THREE.BoxGeometry(BAR, bl, BAR), alu, a1 * (H - BAR / 2), 0, a2 * (H - BAR / 2));
      void v;
      add(new THREE.BoxGeometry(BAR + 0.006, bl * 0.55, BAR + 0.006), goldFoil, a1 * (H - BAR / 2), 0, a2 * (H - BAR / 2));
    }

    // Closed faces: every side is a solid panel flush between the corner posts
    type Kind = 'solar' | 'camera' | 'base';
    const buildFace = (kind: Kind) => {
      const f = new THREE.Group();
      const inner = S - POST * 2 + 0.02;
      add(new THREE.BoxGeometry(inner, inner, 0.04), aluDark, 0, 0, 0, f);
      const top = kind === 'base' ? alu : solarMat;
      add(new THREE.BoxGeometry(inner - 0.08, inner - 0.08, 0.02), [aluDark, aluDark, aluDark, aluDark, top, aluDark], 0, 0, 0.03, f);
      if (kind === 'camera') {
        add(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 40), chipMat, 0, 0, 0.08, f).rotation.x = Math.PI / 2;
        add(new THREE.TorusGeometry(0.17, 0.018, 16, 48), goldFoil, 0, 0, 0.12, f);
        const lens = add(new THREE.SphereGeometry(0.14, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), lensGlass, 0, 0, 0.11, f);
        lens.rotation.x = Math.PI / 2;
      }
      if (kind === 'base') {
        const n = add(new THREE.CylinderGeometry(0.05, 0.14, 0.12, 32, 1, true), goldFoil, 0, 0, 0.09, f);
        n.rotation.x = Math.PI / 2; (n.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      }
      return f;
    };
    const faces: Array<[Kind, [number, number, number], [number, number, number]]> = [
      ['solar', [0, 0, H - 0.03], [0, 0, 0]],
      ['solar', [0, 0, -H + 0.03], [0, Math.PI, 0]],
      ['solar', [H - 0.03, 0, 0], [0, Math.PI / 2, 0]],
      ['solar', [-H + 0.03, 0, 0], [0, -Math.PI / 2, 0]],
      ['camera', [0, H - 0.03, 0], [-Math.PI / 2, 0, 0]],
      ['base', [0, -H + 0.03, 0], [Math.PI / 2, 0, 0]],
    ];
    for (const [k, pos, rot] of faces) { const f = buildFace(k); f.position.set(...pos); f.rotation.set(...rot); satGroup.add(f); }

    // Name plate on the +Z lower bar, remove-before-flight tag on a corner post
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.08), new THREE.MeshStandardMaterial({ map: labelTexture('VYOMAASTRA-1', '1U CUBESAT · FLIGHT MODEL'), roughness: 0.4, metalness: 0.5 }));
    plate.position.set(0, -H + BAR / 2, H + 0.003); satGroup.add(plate);

    // Stowed whip antennas bent out from the top corners
    for (const [sx, sz] of [[-1, 1], [1, -1]]) {
      const w = add(new THREE.CylinderGeometry(0.006, 0.006, 0.7, 8), alu, sx * 0.45, H + 0.3, sz * 0.45);
      w.rotation.z = -sx * 0.35; w.rotation.x = sz * 0.35;
    }

    // Body axes (X red, Y green, Z blue)
    satGroup.add(new THREE.AxesHelper(1.0));

    // ── Backdrop: clean star field only ──
    const starPos = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(90 + Math.random() * 20);
      starPos.set([v.x, v.y, v.z], i * 3);
    }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe6ecff, size: 0.32, sizeAttenuation: true })));


    // ── Orbit camera: drag to look around, strictly stationary unless moved by user ─
    let theta = 0.8, phi = 1.0, radius = 5.2, dragging = false, lastX = 0, lastY = 0;
    const placeCamera = () => {
      camera.position.set(radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.cos(theta));
      camera.lookAt(0, 0, 0);
    };
    placeCamera();

    const el = renderer.domElement;
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      theta -= (e.clientX - lastX) * 0.008; phi = Math.min(2.6, Math.max(0.5, phi - (e.clientY - lastY) * 0.006));
      lastX = e.clientX; lastY = e.clientY;
      placeCamera();
    };
    const up = () => { dragging = false; el.style.cursor = 'grab'; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.min(9, Math.max(2.8, radius + e.deltaY * 0.005));
      placeCamera();
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });

    // ── Animation Loop ───────────────────────────────────────────────────────
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, clock.getDelta());

      // Lock CubeSat position: zero artificial floating or bobbing
      satGroup.position.y = 0;

      if (satGroup) {
        // Continuous, critically damped interpolation (prevents jerky 1-second freeze-and-burst motion)
        const lerpFactor = 1 - Math.exp(-9.0 * delta);
        currentEuler.current.x = THREE.MathUtils.lerp(currentEuler.current.x, targetEuler.current.x, lerpFactor);
        currentEuler.current.y = THREE.MathUtils.lerp(currentEuler.current.y, targetEuler.current.y, lerpFactor);
        currentEuler.current.z = THREE.MathUtils.lerp(currentEuler.current.z, targetEuler.current.z, lerpFactor);

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
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
      pmrem.dispose();
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
  const statusColor = isLive ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : isStale ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-slate-400 bg-slate-800/60 border-slate-700/40';

  if (!webGlSupported) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-slate-900/60">
        <AlertTriangle size={32} className="text-amber-400 mb-2" />
        <p className="text-slate-300 font-medium text-sm">WebGL Unavailable</p>
        <p className="text-slate-500 text-xs mt-1">Please enable WebGL hardware acceleration in your browser to view the 3D CubeSat model.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-slate-950/60 overflow-hidden select-none">
      {/* 3D Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full min-h-0 relative" />

      {/* Floating HUD Telemetry Readout */}
      <div className="absolute top-2 left-3 pointer-events-none">
        <div className="flex items-center gap-1.5 mb-1">
          <Compass size={13} className="text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">CubeSat Attitude</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${statusColor}`}>
            {statusLabel}
          </span>
          {lastPacketNo !== null && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              PKT #{lastPacketNo}
            </span>
          )}
        </div>

        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-lg p-2 font-mono text-[11px] space-y-0.5 shadow-xl">
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Roll (X):</span>
            <span className="text-cyan-300 font-semibold">{displayRoll !== null ? `${displayRoll > 0 ? '+' : ''}${displayRoll.toFixed(1)}°` : 'N/A'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Pitch (Y):</span>
            <span className="text-cyan-300 font-semibold">{displayPitch !== null ? `${displayPitch > 0 ? '+' : ''}${displayPitch.toFixed(1)}°` : 'N/A'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Yaw (Z):</span>
            <span className="text-slate-500">N/A</span>
          </div>
          {ax !== null && (
            <div className="pt-1 border-t border-slate-800 flex justify-between gap-3 text-[10px] text-slate-400">
              <span>Accel:</span>
              <span className="text-slate-300 font-mono">
                {ax.toFixed(2)}, {ay?.toFixed(2) ?? '0'}, {az?.toFixed(2) ?? '0'} m/s²
              </span>
            </div>
          )}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1 pointer-events-auto">
            <button
              onClick={handleTare}
              title="Calibrate current position as 0° flat on table"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-sans transition-all cursor-pointer"
            >
              <Target size={10} />
              <span>Level to Desk (0°)</span>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleInvertRoll}
                title="Flip Roll left/right axis direction"
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                  invertRoll
                    ? 'bg-violet-500/25 text-violet-300 border-violet-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                Invert: {invertRoll ? 'ON' : 'OFF'}
              </button>
              {(tareRoll !== 0 || tarePitch !== 0) && (
                <button
                  onClick={handleResetTare}
                  title="Reset Tare"
                  className="text-[9px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Last update footer */}
      {mpuTimestamp && (
        <div className="absolute bottom-1 right-2 text-[10px] text-slate-500 font-mono pointer-events-none">
          {formatDistanceToNow(new Date(mpuTimestamp), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}
