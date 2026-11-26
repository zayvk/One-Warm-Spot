import { useCallback, useEffect, useState } from 'react';
import { CUTSCENE_ASSETS } from '../game/data/media.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import {
  playClick,
  playFootstep,
  playHover,
  playLiftDing,
  playLiftDoorSlide,
  playLiftFloorTick,
  playLocked,
  startLiftHum,
  startSiteAmbience,
  stopLiftHum,
} from '../game/audio/soundEngine.ts';
import { TERRACE_STAGE } from './TerraceLiftCutscene.tsx';
import {
  CutsceneCaption,
  LIFT_DOORWAY_ORIGIN,
  LIFT_STAGE_H,
  LIFT_STAGE_W,
  LiftDoors,
  LiftFloorReadout,
  LiftFrame,
} from './liftStage.tsx';

/* ── Ride-down timeline (ms) ── */
const STEP_IN = 60;
const STEP_IN_FOOTSTEPS = [120, 480];
const DOORS_CLOSE = 1000;
const RIDE_START = 1750;
/** While the doors are shut, the view beyond them quietly becomes the lobby */
const SWAP_TO_LOBBY = 1850;
const FLOORS = ['R', '4', '3', '2', '1'] as const;
const FLOOR_STEP = 380;
const ARRIVE = 3650;
const DOORS_OPEN = 3800;
const CAPTION = 4100;
const STEP_OUT = 4400;
const LOBBY_READY = 5100;

/** Rooftop ambience while stepping into the lift; birdsong drifts in through the lobby window */
const ROOFTOP_AMBIENCE_LEVEL = 0.55;
const LOBBY_AMBIENCE_LEVEL = 0.3;

const GLOW_MS = 1100;

interface LobbySpot {
  id: string;
  label: string;
  /** Rect in % of the 1376×768 lobby painting */
  rect: { left: number; top: number; width: number; height: number };
  kind: 'lift' | 'locked';
}

const LOBBY_SPOTS: LobbySpot[] = [
  { id: 'apartment-1a', label: 'Apartment 1A', rect: { left: 25.4, top: 21.5, width: 5.6, height: 49 }, kind: 'locked' },
  { id: 'lift', label: 'Ride the lift back up', rect: { left: 42.2, top: 23.8, width: 16.4, height: 40 }, kind: 'lift' },
  { id: 'apartment-1b', label: 'Apartment 1B', rect: { left: 69.2, top: 21.2, width: 5.5, height: 51.7 }, kind: 'locked' },
  { id: 'side-doorway', label: 'Open doorway', rect: { left: 82.3, top: 7.5, width: 10.8, height: 85.5 }, kind: 'locked' },
];

export interface TerraceLobbyScreenProps {
  /** Ride the lift back up (the parent replays the arrival ride onto the rooftop) */
  onReturnToRooftop: () => void;
}

/**
 * The ride down from the Terrace: stepping into the old lift from the rooftop,
 * doors closing, riding R→1, and the doors opening onto the quiet ground-floor
 * lobby — which then becomes a small interactive scene. Apartment doors glow and
 * say "Coming soon"; the lift (or the ↑ Rooftop button) rides back up.
 */
