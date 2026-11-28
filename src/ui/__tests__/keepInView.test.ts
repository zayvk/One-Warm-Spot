import { describe, expect, it } from 'vitest';
import { MENU_MARGIN, MIN_MENU_HEIGHT, menuMaxHeight, menuShift } from '../keepInView.ts';
import { uiScaleFor, uiTextScaleFor } from '../../game/engine/stageFit.ts';

/** The landscape windows the game is tuned for: phones, 4:3 tablet, laptop, 1080p, 1440p, ultrawide */
const TARGETS = [
  [667, 375],
  [844, 390],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
] as const;

/** Bottom of the top HUD row at a given --ui-scale (16px inset + ~44px tall pouch, both scaled) */
const hudBottomAt = (s: number) => 16 * s + 44 * s;

/** Lay a menu out like useKeepInView: cap its height, then shift it by menuShift */
function place(top: number, layoutH: number, viewH: number, hudBottom: number, scale: number) {
  const capped = Math.min(layoutH, menuMaxHeight(viewH, hudBottom, scale)) * scale;
  const shift = menuShift(top, top + capped, viewH, hudBottom);
  return { top: top + shift, bottom: top + capped + shift };
}

describe('floating menus stay on screen (keepInView)', () => {
  it('never covers the top HUD row nor runs off the bottom, at every target window', () => {
    for (const [w, h] of TARGETS) {
      const s = uiScaleFor(w, h);
      const hud = hudBottomAt(s);
      const ts = uiTextScaleFor(s);
      /* Short and tall menus anchored anywhere from above the HUD to the bottom edge */
      for (const layoutH of [90, 180, 320, 520]) {
        for (let top = -100; top <= h; top += 37) {
          const box = place(top, layoutH, h, hud, ts);
          expect(box.top, `${w}×${h} h=${layoutH} top=${top}`).toBeGreaterThanOrEqual(hud + MENU_MARGIN - 1);
          expect(box.bottom, `${w}×${h} h=${layoutH} top=${top}`).toBeLessThanOrEqual(h - MENU_MARGIN + 1);
        }
      }
    }
  });

  it('caps a tall menu to the room left (in layout px, so its scaled height fits) and lets it scroll', () => {
    /* 667×375 phone: a 520px menu at text scale 0.9 */
    const hud = hudBottomAt(uiScaleFor(667, 375));
    const max = menuMaxHeight(375, hud, 0.9);
    expect(max * 0.9).toBeLessThanOrEqual(375 - hud - 2 * MENU_MARGIN + 1);
    expect(max * 0.9).toBeGreaterThan(250);
    /* 1440p: the same menu at 1.2 has plenty of room */
    expect(menuMaxHeight(1440, hudBottomAt(1.22), 1.2) * 1.2).toBeGreaterThan(1200);
  });

  it('keeps a minimum readable height even on a squashed window', () => {
    expect(menuMaxHeight(140, 60, 1)).toBe(MIN_MENU_HEIGHT);
    expect(menuMaxHeight(140, 60, 0.9)).toBe(Math.floor(MIN_MENU_HEIGHT / 0.9));
  });

  it('moves a menu only as far as needed (and not at all when it already fits)', () => {
    expect(menuShift(200, 300, 768, 60)).toBe(0);
    expect(menuShift(20, 120, 768, 60)).toBe(60 + MENU_MARGIN - 20);
    expect(menuShift(700, 800, 768, 60)).toBe(-(800 - (768 - MENU_MARGIN)));
    /* Pushed up from the bottom, but never back under the HUD */
    expect(menuShift(100, 900, 768, 60)).toBe(-(100 - 60 - MENU_MARGIN));
  });

  it('treats a bogus scale as 1', () => {
    expect(menuMaxHeight(768, 60, 0)).toBe(menuMaxHeight(768, 60, 1));
  });
});
