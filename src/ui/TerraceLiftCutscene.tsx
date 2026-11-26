import { useEffect, useState } from 'react';
import { CUTSCENE_ASSETS, SCENE_STAGES } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
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

/** Parent starts its fade-out here; the full sequence runs ~5.2s */
export const TERRACE_LIFT_HOLD_MS = 4800;

const LOBBY_FOOTSTEPS = [280, 720, 1160];
/** Lobby crossfades into the lift as the doors slide shut */
const LIFT_IN = 1450;
const RIDE_START = 1700;
const FLOORS = ['1', '2', '3', '4', 'R'] as const;
const FLOOR_STEP = 380;
const ARRIVE = 3700;
const DOORS_OPEN = 3850;
const CAPTION = 4150;
const STEP_OUT = 4450;

export const TERRACE_STAGE = SCENE_STAGES.terrace ?? '/source/scenes/terrace-stage.webp';

export interface TerraceLiftCutsceneProps {
  reduceMotion: boolean;
  /** Stops all pending beats and the lift hum immediately */
  skipped: boolean;
}

/**
 * 3-beat Terrace arrival: a quiet lobby → riding the old lift up (floor
 * indicator ticks 1→R) → the doors slide open onto the sunlit rooftop.
 */
export default function TerraceLiftCutscene({ reduceMotion, skipped }: TerraceLiftCutsceneProps) {
  const [inLift, setInLift] = useState(false);
  const [riding, setRiding] = useState(false);
  const [floor, setFloor] = useState<(typeof FLOORS)[number]>('1');
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [steppedOut, setSteppedOut] = useState(false);

  /* Warm the image cache so the lift layers are ready before Beat 2 */
  useEffect(() => {
    for (const src of [CUTSCENE_ASSETS.terraceLiftFrame, CUTSCENE_ASSETS.terraceLiftDoor, TERRACE_STAGE]) {
      const img = new Image();
      img.src = src;
    }
  }, []);

  useEffect(() => {
    if (skipped) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    /* Beat 1 — the quiet lobby */
    if (!reduceMotion) for (const ms of LOBBY_FOOTSTEPS) at(ms, playFootstep);
    at(LIFT_IN, () => {
      playLiftDoorSlide();
      setInLift(true);
    });

    /* Beat 2 — riding up */
    at(RIDE_START, () => {
      startLiftHum();
      setRiding(true);
    });
    FLOORS.slice(1).forEach((f, i) => {
      at(RIDE_START + FLOOR_STEP * (i + 1), () => {
        playLiftFloorTick();
        setFloor(f);
      });
    });

    /* Beat 3 — doors open to sunlight */
    at(ARRIVE, () => {
      stopLiftHum();
      playLiftDing();
      setRiding(false);
      startSiteAmbience('terrace');
    });
    at(DOORS_OPEN, () => {
      playLiftDoorSlide();
      setDoorsOpen(true);
    });
    at(CAPTION, () => setShowCaption(true));
    at(STEP_OUT, () => setSteppedOut(true));

    return () => {
      timers.forEach(clearTimeout);
      stopLiftHum();
    };
  }, [reduceMotion, skipped]);

  const siteName = SITES.find((s) => s.id === 'terrace')?.name ?? 'Old Apartment Terrace';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#1e1a16' }}>
      {/* ── Beats 2–3: cover-fitted 16:9 lift stage ── */}
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
          {/* Back: the sunlit rooftop waiting beyond the doors */}
          <img
            src={TERRACE_STAGE}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              filter: 'sepia(0.12) saturate(1.08) brightness(1.06)',
              transform: !reduceMotion && !doorsOpen ? 'scale(1.06)' : 'scale(1)',
              transition: reduceMotion ? undefined : 'transform 1300ms ease-out',
            }}
          />
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

          {/* Lift interior (doors + frame + indicator) — steps "through" the doorway at the end */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformOrigin: LIFT_DOORWAY_ORIGIN,
              transform: steppedOut && !reduceMotion ? 'scale(1.9)' : 'scale(1)',
              opacity: steppedOut ? 0 : 1,
              transition: reduceMotion
                ? 'opacity 400ms ease'
                : 'transform 650ms cubic-bezier(0.55, 0, 0.8, 0.4), opacity 650ms ease-in',
            }}
          >
            <LiftDoors open={doorsOpen} reduceMotion={reduceMotion} />
            <LiftFrame />
            <LiftFloorReadout floor={floor} reduceMotion={reduceMotion} />
          </div>
        </div>
      </div>

      {/* ── Beat 1: the quiet lobby (cover, push-in toward the lift) ── */}
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
          src={CUTSCENE_ASSETS.terraceLobby}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transformOrigin: '50% 45%',
            animation: reduceMotion ? undefined : 'owsLobbyPush 1.7s ease-in-out forwards',
          }}
        />
      </div>

      {/* Warm arrival caption */}
      {showCaption && <CutsceneCaption text={siteName} reduceMotion={reduceMotion} />}
    </div>
  );
}
