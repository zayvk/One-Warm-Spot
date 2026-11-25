import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { useGameStore } from '../store/useGameStore.ts';
import { computeCozyIndex } from '../engine/progression.ts';
import { ShelterScene, type ShelterSceneState } from './shelterScene.ts';

/**
 * ShelterCanvas — React bridge that mounts a PixiJS Application sized to its
 * container (via ResizeObserver) and forwards store state to `ShelterScene`.
 * All Pixi objects are destroyed on unmount.
 */
export default function ShelterCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ShelterScene | null>(null);

  const siteId = useGameStore((s) => s.chosenSite);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const lanternLit = useGameStore((s) => s.lanternLit);
  const reduceMotion = useGameStore((s) => s.reduceMotion);

  const stateRef = useRef<ShelterSceneState | null>(null);

  /* Forward state changes to the scene (declared first so the ref is ready for mount) */
  useEffect(() => {
    const next: ShelterSceneState = {
      siteId,
      timeOfDay,
      built,
      lanternLit,
      cozyIndex: computeCozyIndex(built),
      reduceMotion,
    };
    stateRef.current = next;
    sceneRef.current?.setState(next);
  }, [siteId, timeOfDay, built, lanternLit, reduceMotion]);

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
  }, []);

  return (
    <div
      ref={containerRef}
      aria-label="Your shelter"
      role="img"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      }}
    />
  );
}
