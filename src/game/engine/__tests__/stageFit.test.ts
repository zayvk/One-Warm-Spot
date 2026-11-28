import { describe, expect, it } from 'vitest';
import {
  HUD_MAX_ASPECT,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  fitStage,
  hudFrameInsets,
  pxToStagePoint,
  rendererResolution,
  stageLeavesGaps,
  stagePointToPx,
  uiScaleFor,
  uiTextScaleFor,
  type StageRect,
  type StageSafeArea,
} from '../stageFit.ts';
import { terraceScene } from '../../data/scenes/terrace.ts';
import {
  BUILDING_FLOORS,
  LIFT_SAFE_AREA,
  floorSafeArea,
  stopSafeArea,
  type DownstairsFloorId,
} from '../../data/floors.ts';

const ART_W = 1376;
const ART_H = 768;

/** The on-screen span of the safe area, in screen px */
function safeOnScreen(rect: StageRect, safe: StageSafeArea) {
  return {
    left: rect.x + safe.xMin * rect.width,
    right: rect.x + safe.xMax * rect.width,
    top: rect.y + safe.yMin * rect.height,
    bottom: rect.y + safe.yMax * rect.height,
  };
}

const VIEWS = [
  [1376, 768],
  [1920, 1080],
  [1440, 900],
  [1024, 768],
  [820, 1180],
  [390, 844],
  [2400, 900],
  [3440, 1440],
] as const;

describe('fitStage', () => {
  it('is a plain centred cover fit without a safe area', () => {
    expect(fitStage(1376, 1376, ART_W, ART_H)).toEqual({
      x: (1376 - ART_W * (1376 / ART_H)) / 2,
      y: 0,
      width: ART_W * (1376 / ART_H),
      height: 1376,
    });
  });

  it('leaves 16:9-ish windows exactly as the centred cover fit', () => {
    const safe = terraceScene.safeArea!;
    for (const [w, h] of [[1376, 768], [1920, 1080], [1600, 900]] as const) {
      expect(fitStage(w, h, ART_W, ART_H, safe)).toEqual(fitStage(w, h, ART_W, ART_H));
      expect(stageLeavesGaps(fitStage(w, h, ART_W, ART_H, safe), w, h)).toBe(false);
    }
  });

  it('keeps the Terrace safe area fully on screen at every window shape', () => {
    const safe = terraceScene.safeArea!;
    for (const [w, h] of VIEWS) {
      const s = safeOnScreen(fitStage(w, h, ART_W, ART_H, safe), safe);
      expect(s.left, `${w}×${h}`).toBeGreaterThanOrEqual(-0.5);
      expect(s.right, `${w}×${h}`).toBeLessThanOrEqual(w + 0.5);
      expect(s.top, `${w}×${h}`).toBeGreaterThanOrEqual(-0.5);
      expect(s.bottom, `${w}×${h}`).toBeLessThanOrEqual(h + 0.5);
    }
  });

  it('slides the framing instead of shrinking when cover alone would crop the safe area', () => {
    /* Ultrawide: cover still fits the floor band's height, so no gaps — just shifted down */
    const rect = fitStage(2400, 900, ART_W, ART_H, { xMin: 0.1, xMax: 0.9, yMin: 0.3, yMax: 0.95 });
    expect(rect.width).toBeCloseTo(2400);
    expect(rect.y).toBeLessThan((900 - rect.height) / 2);
    expect(rect.y + rect.height).toBeGreaterThanOrEqual(900);
    expect(stageLeavesGaps(rect, 2400, 900)).toBe(false);
  });

  it('only leaves gaps (for the soft fill) when the shape is too extreme to cover', () => {
    const safe = terraceScene.safeArea!;
    expect(stageLeavesGaps(fitStage(390, 844, ART_W, ART_H, safe), 390, 844)).toBe(true);
  });
});

