import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useGameStore } from '../game/store/useGameStore.ts';
import { useHudStageFrame, useViewport } from './useViewport.ts';
import {
  BUILDING_FLOORS,
  floorSafeArea,
  floorSpotDoneNotice,
  floorSpotEnterLabel,
  floorSpotRepairedLabel,
  floorSpotRepairedNotice,
  type BuildingFloorId,
  type DownstairsFloorId,
  type FloorHotspot,
} from '../game/data/floors.ts';
import { fitStage, stageLeavesGaps } from '../game/engine/stageFit.ts';
import {
  markStoredSpotFailedToday,
  markStoredSpotRepaired,
  readStoredTerraceState,
} from '../game/engine/terraceState.ts';
import { addResources } from '../game/engine/scavenge.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { playClick, playDoorCreak, playHover, playLocked, startSiteAmbience } from '../game/audio/soundEngine.ts';
import type { MiniGameResult } from '../game/minigames/types.ts';
import { formatRewardCallout } from '../game/engine/rewardCallouts.ts';
import ElevatorPanelModal from './ElevatorPanelModal.tsx';
import MaterialPouch from './MaterialPouch.tsx';
import FloatingRewards, { type FloatingCallout } from './FloatingRewards.tsx';
import ConnectWiresGame from './minigames/ConnectWiresGame.tsx';
import TicTacToeGame from './minigames/TicTacToeGame.tsx';
import DotsAndBoxesGame from './minigames/DotsAndBoxesGame.tsx';

/** Floor paintings are 1376×768 (the same stage as the lift) */
const ART_W = 1376;
const ART_H = 768;

/** Birdsong drifts faintly in from the rooftop */
const DOWNSTAIRS_AMBIENCE_LEVEL = 0.3;
const GLOW_MS = 1100;
/*
 * Fuse-box electricity, placed in % of the hotspot (the open panel's contacts and
 * dangling wire ends). Each arc double-flickers on its own rhythm; hot embers
 * shoot out and fall; the box briefly flashes cold blue.
 */
const ARC_PATHS = [
  'M3 22 L11 15 L15 24 L22 11 L27 20 L33 9 L37 14',
  'M4 10 L10 19 L16 12 L21 26 L28 17 L36 25',
  'M5 28 L12 20 L17 27 L23 15 L30 22 L36 12',
];
const ARCS: { left: number; top: number; path: number; delay: number; duration: number }[] = [
  { left: 68, top: 28, path: 0, delay: 0, duration: 2.2 },
  { left: 56, top: 46, path: 1, delay: 0.9, duration: 2.7 },
  { left: 62, top: 88, path: 2, delay: 1.6, duration: 1.9 },
  { left: 10, top: 40, path: 1, delay: 2.3, duration: 3.1 },
];
/* [left %, top %, delay s, horizontal kick px] */
const EMBERS: [number, number, number, number][] = [
  [66, 30, 0.04, -14],
  [70, 30, 0.06, 10],
  [58, 48, 0.95, -9],
  [63, 89, 1.65, 12],
  [61, 89, 1.68, -6],
];

export interface BuildingFloorScreenProps {
  floor: DownstairsFloorId;
  /** Ride the lift to another stop (R = back to the rooftop) */
  onRide: (to: BuildingFloorId) => void;
  /** Step through an opened apartment door into its room */
  onEnterRoom?: (doorId: string) => void;
}

/** The hallway fades out this long before the room fades in */
const ENTER_FADE_MS = 280;

/**
 * One explorable floor of the old apartment building (1–4): its painting on the
 * same aspect-locked stage as the lift, glowing scavenging spots and the centred lift,
 * which opens the floor panel (including the Rooftop). Spots with a live puzzle (Floor 3's
 * fuse box → Connect the Wires) open it, are repaired for the rest of the run when solved
 * and pay out their salvage once; the rest say their puzzle is coming soon.
 * The rooftop's day clock rests while you're down here.
 */
