import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useGameStore } from '../game/store/useGameStore.ts';
import {
  BUILDING_FLOORS,
  floorSafeArea,
  type BuildingFloorId,
  type DownstairsFloorId,
  type FloorHotspot,
} from '../game/data/floors.ts';
import { fitStage, stageLeavesGaps } from '../game/engine/stageFit.ts';
import { markStoredSpotRepaired, readStoredTerraceState } from '../game/engine/terraceState.ts';
import { addResources } from '../game/engine/scavenge.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { playClick, playHover, playLocked, startSiteAmbience } from '../game/audio/soundEngine.ts';
import type { MiniGameResult } from '../game/minigames/types.ts';
import ElevatorPanelModal from './ElevatorPanelModal.tsx';
import ConnectWiresGame from './minigames/ConnectWiresGame.tsx';

/** Floor paintings are 1376×768 (the same stage as the lift) */
const ART_W = 1376;
const ART_H = 768;

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}
const viewportKey = () => `${window.innerWidth}x${window.innerHeight}`;

/** Live window size (re-renders on resize) */
function useViewport(): { w: number; h: number } {
  const key = useSyncExternalStore(subscribeResize, viewportKey);
  return useMemo(() => {
    const [w, h] = key.split('x').map(Number);
    return { w, h };
  }, [key]);
}

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
}

/**
 * One explorable floor of the old apartment building (1–4): its painting on the
 * same aspect-locked stage as the lift, glowing scavenging spots and the centred lift,
 * which opens the floor panel (including the Rooftop). Spots with a live puzzle (Floor 3's
 * fuse box → Connect the Wires) open it, are repaired for the rest of the run when solved
 * and pay out their salvage once; the rest say their puzzle is coming soon.
 * The rooftop's day clock rests while you're down here.
 */
export default function BuildingFloorScreen({ floor, onRide }: BuildingFloorScreenProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const pushNotice = useGameStore((s) => s.pushNotice);
  const selectedMode = useGameStore((s) => s.selectedMode);
  const [panelOpen, setPanelOpen] = useState(false);
  const [glowing, setGlowing] = useState<{ id: string; key: number } | null>(null);
  /* Spots fixed this run (kept in the rooftop's saved state) */
  const [repaired, setRepaired] = useState<readonly string[]>(() => readStoredTerraceState()?.repairedSpots ?? []);
  const [puzzleSpot, setPuzzleSpot] = useState<FloorHotspot | null>(null);
  const data = BUILDING_FLOORS[floor];
  const { w: viewW, h: viewH } = useViewport();
  const stage = useMemo(() => fitStage(viewW, viewH, ART_W, ART_H, floorSafeArea(floor)), [viewW, viewH, floor]);
  const showFill = stageLeavesGaps(stage, viewW, viewH);

  useEffect(() => {
    startSiteAmbience('terrace', false, DOWNSTAIRS_AMBIENCE_LEVEL);
    return () => startSiteAmbience(null);
  }, []);

  /* The glow flare settles back to the hover state */
  useEffect(() => {
    if (!glowing) return;
    const t = setTimeout(() => setGlowing(null), GLOW_MS);
    return () => clearTimeout(t);
  }, [glowing]);

  const openPanel = useCallback(() => {
    playClick();
    setPanelOpen(true);
  }, []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const onSpotClick = (spot: FloorHotspot) => {
    if (spot.kind === 'lift') {
      openPanel();
      return;
    }
    if (spot.puzzle) {
      if (repaired.includes(spot.id)) {
        playClick();
        setGlowing({ id: spot.id, key: Date.now() });
        pushNotice({ icon: '✨', title: spot.puzzle.repairedNotice, tone: 'build' });
      } else {
        playClick();
        setPuzzleSpot(spot);
      }
      return;
    }
    playLocked();
    setGlowing({ id: spot.id, key: Date.now() });
    pushNotice({ icon: '🔦', title: `${spot.label} — scavenging puzzle coming soon.`, tone: 'build' });
  };

  const closePuzzle = useCallback(() => setPuzzleSpot(null), []);

  /* Solving a spot's puzzle repairs it for the rest of the run and pays out its salvage once */
  const onPuzzleComplete = (result: MiniGameResult) => {
    const spot = puzzleSpot;
    setPuzzleSpot(null);
    if (!spot?.puzzle || result.outcome !== 'win' || repaired.includes(spot.id)) return;
    setRepaired(markStoredSpotRepaired(spot.id).repairedSpots);
    const store = useGameStore.getState();
    useGameStore.setState({ resources: addResources(store.resources, spot.puzzle.reward) });
    store._save();
    const firstReward = Object.keys(spot.puzzle.reward)[0] as keyof typeof RESOURCE_MAP | undefined;
    pushNotice({ icon: (firstReward && RESOURCE_MAP[firstReward]?.emoji) || '🔧', title: spot.puzzle.doneNotice, tone: 'unlock' });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        overflow: 'hidden',
        background: '#1e1a16',
        animation: 'owsFadeOpacity 300ms ease',
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
          const label = isRepaired && spot.puzzle ? spot.puzzle.repairedLabel : spot.label;
          return (
            <button
              /* A fresh key per click restarts the glow animation */
              key={glowing?.id === spot.id ? `${spot.id}-${glowing.key}` : spot.id}
              type="button"
              aria-label={spot.kind === 'lift' ? 'Elevator — choose a floor' : label}
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
              <span className="ows-lobby-label">{label}</span>
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
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          maxWidth: 'calc(100vw - 128px)',
          animation: 'owsFadeOpacity 400ms ease both',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-game-title)',
            fontSize: 'clamp(0.95rem, 1.8vw, 1.2rem)',
            color: '#fff',
            textShadow: '0 2px 10px rgba(48, 38, 30, 0.65)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {data.name}
        </span>
      </header>

      {puzzleSpot?.puzzle?.game === 'connect-wires' && (
        <ConnectWiresGame
          mode={selectedMode}
          title={puzzleSpot.puzzle.title}
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
