import { describe, expect, it } from 'vitest';
import {
  addResources,
  cozyBonus,
  getScavengeBlock,
  runScavenge,
  totalGathered,
  type Rng,
} from '../scavenge.ts';
import { canAfford } from '../progression.ts';
import { morningWaterBonus, rollWeather } from '../weather.ts';
import { SCAVENGE_ZONES } from '../../data/scavengeZones.ts';
import { RELICS } from '../../data/relics.ts';
import { startingResources } from '../../data/modes.ts';
import { UPGRADE_MAP } from '../../data/upgrades.ts';
import type { GameMode, ScavengeZoneId } from '../../types/game.ts';

/** Deterministic PRNG (mulberry32) so every assertion is reproducible */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('runScavenge yields', () => {
  it.each(SCAVENGE_ZONES.map((z) => [z.id, z] as const))(
    '%s: Cozy trips stay within zone ranges and never feel wasted',
    (_id, zone) => {
      const zoneResources: string[] = zone.yields.map((y) => y.resource);
      for (const seed of SEEDS) {
        const { gathered, story } = runScavenge(zone.id, 'cozy', 0, seeded(seed));
        expect(totalGathered(gathered)).toBeGreaterThanOrEqual(4);
        for (const y of zone.yields) {
          const amount = gathered[y.resource] ?? 0;
          expect(amount).toBeLessThanOrEqual(y.max);
          if (y.primary) expect(amount).toBeGreaterThanOrEqual(1);
        }
        expect(Object.keys(gathered).every((r) => zoneResources.includes(r))).toBe(true);
        expect(zone.stories).toContain(story);
      }
    },
  );

  it('Challenge trips are never richer than Cozy for the same luck, and tighter overall', () => {
    let cozyTotal = 0;
    let challengeTotal = 0;
    for (const zone of SCAVENGE_ZONES) {
      for (const seed of SEEDS) {
        const cozy = totalGathered(runScavenge(zone.id, 'cozy', 0, seeded(seed)).gathered);
        const challenge = totalGathered(runScavenge(zone.id, 'challenge', 0, seeded(seed)).gathered);
        expect(challenge).toBeLessThanOrEqual(cozy);
        expect(challenge).toBeGreaterThanOrEqual(3);
        cozyTotal += cozy;
        challengeTotal += challenge;
      }
    }
    expect(challengeTotal).toBeLessThan(cozyTotal * 0.85);
  });

  it.each([
    [0, 0],
    [24, 0],
    [25, 1],
    [50, 2],
    [99, 3],
    [100, 4],
  ])('Cozy Index %i grants +%i bonus materials', (cozyIndex, expected) => {
    expect(cozyBonus(cozyIndex)).toBe(expected);
    for (const zoneId of ['highway', 'stone-creek'] as ScavengeZoneId[]) {
      const base = runScavenge(zoneId, 'cozy', 0, seeded(7));
      const boosted = runScavenge(zoneId, 'cozy', cozyIndex, seeded(7));
      expect(boosted.bonus).toBe(expected);
      expect(totalGathered(boosted.gathered) - totalGathered(base.gathered)).toBe(expected);
    }
  });

  it('finds only undiscovered relics, and none once the collection is complete', () => {
    const lucky: Rng = () => 0;
    const allButLast = RELICS.slice(0, -1).map((r) => r.id);
    expect(runScavenge('greenhouse', 'cozy', 0, lucky, allButLast).relic).toEqual(RELICS.at(-1));
    expect(runScavenge('greenhouse', 'cozy', 0, lucky, RELICS.map((r) => r.id)).relic).toBeNull();
    expect(runScavenge('greenhouse', 'cozy', 0, () => 0.99).relic).toBeNull();
  });
});

describe('scavenging availability', () => {
  it.each([
    ['dusk', 'clear', [], 100, 'cozy', 'dark'],
    ['night', 'clear', [], 100, 'cozy', 'dark'],
    ['morning', 'storm', [], 100, 'challenge', 'storm'],
    ['morning', 'storm', ['shell-1', 'shell-2'], 100, 'challenge', null],
    ['afternoon', 'storm', [], 100, 'challenge', null],
    ['morning', 'clear', [], 24, 'cozy', 'tired'],
    ['morning', 'clear', [], 25, 'cozy', null],
    ['morning', 'clear', [], 34, 'challenge', 'tired'],
    ['afternoon', 'rain', [], 35, 'challenge', null],
  ] as const)('%s · %s · built %j · ⚡%i · %s → %s', (time, weather, built, energy, mode, expected) => {
    expect(getScavengeBlock(time, weather, built, energy, mode)).toBe(expected);
  });

  it('caps gathered materials at their storage limit', () => {
    const stock = { timber: 49, scrap: 0, cloth: 0, stone: 0, seeds: 0, water: 40, food: 0 };
    expect(addResources(stock, { timber: 5, water: 3, scrap: 2 })).toMatchObject({
      timber: 50,
      water: 40,
      scrap: 2,
    });
  });
});

describe('Cozy vs. Challenge rules', () => {
  it('Challenge starts with ~60% of the Cozy materials, never below 1 of anything stocked (Food starts empty)', () => {
    expect(startingResources('cozy')).toEqual({ timber: 4, scrap: 3, cloth: 2, stone: 2, seeds: 1, water: 5, food: 0 });
    expect(startingResources('challenge')).toEqual({ timber: 2, scrap: 2, cloth: 1, stone: 1, seeds: 1, water: 3, food: 0 });
  });

  it('keeps shell-1 reachable after a single unlucky Challenge trip', () => {
    const trip = runScavenge('highway', 'challenge', 0, () => 0);
    const stock = addResources(startingResources('challenge'), trip.gathered);
    expect(canAfford(UPGRADE_MAP['shell-1'].cost, stock)).toBe(true);
  });

  it('rolls storms far more often in Challenge than in Cozy', () => {
    const storms = (mode: GameMode) => {
      const rng = seeded(42);
      return Array.from({ length: 2000 }, () => rollWeather(mode, rng)).filter((w) => w === 'storm').length;
    };
    expect(storms('cozy')).toBeLessThan(100);
    expect(storms('challenge')).toBeGreaterThan(300);
  });

  it('soft rain adds 1–2 water, plus 1 with a rain collector; other weather adds none', () => {
    expect(morningWaterBonus('rain', [], () => 0)).toBe(1);
    expect(morningWaterBonus('rain', [], () => 0.99)).toBe(2);
    expect(morningWaterBonus('rain', ['slot-rain-collector'], () => 0.99)).toBe(3);
    expect(morningWaterBonus('clear', ['slot-rain-collector'], () => 0.99)).toBe(0);
  });
});
