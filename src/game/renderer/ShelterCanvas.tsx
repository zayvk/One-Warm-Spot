import { useEffect, useRef, useCallback } from 'react';
import { Application } from 'pixi.js';
import { useGameStore } from '../store/useGameStore.ts';
import { computeCozyIndex } from '../engine/progression.ts';
import { ShelterScene, type ShelterSceneState } from './shelterScene.ts';
import { addResources } from '../engine/scavenge.ts';

/**
 * ShelterCanvas — React bridge that mounts a PixiJS Application sized to its
 * container (via ResizeObserver) and forwards store state to `ShelterScene`.
 * Now also forwards pointer events for the interactive scene engine.
 */
export default function ShelterCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShelterScene | null>(null);

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
  }, [handleReward]);

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
