import { useEffect, useRef, useState } from 'react'

function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    let w = 0, h = 0, raf = 0
    const mouse = { x: 0, y: 0 }
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random() * 0.9 + 0.1, p: Math.random() * 6.28,
    }))
    const resize = () => {
      const d = devicePixelRatio || 1
      w = c.width = innerWidth * d; h = c.height = innerHeight * d
      c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'
    }
    const move = (e: MouseEvent) => {
      mouse.x = (e.clientX / innerWidth - 0.5); mouse.y = (e.clientY / innerHeight - 0.5)
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.y -= 0.00005 * s.z
        if (s.y < 0) s.y = 1
        const x = ((s.x + mouse.x * 0.03 * s.z + 1) % 1) * w
        const y = (s.y + mouse.y * 0.03 * s.z) * h
        const a = 0.35 + 0.65 * Math.abs(Math.sin(t / 900 + s.p))
        ctx.fillStyle = `rgba(${s.z > 0.7 ? '200,180,255' : '255,255,255'},${a * s.z})`
        ctx.beginPath(); ctx.arc(x, y, s.z * 1.6 * (devicePixelRatio || 1), 0, 6.28); ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    resize(); raf = requestAnimationFrame(draw)
    addEventListener('resize', resize); addEventListener('mousemove', move)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('mousemove', move) }
  }, [])
  return <canvas ref={ref} className="absolute inset-0" />
}

function Orbits() {
  const ring = 'absolute rounded-full border'
  return (
    <div className="relative mx-auto h-56 w-56 sm:h-64 sm:w-64">
      <div className={`${ring} inset-0 border-violet-400/20`} style={{ animation: 'spin-cw 40s linear infinite' }}>
        <span className="absolute -top-1.5 left-1/2 h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_18px_6px_rgba(245,158,11,.7)]" />
      </div>
      <div className={`${ring} inset-6 border-fuchsia-400/25 border-dashed`} style={{ animation: 'spin-ccw 28s linear infinite' }}>
        <span className="absolute top-1/2 -right-1.5 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_5px_rgba(103,232,249,.6)]" />
      </div>
      <div className={`${ring} inset-12 border-orange-400/30`} style={{ animation: 'spin-cw 16s linear infinite' }}>
        <span className="absolute -bottom-1 left-1/2 h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_4px_rgba(217,70,239,.7)]" />
      </div>
      <div
        className="absolute inset-[4.5rem] rounded-full bg-black"
        style={{
          animation: 'pulse-core 4s ease-in-out infinite',
          boxShadow: '0 0 0 3px rgba(255,140,0,.55), 0 0 40px 10px rgba(192,38,211,.55), 0 0 90px 30px rgba(124,58,237,.35), inset 0 0 20px rgba(0,0,0,1)',
        }}
      />
    </div>
  )
}

export default function LoginPage({ onEnter }: { onEnter: () => void }) {
  const [entering, setEntering] = useState(false)
  const [m, setM] = useState({ x: 0, y: 0 })

  const enter = () => {
    if (entering) return
    setEntering(true)
    setTimeout(onEnter, 2000)
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      onMouseMove={e => setM({ x: e.clientX / innerWidth - 0.5, y: e.clientY / innerHeight - 0.5 })}
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #150a35 0%, #06050e 60%, #020208 100%)' }}
    >
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-violet-600/25 blur-[120px]" style={{ animation: 'drift 16s ease-in-out infinite' }} />
      <div className="absolute -bottom-48 -right-32 h-[32rem] w-[32rem] rounded-full bg-cyan-500/15 blur-[120px]" style={{ animation: 'drift 20s ease-in-out infinite reverse' }} />
      <div className="absolute bottom-10 left-1/4 h-72 w-72 rounded-full bg-orange-500/10 blur-[110px]" style={{ animation: 'drift 24s ease-in-out infinite' }} />
      <Starfield />

      {entering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black" style={{ animation: 'fade-in 1.2s ease forwards' }}>
          <div className="h-24 w-24 rounded-full bg-black"
            style={{ boxShadow: '0 0 0 4px #ff8c00, 0 0 80px 30px #c026d3', animation: 'warp 2.2s cubic-bezier(.6,0,.9,.4) forwards' }} />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center text-center transition-transform duration-300 ease-out"
        style={{ transform: `translate(${m.x * -14}px, ${m.y * -14}px)` }}>
        <div className="rise" style={{ animationDelay: '.1s' }}><Orbits /></div>

        <h1 className="rise mt-10 bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-300 bg-clip-text text-5xl font-semibold tracking-[0.3em] text-transparent sm:text-7xl"
          style={{ animationDelay: '.4s' }}>VYOMAASTRA</h1>
        <p className="rise mt-4 text-xs tracking-[0.5em] text-white/50 sm:text-sm" style={{ animationDelay: '.6s' }}>CUBESAT MISSION CONTROL</p>

        <button onClick={enter} autoFocus
          className="rise group relative mt-14 overflow-hidden rounded-full border border-white/20 bg-white/[0.04] px-14 py-4 text-sm font-medium tracking-[0.5em] text-white backdrop-blur-xl transition-all duration-500 hover:scale-105 hover:border-fuchsia-400/70 hover:bg-fuchsia-500/10 hover:shadow-[0_0_60px_-5px_rgba(192,38,211,.8)] active:scale-95"
          style={{ animationDelay: '.9s' }}>
          <span className="absolute inset-0 -z-0 bg-gradient-to-r from-violet-600/0 via-fuchsia-500/30 to-orange-500/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <span className="relative z-10 inline-flex items-center gap-3">
            ENTER
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="transition-transform duration-300 group-hover:translate-x-1.5"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
          </span>
        </button>
      </div>
    </div>
  )
}
