import { describe, expect, it } from 'vitest';
import { findSpawnProblems, generateTerraceSpawns } from '../terraceSpawns.ts';
import {
  TERRACE_BOX_IDS,
  TERRACE_SPAWN_RULES,
  TERRACE_STATIONS,
  TERRACE_WEED_IDS,
  isBoxVariant,
  terraceScene,
} from '../../data/scenes/terrace.ts';

const SEEDS = Array.from({ length: 250 }, (_, i) => i * 7919 + 1);

describe('generateTerraceSpawns', () => {
  it('always places all 9 props inside the open floor, clear of walls, structures and each other', () => {
    for (const seed of SEEDS) {
      const spawns = generateTerraceSpawns(seed);
      expect(findSpawnProblems(spawns), `seed ${seed}`).toEqual([]);
      const { bounds } = TERRACE_SPAWN_RULES;
      for (const s of Object.values(spawns)) {
        expect(s.x).toBeGreaterThanOrEqual(bounds.xMin);
        expect(s.x).toBeLessThanOrEqual(bounds.xMax);
        expect(s.y).toBeGreaterThanOrEqual(bounds.yMin);
        expect(s.y).toBeLessThanOrEqual(bounds.yMax);
      }
    }
  });

  it('uses each box sprite once and each weed sprite twice, with gentle scale variation', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const spawns = generateTerraceSpawns(seed);
      const boxes = TERRACE_BOX_IDS.map((id) => spawns[id].variant);
      const weeds = TERRACE_WEED_IDS.map((id) => spawns[id].variant).sort();
      expect(boxes.every(isBoxVariant)).toBe(true);
      expect(new Set(boxes).size).toBe(3);
      expect(weeds).toEqual(['weeds-1', 'weeds-1', 'weeds-2', 'weeds-2', 'weeds-3', 'weeds-3']);
      for (const s of Object.values(spawns)) {
        expect(s.scale).toBeGreaterThanOrEqual(0.92);
        expect(s.scale).toBeLessThanOrEqual(1.08);
      }
    }
  });

  it('is deterministic per seed and varies between runs', () => {
    expect(generateTerraceSpawns(123)).toEqual(generateTerraceSpawns(123));
    const layouts = new Set(SEEDS.slice(0, 20).map((seed) => JSON.stringify(generateTerraceSpawns(seed))));
    expect(layouts.size).toBe(20);
  });

  it('keeps every box and weed clear of the cooking grill, sewing kit and their stand spots', () => {
    const { aspect } = TERRACE_SPAWN_RULES;
    const anchors = TERRACE_STATIONS.filter((s) => s.id === 'grill' || s.id === 'sewing').flatMap((s) => {
      const pos = terraceScene.hotspots.find((h) => h.id === s.hotspotId)!.position;
      return [pos, { x: pos.x + s.buildStandOffset.dx, y: pos.y + s.buildStandOffset.dy }];
    });
    for (const seed of SEEDS) {
      for (const s of Object.values(generateTerraceSpawns(seed))) {
        for (const a of anchors) {
          expect(Math.hypot((s.x - a.x) * aspect, s.y - a.y), `seed ${seed}`).toBeGreaterThan(0.05);
        }
      }
    }
  });

  it('flags crowded or out-of-bounds layouts', () => {
    const spawns = generateTerraceSpawns(5);
    const crowded = { ...spawns, 'weeds-1': { ...spawns['weeds-2'] } };
    const offFloor = { ...spawns, 'boxes-2': { ...spawns['boxes-2'], x: 0.97, y: 0.4 } };
    expect(findSpawnProblems(crowded)).toContain('weeds-1 crowds weeds-2');
    expect(findSpawnProblems(offFloor)).toContain('boxes-2 overlaps scenery or leaves the floor');
  });
});
