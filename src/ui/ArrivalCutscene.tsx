import { useEffect, useCallback, useState, useRef } from 'react';
import BackgroundStage from './BackgroundStage.tsx';
import { BG_SHELTERS } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { playFootstep, startSiteAmbience, fadeOutMenuMusic } from '../game/audio/soundEngine.ts';
import type { SiteId, TravelerGender } from '../game/types/game.ts';

export interface ArrivalCutsceneProps {
  siteId: SiteId;
  gender: TravelerGender;
  onComplete: () => void;
}

const DURATION = 3500; // ms
const REDUCED_DURATION = 2200; // calm hold for reduce-motion
const FOOTSTEP_TIMES = [400, 900, 1400, 1950, 2500]; // ms offsets

/** Inline SVG traveler silhouette */
function TravelerSVG({ gender }: { gender: TravelerGender }) {
  const color = '#3d3832';
  if (gender === 'male') {
    return (
      <svg
        viewBox="0 0 60 120"
        width="60"
        height="120"
        fill={color}
        style={{ filter: 'drop-shadow(0 2px 6px rgba(61,56,50,0.4))' }}
        aria-hidden="true"
      >
        <circle cx="30" cy="16" r="10" />
        <rect x="22" y="26" width="16" height="30" rx="4" />
        <rect x="38" y="30" width="10" height="20" rx="3" opacity="0.7" />
        <rect x="23" y="56" width="6" height="30" rx="3" />
        <rect x="31" y="56" width="6" height="30" rx="3" />
        <rect x="16" y="28" width="6" height="22" rx="3" />
        <rect x="38" y="28" width="6" height="18" rx="3" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 60 120"
      width="60"
      height="120"
      fill={color}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(61,56,50,0.4))' }}
      aria-hidden="true"
    >
      <circle cx="30" cy="14" r="10" />
      <ellipse cx="30" cy="10" rx="11" ry="6" opacity="0.5" />
      <path d="M24 24 L22 56 L38 56 L36 24 Z" />
      <rect x="38" y="28" width="9" height="18" rx="3" opacity="0.7" />
      <rect x="23" y="56" width="6" height="28" rx="3" />
      <rect x="31" y="56" width="6" height="28" rx="3" />
      <rect x="16" y="26" width="5" height="20" rx="2.5" />
      <rect x="38" y="26" width="5" height="16" rx="2.5" />
    </svg>
  );
}

export default function ArrivalCutscene({ siteId, gender, onComplete }: ArrivalCutsceneProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const [phase, setPhase] = useState<'walking' | 'fadeout'>('walking');

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completedRef = useRef(false);

  const site = SITES.find((s) => s.id === siteId);

  const finishOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  /* Start ambience + fade menu music */
  useEffect(() => {
    fadeOutMenuMusic();
    startSiteAmbience(siteId);
    return () => startSiteAmbience(null);
  }, [siteId]);

  /* Schedule footsteps (skip walking footsteps when reduceMotion is on) */
  useEffect(() => {
    if (reduceMotion) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ms of FOOTSTEP_TIMES) {
      timers.push(setTimeout(playFootstep, ms));
    }
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  /* Auto-complete after duration */
  useEffect(() => {
    const holdMs = reduceMotion ? REDUCED_DURATION : DURATION;
    const fadeMs = reduceMotion ? 300 : 600;
    timerRef.current = setTimeout(() => {
      setPhase('fadeout');
      completeTimerRef.current = setTimeout(finishOnce, fadeMs);
    }, holdMs);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(completeTimerRef.current);
    };
  }, [reduceMotion, finishOnce]);

  /* Skip handler */
  const handleSkip = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(completeTimerRef.current);
    setPhase('fadeout');
    completeTimerRef.current = setTimeout(finishOnce, reduceMotion ? 100 : 200);
  }, [finishOnce, reduceMotion]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (['Space', 'Enter', 'Escape'].includes(e.code)) {
        e.preventDefault();
        handleSkip();
      }
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
        transition: `opacity ${reduceMotion ? '300ms' : '600ms'} ease`,
        animation: reduceMotion ? 'owsFadeOpacity 250ms ease' : undefined,
      }}
    >
      {/* Background with Ken Burns zoom (disabled when reduceMotion is active) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          transformOrigin: 'center center',
          transform: reduceMotion ? 'none' : 'scale(1)',
          animation: reduceMotion ? 'none' : 'kenBurns 4s ease-out forwards',
        }}
      >
        <BackgroundStage media={bgMedia} />
      </div>

      {/* Traveler silhouette */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          left: reduceMotion ? 'calc(50vw - 30px)' : 0,
          zIndex: 5,
          animation: reduceMotion
            ? 'owsFadeOpacity 350ms ease'
            : 'walkAcross 3.5s ease-in-out forwards',
        }}
      >
        <div
          style={{
            animation: reduceMotion ? 'none' : 'walkBob 0.5s ease-in-out infinite',
          }}
        >
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
          paddingInline: 'var(--space-md)',
          textAlign: 'center',
          animation: reduceMotion
            ? 'owsFadeOpacity 400ms ease 200ms both'
            : 'fadeInUp 1.2s ease 0.8s both',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-game-title)',
            fontSize: 'clamp(1.4rem, 3.5vw, 2.2rem)',
            color: '#fff',
            textShadow: '0 2px 16px rgba(61,56,50,0.5), 0 1px 4px rgba(61,56,50,0.3)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Day 1 · {site?.name ?? 'Your Shelter'}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.85rem, 1.8vw, 1.05rem)',
            color: 'rgba(255,255,255,0.86)',
            textShadow: '0 1px 8px rgba(61,56,50,0.4)',
            fontStyle: 'italic',
          }}
        >
          Someone passed through here once. Time to make it warm again.
        </p>
      </div>

      {/* Skip button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleSkip();
        }}
        className="ows-btn-glass"
        style={{
          position: 'absolute',
          bottom: 'var(--space-md)',
          right: 'var(--space-md)',
          zIndex: 10,
          padding: 'var(--space-xs) var(--space-md)',
          fontSize: '0.82rem',
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
        @keyframes owsFadeOpacity {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
