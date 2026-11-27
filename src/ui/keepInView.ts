import { useLayoutEffect, type RefObject } from 'react';

/** Floating menus stay below the top HUD (← Title / pouch row) */
const MIN_TOP = 72;
const MARGIN = 8;

/**
 * Keep a floating menu fully on screen: nudge it down below the top HUD or up from
 * the bottom edge, and let it scroll if it's taller than the space (short landscape phones).
 */
export function useKeepInView(ref: RefObject<HTMLElement | null>, anchorX: number, anchorY: number): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.marginTop = '0px';
    const room = window.innerHeight - MIN_TOP - MARGIN;
    el.style.maxHeight = `${Math.max(120, room)}px`;
    el.style.overflowY = 'auto';
    const rect = el.getBoundingClientRect();
    if (rect.top < MIN_TOP) el.style.marginTop = `${MIN_TOP - rect.top}px`;
    else if (rect.bottom > window.innerHeight - MARGIN) el.style.marginTop = `${window.innerHeight - MARGIN - rect.bottom}px`;
  }, [ref, anchorX, anchorY]);
}
