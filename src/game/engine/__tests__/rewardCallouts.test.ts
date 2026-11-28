import { describe, expect, it } from 'vitest';
import { formatRewardCallout, POUCH_RESOURCE_IDS } from '../rewardCallouts.ts';

describe('rewardCallouts', () => {
  it('lists all seven pouch resources in display order', () => {
    expect(POUCH_RESOURCE_IDS).toEqual(['timber', 'cloth', 'seeds', 'water', 'scrap', 'stone', 'food']);
  });

  it('formats positive gained resources and ignores zero or missing entries', () => {
    expect(formatRewardCallout({ timber: 2, cloth: 1, scrap: 0 })).toBe('+2 🪵 Timber  +1 🧵 Cloth');
    expect(formatRewardCallout({})).toBe('');
  });
});