export default function BuildingFloorScreen({ floor, onRide, onEnterRoom }: BuildingFloorScreenProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const pushNotice = useGameStore((s) => s.pushNotice);
  const selectedMode = useGameStore((s) => s.selectedMode);
  const [panelOpen, setPanelOpen] = useState(false);
  const [glowing, setGlowing] = useState<{ id: string; key: number } | null>(null);
  /* Spots fixed or failed today (kept in the rooftop's saved state) */
  const [repaired, setRepaired] = useState<readonly string[]>(() => readStoredTerraceState()?.repairedSpots ?? []);
  const [failedToday, setFailedToday] = useState<readonly string[]>(
    () => readStoredTerraceState()?.failedTodaySpots ?? [],
  );
  const puzzleSeqRef = useRef(0);
  const [puzzleSession, setPuzzleSession] = useState<{ spot: FloorHotspot; key: number } | null>(null);
  /* Stepping through a door: the hallway fades out, then the room takes over */
  const [leaving, setLeaving] = useState(false);
  const [touchPreviewId, setTouchPreviewId] = useState<string | null>(null);
  const isTouchRef = useRef(false);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);
  const calloutSeqRef = useRef(0);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = BUILDING_FLOORS[floor];
  const { w: viewW, h: viewH } = useViewport();
  const stage = useMemo(() => fitStage(viewW, viewH, ART_W, ART_H, floorSafeArea(floor)), [viewW, viewH, floor]);
  const showFill = stageLeavesGaps(stage, viewW, viewH);
  useHudStageFrame(stage);

  useEffect(() => {
    startSiteAmbience('terrace', false, DOWNSTAIRS_AMBIENCE_LEVEL);
    return () => {
      startSiteAmbience(null);
      if (enterTimer.current) clearTimeout(enterTimer.current);
    };
  }, []);

  /* The glow flare settles back to the hover state */
  useEffect(() => {
    if (!glowing) return;
    const t = setTimeout(() => setGlowing(null), GLOW_MS);
    return () => clearTimeout(t);
  }, [glowing]);

  const openPanel = useCallback(() => {
    playClick();
    setTouchPreviewId(null);
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const spawnCallout = useCallback((text: string, xPct?: number, yPct?: number) => {
    if (!text) return;
    const id = ++calloutSeqRef.current;
    setCallouts((curr) => [...curr, { id, text, tone: 'reward', x: xPct, y: yPct }]);
    setTimeout(() => {
      setCallouts((curr) => curr.filter((c) => c.id !== id));
    }, 1500);
  }, []);

  const onSpotClick = (spot: FloorHotspot) => {
    if (leaving) return;
    if (spot.kind === 'lift') {
      openPanel();
      return;
    }
    if (isTouchRef.current && touchPreviewId !== spot.id) {
      isTouchRef.current = false;
      playHover();
      setTouchPreviewId(spot.id);
      return;
    }
    isTouchRef.current = false;
    setTouchPreviewId(null);
    /* An opened room door leads inside */
    if (spot.enterable && onEnterRoom && repaired.includes(spot.id)) {
      playDoorCreak();
      setLeaving(true);
      enterTimer.current = setTimeout(() => onEnterRoom(spot.id), reduceMotion ? 0 : ENTER_FADE_MS);
      return;
    }
    if (spot.requiresTool === 'axe') {
      playLocked();
      setGlowing({ id: spot.id, key: Date.now() });
      pushNotice({
        icon: '🪓',
        title: 'Boarded shut with planks — needs an axe to clear (coming soon).',
        tone: 'build',
      });
      return;
    }
    if (spot.puzzle) {
      if (repaired.includes(spot.id)) {
        playClick();
        setGlowing({ id: spot.id, key: Date.now() });
        pushNotice({ icon: '✨', title: floorSpotRepairedNotice(spot), tone: 'build' });
      } else if (failedToday.includes(spot.id)) {
        playLocked();
        setGlowing({ id: spot.id, key: Date.now() });
        pushNotice({ icon: '🔒', title: 'Locked for today — try again tomorrow', tone: 'build' });
      } else {
        playClick();
        puzzleSeqRef.current += 1;
        setPuzzleSession({ spot, key: puzzleSeqRef.current });
      }
      return;
    }
    playLocked();
    setGlowing({ id: spot.id, key: Date.now() });
    pushNotice({ icon: '🔦', title: `${spot.label} — scavenging puzzle coming soon.`, tone: 'build' });
  };

  const closePuzzle = useCallback(() => setPuzzleSession(null), []);

  /* Solving a spot's puzzle awards its loot and marks it completed; losing locks it for today */
  const onPuzzleComplete = (result: MiniGameResult) => {
    const spot = puzzleSession?.spot;
    setPuzzleSession(null);
    if (!spot?.puzzle) return;
    if (result.outcome === 'win') {
      if (repaired.includes(spot.id)) return;
      setRepaired(markStoredSpotRepaired(spot.id).repairedSpots);
      if (spot.reward) {
        const store = useGameStore.getState();
        useGameStore.setState({ resources: addResources(store.resources, spot.reward) });
        store._save();
        const text = formatRewardCallout(spot.reward);
        const cx = ((stage.x + ((spot.rect.left + spot.rect.width / 2) / 100) * stage.width) / viewW) * 100;
        const cy = ((stage.y + (spot.rect.top / 100) * stage.height) / viewH) * 100;
        spawnCallout(text, Math.min(82, Math.max(18, cx)), Math.min(68, Math.max(18, cy)));
      }
      const firstReward = spot.reward ? (Object.keys(spot.reward)[0] as keyof typeof RESOURCE_MAP | undefined) : undefined;
      pushNotice({
        icon: (firstReward && RESOURCE_MAP[firstReward]?.emoji) || '🔧',
        title: floorSpotDoneNotice(spot),
        tone: 'unlock',
      });
      return;
    }
    if (result.outcome === 'loss') {
      setFailedToday(markStoredSpotFailedToday(spot.id).failedTodaySpots);
      pushNotice({ icon: '🔒', title: 'Locked for today — try again tomorrow', tone: 'build' });
    }
  };

  return (
    <div
      onClick={() => setTouchPreviewId(null)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        overflow: 'hidden',
        background: '#3a2d22',
        animation: 'owsFadeOpacity 300ms ease',
        opacity: leaving ? 0 : 1,
        transition: reduceMotion ? undefined : `opacity ${ENTER_FADE_MS}ms ease`,
      }}
    >
      {/* On extreme window shapes the painting stops short of an edge: a soft, dimmed copy fills behind it */}
      {showFill && (
        <img
          src={data.backdrop}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{
            position: 'absolute',
            inset: '-6%',
            width: '112%',
            height: '112%',
            objectFit: 'cover',
            filter: 'blur(22px) brightness(0.72)',
          }}
        />
      )}

      {/* The 1376×768 stage, cover-fitted but never cropping a hotspot — the painting and every spot share its coordinates */}
      <div
        style={{
          position: 'absolute',
          left: `${stage.x}px`,
          top: `${stage.y}px`,
          width: `${stage.width}px`,
          height: `${stage.height}px`,
          boxShadow: showFill ? '0 0 40px rgba(20, 16, 12, 0.45)' : undefined,
        }}
      >
        <img
          key={data.backdrop}
          src={data.backdrop}
          alt=""
          draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />

        {data.hotspots.map((spot) => {
          const isRepaired = repaired.includes(spot.id);
          const isFailed = failedToday.includes(spot.id) && !isRepaired;
          const canEnter = isRepaired && Boolean(spot.enterable && onEnterRoom);
          const showLockCue = !isRepaired && (spot.requiresTool === 'axe' || (Boolean(spot.puzzle) && !spot.hasSparks));
          const label = canEnter
            ? floorSpotEnterLabel(spot)
            : isRepaired && spot.puzzle
              ? floorSpotRepairedLabel(spot)
              : spot.label;
          return (
            <button
              /* A fresh key per click restarts the glow animation */
              key={glowing?.id === spot.id ? `${spot.id}-${glowing.key}` : spot.id}
              type="button"
              aria-label={spot.kind === 'lift' ? 'Elevator — choose a floor' : label}
              className={`ows-lobby-spot ${glowing?.id === spot.id ? 'ows-lobby-spot--glow' : ''} ${
                touchPreviewId === spot.id ? 'ows-lobby-spot--preview' : ''
              } ${isFailed ? 'ows-lobby-spot--dim' : ''}`}
              style={{
                left: `${spot.rect.left}%`,
                top: `${spot.rect.top}%`,
                width: `${spot.rect.width}%`,
                height: `${spot.rect.height}%`,
              }}
              onPointerDown={(e) => {
                isTouchRef.current = e.pointerType === 'touch';
              }}
              onMouseEnter={playHover}
              onClick={(e) => {
                e.stopPropagation();
                onSpotClick(spot);
              }}
            >
              <span className="ows-lobby-label">{label}</span>
              {canEnter && (
                <span className="ows-spot-cue ows-spot-cue--open" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="12" height="12">
                    <path d="M6 3.5 L10.5 8 L6 12.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </span>
              )}
              {showLockCue && (
                <span className="ows-spot-cue ows-spot-cue--lock" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="11" height="11">
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" fill="rgba(52,34,18,0.62)" />
                    <path d="M5.5 7 V5.2 a2.5 2.5 0 0 1 5 0 V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
              )}
              {spot.hasSparks && !isRepaired && !reduceMotion && (
                <span className="ows-sparks" aria-hidden="true">
                  {/* The box flashes cold blue in step with the main arc */}
                  <span
                    className="ows-sparks__flash"
                    style={{ animationDuration: `${ARCS[0].duration}s`, animationDelay: `${ARCS[0].delay}s` }}
                  />
                  {ARCS.map((arc) => (
                    <span
                      key={`${arc.left}-${arc.top}`}
                      className="ows-arc"
                      style={{ left: `${arc.left}%`, top: `${arc.top}%` }}
                    >
                      <svg
                        viewBox="0 0 40 34"
                        style={{ animationDuration: `${arc.duration}s`, animationDelay: `${arc.delay}s` }}
                      >
                        <path d={ARC_PATHS[arc.path]} className="ows-arc__glow" />
                        <path d={ARC_PATHS[arc.path]} className="ows-arc__core" />
                      </svg>
                    </span>
                  ))}
                  {EMBERS.map(([left, top, delay, kick]) => (
                    <span
                      key={`${left}-${top}-${delay}`}
                      className="ows-ember"
                      style={
                        {
                          left: `${left}%`,
                          top: `${top}%`,
                          animationDelay: `${delay}s`,
                          animationDuration: `${ARCS.find((a) => Math.abs(a.delay - delay) < 0.2)?.duration ?? 2.2}s`,
                          '--kick': `${kick}px`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Top-left: where we are (the lift itself opens the floor panel, including ↑ Rooftop) */}
      <header
        className="ows-hud-header"
        data-hud-top=""
        style={{ animation: 'owsFadeOpacity 400ms ease both', pointerEvents: 'none' }}
      >
        <span className="ows-hud-place">{data.name}</span>
      </header>

      <MaterialPouch variant="downstairs" />
      <FloatingRewards callouts={callouts} />

      {puzzleSession?.spot.puzzle === 'connect-wires' && (
        <ConnectWiresGame
          key={`${puzzleSession.spot.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.spot.puzzleTitle ?? puzzleSession.spot.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}

      {puzzleSession?.spot.puzzle === 'tic-tac-toe' && (
        <TicTacToeGame
          key={`${puzzleSession.spot.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.spot.puzzleTitle ?? puzzleSession.spot.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}

      {puzzleSession?.spot.puzzle === 'dots-and-lines' && (
        <DotsAndBoxesGame
          key={`${puzzleSession.spot.id}-${puzzleSession.key}`}
          mode={selectedMode}
          title={puzzleSession.spot.puzzleTitle ?? puzzleSession.spot.label}
          allowRetryOnLoss={false}
          onComplete={onPuzzleComplete}
          onCancel={closePuzzle}
        />
      )}

      {panelOpen && (
        <ElevatorPanelModal
          current={floor}
          onSelect={(to) => {
            setPanelOpen(false);
            onRide(to);
          }}
          onClose={closePanel}
        />
      )}
    </div>
  );
}
