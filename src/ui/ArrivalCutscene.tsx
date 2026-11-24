import { useEffect, useCallback, useState, useRef } from 'react';
import BackgroundStage from './BackgroundStage.tsx';
import { BG_SHELTERS } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
import { playFootstep, startSiteAmbience, fadeOutMenuMusic } from '../game/audio/soundEngine.ts';
import type { SiteId, TravelerGender } from '../game/types/game.ts';

export interface ArrivalCutsceneProps {
  siteId: SiteId;
  gender: TravelerGender;
  onComplete: () => void;
}

const DURATION = 3500; // ms
const FOOTSTEP_TIMES = [400, 900, 1400, 1950, 2500]; // ms offsets

/** Inline SVG traveler silhouette */
function TravelerSVG({ gender }: { gender: TravelerGender }) {
  // Simple stylized silhouette with backpack
  const color = '#3d3832';
  if (gender === 'male') {
    return (
      <svg viewBox="0 0 60 120" width="60" height="120" fill={color} style={{ filter: 'drop-shadow(0 2px 6px rgba(61,56,50,0.4))' }}>
        {/* Head */}
        <circle cx="30" cy="16" r="10" />
        {/* Body */}
        <rect x="22" y="26" width="16" height="30" rx="4" />
        {/* Backpack */}
        <rect x="38" y="30" width="10" height="20" rx="3" opacity="0.7" />
        {/* Legs */}
        <rect x="23" y="56" width="6" height="30" rx="3" />
        <rect x="31" y="56" width="6" height="30" rx="3" />
        {/* Arms */}
        <rect x="16" y="28" width="6" height="22" rx="3" />
        <rect x="38" y="28" width="6" height="18" rx="3" />
      </svg>
    );
  }
  // Female — slightly different proportions
  return (
    <svg viewBox="0 0 60 120" width="60" height="120" fill={color} style={{ filter: 'drop-shadow(0 2px 6px rgba(61,56,50,0.4))' }}>
      {/* Head */}
      <circle cx="30" cy="14" r="10" />
      {/* Hair detail */}
      <ellipse cx="30" cy="10" rx="11" ry="6" opacity="0.5" />
      {/* Body */}
      <path d="M24 24 L22 56 L38 56 L36 24 Z" rx="4" />
      {/* Backpack */}
      <rect x="38" y="28" width="9" height="18" rx="3" opacity="0.7" />
      {/* Legs */}
      <rect x="23" y="56" width="6" height="28" rx="3" />
      <rect x="31" y="56" width="6" height="28" rx="3" />
      {/* Arms */}
      <rect x="16" y="26" width="5" height="20" rx="2.5" />
      <rect x="38" y="26" width="5" height="16" rx="2.5" />
    </svg>
  );
}

export default function ArrivalCutscene({ siteId, gender, onComplete }: ArrivalCutsceneProps) {
  const [phase, setPhase] = useState<'walking' | 'fadeout'>('walking');
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const site = SITES.find((s) => s.id === siteId);

  /* Start ambience + fade menu music */
  useEffect(() => {
    fadeOutMenuMusic();
    startSiteAmbience(siteId);
  }, [siteId]);

  /* Schedule footsteps */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ms of FOOTSTEP_TIMES) {
      timers.push(setTimeout(playFootstep, ms));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  /* Auto-complete after duration */
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setPhase('fadeout');
      setTimeout(onComplete, 600);
    }, DURATION);
    return () => clearTimeout(timerRef.current);
  }, [onComplete]);

  /* Skip handler */
  const handleSkip = useCallback(() => {
    clearTimeout(timerRef.current);
    setPhase('fadeout');
    setTimeout(onComplete, 200);
  }, [onComplete]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['Space', 'Enter', 'Escape'].includes(e.code)) handleSkip();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSkip]);

  const bgMedia = BG_SHELTERS[siteId];

  return (
    <div
      onClick={handleSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        cursor: 'pointer',
        opacity: phase === 'fadeout' ? 0 : 1,
        transition: 'opacity 600ms ease',
      }}
    >
      {/* Background with Ken Burns zoom */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
      }}>
        <BackgroundStage media={bgMedia} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          animation: 'kenBurns 4s ease-out forwards',
        }} />
      </div>

      {/* Walking traveler silhouette */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          left: 0,
          zIndex: 5,
          animation: 'walkAcross 3.5s ease-in-out forwards',
        }}
      >
        <div style={{ animation: 'walkBob 0.5s ease-in-out infinite' }}>
          <TravelerSVG gender={gender} />
        </div>
      </div>

      {/* Warm sunlit caption */}
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          left: 0,
          right: 0,
          zIndex: 6,
          textAlign: 'center',
          animation: 'fadeInUp 1.2s ease 0.8s both',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-game-title)',
          fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
          color: '#fff',
          textShadow: '0 2px 16px rgba(61,56,50,0.5), 0 1px 4px rgba(61,56,50,0.3)',
          marginBottom: 'var(--space-sm)',
        }}>
          Day 1 · {site?.name ?? 'Your Shelter'}
        </p>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(0.85rem, 1.8vw, 1.05rem)',
          color: 'rgba(255,255,255,0.8)',
          textShadow: '0 1px 8px rgba(61,56,50,0.4)',
          fontStyle: 'italic',
        }}>
          Someone passed through here once. Time to make it warm again.
        </p>
      </div>

      {/* Skip button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleSkip(); }}
        style={{
          position: 'absolute',
          bottom: 'var(--space-md)',
          right: 'var(--space-md)',
          zIndex: 10,
          background: 'rgba(255,252,246,0.2)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-xs) var(--space-md)',
          fontSize: '0.8rem',
        }}
      >
        Skip ▸
      </button>

      {/* CSS animations */}
      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1); }
          to   { transform: scale(1.12); }
        }
        @keyframes walkAcross {
          from { transform: translateX(-80px); }
          to   { transform: translateX(calc(50vw - 30px)); }
        }
        @keyframes walkBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
