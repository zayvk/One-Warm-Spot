import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ShelterCanvasHandle } from '../game/renderer/ShelterCanvas.tsx';
import type { SceneStationState } from '../game/renderer/shelterScene.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { SITES } from '../game/data/sites.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { UI_ASSETS } from '../game/data/media.ts';
import { getSceneConfig } from '../game/data/scenes/index.ts';
import type { StationId } from '../game/data/scenes/types.ts';
import { stationTierConfig } from '../game/engine/stations.ts';
import { unplacedStations } from '../game/engine/buildSlots.ts';
import { playClick, playHover, setWeatherAmbience, startSiteAmbience } from '../game/audio/soundEngine.ts';
import { WEATHER_INFO } from '../game/data/modes.ts';
import type { ResourceId } from '../game/types/game.ts';
import PropActionMenu, { SlotBuildMenu, type StationMenuAction } from './PropActionMenu.tsx';
import StationPopover, { type PopoverStation } from './StationPopover.tsx';
import VitalityDialHud from './VitalityDialHud.tsx';
import ElevatorPanelModal from './ElevatorPanelModal.tsx';
import type { BuildingFloorId } from '../game/data/floors.ts';
import { stagePointToPx, type StagePoint, type StageRect } from '../game/engine/stageFit.ts';
import { useHudStageFrame } from './useViewport.ts';

export interface ShelterScreenProps {
  onBackToTitle: () => void;
  /** Ride the old lift from the rooftop to a floor picked on the elevator panel */
  onRide?: (to: BuildingFloorId) => void;
}

/** Soft loudness for the in-shelter ambience bed */
const SHELTER_AMBIENCE_LEVEL = 0.55;

const POUCH_IDS: ResourceId[] = ['timber', 'cloth', 'seeds', 'water', 'scrap', 'stone', 'food'];

/* PixiJS and the scene code load on demand (kept out of the main bundle; usually warmed during the arrival / lift ride) */
const ShelterCanvas = lazy(() => import('../game/renderer/ShelterCanvas.tsx'));

/** The same lantern emblem the canvas shows while its stage decodes */
function SceneLoader() {
  return (
    <div className="ows-scene-loader" aria-hidden="true">
      <img src={UI_ASSETS.logoEmblem} alt="" width={72} height={72} draggable={false} />
    </div>
  );
}

