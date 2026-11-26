import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackupText } from '../backup.ts';
import { freshTerraceState } from '../terraceState.ts';
import { SAVE_VERSION } from '../saveSystem.ts';
import type { SaveState } from '../../types/game.ts';

const save: SaveState = {
  version: SAVE_VERSION,
  day: 3,
  chosenSite: 'terrace',
  selectedMode: 'cozy',
  travelerGender: 'female',
  resources: { timber: 5, scrap: 2, cloth: 3, stone: 0, seeds: 1, water: 4 },
  unlockedUpgrades: [],
  kitCollected: true,
  stats: { maxDaysSurvived: 2, totalUpgradesBuilt: 0, totalExpansionsBuilt: 0 },
  timestamp: 1,
};

describe('backup files', () => {
  it('round-trips the run save, milestone stats and the full rooftop state', () => {
    const terrace = {
      ...freshTerraceState(99),
      fireLit: true,
      firepitTier: 2 as const,
      searchedBoxes: ['boxes-2'],
      clearedWeeds: ['weeds-1', 'weeds-5'],
      builtProps: ['rain-barrel'],
    };
    const result = parseBackupText(JSON.stringify(buildBackup(save, terrace)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.terrace).toEqual(terrace);
    expect(result.save).toMatchObject({ day: 3, chosenSite: 'terrace', resources: save.resources, stats: save.stats });
    expect(result.warnings).toEqual([]);
  });

  it('still loads older backups without rooftop details, starting the Terrace fresh', () => {
    const result = parseBackupText(JSON.stringify(save));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.terrace).toBeNull();
    expect(result.warnings.join(' ')).toMatch(/starts fresh/);
  });

  it.each([
    ['an unknown fire pit tier', { firepitTier: 5 }],
    ['a non-boolean fire flag', { fireLit: 'yes' }],
    ['a damaged box list', { searchedBoxes: [1, 2] }],
    ['a broken layout', { spawns: { 'boxes-1': { x: 4 } } }],
  ])('rejects rooftop details with %s', (_label, patch) => {
    const bad = { ...buildBackup(save, freshTerraceState(3)) };
    bad.terraceState = { ...bad.terraceState!, ...patch } as never;
    const result = parseBackupText(JSON.stringify(bad));
    expect(result).toEqual({ ok: false, error: 'The rooftop details in this backup are damaged.' });
  });

  it('keeps the friendly save errors for unreadable or invalid files', () => {
    expect(parseBackupText('not json').ok).toBe(false);
    const result = parseBackupText(JSON.stringify({ ...save, day: 0 }));
    expect(result).toEqual({ ok: false, error: "The day count in this save isn't valid." });
  });
});
