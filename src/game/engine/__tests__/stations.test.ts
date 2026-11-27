import { describe, expect, it } from 'vitest';
import {
  applyRecipe,
  barrelCollect,
  gatherStaminaCost,
  nextStationTier,
  perkBlocker,
  phaseStrengthDecay,
  planterHarvest,
  recipeBlocker,
  sleepComfort,
  strengthDriftFactor,
  type StationTiers,
} from '../stations.ts';
import {
  advancePhaseClock,
  applySleep,
  BOX_STAMINA_COST,
  PHASE_DURATION_SEC,
  PHASE_STRENGTH_DECAY,
  WEED_STAMINA_COST,
} from '../dayCycle.ts';
import { TERRACE_STATIONS } from '../../data/scenes/terrace.ts';
import { MENDING_PERKS, RECIPES } from '../../data/recipes.ts';
import type { ResourceId } from '../../types/game.ts';

const pantry: Record<ResourceId, number> = {
  timber: 5, scrap: 5, cloth: 5, stone: 5, seeds: 5, water: 5, food: 5,
};
const empty: Record<ResourceId, number> = {
  timber: 0, scrap: 0, cloth: 0, stone: 0, seeds: 0, water: 0, food: 0,
};

const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;
const perk = (id: string) => MENDING_PERKS.find((p) => p.id === id)!;

describe('station tiers', () => {
  const expectedMax: StationTiers = { shelter: 3, firepit: 3, planter: 3, barrel: 3, grill: 4, sewing: 5 };

  it.each(TERRACE_STATIONS.map((s) => [s.id, s] as const))('%s upgrades one tier at a time until maxed', (id, station) => {
    let tier: number = station.baseTier;
    const built: number[] = [];
    for (let next = nextStationTier(station, tier); next; next = nextStationTier(station, tier)) {
      expect(next.tier).toBe(tier + 1);
      expect(Object.keys(next.cost).length).toBeGreaterThan(0);
      tier = next.tier;
      built.push(tier);
    }
    expect(tier).toBe(expectedMax[id]);
    expect(built[0]).toBe(station.baseTier + 1);
  });

  it('uses the agreed tier costs', () => {
    const costs = Object.fromEntries(TERRACE_STATIONS.map((s) => [s.id, s.tiers.map((t) => t.cost)]));
    expect(costs.shelter.slice(1)).toEqual([{ timber: 3, cloth: 2 }, { timber: 4, scrap: 2, stone: 2 }]);
    expect(costs.firepit.slice(1)).toEqual([{ timber: 2 }, { timber: 2, scrap: 1, stone: 2 }]);
    expect(costs.planter[0]).toEqual({ timber: 1, seeds: 1 });
    expect(costs.grill[3]).toEqual({ timber: 4, scrap: 2, stone: 2 });
    expect(costs.sewing[4]).toEqual({ timber: 4, cloth: 3, scrap: 2 });
  });
});

describe('daily station yields', () => {
  it.each([
    [0, {}],
    [1, { food: 1 }],
    [2, { food: 2, seeds: 1 }],
    [3, { food: 3, seeds: 1 }],
  ])('Farm T%i harvests %j', (tier, gains) => {
    expect(planterHarvest(tier)).toEqual(gains);
  });

  it.each([
    [0, {}],
    [1, { water: 1 }],
    [3, { water: 3 }],
  ])('Rain barrel T%i collects %j', (tier, gains) => {
    expect(barrelCollect(tier)).toEqual(gains);
  });

  it('a rainy day adds +1 water to a built barrel (and nothing to an unbuilt one)', () => {
    expect(barrelCollect(1, 'rain')).toEqual({ water: 2 });
    expect(barrelCollect(3, 'rain')).toEqual({ water: 4 });
    expect(barrelCollect(2, 'wind')).toEqual({ water: 2 });
    expect(barrelCollect(2, 'clear')).toEqual({ water: 2 });
    expect(barrelCollect(0, 'rain')).toEqual({});
  });
});

