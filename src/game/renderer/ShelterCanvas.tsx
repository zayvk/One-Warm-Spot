import { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { useGameStore } from '../store/useGameStore.ts';
import { SITES } from '../data/sites.ts';

/**
 * ShelterCanvas — React wrapper that mounts a responsive PixiJS Application
 * and renders a placeholder layered 2D scene for the chosen shelter site.
 *
 * Layers (back → front):
 *   1. Sunlit sky gradient
 *   2. Ground / horizon
 *   3. Shelter silhouette (color keyed to chosen site)
 *   4. Optional tarp overlay (toggled by upgrade)
 */
export default function ShelterCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const chosenSite = useGameStore((s) => s.chosenSite);
  const tarpPitched = useGameStore((s) => s.tarpPitched);

  const draw = useCallback((app: Application, siteId: string | null, showTarp: boolean) => {
    // Clear previous children
    while (app.stage.children.length > 0) {
      app.stage.removeChildAt(0);
    }

    const W = app.screen.width;
    const H = app.screen.height;

    /* 1 — Sky */
    const sky = new Graphics();
    sky.rect(0, 0, W, H * 0.6);
    sky.fill(0xe3edf7);            // --sky-100
    app.stage.addChild(sky);

    /* Sunlit upper glow */
    const sun = new Graphics();
    sun.circle(W * 0.75, H * 0.12, 50);
    sun.fill({ color: 0xfff4c8, alpha: 0.7 });
    app.stage.addChild(sun);

    /* 2 — Ground */
    const ground = new Graphics();
    ground.rect(0, H * 0.6, W, H * 0.4);
    ground.fill(0xc5d6bc);          // --sage-200
    app.stage.addChild(ground);

    /* Horizon accent line */
    const horizon = new Graphics();
    horizon.rect(0, H * 0.6 - 2, W, 4);
    horizon.fill(0x8aad7a);
    app.stage.addChild(horizon);

    /* 3 — Shelter silhouette */
    const site = SITES.find((s) => s.id === siteId);
    const color = site?.silhouetteColor ?? 0x9e6b42;

    const shelter = new Graphics();
    const sx = W * 0.25;
    const sy = H * 0.35;
    const sw = W * 0.5;
    const sh = H * 0.3;
    shelter.roundRect(sx, sy, sw, sh, 8);
    shelter.fill({ color, alpha: 0.85 });
    app.stage.addChild(shelter);

    /* Shelter label */
    const labelStyle = new TextStyle({
      fontFamily: 'Georgia, serif',
      fontSize: 18,
      fill: 0xfaf8f5,
      align: 'center',
    });
    const label = new Text({ text: site?.name ?? 'Your Shelter', style: labelStyle });
    label.anchor.set(0.5);
    label.x = sx + sw / 2;
    label.y = sy + sh / 2;
    app.stage.addChild(label);

    /* 4 — Tarp overlay */
    if (showTarp) {
      const tarp = new Graphics();
      // Triangular tarp above shelter
      tarp.moveTo(sx - 10, sy);
      tarp.lineTo(sx + sw / 2, sy - 40);
      tarp.lineTo(sx + sw + 10, sy);
      tarp.closePath();
      tarp.fill({ color: 0xe8cdb5, alpha: 0.9 });   // --terra-200
      app.stage.addChild(tarp);

      const tarpLabel = new Text({
        text: '⛺ Tarp Repaired',
        style: new TextStyle({ fontSize: 13, fill: 0x3d3832 }),
      });
      tarpLabel.anchor.set(0.5);
      tarpLabel.x = sx + sw / 2;
      tarpLabel.y = sy - 18;
      app.stage.addChild(tarpLabel);
    }
  }, []);

  /* Mount / unmount the PixiJS app */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const app = new Application();

    void app.init({
      resizeTo: container,
      background: 0xfaf8f5,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (cancelled) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      draw(app, chosenSite, tarpPitched);
    });

    return () => {
      cancelled = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Re-draw when game state changes */
  useEffect(() => {
    if (appRef.current) {
      draw(appRef.current, chosenSite, tarpPitched);
    }
  }, [chosenSite, tarpPitched, draw]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '420px',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '2px solid var(--border)',
      }}
    />
  );
}
