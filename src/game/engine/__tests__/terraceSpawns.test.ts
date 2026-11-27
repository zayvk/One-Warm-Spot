import { describe, expect, it } from 'vitest';
import {
  MAX_CARDBOARD,
  WEEDS_REGROWN,
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
  TERRACE_CARDBOARD_IDS,
  TERRACE_CRATE_IDS,
  TERRACE_SPAWN_RULES,
  TERRACE_STATIONS,
  TERRACE_WEED_IDS,
  WIND_CARDBOARD_VARIANTS,
  isBoxVariant,
  isCrateVariant,
  terraceScene,
} from '../../data/scenes/terrace.ts';

const SEEDS = Array.from({ length: 250 }, (_, i) => i * 7919 + 1);

describe('generateTerraceSpawns', () => {
  it('always places both crates, 1–2 cartons and 6 weeds inside the open floor, clear of walls, structures and each other', () => {
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

  it('starts with both wooden crates, 1–2 fresh cardboard cartons and each weed sprite twice, gently varied in size', () => {
    const cartonCounts = new Set<number>();
    for (const seed of SEEDS.slice(0, 80)) {
      const spawns = generateTerraceSpawns(seed);
      const crates = TERRACE_CRATE_IDS.map((id) => spawns[id].variant).sort();
      const cartons = TERRACE_CARDBOARD_IDS.filter((id) => spawns[id]).map((id) => spawns[id].variant);
      const weeds = TERRACE_WEED_IDS.map((id) => spawns[id].variant).sort();
      expect(crates).toEqual(['box-double', 'boxes-intact']);
      expect(crates.every(isCrateVariant)).toBe(true);
      cartonCounts.add(cartons.length);
      expect(cartons.length).toBeGreaterThanOrEqual(1);
      expect(cartons.length).toBeLessThanOrEqual(2);
      for (const v of cartons) expect(WIND_CARDBOARD_VARIANTS).toContain(v);
      expect(new Set(cartons).size).toBe(cartons.length);
      expect(weeds).toEqual(['weeds-1', 'weeds-1', 'weeds-2', 'weeds-2', 'weeds-3', 'weeds-3']);
      for (const s of Object.values(spawns)) {
        expect(s.scale).toBeGreaterThanOrEqual(0.92);
        expect(s.scale).toBeLessThanOrEqual(1.08);
      }
    }
    expect([...cartonCounts].sort()).toEqual([1, 2]);
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
    const offFloor = { ...spawns, 'crate-2': { ...spawns['crate-2'], x: 0.97, y: 0.4 } };
    expect(findSpawnProblems(crowded)).toContain('weeds-1 crowds weeds-2');
    expect(findSpawnProblems(offFloor)).toContain('crate-2 overlaps scenery or leaves the floor');
    const noCrate = { ...spawns };
    delete noCrate['crate-1'];
    expect(findSpawnProblems(noCrate)).toContain('crate-1 is missing');
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
    for (const id of [...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS].filter((id) => id !== 'weeds-2' && spawns[id])) {
      expect(fixed[id]).toEqual(spawns[id]);
    }
  });
});

describe('regrowTerraceSpawns', () => {
  /** A generated rooftop with some weeds cleared and some cartons carried off (no spawn = gone) */
  const rooftop = (seed: number, clearedWeeds: string[], goneCartons: string[] = [], searchedCrates: string[] = []) => {
    const spawns = generateTerraceSpawns(seed);
    for (const id of goneCartons) delete spawns[id];
    return { spawns, clearedWeeds, searchedBoxes: searchedCrates, fireLit: true };
  };
  const cartonsOn = (spawns: Record<string, unknown>) => TERRACE_CARDBOARD_IDS.filter((id) => spawns[id]);
  const ALL_WEEDS = [...TERRACE_WEED_IDS];

  it('rain regrows 2–3 cleared weeds at new valid spots and never any box', () => {
    const counts = new Set<number>();
    for (const seed of SEEDS) {
      const before = rooftop(seed, ['weeds-1', 'weeds-2', 'weeds-4', 'weeds-6'], [...TERRACE_CARDBOARD_IDS]);
      const { state, regrownWeeds, refreshedBoxes } = regrowTerraceSpawns(before, 'rain', seededRng(seed));
      counts.add(regrownWeeds.length);
      expect(regrownWeeds.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(regrownWeeds.length).toBeLessThanOrEqual(3);
      expect(refreshedBoxes).toEqual([]);
      expect(cartonsOn(state.spawns!)).toEqual([]);
      expect(state.clearedWeeds).toEqual(before.clearedWeeds.filter((id) => !regrownWeeds.includes(id)));
      expect(state.fireLit).toBe(true);
      for (const id of regrownWeeds) {
        expect(state.spawns![id]).not.toEqual(before.spawns[id]);
        expect(isBoxVariant(state.spawns![id].variant)).toBe(false);
      }
      for (const id of Object.keys(before.spawns).filter((id) => !regrownWeeds.includes(id))) {
        expect(state.spawns![id]).toEqual(before.spawns[id]);
      }
      expect(findSpawnProblems(state.spawns!), `seed ${seed}`).toEqual([]);
    }
    expect([...counts].sort()).toEqual([2, 3]);
    /* Never more than were cleared */
    expect(regrowTerraceSpawns(rooftop(4, ['weeds-5']), 'rain', seededRng(9)).regrownWeeds).toEqual(['weeds-5']);
  });

  it('wind blows in 1–2 cardboard-only cartons (never crates) and regrows no weeds', () => {
    const counts = new Set<number>();
    let onEdge = 0;
    let placed = 0;
    for (const seed of SEEDS) {
      const before = rooftop(seed, [...ALL_WEEDS], [...TERRACE_CARDBOARD_IDS], ['crate-1']);
      const { state, regrownWeeds, refreshedBoxes } = regrowTerraceSpawns(before, 'wind', seededRng(seed));
      counts.add(refreshedBoxes.length);
      expect(regrownWeeds).toEqual([]);
      expect(state.clearedWeeds).toEqual(ALL_WEEDS);
      expect(refreshedBoxes.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(refreshedBoxes.length).toBeLessThanOrEqual(2);
      for (const id of refreshedBoxes) {
        expect(TERRACE_CARDBOARD_IDS as readonly string[]).toContain(id);
        expect(WIND_CARDBOARD_VARIANTS).toContain(state.spawns![id].variant);
        placed++;
        if (perimeterDistance(state.spawns![id].x, state.spawns![id].y) <= TERRACE_SPAWN_RULES.perimeterBand) onEdge++;
      }
      /* Wooden crates (even an opened one) never move or change */
      for (const id of TERRACE_CRATE_IDS) expect(state.spawns![id]).toEqual(before.spawns[id]);
      expect(state.searchedBoxes).toEqual(['crate-1']);
      expect(findSpawnProblems(state.spawns!), `seed ${seed}`).toEqual([]);
    }
    expect([...counts].sort()).toEqual([1, 2]);
    expect(onEdge / placed).toBeGreaterThanOrEqual(0.85);
  });

  it('wind never pushes past 3 cartons on the roof', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      /* Windy nights in a row with nobody searching: cartons pile up to the cap, then stop */
      const rng = seededRng(seed);
      let state = rooftop(seed, [], [...TERRACE_CARDBOARD_IDS]);
      for (let night = 0; night < 4; night++) {
        const before = cartonsOn(state.spawns!).length;
        const out = regrowTerraceSpawns(state, 'wind', rng);
        state = out.state;
        expect(out.refreshedBoxes.length).toBeLessThanOrEqual(MAX_CARDBOARD - before);
        expect(cartonsOn(state.spawns!).length).toBeLessThanOrEqual(MAX_CARDBOARD);
        expect(findSpawnProblems(state.spawns!)).toEqual([]);
      }
      expect(cartonsOn(state.spawns!).length, `seed ${seed}`).toBe(MAX_CARDBOARD);
      expect(regrowTerraceSpawns(state, 'wind', rng).refreshedBoxes).toEqual([]);
    }
  });

  it('a clear morning regrows exactly 1 cleared weed patch and no boxes', () => {
    for (const seed of SEEDS.slice(0, 100)) {
      const before = rooftop(seed, ['weeds-1', 'weeds-2', 'weeds-3'], [...TERRACE_CARDBOARD_IDS]);
      const { state, regrownWeeds, refreshedBoxes } = regrowTerraceSpawns(before, 'clear', seededRng(seed));
      expect(regrownWeeds).toHaveLength(1);
      expect(refreshedBoxes).toEqual([]);
      expect(findSpawnProblems(state.spawns!)).toEqual([]);
    }
    const full = rooftop(4, []);
    const untouched = regrowTerraceSpawns(full, 'clear', seededRng(9));
    expect(untouched.state).toBe(full);
    expect(untouched.regrownWeeds).toEqual([]);
    expect(untouched.refreshedBoxes).toEqual([]);
  });

  it('is deterministic for the same seed and weather', () => {
    const before = rooftop(21, ['weeds-1', 'weeds-2', 'weeds-4'], ['cardboard-1', 'cardboard-2', 'cardboard-3']);
    for (const weather of ['clear', 'rain', 'wind'] as const) {
      expect(regrowTerraceSpawns(before, weather, seededRng(77))).toEqual(regrowTerraceSpawns(before, weather, seededRng(77)));
    }
  });

  it('starts from the hand-placed layout for older rooftops without a saved layout', () => {
    const { state, regrownWeeds } = regrowTerraceSpawns(
      { spawns: null, clearedWeeds: ['weeds-2'], searchedBoxes: [] },
      'rain',
      seededRng(3),
    );
    expect(regrownWeeds).toEqual(['weeds-2']);
    expect(findSpawnProblems(state.spawns!)).toEqual([]);
    expect(state.spawns!['crate-1']).toEqual(DEFAULT_TERRACE_SPAWNS['crate-1']);
  });

  it('keeps the rooftop valid within its caps across 40 mixed-weather, cleared-out nights', () => {
    const rng = seededRng(2026);
    let state = rooftop(99, []);
    for (let day = 2; day <= 41; day++) {
      /* The traveler clears every weed, opens both crates and carries off every carton each day */
      const spawns = { ...state.spawns! };
      for (const id of TERRACE_CARDBOARD_IDS) delete spawns[id];
      state = { ...state, spawns, clearedWeeds: [...ALL_WEEDS], searchedBoxes: [...TERRACE_CRATE_IDS] };
      const weather = (['clear', 'rain', 'wind'] as const)[day % 3];
      const out = regrowTerraceSpawns(state, weather, rng);
      state = out.state;
      const { min, max } = WEEDS_REGROWN[weather];
      expect(out.regrownWeeds.length).toBeGreaterThanOrEqual(min);
      expect(out.regrownWeeds.length).toBeLessThanOrEqual(max);
      if (weather === 'wind') expect(out.refreshedBoxes.length).toBeGreaterThanOrEqual(1);
      else expect(out.refreshedBoxes).toEqual([]);
      expect(cartonsOn(state.spawns!).length).toBeLessThanOrEqual(MAX_CARDBOARD);
      for (const id of [...TERRACE_CRATE_IDS, ...TERRACE_WEED_IDS]) expect(state.spawns![id]).toBeDefined();
      expect(state.searchedBoxes).toEqual([...TERRACE_CRATE_IDS]);
      expect(findSpawnProblems(state.spawns!), `day ${day}`).toEqual([]);
    }
  });
});
