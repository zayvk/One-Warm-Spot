import { describe, expect, it } from 'vitest';
import { parseTerraceState, freshTerraceState } from '../terraceState.ts';
import { spendResources } from '../progression.ts';
import { generateTerraceSpawns } from '../terraceSpawns.ts';
import {
  TERRACE_BOX_VARIANTS,
  TERRACE_WEED_VARIANTS,
  terraceScene,
} from '../../data/scenes/terrace.ts';
import { startingResources } from '../../data/modes.ts';
import type { ResourceId } from '../../types/game.ts';

const stock: Record<ResourceId, number> = {
  timber: 3, scrap: 1, cloth: 2, stone: 0, seeds: 0, water: 0,
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
  it('upgrades an older rooftop save to Tier 1 with the hand-placed layout', () => {
    const legacy = JSON.stringify({ fireLit: true, searchedBoxes: ['boxes-2'], clearedWeeds: ['weeds-1'] });
    expect(parseTerraceState(legacy)).toEqual({
      fireLit: true,
      searchedBoxes: ['boxes-2'],
      clearedWeeds: ['weeds-1'],
      builtProps: [],
      firepitTier: 1,
      spawns: null,
    });
  });

  it('keeps known built props once and drops unknown or damaged entries', () => {
    const raw = JSON.stringify({ builtProps: ['rain-barrel', 'rain-barrel', 'hot-tub', 7, 'shed-upgrade'] });
    expect(parseTerraceState(raw).builtProps).toEqual(['rain-barrel', 'shed-upgrade']);
  });

  it.each([
    [2, 2],
    [3, 3],
    [4, 1],
    ['3', 1],
    [null, 1],
  ])('reads firepitTier %j as Tier %i', (stored, expected) => {
    expect(parseTerraceState(JSON.stringify({ firepitTier: stored })).firepitTier).toBe(expected);
  });

  it('round-trips the fire pit tier and this run’s spawn layout exactly', () => {
    const state = { ...freshTerraceState(42), firepitTier: 3 as const, builtProps: ['herb-planter'] };
    expect(parseTerraceState(JSON.stringify(state))).toEqual(state);
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
      expect(state).toMatchObject({ firepitTier: 1, builtProps: [], searchedBoxes: [], fireLit: false });
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

  function totalCost(filter: (id: string) => boolean): Partial<Record<string, number>> {
    const needed: Partial<Record<string, number>> = {};
    for (const b of terraceScene.buildables ?? []) {
      if (!filter(b.id)) continue;
      for (const [id, n] of Object.entries(b.cost)) needed[id] = (needed[id] ?? 0) + (n ?? 0);
    }
    return needed;
  }

  it('rooftop boxes and weeds alone cover every build plus fire pit Tier 2', () => {
    for (const [id, n] of Object.entries(totalCost((id) => id !== 'firepit-t3'))) {
      expect(rooftopYield[id] ?? 0, id).toBeGreaterThanOrEqual(n ?? 0);
    }
  });

  it('even a Challenge start plus the rooftop covers every build including the Stone-Ring Hearth', () => {
    const start = startingResources('challenge');
    for (const [id, n] of Object.entries(totalCost(() => true))) {
      expect((rooftopYield[id] ?? 0) + start[id as ResourceId], id).toBeGreaterThanOrEqual(n ?? 0);
    }
  });
});
