import { useCallback, useEffect, useRef, useState } from 'react';
import ShelterCanvas, { type ShelterCanvasHandle } from '../game/renderer/ShelterCanvas.tsx';
import type { SceneStationState } from '../game/renderer/shelterScene.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { SITES } from '../game/data/sites.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { UI_ASSETS } from '../game/data/media.ts';
import { getSceneConfig } from '../game/data/scenes/index.ts';
import { stationTierConfig } from '../game/engine/stations.ts';
import { playClick, playHover, startSiteAmbience } from '../game/audio/soundEngine.ts';
import type { ResourceId } from '../game/types/game.ts';
import BuildBar from './BuildBar.tsx';
import StationPopover, { type PopoverStation } from './StationPopover.tsx';
import VitalityDialHud from './VitalityDialHud.tsx';

export interface ShelterScreenProps {
  onBackToTitle: () => void;
}

/** Soft loudness for the in-shelter ambience bed */
const SHELTER_AMBIENCE_LEVEL = 0.55;

const POUCH_IDS: ResourceId[] = ['timber', 'cloth', 'seeds', 'water', 'scrap', 'stone', 'food'];

export default function ShelterScreen({ onBackToTitle }: ShelterScreenProps) {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const resources = useGameStore((s) => s.resources);

  const prevResourcesRef = useRef(resources);
  const [pulsing, setPulsing] = useState<Partial<Record<ResourceId, boolean>>>({});
  const canvasRef = useRef<ShelterCanvasHandle>(null);
  /* Null until the scene reports its restored station state, so chips never flash */
  const [stationState, setStationState] = useState<SceneStationState | null>(null);
  const [popover, setPopover] = useState<{ station: PopoverStation; anchor: { x: number; y: number } } | null>(null);
  const stations = getSceneConfig(chosenSite)?.stations ?? [];
  const closePopover = useCallback(() => setPopover(null), []);
  const openPopover = useCallback((station: PopoverStation, anchor: { x: number; y: number }) => {
    setPopover({ station, anchor });
  }, []);

  /* Soft shelter soundscape while on this screen */
  useEffect(() => {
    startSiteAmbience(chosenSite, false, SHELTER_AMBIENCE_LEVEL);
    return () => startSiteAmbience(null);
  }, [chosenSite]);

  /* Real-time 3-phase clock (1s steps; pauses when tab is hidden or settings open) */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      useGameStore.getState().tickDayCycle(1);
    }, 1000);
    return () => {
      window.clearInterval(id);
      useGameStore.getState()._save();
    };
  }, []);

  /* Pulse newly found pouch materials */
  useEffect(() => {
    const prev = prevResourcesRef.current;
    const newlyIncreased: ResourceId[] = [];
    for (const id of POUCH_IDS) {
      if (resources[id] > prev[id]) {
        newlyIncreased.push(id);
      }
    }
    prevResourcesRef.current = resources;
    if (newlyIncreased.length === 0) return;

    setPulsing((curr) => {
      const next = { ...curr };
      for (const id of newlyIncreased) next[id] = true;
      return next;
    });

    const timer = setTimeout(() => {
      setPulsing((curr) => {
        const next = { ...curr };
        for (const id of newlyIncreased) next[id] = false;
        return next;
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [resources]);

  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';
  const pouchResources = POUCH_IDS.map((id) => RESOURCE_MAP[id]).filter((r) => r !== undefined);
  const popoverStation = popover ? stations.find((s) => s.id === popover.station) : undefined;
  const popoverTitle =
    popoverStation && stationState
      ? (stationTierConfig(popoverStation, stationState.tiers[popoverStation.id])?.name ?? '')
      : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top-left Back + Title cluster */}
      <header
        style={{
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          pointerEvents: 'auto',
          maxWidth: 'calc(100vw - 128px)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            playClick();
            onBackToTitle();
          }}
          onMouseEnter={playHover}
          className="ows-pill"
          title="Return to the title screen (progress is saved)"
        >
          ← Title
        </button>
        <img
          src={UI_ASSETS.logoEmblem}
          alt=""
          width={26}
          height={26}
          draggable={false}
          style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(48, 38, 30, 0.45))' }}
        />
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
          {siteName}
        </span>
      </header>

      {/* Enlarged, horizontally centered Found Materials Pouch */}
      <div
        className="ows-hud-bar ows-pouch-bar"
        title="Found Materials Pouch"
        aria-label="Found Materials Pouch"
      >
        {pouchResources.map((r) => (
          <span
            key={r.id}
            title={r.name}
            className={`ows-pouch-item ${pulsing[r.id] ? 'ows-pouch-item--pulse' : ''}`}
          >
            <span>{r.emoji}</span>
            <span>{resources[r.id]}</span>
          </span>
        ))}
      </div>

      {/* Interactive PixiJS canvas (full viewport) */}
      <main style={{ position: 'relative', flex: 1, minHeight: 0, background: '#F5EFE4' }}>
        <ShelterCanvas ref={canvasRef} onStationStateChange={setStationState} onStationOpen={openPopover} />
        {popover && stationState && (
          <StationPopover
            key={`${popover.station}-${popover.anchor.x}-${popover.anchor.y}`}
            station={popover.station}
            anchor={popover.anchor}
            title={popoverTitle}
            stationState={stationState}
            resources={resources}
            onCook={(id) => canvasRef.current?.cook(id) ?? { ok: false, message: 'Not ready yet' }}
            onCraft={(id) => canvasRef.current?.craftPerk(id) ?? { ok: false, message: 'Not ready yet' }}
            onClose={closePopover}
          />
        )}
      </main>

      <VitalityDialHud />

      {stationState && stations.length > 0 && (
        <BuildBar
          stations={stations}
          tiers={stationState.tiers}
          pending={stationState.pending}
          resources={resources}
          onBuild={(id) => {
            setPopover(null);
            return canvasRef.current?.requestBuild(id) ?? false;
          }}
        />
      )}
    </div>
  );
}
