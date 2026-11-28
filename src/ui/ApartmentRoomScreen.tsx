import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useGameStore } from '../game/store/useGameStore.ts';
import { findEnterableDoor, type DownstairsFloorId } from '../game/data/floors.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { travelerSpriteSrc, travelerWalkFrames } from '../game/data/media.ts';
import {
  ROOM_ACTION_POSES,
  ROOMS,
  generateRoomLayout,
  getRoomProp,
  resetRoomTravelerPose,
  roomBackLabel,
  roomEntryPoint,
  roomPropWidth,
  roomSafeArea,
  roomStandTarget,
  roomTravelerScale,
  ROOM_ART_H,
  ROOM_ART_W,
  type GeneratedRoomLayout,
  type PlacedRoomProp,
  type RoomActionPose,
  type RoomPropDef,
} from '../game/data/rooms.ts';
import {
  markStoredRoomPropFailedToday,
  markStoredRoomPropSearched,
  readStoredTerraceState,
  roomPropKey,
  storeRoomLayout,
  storedRoomLayout,
} from '../game/engine/terraceState.ts';
import { addResources } from '../game/engine/scavenge.ts';
import { formatRewardCallout } from '../game/engine/rewardCallouts.ts';
import { fitStage, stageLeavesGaps } from '../game/engine/stageFit.ts';
import {
  playClick,
  playDoorCreak,
  playFootstep,
  playHover,
  playLocked,
  playNailTink,
  playRummage,
  setRoomTone,
} from '../game/audio/soundEngine.ts';
import type { MiniGameResult } from '../game/minigames/types.ts';
import { useHudStageFrame, useViewport } from './useViewport.ts';
import MaterialPouch from './MaterialPouch.tsx';
import FloatingRewards, { type FloatingCallout } from './FloatingRewards.tsx';
import ConnectWiresGame from './minigames/ConnectWiresGame.tsx';
import TicTacToeGame from './minigames/TicTacToeGame.tsx';
import DotsAndBoxesGame from './minigames/DotsAndBoxesGame.tsx';
import JigsawGame from './minigames/JigsawGame.tsx';
import FindTheObjectGame from './minigames/FindTheObjectGame.tsx';
import SafeDialGame from './minigames/SafeDialGame.tsx';
import HitTheNailGame from './minigames/HitTheNailGame.tsx';

/** The room fades out this long before the hallway fades back in */
const EXIT_FADE_MS = 280;
const GLOW_MS = 900;
const MOTE_COUNT = 16;
const WALK_SPEED = 0.4; // stage-width units per second
const WALK_MIN_MS = 260;
const WALK_MAX_MS = 1150;
const WALK_FRAME_MS = 150;
const FOOTSTEP_INTERVAL_MS = 300;
const ACTION_BEAT_MS = 550;
const ACTION_REDUCED_BEAT_MS = 140;

/** Parallax depth per layer, in px at full pointer travel (back shell → props → floating dust) */
const PARALLAX = { shell: 4, props: 7, motes: 10 } as const;

interface Mote {
  left: number;
  top: number;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
}

interface TravelerRoomActor {
  x: number;
  y: number;
  pose: 'idle' | 'walk' | RoomActionPose;
  facingRight: boolean;
  walkFrame: number;
}

interface PuzzleSession {
  placed: PlacedRoomProp;
  def: RoomPropDef;
  key: number;
}

function makeMotes(): Mote[] {
  return Array.from({ length: MOTE_COUNT }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 2 + Math.random() * 3,
    delay: -Math.random() * 14,
    duration: 11 + Math.random() * 9,
    driftX: 18 + Math.random() * 36,
    driftY: -(10 + Math.random() * 26),
  }));
}

function playPoseBeatSfx(pose: RoomActionPose): void {
  if (pose === 'search') playRummage();
  else if (pose === 'fix') playNailTink();
  else playClick();
}

export interface ApartmentRoomScreenProps {
  floor: DownstairsFloorId;
  /** The opened door the traveler stepped through */
  doorId: string;
  /** Step back out into the hallway */
  onBack: () => void;
}