describe('floorSafeArea', () => {
  it('keeps the middle of every hotspot on screen on every floor and window shape', () => {
    for (const floor of [1, 2, 3, 4] as DownstairsFloorId[]) {
      const safe = floorSafeArea(floor);
      for (const [w, h] of VIEWS) {
        const rect = fitStage(w, h, ART_W, ART_H, safe);
        for (const spot of BUILDING_FLOORS[floor].hotspots) {
          const cx = rect.x + ((spot.rect.left + spot.rect.width / 2) / 100) * rect.width;
          const cy = rect.y + ((spot.rect.top + spot.rect.height / 2) / 100) * rect.height;
          expect(cx, `${spot.id} @ ${w}×${h}`).toBeGreaterThanOrEqual(0);
          expect(cx, `${spot.id} @ ${w}×${h}`).toBeLessThanOrEqual(w);
          expect(cy, `${spot.id} @ ${w}×${h}`).toBeGreaterThanOrEqual(0);
          expect(cy, `${spot.id} @ ${w}×${h}`).toBeLessThanOrEqual(h);
        }
      }
    }
  });
});

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

describe('uiScaleFor (the proportional --ui-scale)', () => {
  it('tightens on short phones, is 1 at 1440×900 and grows on big monitors (clamped)', () => {
    const s = Object.fromEntries(TARGETS.map(([w, h]) => [`${w}x${h}`, uiScaleFor(w, h)]));
    expect(s['667x375']).toBe(UI_SCALE_MIN);
    expect(s['844x390']).toBe(UI_SCALE_MIN);
    expect(s['1024x768']).toBeCloseTo(0.815, 2);
    expect(s['1366x768']).toBeCloseTo(0.909, 2);
    expect(uiScaleFor(1440, 900)).toBe(1);
    expect(s['1920x1080']).toBeCloseTo(1.116, 2);
    expect(s['2560x1440']).toBe(UI_SCALE_MAX);
    expect(s['3440x1440']).toBe(UI_SCALE_MAX);
  });

  it('never shrinks as the window grows, and the tighter axis decides', () => {
    for (let w = 600; w <= 3600; w += 100) {
      expect(uiScaleFor(w + 100, 900)).toBeGreaterThanOrEqual(uiScaleFor(w, 900));
      expect(uiScaleFor(1600, w / 2 + 50)).toBeGreaterThanOrEqual(uiScaleFor(1600, w / 2));
    }
    /* A 4:3 tablet is width-bound: smaller than a 16:9 laptop of the same height */
    expect(uiScaleFor(1024, 768)).toBeLessThan(uiScaleFor(1366, 768));
    /* An ultrawide is height-bound: the same as 16:9 at that height */
    expect(uiScaleFor(3440, 1080)).toBe(uiScaleFor(1920, 1080));
  });

  it('keeps text-heavy surfaces readable: never below 0.9 on phones, up to 1.2 on 1440p', () => {
    expect(uiTextScaleFor(uiScaleFor(667, 375))).toBe(0.9);
    expect(uiTextScaleFor(uiScaleFor(1440, 900))).toBe(1);
    expect(uiTextScaleFor(uiScaleFor(2560, 1440))).toBe(1.2);
  });

  it('copes with zero / bogus sizes (before layout)', () => {
    expect(uiScaleFor(0, 0)).toBe(1);
    expect(uiScaleFor(Number.NaN, 900)).toBe(1);
  });
});

