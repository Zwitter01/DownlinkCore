import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// BlackHoleTransition
// Full-screen overlay shown when user launches the dashboard from SetupWizard.
// Phase 1: Black hole grows from centre (1.4s)
// Phase 2: Everything is sucked in — handled by parent via className prop
// Phase 3: Screen goes pitch black (0.4s)
// Phase 4: Sphere reveal — handled by App wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Called when the overlay has fully consumed the screen and it's safe to
   *  switch to the dashboard (just before sphere-reveal begins). */
  onComplete: () => void;
}

export function BlackHoleTransition({ onComplete }: Props) {
  const [phase, setPhase] = useState<'growing' | 'consuming' | 'void'>('growing');

  useEffect(() => {
    // Phase 1 → 2: hole has grown enough to feel real
    const t1 = setTimeout(() => setPhase('consuming'), 800);
    // Phase 2 → 3: everything gone, pure void
    const t2 = setTimeout(() => setPhase('void'), 2000);
    // Notify parent to swap to dashboard + start sphere reveal
    const t3 = setTimeout(() => onComplete(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{ background: phase === 'void' ? '#000' : 'transparent', transition: 'background 0.4s ease' }}
    >
      {/* Black hole visual */}
      {phase !== 'void' && (
        <div
          className="relative flex items-center justify-center"
          style={{
            width: phase === 'growing' ? '280px' : '600px',
            height: phase === 'growing' ? '280px' : '600px',
            transition: 'width 1.4s cubic-bezier(0.16,1,0.3,1), height 1.4s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Outer glow aura */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, transparent 35%, rgba(255,140,40,0.12) 50%, rgba(200,80,20,0.08) 65%, transparent 80%)',
              filter: 'blur(20px)',
              animation: 'blackHolePulse 2s ease-in-out infinite',
            }}
          />

          {/* Accretion disk — outer ring (orange/amber) */}
          <div
            className="absolute rounded-full ring-spin"
            style={{
              width: '95%', height: '95%',
              border: '3px solid transparent',
              background: 'linear-gradient(#000,#000) padding-box, linear-gradient(90deg, rgba(255,160,40,0.9), rgba(255,80,20,0.5), rgba(200,40,200,0.3), rgba(120,40,255,0.4), rgba(255,160,40,0.9)) border-box',
              filter: 'blur(0.5px)',
            }}
          />

          {/* Accretion disk — inner ring (hotter, bluer) */}
          <div
            className="absolute rounded-full ring-spin-reverse"
            style={{
              width: '72%', height: '72%',
              border: '2px solid transparent',
              background: 'linear-gradient(#000,#000) padding-box, linear-gradient(90deg, rgba(255,200,80,0.8), rgba(255,100,30,0.6), rgba(180,60,240,0.5), rgba(255,200,80,0.8)) border-box',
              filter: 'blur(0.5px)',
              transform: 'scaleY(0.25)',
            }}
          />

          {/* Photon ring — thin bright line */}
          <div
            className="absolute rounded-full ring-spin-slow"
            style={{
              width: '58%', height: '58%',
              border: '1px solid rgba(255,220,120,0.6)',
              filter: 'blur(1px)',
              boxShadow: '0 0 8px rgba(255,180,60,0.4), inset 0 0 8px rgba(255,180,60,0.2)',
            }}
          />

          {/* Event horizon — pure black void centre */}
          <div
            className="absolute rounded-full black-hole-pulse animate-black-hole-grow"
            style={{
              width: '52%', height: '52%',
              background: 'radial-gradient(circle, #000 70%, rgba(20,0,0,0.95) 100%)',
              boxShadow: '0 0 40px rgba(255,140,40,0.5), 0 0 80px rgba(255,80,20,0.25), inset 0 0 60px #000',
            }}
          />

          {/* Gravitational lensing shimmer */}
          <div
            className="absolute rounded-full"
            style={{
              width: '80%', height: '80%',
              background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.06) 0%, transparent 40%)',
              animation: 'lensFlare 1.8s ease-in-out infinite',
            }}
          />

          {/* Centre singularity dot */}
          <div
            style={{
              width: '6px', height: '6px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 12px 4px rgba(255,255,255,0.8), 0 0 30px 10px rgba(255,200,100,0.4)',
              position: 'relative', zIndex: 10,
            }}
          />
        </div>
      )}

      {/* Gravitational distortion overlay — radial darkness pulling inward */}
      {phase === 'consuming' && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 20%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.95) 100%)',
            animation: 'blackHoleGrow 1.2s cubic-bezier(0.4,0,1,1) forwards',
          }}
        />
      )}
    </div>
  );
}
