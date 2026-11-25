import { describe, expect, it } from 'vitest';
import { parseTerraceState } from '../terraceState.ts';
import { spendResources } from '../progression.ts';
import { terraceScene } from '../../data/scenes/terrace.ts';
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
  it('upgrades a pre-v2 rooftop save with no built props', () => {
    const legacy = JSON.stringify({ fireLit: true, searchedBoxes: ['boxes-2'], clearedWeeds: ['weeds-1'] });
    expect(parseTerraceState(legacy)).toEqual({
      fireLit: true,
      searchedBoxes: ['boxes-2'],
      clearedWeeds: ['weeds-1'],
      builtProps: [],
    });
  });

  it('keeps known built props once and drops unknown or damaged entries', () => {
    const raw = JSON.stringify({ builtProps: ['rain-barrel', 'rain-barrel', 'hot-tub', 7, 'shed-upgrade'] });
    expect(parseTerraceState(raw).builtProps).toEqual(['rain-barrel', 'shed-upgrade']);
  });

  it('falls back to a fresh rooftop for unreadable data', () => {
    expect(parseTerraceState('{oops')).toEqual(parseTerraceState(null));
  });
});

describe('Terrace v2 balance', () => {
  it('rooftop boxes and weeds alone yield enough to build every upgrade', () => {
    const found: Partial<Record<string, number>> = {};
    for (const hs of terraceScene.hotspots) {
      for (const [id, n] of Object.entries(hs.reward ?? {})) found[id] = (found[id] ?? 0) + n;
    }
    const needed: Partial<Record<string, number>> = {};
    for (const b of terraceScene.buildables ?? []) {
      for (const [id, n] of Object.entries(b.cost)) needed[id] = (needed[id] ?? 0) + (n ?? 0);
    }
    for (const [id, n] of Object.entries(needed)) {
      expect(found[id] ?? 0, id).toBeGreaterThanOrEqual(n ?? 0);
    }
  });
});
