import { describe, expect, it } from 'vitest';
import {
  BOX_REFRESH_EVERY_DAYS,
  findSpawnProblems,
  generateTerraceSpawns,
  perimeterDistance,
  regrowTerraceSpawns,
  repairTerraceSpawns,
  seededRng,
} from '../terraceSpawns.ts';
import {
  DEFAULT_TERRACE_SPAWNS,
  TERRACE_BOX_IDS,
  TERRACE_BUILD_SLOTS,
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

  it('keeps every box and weed clear of every station anchor and its stand spot', () => {
    const { aspect } = TERRACE_SPAWN_RULES;
    const anchors = [
      ...TERRACE_STATIONS.filter((s) => s.hotspotId).map((s) => {
        const pos = terraceScene.hotspots.find((h) => h.id === s.hotspotId)!.position;
        const stand = s.buildStandOffset ?? { dx: 0, dy: 0 };
        return [pos, { x: pos.x + stand.dx, y: pos.y + stand.dy }];
      }),
      ...TERRACE_BUILD_SLOTS.map((slot) => [
        slot.position,
        { x: slot.position.x + slot.standOffset.dx, y: slot.position.y + slot.standOffset.dy },
      ]),
    ].flat();
    for (const seed of SEEDS) {
      for (const s of Object.values(generateTerraceSpawns(seed))) {
        for (const a of anchors) {
          expect(Math.hypot((s.x - a.x) * aspect, s.y - a.y), `seed ${seed}`).toBeGreaterThan(0.05);
        }
      }
    }
  });

  it('strongly prefers the rooftop perimeter over the open middle', () => {
    let onEdge = 0;
    let total = 0;
    for (const seed of SEEDS) {
      for (const s of Object.values(generateTerraceSpawns(seed))) {
        total++;
        if (perimeterDistance(s.x, s.y) <= TERRACE_SPAWN_RULES.perimeterBand) onEdge++;
      }
    }
    expect(onEdge / total).toBeGreaterThanOrEqual(0.95);
  });

  it('keeps the hand-placed default layout valid around the composed stations', () => {
    expect(findSpawnProblems(DEFAULT_TERRACE_SPAWNS)).toEqual([]);
  });

  it('flags crowded or out-of-bounds layouts', () => {
    const spawns = generateTerraceSpawns(5);
    const crowded = { ...spawns, 'weeds-1': { ...spawns['weeds-2'] } };
    const offFloor = { ...spawns, 'boxes-2': { ...spawns['boxes-2'], x: 0.97, y: 0.4 } };
    expect(findSpawnProblems(crowded)).toContain('weeds-1 crowds weeds-2');
    expect(findSpawnProblems(offFloor)).toContain('boxes-2 overlaps scenery or leaves the floor');
  });
});

describe('repairTerraceSpawns', () => {
  it('leaves a valid layout untouched', () => {
    const spawns = generateTerraceSpawns(11);
    expect(repairTerraceSpawns(spawns, seededRng(1))).toBe(spawns);
  });

  it('moves only the props that now overlap a station, keeping their art', () => {
    const spawns = generateTerraceSpawns(11);
    /* e.g. a layout saved before the grill moved onto the back-right parapet */
    const stale = { ...spawns, 'weeds-2': { ...spawns['weeds-2'], x: 0.62, y: 0.58 } };
    const fixed = repairTerraceSpawns(stale, seededRng(2));
    expect(findSpawnProblems(fixed)).toEqual([]);
    expect(fixed['weeds-2']).not.toEqual(stale['weeds-2']);
    expect(fixed['weeds-2']).toMatchObject({ variant: spawns['weeds-2'].variant, scale: spawns['weeds-2'].scale });
    for (const id of [...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS].filter((id) => id !== 'weeds-2')) {
      expect(fixed[id]).toEqual(spawns[id]);
    }
  });
});