export default function ShelterScreen({ onBackToTitle, onRide }: ShelterScreenProps) {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const dayPhase = useGameStore((s) => s.dayPhase);
  const weather = useGameStore((s) => s.weather);
  const resources = useGameStore((s) => s.resources);

  const [pulsing, setPulsing] = useState<Partial<Record<ResourceId, boolean>>>({});
  const [prevResources, setPrevResources] = useState(resources);
  const canvasRef = useRef<ShelterCanvasHandle>(null);
  /* Null until the scene reports its restored station state */
  const [stationState, setStationState] = useState<SceneStationState | null>(null);
  /* Menu anchors are stage points, placed with the live stage so they stay on their prop through resizes */
  const [popover, setPopover] = useState<{ station: PopoverStation; anchor: StagePoint } | null>(null);
  const [propMenu, setPropMenu] = useState<{ stationId: StationId; anchor: StagePoint } | null>(null);
  const [slotMenu, setSlotMenu] = useState<{ slotId: string; anchor: StagePoint } | null>(null);
  const [stage, setStage] = useState<StageRect | null>(null);
  useHudStageFrame(stage);
  const [elevatorOpen, setElevatorOpen] = useState(false);

  /* Pulse newly found pouch materials (derived as the pouch changes) */
  if (resources !== prevResources) {
    setPrevResources(resources);
    const increased = POUCH_IDS.filter((id) => resources[id] > prevResources[id]);
    if (increased.length > 0) {
      setPulsing((curr) => {
        const next = { ...curr };
        for (const id of increased) next[id] = true;
        return next;
      });
    }
  }

  const stations = getSceneConfig(chosenSite)?.stations ?? [];

  const closePopover = useCallback(() => setPopover(null), []);
  const openPopover = useCallback((station: PopoverStation, anchor: StagePoint) => {
    setPropMenu(null);
    setSlotMenu(null);
    setPopover({ station, anchor });
  }, []);

  const closePropMenu = useCallback(() => setPropMenu(null), []);
  const openPropMenu = useCallback((stationId: StationId, anchor: StagePoint) => {
    setPopover(null);
    setSlotMenu(null);
    setPropMenu({ stationId, anchor });
  }, []);

  const closeSlotMenu = useCallback(() => setSlotMenu(null), []);
  const openSlotMenu = useCallback((slotId: string, anchor: StagePoint) => {
    setPopover(null);
    setPropMenu(null);
    setSlotMenu({ slotId, anchor });
  }, []);

  const handlePropAction = useCallback((stationId: string, action: StationMenuAction) => {
    return canvasRef.current?.performStationAction(stationId, action) ?? false;
  }, []);

  /*
   * The traveler reached the stairwell/lift door: open the floor panel. Returning
   * false lets the scene unlock, so cancelling the panel leaves them free to roam.
   */
  const handleDoor = useCallback(
    (doorId: string) => {
      if (doorId !== 'stairwell-door' || !onRide) return false;
      setPopover(null);
      setPropMenu(null);
      setSlotMenu(null);
      setElevatorOpen(true);
      return false;
    },
    [onRide],
  );
  const closeElevator = useCallback(() => setElevatorOpen(false), []);

  /* Soft shelter soundscape while on this screen */
  useEffect(() => {
    startSiteAmbience(chosenSite, false, SHELTER_AMBIENCE_LEVEL);
    return () => startSiteAmbience(null);
  }, [chosenSite]);

  /* Rain patter / wind gusts over the open rooftop; silent indoors (this screen unmounts downstairs) */
  const outdoorWeather = chosenSite === 'terrace' ? weather : 'clear';
  useEffect(() => {
    setWeatherAmbience(outdoorWeather);
  }, [outdoorWeather]);
  useEffect(() => () => setWeatherAmbience(null), []);

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

  /* Every pulse settles 700ms after the latest find */
  useEffect(() => {
    const active = POUCH_IDS.filter((id) => pulsing[id]);
    if (active.length === 0) return;
    const timer = setTimeout(() => {
      setPulsing((curr) => {
        const next = { ...curr };
        for (const id of active) next[id] = false;
        return next;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [pulsing]);

  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';
  const pouchResources = POUCH_IDS.map((id) => RESOURCE_MAP[id]).filter((r) => r !== undefined);
  const popoverStation = popover ? stations.find((s) => s.id === popover.station) : undefined;
  const popoverTitle =
    popoverStation && stationState
      ? (stationTierConfig(popoverStation, stationState.tiers[popoverStation.id])?.name ?? '')
      : '';
  const menuStation = propMenu ? stations.find((s) => s.id === propMenu.stationId) : undefined;
  /* What an empty slot can still host: every assignable station not yet placed anywhere */
  const slotChoices = stationState
    ? unplacedStations(stationState.slots).flatMap((id) => stations.filter((s) => s.assignableId === id))
    : [];
  const toPx = (p: StagePoint) => (stage ? stagePointToPx(stage, p) : { x: 0, y: 0 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top-left Back + Title cluster */}
      <header className="ows-hud-header" data-hud-top="">
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
          className="ows-shelter-emblem"
          src={UI_ASSETS.logoEmblem}
          alt=""
          width={26}
          height={26}
          draggable={false}
          style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(48, 38, 30, 0.45))' }}
        />
        <span className="ows-hud-place ows-shelter-name">
          {siteName}
        </span>
        {/* Today's weather and what it does on the rooftop (hover / focus) */}
        <span
          className="ows-sky-chip"
          tabIndex={0}
          aria-label={`Weather: ${WEATHER_INFO[outdoorWeather].label} — ${WEATHER_INFO[outdoorWeather].hint}`}
        >
          <span aria-hidden="true">{WEATHER_INFO[outdoorWeather].emoji}</span>
          <span className="ows-sky-chip__label">{WEATHER_INFO[outdoorWeather].label}</span>
          <span className="ows-pouch-tooltip ows-sky-chip__tooltip" role="tooltip">
            {WEATHER_INFO[outdoorWeather].hint}
          </span>
        </span>
      </header>

      {/* Enlarged, horizontally centered Found Materials Pouch with instant hover tooltips */}
      <div className="ows-hud-bar ows-pouch-bar" aria-label="Found Materials Pouch" data-hud-top="">
        {pouchResources.map((r) => (
          <span
            key={r.id}
            tabIndex={0}
            aria-label={`${r.name}: ${resources[r.id]}`}
            className={`ows-pouch-item ${pulsing[r.id] ? 'ows-pouch-item--pulse' : ''}`}
          >
            <span aria-hidden="true">{r.emoji}</span>
            <span>{resources[r.id]}</span>
            <span className="ows-pouch-tooltip" role="tooltip">
              {r.name}
            </span>
          </span>
        ))}
      </div>

      {/* Interactive PixiJS canvas (full viewport) */}
      <main style={{ position: 'relative', flex: 1, minHeight: 0, background: '#F5EFE4' }}>
        <Suspense fallback={<SceneLoader />}>
        <ShelterCanvas
          ref={canvasRef}
          onStationStateChange={setStationState}
          onStationOpen={openPopover}
          onStationMenuOpen={openPropMenu}
          onSlotMenuOpen={openSlotMenu}
          onDoor={handleDoor}
          onStageChange={setStage}
        />
        </Suspense>

        {slotMenu && stage && stationState && slotChoices.length > 0 && (
          <SlotBuildMenu
            key={`${slotMenu.slotId}-${slotMenu.anchor.x}-${slotMenu.anchor.y}`}
            stations={slotChoices}
            anchor={toPx(slotMenu.anchor)}
            resources={resources}
            busy={stationState.pending !== null}
            onPick={(stationId) => canvasRef.current?.buildInSlot(slotMenu.slotId, stationId) ?? false}
            onClose={closeSlotMenu}
          />
        )}

        {propMenu && stage && menuStation && stationState && (
          <PropActionMenu
            key={`${propMenu.stationId}-${propMenu.anchor.x}-${propMenu.anchor.y}`}
            station={menuStation}
            anchor={toPx(propMenu.anchor)}
            dayPhase={dayPhase}
            weather={outdoorWeather}
            stationState={stationState}
            resources={resources}
            onAction={handlePropAction}
            onClose={closePropMenu}
          />
        )}

        {popover && stage && stationState && (
          <StationPopover
            key={`${popover.station}-${popover.anchor.x}-${popover.anchor.y}`}
            station={popover.station}
            anchor={toPx(popover.anchor)}
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

      {elevatorOpen && onRide && (
        <ElevatorPanelModal
          current="R"
          onSelect={(to) => {
            setElevatorOpen(false);
            onRide(to);
          }}
          onClose={closeElevator}
        />
      )}
    </div>
  );
}
