import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Compass, Target, Sparkles, Crosshair, Award } from 'lucide-react';

interface Props {
  roll: number;   // degrees from MPU6050
  pitch: number;  // degrees from MPU6050
  yaw?: number;
  isHardwareLive?: boolean;
}

interface CelestialObject {
  name: string;
  constellation: string;
  raHours: number;    // Right Ascension (0 - 24 hours)
  decDeg: number;     // Declination (-90 to +90 degrees)
  mag: number;        // Apparent magnitude (lower = brighter)
  color: string;
  desc: string;
}

const CELESTIAL_CATALOG: CelestialObject[] = [
  { name: 'Polaris', constellation: 'Ursa Minor (Dhruva Tara)', raHours: 2.53, decDeg: 89.3, mag: 1.98, color: '#fef08a', desc: 'North Celestial Pole marker' },
  { name: 'Sirius', constellation: 'Canis Major', raHours: 6.75, decDeg: -16.7, mag: -1.46, color: '#93c5fd', desc: 'Brightest star in Earth night sky' },
  { name: 'Betelgeuse', constellation: 'Orion', raHours: 5.92, decDeg: 7.4, mag: 0.5, color: '#f87171', desc: 'Red Supergiant in Orion shoulder' },
  { name: 'Rigel', constellation: 'Orion', raHours: 5.24, decDeg: -8.2, mag: 0.13, color: '#67e8f9', desc: 'Blue Supergiant in Orion foot' },
  { name: 'Vega', constellation: 'Lyra', raHours: 18.62, decDeg: 38.8, mag: 0.03, color: '#c084fc', desc: 'Standard zero-point photometric star' },
  { name: 'Arcturus', constellation: 'Boötes', raHours: 14.26, decDeg: 19.2, mag: -0.05, color: '#fb923c', desc: 'Brightest orange giant in Northern hemisphere' },
  { name: 'Dubhe (Ursa Maj)', constellation: 'Ursa Major (Saptarishi)', raHours: 11.06, decDeg: 61.8, mag: 1.79, color: '#fde047', desc: 'Pointer star to North Star' },
  { name: 'Schedar', constellation: 'Cassiopeia', raHours: 0.67, decDeg: 56.5, mag: 2.23, color: '#f472b6', desc: 'Alpha star of W-shaped Cassiopeia' },
];

