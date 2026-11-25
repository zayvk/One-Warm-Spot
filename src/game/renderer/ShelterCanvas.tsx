import { useEffect, useRef, useCallback, useImperativeHandle, type Ref } from 'react';
import { Application } from 'pixi.js';
import { useGameStore } from '../store/useGameStore.ts';
import { computeCozyIndex, spendResources } from '../engine/progression.ts';
import {
  ShelterScene,
  type BuildCallback,
  type SceneBuildState,
  type ShelterSceneState,
} from './shelterScene.ts';
import { addResources } from '../engine/scavenge.ts';

export interface ShelterCanvasHandle {
  /** Ask the traveler to walk over and build an in-scene upgrade */
  requestBuild: (id: string) => boolean;
}

export interface ShelterCanvasProps {
  ref?: Ref<ShelterCanvasHandle>;
  onBuildStateChange?: (state: SceneBuildState) => void;
}

/**
 * ShelterCanvas — React bridge that mounts a PixiJS Application sized to its
 * container (via ResizeObserver) and forwards store state to `ShelterScene`.
 * Scene rewards, in-scene build payments and toasts flow back into the store.
 */
export default function ShelterCanvas({ ref, onBuildStateChange }: ShelterCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShelterScene | null>(null);
  const buildStateCbRef = useRef(onBuildStateChange);

  useEffect(() => {
    buildStateCbRef.current = onBuildStateChange;
  }, [onBuildStateChange]);

  useImperativeHandle(ref, () => ({
    requestBuild: (id: string) => sceneRef.current?.requestBuild(id) ?? false,
  }), []);

  const siteId = useGameStore((s) => s.chosenSite);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const lanternLit = useGameStore((s) => s.lanternLit);
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const gender = useGameStore((s) => s.travelerGender);

  const stateRef = useRef<ShelterSceneState | null>(null);

  /* Reward handler: add found materials to the Zustand store */
  const handleReward = useCallback((reward: Record<string, number>) => {
    const s = useGameStore.getState();
    const updated = addResources(s.resources, reward);
    useGameStore.setState({ resources: updated });
    useGameStore.getState()._save();
  }, []);

  /* Build payment: deduct materials from the pouch, or refuse if short */
  const handleBuild = useCallback<BuildCallback>((cost) => {
    const next = spendResources(useGameStore.getState().resources, cost);
    if (!next) return false;
    useGameStore.setState({ resources: next });
    useGameStore.getState()._save();
    return true;
  }, []);

  const handleNotice = useCallback((message: string) => {
    useGameStore.getState().pushNotice({ icon: '🚪', title: message, tone: 'build' });
  }, []);

  /* Forward state changes to the scene */
  useEffect(() => {
    const next: ShelterSceneState = {
      siteId,
      timeOfDay,
      built,
      lanternLit,
      cozyIndex: computeCozyIndex(built),
      reduceMotion,
      gender,
    };
    stateRef.current = next;
    sceneRef.current?.setState(next);
  }, [siteId, timeOfDay, built, lanternLit, reduceMotion, gender]);

  /* Mount / unmount the PixiJS app */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let scene: ShelterScene | null = null;
    const app = new Application();

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) scene?.resize(rect.width, rect.height);
    });

    void app
      .init({
        width: Math.max(1, container.clientWidth),
        height: Math.max(1, container.clientHeight),
        background: 0xfaf8f5,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
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
        scene.setRewardCallback(handleReward);
        scene.setBuildCallback(handleBuild);
        scene.setNoticeCallback(handleNotice);
        scene.setBuildStateCallback((s) => buildStateCbRef.current?.(s));
        sceneRef.current = scene;
        observer.observe(container);
      });

    return () => {
      disposed = true;
      observer.disconnect();
      scene?.destroy();
      scene = null;
      sceneRef.current = null;
    };
  }, [handleReward, handleBuild, handleNotice]);

  return (
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
  );
}
