import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const STAGES = [
  { at: 0, t: 'THE MOUTH', s: 'Altitude 550 km' },
  { at: 0.2, t: 'ENTRY', s: 'Space begins to fold' },
  { at: 0.45, t: 'THE THROAT', s: 'Distance has no meaning here' },
  { at: 0.7, t: 'FOLD EXIT', s: 'A light ahead' },
  { at: 0.85, t: 'ARRIVAL', s: 'Almost there' },
]

const TUNNEL_LEN = 240

const vert = `
varying vec2 vUv; varying float vDist; varying float vRad;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  vRad = length(position.xy);
  gl_Position = projectionMatrix * mv;
}`

// Swirling spacetime walls: seam-free noise sampled in twisted polar coordinates,
// spiral light filaments, and a bright exit that bleeds in near the far end.
const frag = `
precision highp float;
uniform float uTime; uniform float uProg;
varying vec2 vUv; varying float vDist; varying float vRad;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  float a = vUv.x * 6.2831853;
  float v = vUv.y;
  float tw = a + v * 14.0 - uTime * 0.12;
  vec2 p = vec2(cos(tw), sin(tw)) * 1.6 + vec2(v * 90.0 - uTime * 0.6, v * 31.0);
  float f = fbm(p);
  float g = fbm(p * 2.1 + 7.3);

  vec3 deep = vec3(0.02, 0.01, 0.09);
  vec3 violet = vec3(0.38, 0.14, 0.85);
  vec3 blue = vec3(0.1, 0.35, 1.0);
  vec3 amber = vec3(1.0, 0.62, 0.2);
  vec3 col = mix(deep, violet, smoothstep(0.25, 0.7, f));
  col = mix(col, blue, smoothstep(0.45, 0.85, g) * 0.7);
  col += amber * smoothstep(0.68, 0.9, f * g * 1.9) * 0.9;

  // spiral filaments racing toward the camera
  float sp = sin(a * 5.0 + v * 140.0 - uTime * 2.4);
  col += vec3(0.7, 0.8, 1.0) * smoothstep(0.93, 1.0, sp) * 0.55;
  float ring = sin(v * 900.0 - uTime * 3.0);
  col += vec3(0.5, 0.35, 1.0) * smoothstep(0.97, 1.0, ring) * 0.35;

  // glow brighter toward the narrow throat, fog with distance
  float throat = 1.0 / (0.35 + vRad * 0.35);
  col *= 0.55 + throat * 0.9;
  float fog = exp(-vDist * 0.011);
  col = mix(deep * 0.4, col, fog);

  // exit light
  float ex = smoothstep(0.86, 1.0, v);
  col = mix(col, vec3(1.0, 0.96, 0.88), ex * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`

