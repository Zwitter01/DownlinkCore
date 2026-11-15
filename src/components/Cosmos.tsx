import { useEffect, useRef } from 'react';

// Cosmic backdrop: parallax stars, a faint milky-way band, shooting meteors with
// glowing trails and slowly tumbling rocky asteroids drifting through the frame.
// Everything is deliberately low-contrast so dashboard content stays readable.
type Meteor = { x: number; y: number; vx: number; vy: number; len: number; life: number; max: number };
type Rock = { x: number; y: number; vx: number; vy: number; r: number; rot: number; spin: number; pts: number[]; a: number };

export function Cosmos() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const fit = () => { W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit();
    addEventListener('resize', fit);

    const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, tw: Math.random() * 6 }));
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const meteors: Meteor[] = [];
    const rocks: Rock[] = [];
    let mx = 0, my = 0, raf = 0, last = performance.now(), nextMeteor = 1.5;

    const spawnMeteor = () => {
      const speed = 700 + Math.random() * 600;
      const ang = Math.PI * (0.62 + Math.random() * 0.12); // down and to the left
      meteors.push({ x: Math.random() * W * 1.2, y: -40, vx: Math.cos(ang) * speed * -1, vy: Math.sin(ang) * speed, len: 90 + Math.random() * 130, life: 0, max: 1.6 });
    };
    const spawnRock = () => {
      const r = 10 + Math.random() * 26;
      const n = 9 + Math.floor(Math.random() * 4);
      rocks.push({
        x: W + r * 2, y: Math.random() * H * 0.8, vx: -(14 + Math.random() * 26), vy: 6 + Math.random() * 16, r,
        rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.5, a: 0.35 + Math.random() * 0.35,
        pts: Array.from({ length: n }, () => 0.72 + Math.random() * 0.4),
      });
    };
    for (let i = 0; i < 3; i++) { spawnRock(); rocks[i].x = Math.random() * W; }

    const move = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    addEventListener('pointermove', move);

    const drawRock = (k: Rock) => {
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot); ctx.globalAlpha = k.a;
      ctx.beginPath();
      k.pts.forEach((m, i) => {
        const a = (i / k.pts.length) * Math.PI * 2;
        const px = Math.cos(a) * k.r * m, py = Math.sin(a) * k.r * m;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      });
      ctx.closePath();
      const g = ctx.createRadialGradient(-k.r * 0.4, -k.r * 0.4, k.r * 0.1, 0, 0, k.r * 1.1);
      g.addColorStop(0, '#8a93a6'); g.addColorStop(0.6, '#3a4152'); g.addColorStop(1, '#0d111b');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(160,190,255,.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.35)';                       // craters
      ctx.beginPath(); ctx.arc(k.r * 0.2, k.r * 0.1, k.r * 0.18, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(-k.r * 0.3, k.r * 0.3, k.r * 0.1, 0, 6.28); ctx.fill();
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);

      // milky-way band
      ctx.save(); ctx.translate(W * 0.5, H * 0.5); ctx.rotate(-0.5);
      const band = ctx.createLinearGradient(0, -H * 0.35, 0, H * 0.35);
      band.addColorStop(0, 'rgba(120,170,255,0)'); band.addColorStop(0.5, 'rgba(150,190,255,.07)'); band.addColorStop(1, 'rgba(120,170,255,0)');
      ctx.fillStyle = band; ctx.fillRect(-W, -H * 0.35, W * 2, H * 0.7); ctx.restore();

      // stars
      for (const s of stars) {
        if (!reduce) { s.y += 0.00003 * s.z; if (s.y > 1) s.y = 0; }
        const x = ((s.x - mx * 0.025 * s.z + 1) % 1) * W;
        const y = ((s.y - my * 0.025 * s.z + 1) % 1) * H;
        const a = (0.3 + 0.7 * Math.abs(Math.sin(now / 1400 + s.tw))) * s.z;
        ctx.fillStyle = s.z > 0.85 ? `rgba(255,236,210,${a})` : `rgba(200,220,255,${a})`;
        ctx.beginPath(); ctx.arc(x, y, s.z * 1.2, 0, 6.28); ctx.fill();
      }

      if (!reduce) {
        nextMeteor -= dt;
        if (nextMeteor <= 0 && meteors.length < 3) { spawnMeteor(); nextMeteor = 2.5 + Math.random() * 4.5; }
        if (rocks.length < 5 && Math.random() < dt * 0.15) spawnRock();
      }

      for (const k of rocks) { k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.spin * dt; drawRock(k); }
      for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].x < -80 || rocks[i].y > H + 80) rocks.splice(i, 1);

      for (const m of meteors) {
        m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt;
        const sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
        const fade = Math.min(1, m.life * 6) * Math.max(0, 1 - m.life / m.max);
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
        g.addColorStop(0, `rgba(255,244,225,${0.95 * fade})`); g.addColorStop(0.25, `rgba(255,180,100,${0.55 * fade})`); g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(255,250,240,${fade})`; ctx.shadowColor = 'rgba(255,190,120,.9)'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0;
      }
      for (let i = meteors.length - 1; i >= 0; i--) if (meteors[i].life > meteors[i].max || meteors[i].y > H + 100) meteors.splice(i, 1);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); removeEventListener('pointermove', move); };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 h-full w-full" />;
}
