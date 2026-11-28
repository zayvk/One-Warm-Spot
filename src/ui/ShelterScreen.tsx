import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ShelterCanvasHandle } from '../game/renderer/ShelterCanvas.tsx';
import type { SceneStationState } from '../game/renderer/shelterScene.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { SITES } from '../game/data/sites.ts';
import { UI_ASSETS } from '../game/data/media.ts';
import { getSceneConfig } from '../game/data/scenes/index.ts';
import { MENDING_PERKS } from '../game/data/recipes.ts';
import type { StationId } from '../game/data/scenes/types.ts';
import { stationTierConfig } from '../game/engine/stations.ts';
import { unplacedStations } from '../game/engine/buildSlots.ts';
import { playClick, playHover, setWeatherAmbience, startSiteAmbience } from '../game/audio/soundEngine.ts';
import { WEATHER_INFO } from '../game/data/modes.ts';
import type { ResourceId } from '../game/types/game.ts';
import PropActionMenu, { SlotBuildMenu, type StationMenuAction } from './PropActionMenu.tsx';
import StationPopover, { type PopoverStation } from './StationPopover.tsx';
import VitalityDialHud from './VitalityDialHud.tsx';
import { formatRewardCallout, POUCH_RESOURCE_IDS } from '../game/engine/rewardCallouts.ts';
import ElevatorPanelModal from './ElevatorPanelModal.tsx';
import MaterialPouch from './MaterialPouch.tsx';
import FloatingRewards, { type FloatingCallout } from './FloatingRewards.tsx';
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

  const prevResourcesRef = useRef(resources);
  const prevStationStateRef = useRef<SceneStationState | null>(null);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);
  const calloutSeqRef = useRef(0);
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

  const enqueueCallout = useCallback((text: string, tone: 'reward' | 'build' = 'reward', y = 24) => {
    if (!text) return;
    const id = ++calloutSeqRef.current;
    setCallouts((curr) => [...curr, { id, text, tone, x: 50, y }]);
    setTimeout(() => {
      setCallouts((curr) => curr.filter((c) => c.id !== id));
    }, 1500);
  }, []);

  const stations = useMemo(() => getSceneConfig(chosenSite)?.stations ?? [], [chosenSite]);

  /* Float upward callouts whenever materials arrive or a station/perk completes */
  useEffect(() => {
    const prev = prevResourcesRef.current;
    if (resources === prev) return;
    prevResourcesRef.current = resources;
    const gained: Partial<Record<ResourceId, number>> = {};
    let hasGain = false;
    for (const id of POUCH_RESOURCE_IDS) {
      const diff = resources[id] - prev[id];
      if (diff > 0) {
        gained[id] = diff;
        hasGain = true;
      }
    }
    if (hasGain) enqueueCallout(formatRewardCallout(gained), 'reward', 22);
  }, [resources, enqueueCallout]);

  useEffect(() => {
    if (!stationState) return;
    const prev = prevStationStateRef.current;
    prevStationStateRef.current = stationState;
    if (!prev) return;
    for (const st of stations) {
      const nextTier = stationState.tiers[st.id];
      const prevTier = prev.tiers[st.id];
      if (nextTier > prevTier) {
        const cfg = stationTierConfig(st, nextTier);
        if (cfg) {
          enqueueCallout(`${prevTier === 0 ? 'Built' : 'Upgraded'} ${cfg.name}!`, 'build', 28);
        }
      }
    }
    if (stationState.perks.length > prev.perks.length) {
      const newPerkId = stationState.perks.find((id) => !prev.perks.includes(id));
      const perk = MENDING_PERKS.find((p) => p.id === newPerkId);
      if (perk) enqueueCallout(`${perk.icon} ${perk.name}`, 'build', 28);
    }
  }, [stationState, stations, enqueueCallout]);

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

  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';
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
      <MaterialPouch variant="rooftop" />
      <FloatingRewards callouts={callouts} />

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