// Scroll-driven wormhole flight. At the end the screen whites out and the dashboard sphere opens.
export default function Descent({ onArrive }: { onArrive: () => void }) {
  const [p, setP] = useState(0)
  const done = useRef(false)
  const target = useRef(0)
  const mount = useRef<HTMLDivElement>(null)
  const [noGL, setNoGL] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    const on = () => {
      const max = document.documentElement.scrollHeight - innerHeight
      target.current = Math.min(1, scrollY / max)
    }
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    const el = mount.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setNoGL(true)
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020109)
    const camera = new THREE.PerspectiveCamera(70, el.clientWidth / el.clientHeight, 0.05, 400)

    // Throat profile: wide mouth -> pinched throat in the middle -> flared exit
    const geo = new THREE.CylinderGeometry(1, 1, TUNNEL_LEN, 160, 480, true)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / TUNNEL_LEN + 0.5
      const pinch = Math.pow(Math.abs(Math.cos(t * Math.PI)), 3.2)
      const r = 2.4 + 26 * pinch
      pos.setX(i, pos.getX(i) * r)
      pos.setZ(i, pos.getZ(i) * r)
    }
    geo.rotateX(Math.PI / 2)
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uProg: { value: 0 } },
    })
    scene.add(new THREE.Mesh(geo, mat))

    // Light waiting at the far end
    const cv = document.createElement('canvas'); cv.width = cv.height = 256
    const g = cv.getContext('2d')!
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,236,200,.85)'); gr.addColorStop(0.6, 'rgba(255,170,90,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    glow.position.set(0, 0, TUNNEL_LEN / 2 + 30); glow.scale.setScalar(120)
    scene.add(glow)

    // Drifting motes inside the tunnel for a sense of speed
    const N = 1200
    const pts = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const z = (Math.random() - 0.5) * TUNNEL_LEN
      const t = z / TUNNEL_LEN + 0.5
      const rMax = (2.4 + 26 * Math.pow(Math.abs(Math.cos(t * Math.PI)), 3.2)) * 0.9
      const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * rMax
      pts.set([Math.cos(a) * rr, Math.sin(a) * rr, z], i * 3)
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.09, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })))

    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    }
    addEventListener('resize', onResize)

    let raf = 0, last = performance.now(), smooth = 0, shown = -1
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const prev = smooth
      smooth += (target.current - smooth) * Math.min(1, dt * 3.5)
      const speed = (smooth - prev) / Math.max(dt, 0.001)
      mat.uniforms.uTime.value += dt
      mat.uniforms.uProg.value = smooth

      const z = -TUNNEL_LEN / 2 + 6 + smooth * (TUNNEL_LEN - 14)
      camera.position.set(Math.sin(now / 900) * 0.05, Math.cos(now / 1100) * 0.05, z)
      camera.lookAt(0, 0, z + 20)
      camera.rotation.z = smooth * Math.PI * 1.5 + Math.sin(now / 2000) * 0.03   // slow barrel roll as you fall
      camera.fov = 70 + Math.min(28, Math.abs(speed) * 90)                          // stretch with speed
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)

      if (Math.abs(smooth - shown) > 0.0005) { shown = smooth; setP(smooth) }
      if (smooth > 0.99 && !done.current) { done.current = true; onArrive() }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf); removeEventListener('resize', onResize)
      geo.dispose(); mat.dispose(); renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [onArrive])

  // Reduced-motion / no-WebGL: simple scroll-linked glow so the sequence still completes
  useEffect(() => {
    if (!noGL) return
    const on = () => {
      const max = document.documentElement.scrollHeight - innerHeight
      const v = Math.min(1, scrollY / max)
      setP(v)
      if (v > 0.99 && !done.current) { done.current = true; onArrive() }
    }
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [noGL, onArrive])

  const stage = [...STAGES].reverse().find(s => p >= s.at)!
  const flash = Math.max(0, (p - 0.9) / 0.1)
  const ui = 1 - Math.min(1, flash * 1.5)
  const shadow = '0 1px 10px rgba(2,1,9,.95)'

  return (
    <div style={{ height: '600vh' }}>
      <div className="fixed inset-0 overflow-hidden" style={{ background: noGL ? `radial-gradient(circle, #fff ${p * 60}%, #3b1a8a 70%, #020109)` : '#020109' }}>
        <div ref={mount} className="absolute inset-0" />
        {/* soft vignette keeps the eye on the centre */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 45%, rgba(2,1,9,.75) 100%)' }} />

        <div className="absolute inset-x-0 top-24 text-center" style={{ opacity: ui }}>
          <p key={stage.t} className="rise text-2xl font-light tracking-[0.5em] text-white sm:text-4xl" style={{ textShadow: `0 0 24px rgba(160,120,255,.9), ${shadow}` }}>{stage.t}</p>
          <p className="mt-2 text-sm tracking-[0.3em] text-white/80" style={{ textShadow: shadow }}>{stage.s}</p>
        </div>

        <div className="absolute bottom-10 left-8 font-mono text-xs tracking-widest text-white/80" style={{ opacity: ui, textShadow: shadow }}>
          DISTANCE {Math.round(p * 11000).toLocaleString()} KM
        </div>
        <div className="absolute bottom-10 right-8 h-24 w-px bg-white/30" style={{ opacity: ui }}>
          <div className="w-px bg-gradient-to-b from-white to-violet-400" style={{ height: `${p * 100}%` }} />
        </div>

        {p < 0.05 && (
          <div className="absolute inset-x-0 bottom-16 text-center text-sm tracking-[0.4em] text-white/90" style={{ animation: 'bob 1.8s ease-in-out infinite', textShadow: shadow }}>
            SCROLL TO ENTER THE WORMHOLE
          </div>
        )}

        {/* final whiteout, then the dashboard sphere opens */}
        <div className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: flash }} />
      </div>
    </div>
  )
}
