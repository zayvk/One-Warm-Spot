import { useLayoutEffect, type CSSProperties, type RefObject } from 'react';
import { readViewportSize } from './useViewport.ts';

/** Gap kept between a floating menu and the window edges / the top HUD */
export const MENU_MARGIN = 8;
/** Never squeeze a menu shorter than this (on screen); it scrolls instead */
export const MIN_MENU_HEIGHT = 120;

/**
 * Tallest a floating menu may be, in layout px, so it fits between the top HUD (`hudBottom`) and
 * the bottom edge. `scale` is the menu's CSS scale (its on-screen height = layout height × scale).
 */
export function menuMaxHeight(viewH: number, hudBottom: number, scale = 1): number {
  const s = scale > 0 ? scale : 1;
  const room = Math.max(MIN_MENU_HEIGHT, viewH - hudBottom - 2 * MENU_MARGIN);
  return Math.floor(room / s);
}

/**
 * Px to move a menu (already capped by `menuMaxHeight`) so its on-screen box [top, bottom] sits
 * below the top HUD and above the bottom edge. Being below the HUD wins if both can't hold.
 */
export function menuShift(top: number, bottom: number, viewH: number, hudBottom: number): number {
  const minTop = hudBottom + MENU_MARGIN;
  if (top < minTop) return Math.round(minTop - top);
  const over = bottom - (viewH - MENU_MARGIN);
  if (over > 0) return Math.round(-Math.min(over, top - minTop));
  return 0;
}

/** Bottom edge of the top HUD row (← Title cluster, pouch, settings) — every element marked `data-hud-top` */
export function measureHudBottom(): number {
  let bottom = 0;
  for (const el of document.querySelectorAll<HTMLElement>('[data-hud-top]')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0) bottom = Math.max(bottom, r.bottom);
  }
  return bottom;
}

/**
 * Style for a floating menu pinned to an in-world anchor (screen px inside the stage container):
 * above the prop — or below it when the anchor is near the top (`flipBelowY`) — scaled from that
 * pinned edge by `--ui-text-scale`, and clamped so its scaled width stays inside the container.
 */
export function anchoredMenuStyle(
  anchor: { x: number; y: number },
  halfWidth: number,
  flipBelowY: number,
  belowOffset: number,
  edgeGap: number,
): CSSProperties {
  const below = anchor.y < flipBelowY;
  const edge = `calc(${halfWidth}px * var(--ui-text-scale) + ${edgeGap}px)`;
  return {
    left: `clamp(${edge}, ${anchor.x}px, calc(100% - ${edge}))`,
    top: below ? anchor.y + belowOffset : anchor.y - 12,
    transform: below
      ? 'translateX(-50%) scale(var(--ui-text-scale))'
      : 'translate(-50%, -100%) scale(var(--ui-text-scale))',
    transformOrigin: below ? '50% 0' : '50% 100%',
  };
}

/**
 * Keep a floating menu fully on screen: nudge it below the top HUD or up from the bottom edge,
 * and let it scroll if it's taller than the space (short landscape phones). Re-runs whenever the
 * anchor moves (the stage is refitted on every live resize).
 */
export function useKeepInView(ref: RefObject<HTMLElement | null>, anchorX: number, anchorY: number): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.marginTop = '0px';
    el.style.overflowY = 'auto';
    const { h } = readViewportSize();
    const hudBottom = measureHudBottom();
    /* A margin moves the box 1:1 on screen; a max-height is multiplied by the menu's CSS scale */
    const scale = el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1;
    el.style.maxHeight = `${menuMaxHeight(h, hudBottom, scale)}px`;
    const rect = el.getBoundingClientRect();
    const shift = menuShift(rect.top, rect.bottom, h, hudBottom);
    if (shift !== 0) el.style.marginTop = `${shift}px`;
  }, [ref, anchorX, anchorY]);
}
