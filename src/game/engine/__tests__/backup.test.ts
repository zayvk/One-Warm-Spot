import { describe, expect, it } from 'vitest';
import { buildBackup, parseBackupText } from '../backup.ts';
import { freshTerraceState } from '../terraceState.ts';
import type { SlotAssignments } from '../buildSlots.ts';
import { SAVE_VERSION } from '../saveSystem.ts';
import type { SaveState } from '../../types/game.ts';

const save: SaveState = {
  version: SAVE_VERSION,
  day: 3,
  chosenSite: 'terrace',
  selectedMode: 'cozy',
  travelerGender: 'female',
  resources: { timber: 5, scrap: 2, cloth: 3, stone: 0, seeds: 1, water: 4, food: 2 },
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
      firepitTier: 2,
      searchedBoxes: ['boxes-2'],
      clearedWeeds: ['weeds-1', 'weeds-5'],
      grillTier: 3,
      sewingTier: 1,
      barrelTier: 2,
      barrelReady: false,
      craftedPerks: ['warm-sheets'],
      slotAssignments: { 'slot-1': 'sewing', 'slot-2': null, 'slot-3': 'rain-barrel', 'slot-4': 'grill' } satisfies SlotAssignments,
    };
    const result = parseBackupText(JSON.stringify(buildBackup(save, terrace)));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.terrace).toEqual(terrace);
    expect(result.save).toMatchObject({ day: 3, chosenSite: 'terrace', resources: save.resources, stats: save.stats });
    expect(result.warnings).toEqual([]);
  });

  it('loads older backups saved before Food and the multi-tier stations existed', () => {
    const { food: _food, ...oldResources } = save.resources;
    const old = {
      ...save,
      resources: oldResources,
      terraceState: { fireLit: false, searchedBoxes: [], clearedWeeds: [], builtProps: ['rain-barrel'], firepitTier: 2, spawns: null },
    };
    const result = parseBackupText(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.resources.food).toBe(0);
    expect(result.terrace).toMatchObject({ barrelTier: 2, barrelReady: true, firepitTier: 2, shelterTier: 1, grillTier: 0 });
    /* Built before slots were flexible: the barrel keeps its old spot by the stairwell */
    expect(result.terrace?.slotAssignments).toEqual({ 'slot-1': null, 'slot-2': null, 'slot-3': null, 'slot-4': 'rain-barrel' });
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
    ['an out-of-range grill tier', { grillTier: 9 }],
    ['a non-boolean harvest flag', { planterReady: 'soon' }],
    ['a damaged perk list', { craftedPerks: [1] }],
    ['the same station in two slots', { grillTier: 1, slotAssignments: { 'slot-1': 'grill', 'slot-3': 'grill' } }],
    ['an unknown build slot', { slotAssignments: { 'slot-7': 'planter' } }],
    ['an unknown slot station', { slotAssignments: { 'slot-1': 'hot-tub' } }],
    ['a damaged slot map', { slotAssignments: ['planter'] }],
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
