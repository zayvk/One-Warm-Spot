import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useGameStore } from '../game/store/useGameStore.ts';
import { findEnterableDoor, type DownstairsFloorId } from '../game/data/floors.ts';
import {
  ROOMS,
  generateRoomLayout,
  getRoomProp,
  roomPropWidth,
  roomSafeArea,
  ROOM_ART_H,
  ROOM_ART_W,
  type GeneratedRoomLayout,
} from '../game/data/rooms.ts';
import { storeRoomLayout, storedRoomLayout } from '../game/engine/terraceState.ts';
import { fitStage, stageLeavesGaps } from '../game/engine/stageFit.ts';
import { playClick, playDoorCreak, playHover, setRoomTone } from '../game/audio/soundEngine.ts';
import { useHudStageFrame, useViewport } from './useViewport.ts';
import MaterialPouch from './MaterialPouch.tsx';

/** The room fades out this long before the hallway fades back in */
const EXIT_FADE_MS = 280;
const GLOW_MS = 900;
const MOTE_COUNT = 16;

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

export interface ApartmentRoomScreenProps {
  floor: DownstairsFloorId;
  /** The opened door the traveler stepped through */
  doorId: string;
  /** Step back out into the hallway */
  onBack: () => void;
}

/**
 * Inside an opened apartment door: the room behind it (a random room type and 3–5 pieces
 * of furniture, remembered until the door re-locks) on the same safe-area stage as the
 * floors. Props stand grounded on soft contact shadows, layered back to front, with gentle
 * pointer parallax, drifting window-light dust, and a light wash that follows the rooftop's
 * time of day and weather. Furniture can be inspected (searching comes next); ← Back or
 * Escape returns to the hallway.
 */
export default function ApartmentRoomScreen({ floor, doorId, onBack }: ApartmentRoomScreenProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const pushNotice = useGameStore((s) => s.pushNotice);
  const dayPhase = useGameStore((s) => s.dayPhase);
  const weather = useGameStore((s) => s.weather);
  const door = findEnterableDoor(floor, doorId);
  /* The same room every visit until the door re-locks overnight */
  const [layout] = useState<GeneratedRoomLayout>(() => storedRoomLayout(doorId) ?? generateRoomLayout(doorId));
  const [motes] = useState(makeMotes);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [glowing, setGlowing] = useState<{ id: string; key: number } | null>(null);
  /* The prop under the pointer / keyboard focus (its name tag sits above the room's light wash) */
  const [hovered, setHovered] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const isTouchRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBannerVisible(false), 2100);
    return () => clearTimeout(t);
  }, [doorId]);

  const room = ROOMS[layout.roomType];
  const { w: viewW, h: viewH } = useViewport();
  const safe = useMemo(() => roomSafeArea(layout), [layout]);
  const stage = useMemo(() => fitStage(viewW, viewH, ROOM_ART_W, ROOM_ART_H, safe), [viewW, viewH, safe]);
  const showFill = stageLeavesGaps(stage, viewW, viewH);
  useHudStageFrame(stage);

  useEffect(() => {
    storeRoomLayout(doorId, layout);
  }, [doorId, layout]);

  /* A door that isn't on this floor (stale link) just leads back out */
  useEffect(() => {
    if (!door) onBack();
  }, [door, onBack]);

  /* Reveal the room once the shell and its furniture have loaded */
  useEffect(() => {
    let alive = true;
    const urls = [room.shell, ...layout.props.map((p) => getRoomProp(layout.roomType, p.propId)?.src ?? '')].filter(Boolean);
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
  }, [room.shell, layout]);

  /* Muffled indoor room tone for the current weather & time of day */
  useEffect(() => {
    setRoomTone({ weather, phase: dayPhase });
  }, [weather, dayPhase]);
  useEffect(
    () => () => {
      setRoomTone(null);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!glowing) return;
    const t = setTimeout(() => setGlowing(null), GLOW_MS);
    return () => clearTimeout(t);
  }, [glowing]);

  const leave = useCallback(() => {
    if (exitTimer.current) return;
    playDoorCreak();
    setLeaving(true);
    exitTimer.current = setTimeout(onBack, reduceMotion ? 0 : EXIT_FADE_MS);
  }, [onBack, reduceMotion]);

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

  const inspect = (label: string, id: string) => {
    playClick();
    setGlowing({ id, key: Date.now() });
    pushNotice({ icon: '🔎', title: `You inspect the ${label} — searching inside rooms is coming soon.`, tone: 'build' });
  };

  const layerStyle = (depth: number): CSSProperties =>
    reduceMotion
      ? {}
      : { transform: `translate3d(calc(var(--room-px, 0) * ${-depth}px), calc(var(--room-py, 0) * ${-depth * 0.4}px), 0)` };

  const title = door ? `${door.label} · ${room.name}` : room.name;
  const hoveredPlaced = hovered ? layout.props.find((p) => p.propId === hovered) : undefined;
  const hoveredProp = hoveredPlaced && {
    ...hoveredPlaced,
    label: getRoomProp(layout.roomType, hoveredPlaced.propId)?.label ?? '',
  };

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

      {/* The 1376×768 room stage — shell, furniture and light all share its coordinates */}
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
          {layout.props.map((p, i) => {
            const def = getRoomProp(layout.roomType, p.propId);
            if (!def) return null;
            const w = roomPropWidth(def, p.scale);
            return (
              <button
                key={glowing?.id === p.propId ? `${p.propId}-${glowing.key}` : p.propId}
                type="button"
                className={`ows-room-prop ${glowing?.id === p.propId ? 'ows-room-prop--glow' : ''}`}
                aria-label={def.label}
                style={{
                  left: `${(p.x - w / 2) * 100}%`,
                  top: `${(p.y - p.scale) * 100}%`,
                  width: `${w * 100}%`,
                  height: `${p.scale * 100}%`,
                  zIndex: i + 1,
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
                  inspect(def.label, p.propId);
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
              </button>
            );
          })}
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

        {hoveredProp && (
          <div className="ows-room-layer ows-room-layer--labels" style={layerStyle(PARALLAX.props)} aria-hidden="true">
            <span
              className="ows-room-tag"
              style={{ left: `${hoveredProp.x * 100}%`, top: `${(hoveredProp.y - hoveredProp.scale) * 100}%` }}
            >
              {hoveredProp.label}
            </span>
          </div>
        )}
      </div>

      <header className="ows-hud-header ows-room-header" data-hud-top="">
        <button type="button" className="ows-room-back" onMouseEnter={playHover} onClick={leave}>
          ← Back to Floor {floor}
        </button>
        <span className="ows-room-title">{title}</span>
      </header>

      <MaterialPouch variant="downstairs" />

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
    </div>
  );
}
