import { useEffect, useRef, useCallback, useImperativeHandle, useState, type Ref } from 'react';
import { Application } from 'pixi.js';
import { useGameStore } from '../store/useGameStore.ts';
import { UI_ASSETS } from '../data/media.ts';
import { canAfford, computeCozyIndex, spendResources } from '../engine/progression.ts';
import {
  BOX_STAMINA_COST,
  BUILD_STAMINA_COST,
  WEED_STAMINA_COST,
} from '../engine/dayCycle.ts';
import { gatherStaminaCost, strengthDriftFactor } from '../engine/stations.ts';
import {
  ShelterScene,
  type BuildCallback,
  type CookCallback,
  type RewardCallback,
  type SceneStationState,
  type ShelterSceneState,
  type SleepCallback,
  type SpendCallback,
  type StationActionResult,
  type StationMenuAction,
  type StationMenuCallback,
  type SlotMenuCallback,
  type StageCallback,
  type StationOpenCallback,
} from './shelterScene.ts';
import { rendererResolution } from '../engine/stageFit.ts';
import { currentUiScale, subscribeViewport } from '../../ui/useViewport.ts';
import type { AssignableStationId } from '../data/scenes/types.ts';
import { addResources } from '../engine/scavenge.ts';

export interface ShelterCanvasHandle {
  /** Ask the traveler to walk over and build a station's next tier */
  requestBuild: (stationId: string) => boolean;
  /** Execute a contextual action from the in-world PropActionMenu */
  performStationAction: (stationId: string, action: StationMenuAction) => boolean;
  /** Walk to an empty build slot and place a station there */
  buildInSlot: (slotId: string, stationId: AssignableStationId) => boolean;
  /** Cook a grill recipe */
  cook: (recipeId: string) => StationActionResult;
  /** Craft a mending perk at the sewing kit */
  craftPerk: (perkId: string) => StationActionResult;
}

export interface ShelterCanvasProps {
  ref?: Ref<ShelterCanvasHandle>;
  onStationStateChange?: (state: SceneStationState) => void;
  onStationOpen?: StationOpenCallback;
  onStationMenuOpen?: StationMenuCallback;
  /** An empty build slot was clicked (open the "what to build here" menu) */
  onSlotMenuOpen?: SlotMenuCallback;
  /** The traveler reached a door; return true if it leads somewhere (e.g. `stairwell-door`) */
  onDoor?: (doorId: string) => boolean;
  /** The fitted stage rect (screen px), now and after every refit */
  onStageChange?: StageCallback;
  /** Fired as soon as Pixi has decoded and revealed the shelter backdrop */
  onReady?: () => void;
}

const NOT_READY: StationActionResult = { ok: false, message: 'The rooftop is still settling in' };

/**
 * ShelterCanvas — React bridge that mounts a PixiJS Application sized to its
 * container (via ResizeObserver) and forwards store state to `ShelterScene`.
 * Scene rewards, station builds, cooking, mending and toasts flow back into the store.
 */