describe('fitStage at the target landscape windows', () => {
  it('keeps every interactive safe area on screen (Terrace, Floors 1–4, the lift)', () => {
    const safes: [string, StageSafeArea][] = [
      ['rooftop', stopSafeArea('R')],
      ...([1, 2, 3, 4] as const).map((f): [string, StageSafeArea] => [`floor ${f}`, floorSafeArea(f)]),
      ['lift', LIFT_SAFE_AREA],
    ];
    for (const [name, safe] of safes) {
      for (const [w, h] of TARGETS) {
        const rect = fitStage(w, h, ART_W, ART_H, safe);
        const s = safeOnScreen(rect, safe);
        expect(s.left, `${name} @ ${w}×${h}`).toBeGreaterThanOrEqual(-0.5);
        expect(s.right, `${name} @ ${w}×${h}`).toBeLessThanOrEqual(w + 0.5);
        expect(s.top, `${name} @ ${w}×${h}`).toBeGreaterThanOrEqual(-0.5);
        expect(s.bottom, `${name} @ ${w}×${h}`).toBeLessThanOrEqual(h + 0.5);
        /* Never letterboxed by more than the art can't avoid: it still covers one full axis */
        expect(rect.width >= w - 0.5 || rect.height >= h - 0.5, `${name} @ ${w}×${h}`).toBe(true);
      }
    }
  });

  it('frames the rooftop the same way the lift ride frames the stop it leaves (no jump at the hand-off)', () => {
    expect(stopSafeArea('R')).toEqual(terraceScene.safeArea);
    expect(stopSafeArea(3)).toEqual(floorSafeArea(3));
  });

  it('anchors stage points to the fitted rect, so a menu follows its prop through any resize', () => {
    const safe = terraceScene.safeArea!;
    const shed = { x: 0.3, y: 0.56 };
    for (const [w, h] of TARGETS) {
      const rect = fitStage(w, h, ART_W, ART_H, safe);
      const px = stagePointToPx(rect, shed);
      expect(px.x).toBeCloseTo(rect.x + 0.3 * rect.width);
      expect(px.y).toBeCloseTo(rect.y + 0.56 * rect.height);
      const back = pxToStagePoint(rect, px.x, px.y);
      expect(back.x).toBeCloseTo(shed.x);
      expect(back.y).toBeCloseTo(shed.y);
      /* Inside the safe area → on screen */
      expect(px.x).toBeGreaterThanOrEqual(0);
      expect(px.x).toBeLessThanOrEqual(w);
    }
  });
});

describe('hudFrameInsets (corner HUD on wide windows)', () => {
  it('stays at the window edges up to 16:9 and 21:9', () => {
    for (const [w, h] of TARGETS.filter(([w, h]) => w / h <= HUD_MAX_ASPECT)) {
      expect(hudFrameInsets(w, h, fitStage(w, h, ART_W, ART_H, terraceScene.safeArea))).toEqual({ left: 0, right: 0 });
    }
  });

  it('pulls the corners in on ultrawide windows', () => {
    const inset = Math.round((3440 - 1440 * HUD_MAX_ASPECT) / 2);
    expect(hudFrameInsets(3440, 1440)).toEqual({ left: inset, right: inset });
  });

  it('hugs the painting when the stage leaves soft side bands (32:9)', () => {
    const rect = fitStage(5120, 1440, ART_W, ART_H, terraceScene.safeArea);
    expect(stageLeavesGaps(rect, 5120, 1440)).toBe(true);
    const f = hudFrameInsets(5120, 1440, rect);
    expect(f.left).toBe(Math.round(Math.max(rect.x, (5120 - 1440 * HUD_MAX_ASPECT) / 2)));
    expect(f.left).toBeGreaterThanOrEqual(Math.round(rect.x));
    expect(f.right).toBeGreaterThanOrEqual(Math.round(5120 - rect.x - rect.width));
  });

  it('ignores 4:3 top / bottom bands (the HUD sits in them, off the art)', () => {
    const rect = fitStage(1024, 768, ART_W, ART_H, terraceScene.safeArea);
    expect(stageLeavesGaps(rect, 1024, 768)).toBe(true);
    expect(hudFrameInsets(1024, 768, rect)).toEqual({ left: 0, right: 0 });
  });
});

describe('rendererResolution', () => {
  it('follows the device pixel ratio, capped at 2×', () => {
    expect(rendererResolution(1)).toBe(1);
    expect(rendererResolution(1.25)).toBe(1.25);
    expect(rendererResolution(2)).toBe(2);
    expect(rendererResolution(3)).toBe(2);
  });

  it('falls back to 1 for missing or bogus ratios', () => {
    expect(rendererResolution(undefined)).toBe(1);
    expect(rendererResolution(0)).toBe(1);
    expect(rendererResolution(Number.NaN)).toBe(1);
  });
});