export default function TerraceLobbyScreen({ onReturnToRooftop }: TerraceLobbyScreenProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const pushNotice = useGameStore((s) => s.pushNotice);

  const [phase, setPhase] = useState<'descending' | 'lobby'>('descending');
  const [steppedIn, setSteppedIn] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(true);
  const [riding, setRiding] = useState(false);
  const [floor, setFloor] = useState<(typeof FLOORS)[number]>('R');
  const [lobbyBehind, setLobbyBehind] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [steppedOut, setSteppedOut] = useState(false);
  const [glowing, setGlowing] = useState<{ id: string; key: number } | null>(null);

  /* Warm the image cache, start on the rooftop's soundscape, and fall silent when leaving */
  useEffect(() => {
    for (const src of [CUTSCENE_ASSETS.terraceLiftFrame, CUTSCENE_ASSETS.terraceLiftDoor, CUTSCENE_ASSETS.terraceLobby]) {
      const img = new Image();
      img.src = src;
    }
    startSiteAmbience('terrace', false, ROOFTOP_AMBIENCE_LEVEL);
    return () => {
      stopLiftHum();
      startSiteAmbience(null);
    };
  }, []);

  /* Jump straight to the lobby (Skip, or the end of the ride) */
  const arriveInLobby = useCallback(() => {
    stopLiftHum();
    setSteppedIn(true);
    setRiding(false);
    setFloor('1');
    setLobbyBehind(true);
    setDoorsOpen(true);
    setSteppedOut(true);
    setPhase('lobby');
    startSiteAmbience('terrace', false, LOBBY_AMBIENCE_LEVEL);
  }, []);

  useEffect(() => {
    if (phase !== 'descending') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    /* Beat 1 — stepping back into the lift, the rooftop framed in its doorway */
    at(STEP_IN, () => setSteppedIn(true));
    if (!reduceMotion) for (const ms of STEP_IN_FOOTSTEPS) at(ms, playFootstep);
    at(DOORS_CLOSE, () => {
      playLiftDoorSlide();
      setDoorsOpen(false);
      startSiteAmbience(null);
    });

    /* Beat 2 — riding down */
    at(RIDE_START, () => {
      startLiftHum();
      setRiding(true);
    });
    at(SWAP_TO_LOBBY, () => setLobbyBehind(true));
    FLOORS.slice(1).forEach((f, i) => {
      at(RIDE_START + FLOOR_STEP * (i + 1), () => {
        playLiftFloorTick();
        setFloor(f);
      });
    });

    /* Beat 3 — doors open onto the quiet lobby */
    at(ARRIVE, () => {
      stopLiftHum();
      playLiftDing();
      setRiding(false);
      startSiteAmbience('terrace', false, LOBBY_AMBIENCE_LEVEL);
    });
    at(DOORS_OPEN, () => {
      playLiftDoorSlide();
      setDoorsOpen(true);
    });
    at(CAPTION, () => setShowCaption(true));
    at(STEP_OUT, () => setSteppedOut(true));
    at(LOBBY_READY, () => setPhase('lobby'));

    return () => {
      timers.forEach(clearTimeout);
      stopLiftHum();
    };
  }, [phase, reduceMotion]);

  /* Space / Enter / Escape skip the ride */
  useEffect(() => {
    if (phase !== 'descending') return;
    function onKey(e: KeyboardEvent) {
      if (['Space', 'Enter', 'Escape'].includes(e.code)) {
        e.preventDefault();
        arriveInLobby();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, arriveInLobby]);

  /* The glow highlight fades back to the hover state */
  useEffect(() => {
    if (!glowing) return;
    const t = setTimeout(() => setGlowing(null), GLOW_MS);
    return () => clearTimeout(t);
  }, [glowing]);

  const goBackUp = useCallback(() => {
    playClick();
    onReturnToRooftop();
  }, [onReturnToRooftop]);

  const onSpotClick = (spot: LobbySpot) => {
    if (spot.kind === 'lift') {
      goBackUp();
      return;
    }
    playLocked();
    setGlowing({ id: spot.id, key: Date.now() });
    pushNotice({
      icon: '🚪',
      title: 'Coming soon',
      body: `${spot.label} is closed for now — more of the building to explore soon.`,
      tone: 'build',
    });
  };

  const inLobby = phase === 'lobby';

  return (
    <div
      onClick={inLobby ? undefined : arriveInLobby}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        overflow: 'hidden',
        background: '#1e1a16',
        cursor: inLobby ? 'default' : 'pointer',
        animation: 'owsFadeOpacity 300ms ease',
      }}
    >
      {/* Cover-fitted 16:9 stage — the lift and the lobby painting share its coordinates */}
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
          {/* Back: the rooftop we leave… */}
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
              opacity: lobbyBehind ? 0 : 1,
            }}
          />
          {/* …and the quiet lobby we arrive in */}
          <img
            src={CUTSCENE_ASSETS.terraceLobby}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: lobbyBehind ? 1 : 0,
              transform: !reduceMotion && !steppedOut ? 'scale(1.06)' : 'scale(1)',
              transition: reduceMotion ? undefined : 'transform 1300ms ease-out',
            }}
          />

          {/* Lift interior: zooms in from the doorway on entry, steps back out through it on arrival */}
          {!inLobby && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transformOrigin: LIFT_DOORWAY_ORIGIN,
                transform: !reduceMotion && (!steppedIn || steppedOut) ? 'scale(1.9)' : 'scale(1)',
                opacity: steppedIn && !steppedOut ? 1 : 0,
                transition: reduceMotion
                  ? 'opacity 400ms ease'
                  : steppedOut
                    ? 'transform 650ms cubic-bezier(0.55, 0, 0.8, 0.4), opacity 650ms ease-in'
                    : 'transform 700ms cubic-bezier(0.2, 0.6, 0.35, 1), opacity 500ms ease-out',
              }}
            >
              <LiftDoors open={doorsOpen} reduceMotion={reduceMotion} />
              <LiftFrame />
              <LiftFloorReadout floor={floor} reduceMotion={reduceMotion} />
            </div>
          )}

          {/* Interactive lobby: glowing doors (coming soon) and the lift back up */}
          {inLobby &&
            LOBBY_SPOTS.map((spot) => (
              <button
                /* A fresh key per click restarts the glow animation */
                key={glowing?.id === spot.id ? `${spot.id}-${glowing.key}` : spot.id}
                type="button"
                aria-label={spot.label}
                className={`ows-lobby-spot ${glowing?.id === spot.id ? 'ows-lobby-spot--glow' : ''}`}
                style={{
                  left: `${spot.rect.left}%`,
                  top: `${spot.rect.top}%`,
                  width: `${spot.rect.width}%`,
                  height: `${spot.rect.height}%`,
                }}
                onMouseEnter={playHover}
                onClick={() => onSpotClick(spot)}
              >
                <span className="ows-lobby-label">{spot.label}</span>
              </button>
            ))}
        </div>
      </div>

      {showCaption && !inLobby && <CutsceneCaption text="Ground Floor · Lobby" reduceMotion={reduceMotion} />}

      {/* Lobby header: back up to the rooftop */}
      {inLobby && (
        <header
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            animation: 'owsFadeOpacity 400ms ease both',
          }}
        >
          <button
            type="button"
            className="ows-pill"
            onClick={goBackUp}
            onMouseEnter={playHover}
            title="Ride the lift back up to the rooftop"
          >
            ↑ Rooftop
          </button>
          <span
            style={{
              fontFamily: 'var(--font-game-title)',
              fontSize: 'clamp(0.95rem, 1.8vw, 1.2rem)',
              color: '#fff',
              textShadow: '0 2px 10px rgba(48, 38, 30, 0.65)',
              whiteSpace: 'nowrap',
            }}
          >
            Ground Floor Lobby
          </span>
        </header>
      )}

      {/* Skip the ride */}
      {!inLobby && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            arriveInLobby();
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
      )}
    </div>
  );
}
