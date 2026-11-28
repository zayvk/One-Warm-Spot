import { useEffect, useCallback, useState, useRef } from 'react';
import BackgroundStage from './BackgroundStage.tsx';
import TerraceLiftCutscene from './TerraceLiftCutscene.tsx';
import { isCutsceneSkipKey } from './cutsceneKeys.ts';
import { LIFT_FADE_MS, liftRideHoldMs } from '../game/data/floors.ts';
import { BG_SHELTERS } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import {
  playFootstep,
  startSiteAmbience,
  fadeOutMenuMusic,
  stopLiftHum,
} from '../game/audio/soundEngine.ts';
import type { SiteId } from '../game/types/game.ts';
import { preloadShelterScene } from '../game/renderer/preloadScene.ts';

export interface ArrivalCutsceneProps {
  siteId: SiteId;
  onComplete: () => void;
}

const DURATION = 3500; // ms
const REDUCED_DURATION = 2200; // calm hold for reduce-motion
const FOOTSTEP_TIMES = [400, 900, 1400, 1950, 2500]; // ms offsets

export default function ArrivalCutscene({ siteId, onComplete }: ArrivalCutsceneProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  /* Timings follow the setting at the start, so toggling Reduce Motion mid-cutscene never restarts it */
  const [reducedAtStart] = useState(reduceMotion);
  const [phase, setPhase] = useState<'walking' | 'fadeout'>('walking');
  const [skipped, setSkipped] = useState(false);
  /* The Terrace arrives by the old apartment lift; other shelters use the Ken Burns fade */
  const isLift = siteId === 'terrace';

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completedRef = useRef(false);

  const site = SITES.find((s) => s.id === siteId);

  const finishOnce = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  /* Fade menu music; the lift swells its own ambience when the doors open */
  useEffect(() => {
    fadeOutMenuMusic();
    /* Decode the shelter's stage into Pixi's cache so the live scene reveals without a pop-in */
    preloadShelterScene(siteId);
    if (!isLift) startSiteAmbience(siteId);
    return () => startSiteAmbience(null);
  }, [siteId, isLift]);

  /* Schedule footsteps (skip walking footsteps when reduceMotion is on) */
  useEffect(() => {
    if (reducedAtStart || isLift) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ms of FOOTSTEP_TIMES) {
      timers.push(setTimeout(playFootstep, ms));
    }
    return () => timers.forEach(clearTimeout);
  }, [reducedAtStart, isLift]);

  /* Auto-complete after duration */
  useEffect(() => {
    const holdMs = isLift ? liftRideHoldMs(1, 'R') : reducedAtStart ? REDUCED_DURATION : DURATION;
    const fadeMs = isLift ? LIFT_FADE_MS : reducedAtStart ? 300 : 600;
    timerRef.current = setTimeout(() => {
      setPhase('fadeout');
      completeTimerRef.current = setTimeout(finishOnce, fadeMs);
    }, holdMs);

    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(completeTimerRef.current);
    };
  }, [reducedAtStart, finishOnce, isLift]);

  /* Skip handler */
  const handleSkip = useCallback(() => {
    clearTimeout(timerRef.current);
    clearTimeout(completeTimerRef.current);
    setSkipped(true);
    stopLiftHum();
    setPhase('fadeout');
    completeTimerRef.current = setTimeout(finishOnce, reduceMotion ? 100 : 200);
  }, [finishOnce, reduceMotion]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isCutsceneSkipKey(e)) {
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
        transition: `opacity ${isLift ? `${LIFT_FADE_MS}ms` : reducedAtStart ? '300ms' : '600ms'} ease`,
        animation: reduceMotion ? 'owsFadeOpacity 250ms ease' : undefined,
      }}
    >
      {isLift ? (
        <TerraceLiftCutscene fromFloor={1} toFloor="R" reduceMotion={reduceMotion} skipped={skipped} />
      ) : (
        <>
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
        </>
      )}

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
          bottom: 'var(--hud-bottom)',
          right: 'var(--hud-right)',
          zIndex: 10,
          padding: 'var(--space-xs) var(--space-md)',
          fontSize: '0.82rem',
        }}
      >
        Skip ▸
      </button>

      {/* CSS animations (fadeInUp / owsFadeOpacity live in theme.css) */}
      <style>{`
        @keyframes kenBurns {
          from { transform: scale(1); }
          to   { transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
