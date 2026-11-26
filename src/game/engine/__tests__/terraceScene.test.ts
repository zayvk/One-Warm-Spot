import { describe, expect, it } from 'vitest';
import { parseTerraceState, freshTerraceState, validateTerraceState } from '../terraceState.ts';
import { spendResources } from '../progression.ts';
import { findSpawnProblems, generateTerraceSpawns } from '../terraceSpawns.ts';
import {
  TERRACE_BOX_VARIANTS,
  TERRACE_STATIONS,
  TERRACE_WEED_VARIANTS,
} from '../../data/scenes/terrace.ts';
import { GENEROUS_TEST_POOL } from '../../data/modes.ts';
import { MENDING_PERKS, RECIPES } from '../../data/recipes.ts';
import type { ResourceId } from '../../types/game.ts';

const stock: Record<ResourceId, number> = {
  timber: 3, scrap: 1, cloth: 2, stone: 0, seeds: 0, water: 0, food: 0,
};

describe('spendResources', () => {
  it('deducts the exact cost without mutating the stockpile', () => {
    expect(spendResources(stock, { timber: 3, cloth: 2 })).toEqual({ ...stock, timber: 0, cloth: 0 });
    expect(stock.timber).toBe(3);
  });

  it('refuses when any material is short', () => {
    expect(spendResources(stock, { scrap: 2, timber: 1 })).toBeNull();
  });
});