/**
 * Inside an opened apartment door: the room behind it (a random room type and 3–5 pieces
 * of furniture, remembered until the door re-locks) with the player's traveler walking
 * across the floor to perform each prop's matching pose before launching its mini-game.
 */
export default function ApartmentRoomScreen({ floor, doorId, onBack }: ApartmentRoomScreenProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const pushNotice = useGameStore((s) => s.pushNotice);
  const dayPhase = useGameStore((s) => s.dayPhase);
  const weather = useGameStore((s) => s.weather);
  const travelerGender = useGameStore((s) => s.travelerGender);
  const selectedMode = useGameStore((s) => s.selectedMode);
  const door = findEnterableDoor(floor, doorId);

  /* The same room every visit until the door re-locks overnight */
  const [layout] = useState<GeneratedRoomLayout>(() => storedRoomLayout(doorId) ?? generateRoomLayout(doorId));
  const [motes] = useState(makeMotes);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [glowing, setGlowing] = useState<{ id: string; key: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [searchedProps, setSearchedProps] = useState<readonly string[]>(
    () => readStoredTerraceState()?.searchedRoomProps ?? [],
  );
  const [failedPropsToday, setFailedPropsToday] = useState<readonly string[]>(
    () => readStoredTerraceState()?.failedRoomPropsToday ?? [],
  );
  const [puzzleSession, setPuzzleSession] = useState<PuzzleSession | null>(null);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);

  const entry = useMemo(() => roomEntryPoint(), []);
  const [traveler, setTraveler] = useState<TravelerRoomActor>(() => ({
    x: entry.x,
    y: entry.y,
    pose: 'idle',
    facingRight: true,
    walkFrame: 0,
  }));

  const isTouchRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walkRafRef = useRef<number | null>(null);
  const poseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPropIdRef = useRef<string | null>(null);
  const travelerPosRef = useRef({ x: entry.x, y: entry.y });
  const puzzleSeqRef = useRef(0);
  const calloutSeqRef = useRef(0);

  const room = ROOMS[layout.roomType];
  const { w: viewW, h: viewH } = useViewport();
  const safe = useMemo(() => roomSafeArea(layout), [layout]);
  const stage = useMemo(() => fitStage(viewW, viewH, ROOM_ART_W, ROOM_ART_H, safe), [viewW, viewH, safe]);
  const showFill = stageLeavesGaps(stage, viewW, viewH);
  useHudStageFrame(stage);

  useEffect(() => {
    const t = setTimeout(() => setBannerVisible(false), 2100);
    return () => clearTimeout(t);
  }, [doorId]);

  useEffect(() => {
    storeRoomLayout(doorId, layout);
  }, [doorId, layout]);

  /* A door that isn't on this floor (stale link) just leads back out */
  useEffect(() => {
    if (!door) onBack();
  }, [door, onBack]);

  /* Reveal the room once the shell, furniture, and traveler sprites have loaded */
  useEffect(() => {
    let alive = true;
    const urls = [
      room.shell,
      ...layout.props.map((p) => getRoomProp(layout.roomType, p.propId)?.src ?? ''),
      travelerSpriteSrc(travelerGender, 'idle'),
      travelerSpriteSrc(travelerGender, 'walk'),
      ...travelerWalkFrames(travelerGender),
      ...ROOM_ACTION_POSES.map((p) => travelerSpriteSrc(travelerGender, p)),
    ].filter(Boolean);
    let left = urls.length;
    const done = () => {
      left -= 1;
      if (alive && left <= 0) setReady(true);
    };
    for (const url of urls) {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = url;
    }
    return () => {
      alive = false;
    };
  }, [room.shell, layout, travelerGender]);

  const cancelSequence = useCallback(() => {
    if (walkRafRef.current !== null) {
      cancelAnimationFrame(walkRafRef.current);
      walkRafRef.current = null;
    }
    if (poseTimerRef.current !== null) {
      clearTimeout(poseTimerRef.current);
      poseTimerRef.current = null;
    }
    pendingPropIdRef.current = null;
  }, []);

  /* Muffled indoor room tone for the current weather & time of day */
  useEffect(() => {
    setRoomTone({ weather, phase: dayPhase });
  }, [weather, dayPhase]);
  useEffect(
    () => () => {
      setRoomTone(null);
      if (exitTimer.current) clearTimeout(exitTimer.current);
      cancelSequence();
    },
    [cancelSequence],
  );

  useEffect(() => {
    if (!glowing) return;
    const t = setTimeout(() => setGlowing(null), GLOW_MS);
    return () => clearTimeout(t);
  }, [glowing]);

  const leave = useCallback(
    (e?: ReactMouseEvent) => {
      e?.stopPropagation();
      if (exitTimer.current) return;
      cancelSequence();
      setHovered(null);
      setPuzzleSession(null);
      setTraveler(resetRoomTravelerPose);
      playDoorCreak();
      setLeaving(true);
      exitTimer.current = setTimeout(onBack, reduceMotion ? 0 : EXIT_FADE_MS);
    },
    [onBack, reduceMotion, cancelSequence],
  );

  /* Escape steps back out — unless a popover or dialog is open (Escape closes that instead) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"]')) return;
      leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  /* Gentle parallax: each layer drifts a few px against the pointer */
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reduceMotion || e.pointerType === 'touch') return;
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty('--room-px', ((e.clientX / viewW - 0.5) * 2).toFixed(3));
    el.style.setProperty('--room-py', ((e.clientY / viewH - 0.5) * 2).toFixed(3));
  };

  const openPuzzleNow = useCallback((placed: PlacedRoomProp, def: RoomPropDef) => {
    puzzleSeqRef.current += 1;
    pendingPropIdRef.current = null;
    setPuzzleSession({ placed, def, key: puzzleSeqRef.current });
  }, []);

  const performPoseThenOpen = useCallback(
    (placed: PlacedRoomProp, def: RoomPropDef, targetX: number, targetY: number, facingRight: boolean, brisk: boolean) => {
      travelerPosRef.current = { x: targetX, y: targetY };
      setTraveler({
        x: targetX,
        y: targetY,
        pose: def.actionPose,
        facingRight,
        walkFrame: 0,
      });
      playPoseBeatSfx(def.actionPose);
      poseTimerRef.current = setTimeout(
        () => {
          poseTimerRef.current = null;
          openPuzzleNow(placed, def);
        },
        brisk ? ACTION_REDUCED_BEAT_MS : ACTION_BEAT_MS,
      );
    },
    [openPuzzleNow],
  );

  const inspectProp = useCallback(
    (placed: PlacedRoomProp, def: RoomPropDef) => {
      if (leaving || puzzleSession) return;
      const key = roomPropKey(doorId, def.id);
      if (searchedProps.includes(key)) {
        playClick();
        setGlowing({ id: def.id, key: Date.now() });
        pushNotice({ icon: '✓', title: `${def.label} — already searched.`, tone: 'build' });
        return;
      }
      if (failedPropsToday.includes(key)) {
        playLocked();
        setGlowing({ id: def.id, key: Date.now() });
        pushNotice({ icon: '🔒', title: `${def.label} — try again tomorrow.`, tone: 'build' });
        return;
      }

      const target = roomStandTarget(placed, def);
      /* Second click on the same prop mid-walk (or Reduce Motion) skips briskly into the pose & puzzle */
      if (reduceMotion || pendingPropIdRef.current === def.id) {
        cancelSequence();
        pendingPropIdRef.current = def.id;
        performPoseThenOpen(placed, def, target.x, target.y, target.facingRight, true);
        return;
      }

      cancelSequence();
      pendingPropIdRef.current = def.id;
      const startX = travelerPosRef.current.x;
      const startY = travelerPosRef.current.y;
      const dist = Math.hypot(target.x - startX, target.y - startY);
      if (dist < 0.015) {
        performPoseThenOpen(placed, def, target.x, target.y, target.facingRight, false);
        return;
      }

      const durationMs = Math.min(WALK_MAX_MS, Math.max(WALK_MIN_MS, (dist / WALK_SPEED) * 1000));
      const walkRight = target.x >= startX;
      const startTime = performance.now();
      let lastStepSound = startTime - FOOTSTEP_INTERVAL_MS * 0.65;

      const step = (now: number) => {
        if (pendingPropIdRef.current !== def.id) return;
        const t = Math.min(1, (now - startTime) / durationMs);
        /* Smoothstep easing feels cozy without sluggish stop */
        const ease = t * t * (3 - 2 * t);
        const curX = startX + (target.x - startX) * ease;
        const curY = startY + (target.y - startY) * ease;
        travelerPosRef.current = { x: curX, y: curY };

        if (now - lastStepSound >= FOOTSTEP_INTERVAL_MS && t < 0.92) {
          lastStepSound = now;
          playFootstep();
        }
        const frame = Math.floor((now - startTime) / WALK_FRAME_MS) % 4;
        setTraveler({
          x: curX,
          y: curY,
          pose: 'walk',
          facingRight: walkRight,
          walkFrame: frame,
        });

        if (t < 1) {
          walkRafRef.current = requestAnimationFrame(step);
        } else {
          walkRafRef.current = null;
          performPoseThenOpen(placed, def, target.x, target.y, target.facingRight, false);
        }
      };

      walkRafRef.current = requestAnimationFrame(step);
    },
    [
      leaving,
      puzzleSession,
      doorId,
      searchedProps,
      failedPropsToday,
      reduceMotion,
      cancelSequence,
      performPoseThenOpen,
      pushNotice,
    ],
  );

  const spawnCallout = useCallback((placed: PlacedRoomProp, text: string) => {
    if (!text) return;
    const id = ++calloutSeqRef.current;
    const x = Math.min(82, Math.max(18, ((stage.x + placed.x * stage.width) / viewW) * 100));
    const y = Math.min(68, Math.max(18, ((stage.y + (placed.y - placed.scale) * stage.height) / viewH) * 100));
    setCallouts((curr) => [...curr, { id, text, tone: 'reward', x, y }]);
    setTimeout(() => {
      setCallouts((curr) => curr.filter((c) => c.id !== id));
    }, 1500);
  }, [stage, viewW, viewH]);

  const closePuzzle = useCallback(() => {
    cancelSequence();
    setPuzzleSession(null);
    setTraveler(resetRoomTravelerPose);
  }, [cancelSequence]);

  const onPuzzleComplete = useCallback(
    (result: MiniGameResult) => {
      cancelSequence();
      const session = puzzleSession;
      setPuzzleSession(null);
      setTraveler(resetRoomTravelerPose);
      if (!session) return;
      const { placed, def } = session;
      const key = roomPropKey(doorId, def.id);
      if (result.outcome === 'win') {
        if (searchedProps.includes(key)) return;
        setSearchedProps(markStoredRoomPropSearched(doorId, def.id).searchedRoomProps);
        const store = useGameStore.getState();
        useGameStore.setState({ resources: addResources(store.resources, def.reward) });
        store._save();
        const rewardLine = formatRewardCallout(def.reward);
        spawnCallout(placed, rewardLine);
        const firstId = Object.keys(def.reward)[0] as keyof typeof RESOURCE_MAP | undefined;
        pushNotice({
          icon: (firstId && RESOURCE_MAP[firstId]?.emoji) || '🔎',
          title: rewardLine ? `${def.label} — ${rewardLine}` : `${def.label} searched!`,
          tone: 'unlock',
        });
        return;
      }
      if (result.outcome === 'loss') {
        setFailedPropsToday(markStoredRoomPropFailedToday(doorId, def.id).failedRoomPropsToday);
        pushNotice({ icon: '🔒', title: `${def.label} — try again tomorrow.`, tone: 'build' });
      }
    },
    [cancelSequence, puzzleSession, doorId, searchedProps, spawnCallout, pushNotice],
  );

  const layerStyle = (depth: number): CSSProperties =>
    reduceMotion
      ? {}
      : { transform: `translate3d(calc(var(--room-px, 0) * ${-depth}px), calc(var(--room-py, 0) * ${-depth * 0.4}px), 0)` };

  const title = door ? `${door.label} · ${room.name}` : room.name;
  const hoveredPlaced = hovered ? layout.props.find((p) => p.propId === hovered) : undefined;
  const hoveredDef = hoveredPlaced ? getRoomProp(layout.roomType, hoveredPlaced.propId) : undefined;
  const hoveredKey = hoveredDef ? roomPropKey(doorId, hoveredDef.id) : '';
  const hoveredSearched = Boolean(hoveredDef && searchedProps.includes(hoveredKey));
  const hoveredFailed = Boolean(hoveredDef && !hoveredSearched && failedPropsToday.includes(hoveredKey));

  const travelerHeight = roomTravelerScale(
    traveler.y,
    traveler.pose,
  );
  const travelerSrc =
    traveler.pose === 'walk' && !reduceMotion
      ? travelerWalkFrames(travelerGender)[traveler.walkFrame]
      : travelerSpriteSrc(travelerGender, traveler.pose);

  return (
    <div
      ref={rootRef}
      className={`ows-room ows-room--${dayPhase} ows-room--${weather}`}
      style={{
        opacity: leaving ? 0 : 1,
        transition: reduceMotion ? undefined : `opacity ${EXIT_FADE_MS}ms ease`,
      }}
      onPointerMove={onPointerMove}
      onClick={() => {
        if (hovered) setHovered(null);
      }}
    >
      {showFill && (
        <img
          src={room.shell}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="ows-room-fill"
        />
      )}

      {/* The 1376×768 room stage — shell, furniture, traveler and light share its coordinates */}
      <div
        className={`ows-room-stage ${ready ? 'ows-room-stage--ready' : ''}`}
        style={{
          left: `${stage.x}px`,
          top: `${stage.y}px`,
          width: `${stage.width}px`,
          height: `${stage.height}px`,
          boxShadow: showFill ? '0 0 40px rgba(20, 16, 12, 0.45)' : undefined,
        }}
      >
        <div className="ows-room-layer ows-room-layer--shell" style={layerStyle(PARALLAX.shell)}>
          <img src={room.shell} alt="" draggable={false} className="ows-room-shell" />
        </div>

        <div className="ows-room-layer ows-room-layer--props" style={layerStyle(PARALLAX.props)}>
          {layout.props.map((p) => {
            const def = getRoomProp(layout.roomType, p.propId);
            if (!def) return null;
            const key = roomPropKey(doorId, p.propId);
            const isSearched = searchedProps.includes(key);
            const isFailed = !isSearched && failedPropsToday.includes(key);
            const w = roomPropWidth(def, p.scale);
            return (
              <button
                key={glowing?.id === p.propId ? `${p.propId}-${glowing.key}` : p.propId}
                type="button"
                className={`ows-room-prop ${glowing?.id === p.propId ? 'ows-room-prop--glow' : ''} ${
                  isSearched ? 'ows-room-prop--searched' : ''
                } ${isFailed ? 'ows-room-prop--failed' : ''}`}
                aria-label={isSearched ? `${def.label} (already searched)` : def.label}
                style={{
                  left: `${(p.x - w / 2) * 100}%`,
                  top: `${(p.y - p.scale) * 100}%`,
                  width: `${w * 100}%`,
                  height: `${p.scale * 100}%`,
                  zIndex: Math.round(p.y * 1000),
                }}
                onPointerDown={(e) => {
                  isTouchRef.current = e.pointerType === 'touch';
                }}
                onMouseEnter={() => {
                  playHover();
                  setHovered(p.propId);
                }}
                onMouseLeave={() => setHovered((h) => (h === p.propId ? null : h))}
                onFocus={() => setHovered(p.propId)}
                onBlur={() => setHovered((h) => (h === p.propId ? null : h))}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isTouchRef.current && hovered !== p.propId) {
                    isTouchRef.current = false;
                    playHover();
                    setHovered(p.propId);
                    return;
                  }
                  isTouchRef.current = false;
                  inspectProp(p, def);
                }}
              >
                <span className="ows-room-prop__shadow-ambient" aria-hidden="true" />
                <span className="ows-room-prop__shadow-occlusion" aria-hidden="true" />
                <span className="ows-room-prop__art">
                  <img
                    src={def.src}
                    alt=""
                    draggable={false}
                    style={p.flipX ? { transform: 'scaleX(-1)' } : undefined}
                  />
                </span>
                {isSearched && (
                  <span className="ows-room-prop__check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}

          {/* Player's chosen traveler, Y-sorted seamlessly among the furniture */}
          <div
            className="ows-room-traveler"
            aria-hidden="true"
            style={{
              left: `${traveler.x * 100}%`,
              top: `${(traveler.y - travelerHeight) * 100}%`,
              height: `${travelerHeight * 100}%`,
              zIndex: Math.round(traveler.y * 1000),
            }}
          >
            <span className="ows-room-traveler__shadow-ambient" />
            <span className="ows-room-traveler__shadow-occlusion" />
            <span className="ows-room-traveler__art">
              <img
                src={travelerSrc}
                alt=""
                draggable={false}
                style={traveler.facingRight ? undefined : { transform: 'scaleX(-1)' }}
              />
            </span>
          </div>
        </div>

        {/* Angled sunlit beams & dust drifting through the window light */}
        <div className="ows-room-layer ows-room-layer--motes" style={layerStyle(PARALLAX.motes)} aria-hidden="true">
          <div className={`ows-room-sunbeams ows-room-sunbeams--${room.windowSide}`}>
            <span className="ows-room-beam ows-room-beam--1" />
            <span className="ows-room-beam ows-room-beam--2" />
            <span className="ows-room-beam ows-room-beam--3" />
          </div>
          <div
            className="ows-room-light"
            style={{
              left: `${room.light.x * 100}%`,
              top: `${room.light.y * 100}%`,
              width: `${room.light.w * 100}%`,
              height: `${room.light.h * 100}%`,
            }}
          >
            {motes.map((m, i) => (
              <span
                key={i}
                className="ows-room-mote"
                style={
                  {
                    left: `${m.left}%`,
                    top: `${m.top}%`,
                    width: `${m.size}px`,
                    height: `${m.size}px`,
                    animationDelay: `${m.delay}s`,
                    animationDuration: `${m.duration}s`,
                    '--mote-dx': `${m.driftX}px`,
                    '--mote-dy': `${m.driftY}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>

        {/* Time of day & weather light, then a warm edge vignette */}
        <div className="ows-room-wash" aria-hidden="true" />
        <div className="ows-room-weather" aria-hidden="true" />
        <div className="ows-room-vignette" aria-hidden="true" />

        {hoveredPlaced && hoveredDef && (
          <div className="ows-room-layer ows-room-layer--labels" style={layerStyle(PARALLAX.props)} aria-hidden="true">
            <span
              className="ows-room-tag"
              style={{ left: `${hoveredPlaced.x * 100}%`, top: `${(hoveredPlaced.y - hoveredPlaced.scale) * 100}%` }}
            >
              <span>{hoveredDef.label}</span>
              {hoveredSearched && <span className="ows-room-tag__check">✓</span>}
              {hoveredFailed && <span className="ows-room-tag__lock">· Tomorrow</span>}
            </span>
          </div>
        )}
      </div>

      <header className="ows-hud-header ows-room-header" data-hud-top="">
        <button type="button" className="ows-room-back" onMouseEnter={playHover} onClick={(e) => leave(e)}>
          {roomBackLabel(floor)}
        </button>
        <span className="ows-room-title">{title}</span>
      </header>

      <MaterialPouch variant="downstairs" />
      <FloatingRewards callouts={callouts} />

      {bannerVisible && (
        <div className="ows-room-banner" aria-hidden="true">
          <span className="ows-room-banner__title">{door ? door.label : room.name}</span>
          {door && (
            <>
              <span className="ows-room-banner__rule" />
              <span className="ows-room-banner__sub">{room.name}</span>
            </>
          )}
        </div>
      )}

      {puzzleSession?.def.puzzle === 'connect-wires' && (
        <ConnectWiresGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
      {puzzleSession?.def.puzzle === 'tic-tac-toe' && (
        <TicTacToeGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
      {puzzleSession?.def.puzzle === 'dots-and-lines' && (
        <DotsAndBoxesGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
      {puzzleSession?.def.puzzle === 'jigsaw' && (
        <JigsawGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
      {puzzleSession?.def.puzzle === 'find-the-object' && (
        <FindTheObjectGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
      {puzzleSession?.def.puzzle === 'safe-dial' && (
        <SafeDialGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
      {puzzleSession?.def.puzzle === 'hit-the-nail' && (
        <HitTheNailGame
          key={`${puzzleSession.def.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.def.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}
    </div>
  );
}
