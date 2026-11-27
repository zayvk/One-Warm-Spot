import { describe, expect, it } from 'vitest';
import { fitStage, stageLeavesGaps, type StageRect, type StageSafeArea } from '../stageFit.ts';
import { terraceScene } from '../../data/scenes/terrace.ts';
import { BUILDING_FLOORS, floorSafeArea, type DownstairsFloorId } from '../../data/floors.ts';

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