describe('shelter sleep comfort', () => {
  it.each([
    [1, [], 75, 10],
    [2, [], 90, 10],
    [3, [], 100, 5],
    [1, ['warm-sheets'], 85, 10],
    [2, ['warm-sheets'], 100, 10],
    [3, ['warm-sheets'], 100, 5],
  ])('Shelter T%i with %j wakes to %i Stamina and loses %i Strength', (tier, perks, stamina, loss) => {
    expect(sleepComfort(tier, perks)).toEqual({ staminaTarget: stamina, strengthLoss: loss });
  });

  it('sleeping applies the shelter comfort but never lowers stamina you already have', () => {
    const t1 = sleepComfort(1, []);
    expect(applySleep(2, 60, t1, 20)).toMatchObject({ day: 3, dayPhase: 'day', stamina: 75, strength: 50 });
    expect(applySleep(2, 60, t1, 82).stamina).toBe(82);
    expect(applySleep(2, 60, sleepComfort(3, [])).strength).toBe(55);
  });
});

describe('mending perks', () => {
  it('Mended Work Gloves make gathering ~30% lighter on Stamina', () => {
    expect(gatherStaminaCost(BOX_STAMINA_COST, [])).toBe(BOX_STAMINA_COST);
    expect(gatherStaminaCost(BOX_STAMINA_COST, ['mended-gloves'])).toBe(7);
    expect(gatherStaminaCost(WEED_STAMINA_COST, ['mended-gloves'])).toBe(4);
  });

  it('the Quilted Cozy Cloak halves Strength drift as the day turns', () => {
    const decay = phaseStrengthDecay(strengthDriftFactor(['cozy-cloak']));
    expect(decay).toBe(PHASE_STRENGTH_DECAY / 2);
    expect(phaseStrengthDecay(strengthDriftFactor([]))).toBe(PHASE_STRENGTH_DECAY);
    const next = advancePhaseClock('day', PHASE_DURATION_SEC - 1, 2, 80, decay);
    expect(next.strength).toBe(80 - decay);
  });

  it('explains why a perk can’t be crafted yet', () => {
    const ctx = { sewingTier: 1, perks: [] as string[], resources: pantry };
    expect(perkBlocker(perk('warm-sheets'), ctx)).toBeNull();
    expect(perkBlocker(perk('mended-gloves'), ctx)).toBe('Needs Knitting Basket');
    expect(perkBlocker(perk('cozy-cloak'), { ...ctx, sewingTier: 5, resources: { ...pantry, cloth: 1 } })).toBe('Need 3 🧵 more');
    expect(perkBlocker(perk('warm-sheets'), { ...ctx, perks: ['warm-sheets'] })).toBe('Already crafted');
  });
});

describe('grill cooking', () => {
  it.each([
    ['cool-rainwater', 1, false, null],
    ['toasted-seeds', 1, false, 'Light the fire pit first'],
    ['toasted-seeds', 1, true, null],
    ['cool-rainwater', 0, true, 'Needs Grill Rack'],
  ] as const)('%s at Grill T%i (fire %s) → %j', (id, grillTier, fireLit, blocker) => {
    expect(recipeBlocker(recipe(id), { grillTier, fireLit, resources: pantry })).toBe(blocker);
  });

  it('unlocks recipes by grill tier and reports missing ingredients', () => {
    const ctx = { grillTier: 2, fireLit: true, resources: pantry };
    expect(recipeBlocker(recipe('herbal-tea'), ctx)).toBeNull();
    expect(recipeBlocker(recipe('veggie-stew'), ctx)).toBe('Needs Grill Counter');
    expect(recipeBlocker(recipe('hearth-feast'), { ...ctx, grillTier: 4 })).toBeNull();
    expect(recipeBlocker(recipe('veggie-stew'), { ...ctx, grillTier: 3, resources: { ...empty, water: 1 } })).toBe('Need 2 🍅 more');
  });

  it.each([
    ['cool-rainwater', 10, 5],
    ['toasted-seeds', 0, 15],
    ['herbal-tea', 30, 10],
    ['veggie-stew', 15, 45],
    ['hearth-feast', 40, 65],
  ])('%s restores +%i Stamina and +%i Strength', (id, stamina, strength) => {
    const r = recipe(id);
    const out = applyRecipe(r, pantry, 20, 20)!;
    expect(out.stamina).toBe(20 + stamina);
    expect(out.strength).toBe(20 + strength);
    for (const [res, n] of Object.entries(r.ingredients) as [ResourceId, number][]) {
      expect(out.resources[res]).toBe(pantry[res] - n);
    }
  });

  it('caps vitality at 100 and refuses without ingredients', () => {
    expect(applyRecipe(recipe('hearth-feast'), pantry, 90, 90)).toMatchObject({ stamina: 100, strength: 100 });
    expect(applyRecipe(recipe('veggie-stew'), empty, 50, 50)).toBeNull();
  });
});
