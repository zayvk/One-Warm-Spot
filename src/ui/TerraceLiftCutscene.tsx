import { useEffect, useMemo, useState } from 'react';
import { CUTSCENE_ASSETS } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
import {
  floorBackdrop,
  floorCaption,
  floorIndicator,
  liftRideTimeline,
  type BuildingFloorId,
} from '../game/data/floors.ts';
import {
  playFootstep,
  playLiftDing,
  playLiftDoorSlide,
  playLiftFloorTick,
  startLiftHum,
  startSiteAmbience,
  stopLiftHum,
} from '../game/audio/soundEngine.ts';
import {
  CutsceneCaption,
  LIFT_DOORWAY_ORIGIN,
  LIFT_STAGE_H,
  LIFT_STAGE_W,
  LiftDoors,
  LiftFloorReadout,
  LiftFrame,
} from './liftStage.tsx';

/** The parent's fade-out at the end of every lift ride */
export const LIFT_FADE_MS = 400;

/** When the parent should start fading out of a ride (the ride ends exactly as the fade does) */
export function liftRideHoldMs(from: BuildingFloorId, to: BuildingFloorId): number {
  return liftRideTimeline(from, to).total - LIFT_FADE_MS;
}

/** Downstairs floors hear the rooftop's birdsong faintly through the windows */
const DOWNSTAIRS_AMBIENCE_LEVEL = 0.3;

export interface TerraceLiftCutsceneProps {
  fromFloor: BuildingFloorId;
  toFloor: BuildingFloorId;
  reduceMotion: boolean;
  /** Stops all pending beats and the lift hum immediately */
  skipped: boolean;
}

/**
 * A ride in the old apartment lift between any two stops (1–4 or R):
 * 1. **Leave** — push in toward the floor's lift (from 1–4), or pull back into the
 *    lift with the rooftop framed in its open doors (from R) and let the doors shut.
 * 2. **Ride** — hum, tremor and the amber indicator ticking floor by floor.
 * 3. **Arrive** — ding, the doors open on the destination's painting, its caption,
 *    and the view steps out. Duration scales with distance (~2.8s–4.5s).
 */