describe('parseTerraceState', () => {
  it('upgrades an older rooftop save to base station tiers with the hand-placed layout', () => {
    const legacy = JSON.stringify({ fireLit: true, searchedBoxes: ['boxes-2'], clearedWeeds: ['weeds-1'] });
    expect(parseTerraceState(legacy)).toEqual({
      fireLit: true,
      searchedBoxes: ['boxes-2'],
      clearedWeeds: ['weeds-1'],
      shelterTier: 1,
      firepitTier: 1,
      planterTier: 0,
      barrelTier: 0,
      grillTier: 0,
      sewingTier: 0,
      planterReady: false,
      barrelReady: false,
      craftedPerks: [],
      spawns: null,
    });
  });

  it('migrates legacy one-off builds to Tier 2 of their station, ready to use', () => {
    const raw = JSON.stringify({
      builtProps: ['timber-shelter', 'herb-planter', 'rain-barrel', 'hot-tub', 7],
      firepitTier: 3,
    });
    expect(parseTerraceState(raw)).toMatchObject({
      shelterTier: 2,
      planterTier: 2,
      barrelTier: 2,
      firepitTier: 3,
      grillTier: 0,
      planterReady: true,
      barrelReady: true,
    });
    expect(parseTerraceState(JSON.stringify({ builtProps: ['shed-upgrade'] })).shelterTier).toBe(2);
  });

  it.each([
    ['firepitTier', 2, 2],
    ['firepitTier', 4, 1],
    ['firepitTier', '3', 1],
    ['shelterTier', 0, 1],
    ['grillTier', 4, 4],
    ['grillTier', 5, 0],
    ['sewingTier', 5, 5],
    ['sewingTier', 2.5, 0],
    ['barrelTier', 3, 3],
    ['planterTier', -1, 0],
  ])('reads %s %j as Tier %i', (key, stored, expected) => {
    expect(parseTerraceState(JSON.stringify({ [key]: stored }))[key as 'grillTier']).toBe(expected);
  });

  it('keeps known crafted perks once and drops unknown ones', () => {
    const raw = JSON.stringify({ craftedPerks: ['warm-sheets', 'warm-sheets', 'jetpack', 3, 'cozy-cloak'] });
    expect(parseTerraceState(raw).craftedPerks).toEqual(['warm-sheets', 'cozy-cloak']);
  });

  it('keeps today’s harvested / collected flags for built stations only', () => {
    const raw = JSON.stringify({ planterTier: 1, planterReady: false, barrelTier: 0, barrelReady: true });
    expect(parseTerraceState(raw)).toMatchObject({ planterReady: false, barrelReady: false });
  });

  it('round-trips every station tier, perk and this run’s spawn layout exactly', () => {
    const state = {
      ...freshTerraceState(42),
      shelterTier: 3,
      firepitTier: 2,
      planterTier: 1,
      barrelTier: 3,
      grillTier: 4,
      sewingTier: 5,
      planterReady: false,
      barrelReady: true,
      craftedPerks: ['mended-gloves'],
    };
    expect(parseTerraceState(JSON.stringify(state))).toEqual(state);
    expect(validateTerraceState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('nudges saved props that now sit on a recomposed station, keeping the rest of the layout', () => {
    const spawns = generateTerraceSpawns(31);
    const stale = { ...spawns, 'boxes-3': { ...spawns['boxes-3'], x: 0.3, y: 0.58 } };
    const restored = parseTerraceState(JSON.stringify({ spawns: stale })).spawns!;
    expect(findSpawnProblems(restored)).toEqual([]);
    expect(restored['boxes-3']).not.toMatchObject({ x: 0.3, y: 0.58 });
    expect(restored['weeds-1']).toEqual(spawns['weeds-1']);
  });

  it('falls back to the default layout when the saved spawns are damaged', () => {
    const spawns = generateTerraceSpawns(7);
    const missingOne = { ...spawns };
    delete missingOne['weeds-4'];
    const badVariant = { ...spawns, 'boxes-1': { ...spawns['boxes-1'], variant: 'weeds-1' } };
    expect(parseTerraceState(JSON.stringify({ spawns: missingOne })).spawns).toBeNull();
    expect(parseTerraceState(JSON.stringify({ spawns: badVariant })).spawns).toBeNull();
  });

  it('starts a fresh run with a newly generated layout for missing or unreadable data', () => {
    for (const raw of [null, '{oops']) {
      const state = parseTerraceState(raw);
      expect(state).toMatchObject({ firepitTier: 1, shelterTier: 1, grillTier: 0, searchedBoxes: [], fireLit: false });
      expect(Object.keys(state.spawns ?? {})).toHaveLength(9);
    }
  });
});

describe('Terrace balance', () => {
  /* Every layout uses each box variant once and each weed variant twice */
  const rooftopYield: Partial<Record<string, number>> = {};
  for (const v of [...Object.values(TERRACE_BOX_VARIANTS), ...Object.values(TERRACE_WEED_VARIANTS), ...Object.values(TERRACE_WEED_VARIANTS)]) {
    for (const [id, n] of Object.entries(v.reward)) rooftopYield[id] = (rooftopYield[id] ?? 0) + n;
  }

  function addCost(into: Partial<Record<string, number>>, cost: Partial<Record<string, number>>): void {
    for (const [id, n] of Object.entries(cost)) into[id] = (into[id] ?? 0) + (n ?? 0);
  }

  it('rooftop boxes and weeds alone still cover the shelter & fire pit Tier 2', () => {
    const needed: Partial<Record<string, number>> = {};
    for (const station of TERRACE_STATIONS.filter((s) => s.id === 'shelter' || s.id === 'firepit')) {
      addCost(needed, station.tiers.find((t) => t.tier === 2)!.cost);
    }
    for (const [id, n] of Object.entries(needed)) {
      expect(rooftopYield[id] ?? 0, id).toBeGreaterThanOrEqual(n ?? 0);
    }
  });

  it('the test-mode pool plus the rooftop covers every station tier, every perk, a few fires and each recipe once', () => {
    const needed: Partial<Record<string, number>> = { timber: 3 };
    for (const station of TERRACE_STATIONS) for (const t of station.tiers) addCost(needed, t.cost);
    for (const perk of MENDING_PERKS) addCost(needed, perk.cost);
    for (const recipe of RECIPES) addCost(needed, recipe.ingredients);
    for (const [id, n] of Object.entries(needed)) {
      expect(GENEROUS_TEST_POOL[id as ResourceId] + (rooftopYield[id] ?? 0), id).toBeGreaterThanOrEqual(n ?? 0);
    }
  });
});