export function StarTracker3D({ roll, pitch, yaw = 0, isHardwareLive = false }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const satelliteGroupRef = useRef<THREE.Group | null>(null);
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const currentEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));

  // Convert physical attitude to Celestial Boresight Vector (Right Ascension & Declination)
  const celestialBoresight = useMemo(() => {
    // Pitch corresponds to elevation/declination shift
    // Roll & Yaw rotate azimuth / Right Ascension (Invert roll to match physical left-to-left)
    const radPitch = (pitch * Math.PI) / 180;
    const radRoll = (-roll * Math.PI) / 180;

    // Direction vector of satellite +Z optical axis (top face of CubeSat)
    const y = Math.sin(radPitch);
    const x = Math.sin(radRoll) * Math.cos(radPitch);
    const z = Math.cos(radRoll) * Math.cos(radPitch);

    const dec = Math.asin(Math.max(-1, Math.min(1, y))) * (180 / Math.PI);
    let raDeg = (Math.atan2(x, z) * (180 / Math.PI) + 360) % 360;
    const raHours = raDeg / 15;

    // Find angular separation to each celestial target
    const targetsWithDistance = CELESTIAL_CATALOG.map((obj) => {
      const objRaDeg = obj.raHours * 15;
      const phi1 = (dec * Math.PI) / 180;
      const phi2 = (obj.decDeg * Math.PI) / 180;
      const deltaLambda = ((raDeg - objRaDeg) * Math.PI) / 180;

      // Spherical law of cosines for angular separation
      const cosTheta = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
      const angSepDeg = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);

      return {
        ...obj,
        angSepDeg: Math.round(angSepDeg * 10) / 10,
        alignmentPct: Math.max(0, Math.min(100, Math.round((1 - angSepDeg / 60) * 100))),
      };
    });

    targetsWithDistance.sort((a, b) => a.angSepDeg - b.angSepDeg);
    const closest = targetsWithDistance[0];

    return {
      raHours: Math.round(raHours * 100) / 100,
      decDeg: Math.round(dec * 10) / 10,
      targets: targetsWithDistance,
      closest,
      isTargetLocked: closest.angSepDeg < 18,
    };
  }, [roll, pitch]);

  // Update Three.js rotation targets
  useEffect(() => {
    const radPitch = THREE.MathUtils.degToRad(-pitch);
    const radRoll = THREE.MathUtils.degToRad(-roll);
    targetEuler.current.set(radPitch, 0, radRoll, 'YXZ');
  }, [pitch, roll]);

  // Three.js 3D Celestial Scene setup
  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.8, 4.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 1. Ambient & Directional Space Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xa78bfa, 2.5);
    dirLight.position.set(4, 8, 4);
    scene.add(dirLight);

    // 2. Background Star Field Particles (1200 stars)
    const starCount = 1200;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 25 + Math.random() * 15;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const colorChance = Math.random();
      if (colorChance > 0.8) {
        starColors[i * 3] = 0.58; starColors[i * 3 + 1] = 0.77; starColors[i * 3 + 2] = 0.99; // Blue-white
      } else if (colorChance > 0.6) {
        starColors[i * 3] = 0.99; starColors[i * 3 + 1] = 0.85; starColors[i * 3 + 2] = 0.55; // Amber
      } else {
        starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 1.0;  // White
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.85 });
    const starPoints = new THREE.Points(starGeometry, starMaterial);
    scene.add(starPoints);

    // 3. Celestial Coordinate Grid Sphere
    const sphereWire = new THREE.Mesh(
      new THREE.SphereGeometry(24, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.08 })
    );
    scene.add(sphereWire);

    // 4. Major Catalog Star Spheres
    CELESTIAL_CATALOG.forEach((star) => {
      const raRad = (star.raHours * 15 * Math.PI) / 180;
      const decRad = (star.decDeg * Math.PI) / 180;
      const dist = 22;

      const sx = dist * Math.cos(decRad) * Math.sin(raRad);
      const sy = dist * Math.sin(decRad);
      const sz = dist * Math.cos(decRad) * Math.cos(raRad);

      const starMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: star.color })
      );
      starMesh.position.set(sx, sy, sz);
      scene.add(starMesh);

      // Star Glow Halo
      const haloMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 12),
        new THREE.MeshBasicMaterial({ color: star.color, transparent: true, opacity: 0.25 })
      );
      haloMesh.position.set(sx, sy, sz);
      scene.add(haloMesh);
    });

    // 5. 1U CubeSat Physical Model (Center)
    const satGroup = new THREE.Group();
    satelliteGroupRef.current = satGroup;

    // Aluminium Chassis
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.85 })
    );
    satGroup.add(chassis);

    // Solar Panel Side Sheets
    const solarTex = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.95 });
    [-0.605, 0.605].forEach((offset) => {
      const px = new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.05, 1.05), solarTex);
      px.position.x = offset;
      satGroup.add(px);
    });

    // Optical Camera / Boresight Aperture on Top (+Y / +Z)
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.24, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.1, metalness: 0.9 })
    );
    lens.position.y = 0.62;
    satGroup.add(lens);

    // Laser Boresight Line shooting into deep space
    const laserGeom = new THREE.CylinderGeometry(0.012, 0.012, 22, 8);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.65 });
    const laserBeam = new THREE.Mesh(laserGeom, laserMat);
    laserBeam.position.y = 11;
    satGroup.add(laserBeam);

    scene.add(satGroup);

    // Animation Loop
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, clock.getDelta());

      // Smooth attitude lerp interpolation with exponential decay
      const factor = 1 - Math.exp(-9.0 * delta);
      currentEuler.current.x = THREE.MathUtils.lerp(currentEuler.current.x, targetEuler.current.x, factor);
      currentEuler.current.z = THREE.MathUtils.lerp(currentEuler.current.z, targetEuler.current.z, factor);

      if (satelliteGroupRef.current) {
        satelliteGroupRef.current.quaternion.setFromEuler(currentEuler.current);
      }

      // Gentle star background rotation
      starPoints.rotation.y += 0.0003;
      sphereWire.rotation.y += 0.0003;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
      {/* 3D Celestial Sky Canvas */}
      <div className="liquid-glass rounded-3xl p-5 flex flex-col items-center relative overflow-hidden">
        <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-200">
              Harold Black TRIAD Star Tracker (3D)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
              celestialBoresight.isTargetLocked
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}>
              {celestialBoresight.isTargetLocked ? '⭐ TARGET LOCKED' : 'SEARCHING CONSTELLATIONS'}
            </span>
          </div>
        </div>

        {/* Canvas Mount */}
        <div className="relative w-full h-80 sm:h-96 rounded-2xl bg-[#040212] border border-cyan-500/20 overflow-hidden shadow-2xl">
          <div ref={mountRef} className="w-full h-full" />

          {/* Crosshair Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border border-cyan-400/30 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border border-dashed border-cyan-400/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>
          </div>

          {/* Celestial Boresight Coordinates Tag */}
          <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-700/70 rounded-xl p-2.5 font-mono text-[11px] space-y-1 shadow-2xl pointer-events-none">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Target size={12} className="text-cyan-400" />
              <span>Optical Boresight (+Z Laser)</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Right Ascension (α):</span>
              <span className="text-cyan-300 font-bold">{celestialBoresight.raHours}h ({(celestialBoresight.raHours * 15).toFixed(1)}°)</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Declination (δ):</span>
              <span className="text-cyan-300 font-bold">{celestialBoresight.decDeg > 0 ? '+' : ''}{celestialBoresight.decDeg}°</span>
            </div>
            <div className="flex justify-between gap-4 pt-1 border-t border-slate-800">
              <span className="text-slate-400">MPU6050 Attitude:</span>
              <span className="text-violet-300">R: {roll.toFixed(1)}° | P: {pitch.toFixed(1)}°</span>
            </div>
          </div>

          {/* Target Lock Banner */}
          {celestialBoresight.isTargetLocked && (
            <div className="absolute top-3 left-3 bg-emerald-950/90 border border-emerald-500/60 rounded-xl px-3 py-1.5 text-xs font-mono text-emerald-200 flex items-center gap-2 shadow-xl backdrop-blur-md pointer-events-none">
              <Award size={14} className="text-emerald-400 animate-bounce" />
              <span>Aligned with <strong>{celestialBoresight.closest.name}</strong> ({celestialBoresight.closest.angSepDeg}° off)</span>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-400 font-mono text-center">
          Rotate your physical CubeSat on the terrace to point the cyan laser boresight at real celestial constellations!
        </p>
      </div>

      {/* Constellation & Star Alignment Deck */}
      <div className="space-y-3">
        <div className="liquid-glass rounded-2xl p-4 border-l-4 border-l-cyan-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-cyan-400 font-mono">Closest Celestial Match</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{celestialBoresight.closest.name}</h3>
              <p className="text-xs text-slate-400">{celestialBoresight.closest.constellation}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-mono font-bold text-cyan-300">
                {celestialBoresight.closest.alignmentPct}%
              </span>
              <p className="text-[10px] text-slate-400 font-mono">Alignment Score</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${celestialBoresight.closest.alignmentPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-300 font-mono">
            {celestialBoresight.closest.desc} · Separation: <strong className="text-amber-300">{celestialBoresight.closest.angSepDeg}°</strong>
          </p>
        </div>

        {/* Celestial Star Catalog Table */}
        <div className="liquid-glass rounded-2xl p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-mono mb-3">
            Celestial Sky Reference Targets (Yale Bright Star)
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {celestialBoresight.targets.map((star) => (
              <div
                key={star.name}
                className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                  star.angSepDeg < 18
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px]"
                    style={{ background: star.color, boxShadow: `0 0 8px ${star.color}` }}
                  />
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">{star.name}</p>
                    <p className="text-[10px] text-slate-400">{star.constellation}</p>
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  <span className={star.angSepDeg < 18 ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                    {star.angSepDeg}° separation
                  </span>
                  <p className="text-[10px] text-slate-500">
                    RA: {star.raHours}h | Dec: {star.decDeg > 0 ? '+' : ''}{star.decDeg}°
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