export default function TerraceLiftCutscene({ fromFloor, toFloor, reduceMotion, skipped }: TerraceLiftCutsceneProps) {
  const timeline = useMemo(() => liftRideTimeline(fromFloor, toFloor), [fromFloor, toFloor]);
  const isPush = timeline.intro === 'push';

  /* Push rides start inside the closed lift (hidden under the floor painting); step-in rides start with open doors */
  const [entered, setEntered] = useState(isPush);
  const [inLift, setInLift] = useState(!isPush);
  const [doorsOpen, setDoorsOpen] = useState(!isPush);
  const [riding, setRiding] = useState(false);
  const [indicator, setIndicator] = useState<BuildingFloorId>(fromFloor);
  const [behindIsDestination, setBehindIsDestination] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [steppedOut, setSteppedOut] = useState(false);

  const fromBackdrop = floorBackdrop(fromFloor);
  const toBackdrop = floorBackdrop(toFloor);

  /* Warm the image cache so every layer is ready before it's needed */
  useEffect(() => {
    for (const src of [CUTSCENE_ASSETS.terraceLiftFrame, CUTSCENE_ASSETS.terraceLiftDoor, fromBackdrop, toBackdrop]) {
      const img = new Image();
      img.src = src;
    }
  }, [fromBackdrop, toBackdrop]);

  useEffect(() => {
    if (skipped) return;
    const t = timeline;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    /* Beat 1 — leaving the floor */
    if (!reduceMotion) for (const ms of t.footsteps) at(ms, playFootstep);
    if (isPush) {
      at(t.liftIn, () => {
        playLiftDoorSlide();
        setInLift(true);
      });
    } else {
      at(t.stepIn, () => setEntered(true));
      at(t.doorsClose, () => {
        playLiftDoorSlide();
        setDoorsOpen(false);
        startSiteAmbience(null);
      });
    }

    /* Beat 2 — the ride */
    at(t.rideStart, () => {
      startLiftHum();
      setRiding(true);
    });
    at(t.swapBehind, () => setBehindIsDestination(true));
    for (const tick of t.ticks) {
      at(tick.at, () => {
        playLiftFloorTick();
        setIndicator(tick.floor);
      });
    }

    /* Beat 3 — arriving */
    at(t.arrive, () => {
      stopLiftHum();
      playLiftDing();
      setRiding(false);
      if (toFloor === 'R') startSiteAmbience('terrace');
      else startSiteAmbience('terrace', false, DOWNSTAIRS_AMBIENCE_LEVEL);
    });
    at(t.doorsOpen, () => {
      playLiftDoorSlide();
      setDoorsOpen(true);
    });
    at(t.caption, () => setShowCaption(true));
    at(t.stepOut, () => setSteppedOut(true));

    return () => {
      timers.forEach(clearTimeout);
      stopLiftHum();
    };
  }, [timeline, isPush, toFloor, reduceMotion, skipped]);

  const rooftopName = SITES.find((s) => s.id === 'terrace')?.name ?? 'Old Apartment Terrace';
  const behindIsRooftop = (behindIsDestination ? toFloor : fromFloor) === 'R';
  const liftShown = entered && !steppedOut;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#1e1a16' }}>
      {/* ── Cover-fitted 16:9 lift stage ── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: LIFT_STAGE_W,
          height: LIFT_STAGE_H,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            animation: riding && !reduceMotion ? 'owsLiftTremor 0.32s linear infinite' : undefined,
          }}
        >
          {/* Back: the floor beyond the doors (origin while leaving, destination once the doors are shut) */}
          {(
            [
              { floor: fromFloor, src: fromBackdrop, shown: !behindIsDestination },
              { floor: toFloor, src: toBackdrop, shown: behindIsDestination },
            ] as const
          ).map((layer, i) => (
            <img
              key={i}
              src={layer.src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: layer.shown ? 1 : 0,
                filter: layer.floor === 'R' ? 'sepia(0.12) saturate(1.08) brightness(1.06)' : undefined,
                /* The destination eases back from a slight zoom as the doors open */
                transform: i === 1 && !reduceMotion && !doorsOpen ? 'scale(1.06)' : 'scale(1)',
                transition: reduceMotion ? undefined : 'transform 1300ms ease-out',
              }}
            />
          ))}
          {behindIsRooftop && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at 50% 45%, rgba(255, 214, 140, 0.38), rgba(255, 186, 110, 0.12) 70%)',
                mixBlendMode: 'screen',
              }}
            />
          )}

          {/* Lift interior: settles in on entry, steps "through" the doorway on arrival */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: LIFT_DOORWAY_ORIGIN,
              transform: !reduceMotion && !liftShown ? 'scale(1.9)' : 'scale(1)',
              opacity: liftShown ? 1 : 0,
              transition: reduceMotion
                ? 'opacity 400ms ease'
                : steppedOut
                  ? 'transform 650ms cubic-bezier(0.55, 0, 0.8, 0.4), opacity 650ms ease-in'
                  : isPush
                    ? undefined
                    : 'transform 700ms cubic-bezier(0.2, 0.6, 0.35, 1), opacity 500ms ease-out',
            }}
          >
            <LiftDoors open={doorsOpen} reduceMotion={reduceMotion} />
            <LiftFrame />
            <LiftFloorReadout floor={floorIndicator(indicator)} reduceMotion={reduceMotion} />
          </div>
        </div>
      </div>

      {/* ── Push rides: the floor we're leaving, pushing in toward its lift ── */}
      {isPush && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            opacity: inLift ? 0 : 1,
            transition: 'opacity 300ms ease',
            pointerEvents: 'none',
          }}
        >
          <img
            src={fromBackdrop}
            alt=""
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transformOrigin: '50% 45%',
              animation: reduceMotion ? undefined : `owsLobbyPush ${timeline.liftIn + 200}ms ease-in-out forwards`,
            }}
          />
        </div>
      )}

      {showCaption && <CutsceneCaption text={floorCaption(toFloor, rooftopName)} reduceMotion={reduceMotion} />}
    </div>
  );
}
