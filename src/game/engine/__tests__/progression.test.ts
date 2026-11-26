import { describe, expect, it } from 'vitest';
import {
  applyUpgradeBuild,
  computeCozyIndex,
  daysSurvivedOn,
  emptyStats,
  findNewUnlocks,
  getUnlockedSiteIds,
  getUpgradeStatus,
} from '../progression.ts';
import { UPGRADES, UPGRADE_MAP } from '../../data/upgrades.ts';
import type { PlayerStats, ResourceId } from '../../types/game.ts';

const plenty: Record<ResourceId, number> = {
  timber: 20, scrap: 20, cloth: 20, stone: 20, seeds: 20, water: 20, food: 20,
};

describe('upgrade eligibility', () => {
  const shell1 = UPGRADE_MAP['shell-1'];
  const shell2 = UPGRADE_MAP['shell-2'];

  it.each([
    ['built', shell1, ['shell-1'], plenty, 100],
    ['locked', shell2, [], plenty, 100],
    ['need-materials', shell2, ['shell-1'], { ...plenty, timber: 4 }, 100],
    ['too-tired', shell2, ['shell-1'], plenty, shell2.energy - 1],
    ['available', shell2, ['shell-1'], plenty, shell2.energy],
  ] as const)('reports %s', (expected, upgrade, built, resources, energy) => {
    expect(getUpgradeStatus(upgrade, built, resources, energy)).toBe(expected);
  });

  it('checks the tier prerequisite before materials or energy', () => {
    expect(getUpgradeStatus(shell2, [], { ...plenty, timber: 0 }, 0)).toBe('locked');
  });

  it('deducts the exact cost and energy without mutating inputs', () => {
    const resources = { ...plenty };
    const built = ['shell-1'];
    expect(applyUpgradeBuild(shell2, resources, 80, built)).toEqual({
      ok: true,
      resources: { ...plenty, timber: 15, stone: 16 },
      energy: 80 - shell2.energy,
      built: ['shell-1', 'shell-2'],
    });
    expect(resources).toEqual(plenty);
    expect(built).toEqual(['shell-1']);
  });

  it('refuses to build when not available and reports why', () => {
    expect(applyUpgradeBuild(shell1, { ...plenty, cloth: 0 }, 100, [])).toEqual({
      ok: false,
      status: 'need-materials',
    });
  });

  it('sums Cozy Index across built upgrades (all 10 = 100, duplicates once)', () => {
    expect(computeCozyIndex(UPGRADES.map((u) => u.id))).toBe(100);
    expect(computeCozyIndex(['shell-1', 'shell-1', 'unknown'])).toBe(shell1.cozy);
  });
});

describe('milestone unlocks', () => {
  const starters = ['terrace'];

  it('keeps only the Old Apartment Terrace open on Day 1', () => {
    expect(getUnlockedSiteIds(emptyStats())).toEqual(starters);
  });

  it('keeps “coming soon” shelters locked no matter how far the player gets', () => {
    const maxed = { maxDaysSurvived: 999, totalUpgradesBuilt: 999, totalExpansionsBuilt: 999 };
    const unlocked = getUnlockedSiteIds(maxed);
    expect(unlocked).not.toContain('pipe');
    expect(unlocked).not.toContain('tree');
    expect(findNewUnlocks(maxed, []).map((s) => s.id)).not.toContain('pipe');
  });

  it('counts days survived as day − 1', () => {
    expect(daysSurvivedOn(1)).toBe(0);
    expect(daysSurvivedOn(8)).toBe(7);
  });

  it.each([
    [{ maxDaysSurvived: 6 }, []],
    [{ maxDaysSurvived: 7 }, ['countryhouse']],
    [{ maxDaysSurvived: 10 }, ['countryhouse', 'cave']],
    [{ maxDaysSurvived: 14 }, ['countryhouse', 'cave', 'beachhouse']],
    [{ totalUpgradesBuilt: 2 }, ['farmhouse']],
    [{ totalUpgradesBuilt: 4 }, ['farmhouse', 'island']],
    [{ totalExpansionsBuilt: 1 }, ['bunker']],
  ] as [Partial<PlayerStats>, string[]][])('%j unlocks %j', (partial, expected) => {
    expect(getUnlockedSiteIds({ ...emptyStats(), ...partial })).toEqual([...starters, ...expected]);
  });

  it('announces each newly reached shelter only once', () => {
    const stats = { ...emptyStats(), totalUpgradesBuilt: 4 };
    expect(findNewUnlocks(stats, []).map((s) => s.id)).toEqual(['farmhouse', 'island']);
    expect(findNewUnlocks(stats, ['farmhouse']).map((s) => s.id)).toEqual(['island']);
  });
});