describe('regrowTerraceSpawns', () => {
  const rooftop = (seed: number, clearedWeeds: string[], searchedBoxes: string[]) => ({
    spawns: generateTerraceSpawns(seed),
    clearedWeeds,
    searchedBoxes,
    fireLit: true,
  });

  it('regrows 1–2 cleared weeds at brand-new valid spots, without touching anything else', () => {
    for (const seed of SEEDS) {
      const before = rooftop(seed, ['weeds-1', 'weeds-3', 'weeds-6'], ['boxes-2']);
      const { state, regrownWeeds, refreshedBoxes } = regrowTerraceSpawns(before, 3, seededRng(seed));
      expect(regrownWeeds.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(regrownWeeds.length).toBeLessThanOrEqual(2);
      expect(refreshedBoxes).toEqual([]);
      expect(state.fireLit).toBe(true);
      expect(state.searchedBoxes).toEqual(['boxes-2']);
      expect(state.clearedWeeds).toEqual(before.clearedWeeds.filter((id) => !regrownWeeds.includes(id)));
      expect(findSpawnProblems(state.spawns!), `seed ${seed}`).toEqual([]);
      for (const id of regrownWeeds) {
        expect(before.clearedWeeds).toContain(id);
        expect(state.spawns![id]).not.toEqual(before.spawns[id]);
        expect(isBoxVariant(state.spawns![id].variant)).toBe(false);
      }
      for (const id of Object.keys(before.spawns).filter((id) => !regrownWeeds.includes(id))) {
        expect(state.spawns![id]).toEqual(before.spawns[id]);
      }
    }
  });

  it('never regrows more weeds than were cleared, and leaves a full rooftop as it is', () => {
    const one = regrowTerraceSpawns(rooftop(4, ['weeds-5'], []), 3, seededRng(9));
    expect(one.regrownWeeds).toEqual(['weeds-5']);
    expect(one.state.clearedWeeds).toEqual([]);

    const full = rooftop(4, [], []);
    const untouched = regrowTerraceSpawns(full, 4, seededRng(9));
    expect(untouched.state).toBe(full);
    expect(untouched.regrownWeeds).toEqual([]);
    expect(untouched.refreshedBoxes).toEqual([]);
  });

  it(`refreshes one searched box every ${BOX_REFRESH_EVERY_DAYS} days at a new (mostly edge) spot`, () => {
    const before = rooftop(8, [], ['boxes-1', 'boxes-3']);
    expect(regrowTerraceSpawns(before, 3, seededRng(5)).refreshedBoxes).toEqual([]);

    let onEdge = 0;
    const tries = SEEDS.slice(0, 100);
    for (const seed of tries) {
      const { state, refreshedBoxes } = regrowTerraceSpawns(before, 4, seededRng(seed));
      expect(refreshedBoxes).toHaveLength(1);
      const [id] = refreshedBoxes;
      expect(before.searchedBoxes).toContain(id);
      expect(state.searchedBoxes).toEqual(before.searchedBoxes.filter((b) => b !== id));
      expect(isBoxVariant(state.spawns![id].variant)).toBe(true);
      expect(state.spawns![id]).not.toEqual(before.spawns[id]);
      if (perimeterDistance(state.spawns![id].x, state.spawns![id].y) <= TERRACE_SPAWN_RULES.perimeterBand) onEdge++;
      expect(findSpawnProblems(state.spawns!)).toEqual([]);
    }
    /* Only when the edges are already crowded does a box settle on the open floor */
    expect(onEdge / tries.length).toBeGreaterThanOrEqual(0.85);
  });

  it('is deterministic for the same seed', () => {
    const before = rooftop(21, ['weeds-1', 'weeds-2', 'weeds-4'], ['boxes-3']);
    expect(regrowTerraceSpawns(before, 6, seededRng(77))).toEqual(regrowTerraceSpawns(before, 6, seededRng(77)));
  });

  it('starts from the hand-placed layout for older rooftops without a saved layout', () => {
    const { state, regrownWeeds } = regrowTerraceSpawns(
      { spawns: null, clearedWeeds: ['weeds-2'], searchedBoxes: [] },
      2,
      seededRng(3),
    );
    expect(regrownWeeds).toEqual(['weeds-2']);
    expect(findSpawnProblems(state.spawns!)).toEqual([]);
    expect(state.spawns!['boxes-1']).toEqual(DEFAULT_TERRACE_SPAWNS['boxes-1']);
  });

  it('keeps the rooftop valid and within its 3-box / 6-weed caps across many cleared-out nights', () => {
    const rng = seededRng(2026);
    let state = rooftop(99, [], []);
    let boxNights = 0;
    let boxesRefreshed = 0;
    for (let day = 2; day <= 40; day++) {
      /* The traveler clears and searches everything each day */
      state = { ...state, clearedWeeds: [...TERRACE_WEED_IDS], searchedBoxes: [...TERRACE_BOX_IDS] };
      const out = regrowTerraceSpawns(state, day, rng);
      state = out.state;
      expect(Object.keys(state.spawns!).sort()).toEqual([...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS].sort());
      expect(6 - state.clearedWeeds.length).toBe(out.regrownWeeds.length);
      expect(out.regrownWeeds.length).toBeGreaterThanOrEqual(1);
      /* Boxes only refresh on even days; if the edges are momentarily full, one waits for a later night */
      expect(3 - state.searchedBoxes.length).toBe(out.refreshedBoxes.length);
      expect(out.refreshedBoxes.length).toBeLessThanOrEqual(day % 2 === 0 ? 1 : 0);
      if (day % 2 === 0) {
        boxNights++;
        boxesRefreshed += out.refreshedBoxes.length;
      }
      expect(findSpawnProblems(state.spawns!), `day ${day}`).toEqual([]);
    }
    expect(boxesRefreshed / boxNights).toBeGreaterThanOrEqual(0.9);
  });
});
