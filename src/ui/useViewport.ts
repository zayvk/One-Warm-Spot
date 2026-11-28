import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { hudFrameInsets, uiScaleFor, type StageRect } from '../game/engine/stageFit.ts';

/*
 * One source of truth for the visible window size. Mobile browsers resize the visible area as the
 * address bar slides in and out (and `visualViewport` can report that before `resize` fires), so
 * everything subscribes to window resize, orientation changes and visualViewport resizes alike.
 */

/** The visible size in CSS px (the visual viewport unless the page is pinch-zoomed) */
export function readViewportSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  if (vv && Math.abs(vv.scale - 1) < 0.01 && vv.width > 0 && vv.height > 0) {
    return { w: Math.round(vv.width), h: Math.round(vv.height) };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

export function subscribeViewport(onChange: () => void): () => void {
  const vv = window.visualViewport;
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  vv?.addEventListener('resize', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
    vv?.removeEventListener('resize', onChange);
  };
}

const viewportKey = () => {
  const { w, h } = readViewportSize();
  return `${w}x${h}`;
};

/** Live visible size (re-renders on any viewport change) */
export function useViewport(): { w: number; h: number } {
  const key = useSyncExternalStore(subscribeViewport, viewportKey);
  return useMemo(() => {
    const [w, h] = key.split('x').map(Number);
    return { w, h };
  }, [key]);
}

/* ───── Root CSS variables: --app-w / --app-h, --ui-scale, --hud-frame-left / -right ───── */

/** The stage of the scene currently on screen (null on menus) */
let activeStage: StageRect | null = null;

function applyViewportVars(root: HTMLElement): void {
  const { w, h } = readViewportSize();
  const frame = hudFrameInsets(w, h, activeStage);
  const s = root.style;
  s.setProperty('--app-w', `${w}px`);
  s.setProperty('--app-h', `${h}px`);
  s.setProperty('--ui-scale', String(uiScaleFor(w, h)));
  s.setProperty('--hud-frame-left', `${frame.left}px`);
  s.setProperty('--hud-frame-right', `${frame.right}px`);
}

/** Write the viewport variables now and keep them current (call once at startup) */
export function installViewportVars(root: HTMLElement = document.documentElement): () => void {
  const update = () => applyViewportVars(root);
  update();
  return subscribeViewport(update);
}

/**
 * Scenes publish their fitted stage so the corner HUD can hug it on very wide windows.
 * Pass the stage computed for the current viewport; it is cleared again on unmount.
 */
export function useHudStageFrame(stage: StageRect | null): void {
  useEffect(() => {
    activeStage = stage;
    applyViewportVars(document.documentElement);
  }, [stage]);
  useEffect(
    () => () => {
      activeStage = null;
      applyViewportVars(document.documentElement);
    },
    [],
  );
}

/** The current --ui-scale (for code that sizes things outside CSS, e.g. Pixi labels) */
export function currentUiScale(): number {
  const { w, h } = readViewportSize();
  return uiScaleFor(w, h);
}
