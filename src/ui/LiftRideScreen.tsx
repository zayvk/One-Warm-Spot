import { useCallback, useEffect, useRef, useState } from 'react';
import TerraceLiftCutscene from './TerraceLiftCutscene.tsx';
import { useGameStore } from '../game/store/useGameStore.ts';
import { stopLiftHum } from '../game/audio/soundEngine.ts';
import { preloadShelterScene } from '../game/renderer/preloadScene.ts';
import { liftRideTimeline, type BuildingFloorId } from '../game/data/floors.ts';
import { isCutsceneSkipKey } from './cutsceneKeys.ts';

export interface LiftRideScreenProps {
  fromFloor: BuildingFloorId;
  toFloor: BuildingFloorId;
  /** The ride (or a skip) finished — show the destination floor */
  onArrive: () => void;
}

/**
 * Full-screen shell around a floor-to-floor lift ride: holds at full opacity into the
 * destination hand-off (so there is never a flash against bare body), and Skip jumps straight there.
 */
export default function LiftRideScreen({ fromFloor, toFloor, onArrive }: LiftRideScreenProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const [skipped, setSkipped] = useState(false);
  const doneRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onArrive();
  }, [onArrive]);

  /* Decode the rooftop stage early so the live scene reveals without a pop-in */
  useEffect(() => {
    if (toFloor === 'R') preloadShelterScene('terrace');
  }, [toFloor]);

  useEffect(() => {
    const hold = setTimeout(finish, liftRideTimeline(fromFloor, toFloor).total);
    timersRef.current.push(hold);
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      stopLiftHum();
    };
  }, [fromFloor, toFloor, finish]);

  const skip = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    setSkipped(true);
    stopLiftHum();
    finish();
  }, [finish]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isCutsceneSkipKey(e)) {
        e.preventDefault();
        skip();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skip]);

  return (
    <div
      onClick={skip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        cursor: 'pointer',
        animation: 'owsFadeOpacity 250ms ease',
      }}
    >
      <TerraceLiftCutscene fromFloor={fromFloor} toFloor={toFloor} reduceMotion={reduceMotion} skipped={skipped} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          skip();
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
    </div>
  );
}