export default function ShelterCanvas({
  ref,
  onStationStateChange,
  onStationOpen,
  onStationMenuOpen,
  onSlotMenuOpen,
  onDoor,
  onStageChange,
  onReady,
}: ShelterCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShelterScene | null>(null);
  const stationStateCbRef = useRef(onStationStateChange);
  const stationOpenCbRef = useRef(onStationOpen);
  const stationMenuCbRef = useRef(onStationMenuOpen);
  const slotMenuCbRef = useRef(onSlotMenuOpen);
  const doorCbRef = useRef(onDoor);
  const stageCbRef = useRef(onStageChange);
  const readyCbRef = useRef(onReady);
  /* Crafted perks shape gathering costs (gloves) and strength drift (cloak) */
  const perksRef = useRef<string[]>([]);

  useEffect(() => {
    stationStateCbRef.current = onStationStateChange;
    stationOpenCbRef.current = onStationOpen;
    stationMenuCbRef.current = onStationMenuOpen;
    slotMenuCbRef.current = onSlotMenuOpen;
    doorCbRef.current = onDoor;
    stageCbRef.current = onStageChange;
    readyCbRef.current = onReady;
  }, [onStationStateChange, onStationOpen, onStationMenuOpen, onSlotMenuOpen, onDoor, onStageChange, onReady]);

  useImperativeHandle(ref, () => ({
    requestBuild: (id: string) => sceneRef.current?.requestBuild(id) ?? false,
    performStationAction: (id: string, action: StationMenuAction) =>
      sceneRef.current?.performStationAction(id, action) ?? false,
    buildInSlot: (slotId: string, stationId: AssignableStationId) =>
      sceneRef.current?.requestBuildInSlot(slotId, stationId) ?? false,
    cook: (id: string) => sceneRef.current?.cook(id) ?? NOT_READY,
    craftPerk: (id: string) => sceneRef.current?.craftPerk(id) ?? NOT_READY,
  }), []);

  const siteId = useGameStore((s) => s.chosenSite);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const dayPhase = useGameStore((s) => s.dayPhase);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const lanternLit = useGameStore((s) => s.lanternLit);
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const gender = useGameStore((s) => s.travelerGender);
  const weather = useGameStore((s) => s.weather);
  const sceneRevision = useGameStore((s) => s.sceneRevision);
  /* Which scene revision has revealed its stage (drives the loading emblem) */
  const [readyRevision, setReadyRevision] = useState(-1);

  const stateRef = useRef<ShelterSceneState | null>(null);

  /* Reward handler: add found materials; gathering (not daily station yields) costs gentle stamina */
  const handleReward = useCallback<RewardCallback>((reward, source) => {
    const s = useGameStore.getState();
    const updated = addResources(s.resources, reward);
    useGameStore.setState({ resources: updated });
    if (source === 'weeds') s.spendStamina(gatherStaminaCost(WEED_STAMINA_COST, perksRef.current));
    else if (source === 'searchable') s.spendStamina(gatherStaminaCost(BOX_STAMINA_COST, perksRef.current));
    useGameStore.getState()._save();
  }, []);

  /* Build payment: deduct materials & stamina from the store, or refuse if short */
  const handleBuild = useCallback<BuildCallback>((cost) => {
    const s = useGameStore.getState();
    const next = spendResources(s.resources, cost);
    if (!next) return false;
    useGameStore.setState({ resources: next });
    s.spendStamina(BUILD_STAMINA_COST);
    useGameStore.getState()._save();
    return true;
  }, []);

  /* Materials-only spend (firewood, mending) */
  const handleSpend = useCallback<SpendCallback>((cost) => {
    const next = spendResources(useGameStore.getState().resources, cost);
    if (!next) return false;
    useGameStore.setState({ resources: next });
    useGameStore.getState()._save();
    return true;
  }, []);

  const handleCook = useCallback<CookCallback>((recipe) => useGameStore.getState().cookRecipe(recipe), []);

  const handleNotice = useCallback((message: string, icon = '🚪') => {
    useGameStore.getState().pushNotice({ icon, title: message, tone: 'build' });
  }, []);

  const handleRest = useCallback(() => {
    useGameStore.getState().restAtShelter();
  }, []);

  const handleSleep = useCallback<SleepCallback>((comfort) => useGameStore.getState().sleepAtShelter(comfort), []);

  const handleStationState = useCallback((state: SceneStationState) => {
    perksRef.current = state.perks;
    useGameStore.getState().setStrengthDriftFactor(strengthDriftFactor(state.perks));
    stationStateCbRef.current?.(state);
  }, []);

  /* Forward state changes to the scene */
  useEffect(() => {
    const next: ShelterSceneState = {
      siteId,
      timeOfDay,
      dayPhase,
      built,
      lanternLit,
      cozyIndex: computeCozyIndex(built),
      reduceMotion,
      gender,
      weather,
    };
    stateRef.current = next;
    sceneRef.current?.setState(next);
  }, [siteId, timeOfDay, dayPhase, built, lanternLit, reduceMotion, gender, weather]);

  /* Mount / unmount the PixiJS app */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let scene: ShelterScene | null = null;
    const app = new Application();

    /* The container follows 100dvh, so address-bar slides and window resizes all arrive here */
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) scene?.resize(rect.width, rect.height, rendererResolution(window.devicePixelRatio));
    });
    const refit = () => {
      if (!scene) return;
      scene.setUiScale(currentUiScale());
      scene.resize(container.clientWidth, container.clientHeight, rendererResolution(window.devicePixelRatio));
    };
    const unsubscribeViewport = subscribeViewport(refit);
    /* Dragging the window to a screen with another pixel density re-rasterizes at the new ratio */
    let dprQuery: MediaQueryList | null = null;
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
    };
    function onDprChange() {
      watchDpr();
      refit();
    }
    watchDpr();

    void app
      .init({
        width: Math.max(1, container.clientWidth),
        height: Math.max(1, container.clientHeight),
        background: 0xf5efe4,
        antialias: true,
        resolution: rendererResolution(window.devicePixelRatio),
        autoDensity: true,
      })
      .then(() => {
        if (disposed || !stateRef.current) {
          app.destroy({ removeView: true }, { children: true });
          return;
        }
        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.display = 'block';
        container.appendChild(canvas);
        scene = new ShelterScene(app, stateRef.current);
        scene.setUiScale(currentUiScale());
        scene.setStageCallback((stage) => stageCbRef.current?.(stage));
        scene.setRewardCallback(handleReward);
        scene.setBuildCallback(handleBuild);
        scene.setSpendCallback(handleSpend);
        scene.setCookCallback(handleCook);
        scene.setNoticeCallback(handleNotice);
        scene.setDoorCallback((doorId) => doorCbRef.current?.(doorId) ?? false);
        scene.setRestCallback(handleRest);
        scene.setSleepCallback(handleSleep);
        scene.setCanAffordCallback((cost) => canAfford(cost, useGameStore.getState().resources));
        scene.setStationOpenCallback((station, anchor) => stationOpenCbRef.current?.(station, anchor));
        scene.setStationMenuCallback((stationId, anchor) => stationMenuCbRef.current?.(stationId, anchor));
        scene.setSlotMenuCallback((slotId, anchor) => slotMenuCbRef.current?.(slotId, anchor));
        scene.setStationStateCallback(handleStationState);
        scene.setReadyCallback(() => {
          if (!disposed) {
            setReadyRevision(sceneRevision);
            readyCbRef.current?.();
          }
        });
        sceneRef.current = scene;
        observer.observe(container);
      });

    return () => {
      disposed = true;
      observer.disconnect();
      unsubscribeViewport();
      dprQuery?.removeEventListener('change', onDprChange);
      scene?.destroy();
      scene = null;
      sceneRef.current = null;
    };
    /* `sceneRevision` remounts the scene so it reloads restored rooftop state */
  }, [handleReward, handleBuild, handleSpend, handleCook, handleNotice, handleRest, handleSleep, handleStationState, sceneRevision]);

  const ready = readyRevision === sceneRevision;

  return (
    <>
      <div
        ref={containerRef}
        aria-label="Your shelter — click to explore"
        role="application"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          cursor: 'crosshair',
        }}
      />
      {/* Gentle lantern emblem while the stage art decodes (only appears if it takes a moment) */}
      {!ready && (
        <div className="ows-scene-loader" aria-hidden="true">
          <img src={UI_ASSETS.logoEmblem} alt="" width={72} height={72} draggable={false} />
        </div>
      )}
    </>
  );
}
