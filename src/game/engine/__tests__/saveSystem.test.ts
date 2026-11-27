import { describe, expect, it } from 'vitest';
import { migrateSave, parseSaveText, SAVE_VERSION, validateSave } from '../saveSystem.ts';
import type { SaveState } from '../../types/game.ts';

const resources = { timber: 4, scrap: 3, cloth: 1, stone: 2, seeds: 1, water: 5 };

const v2Save = {
  version: 2,
  day: 3,
  chosenSite: 'terrace',
  selectedMode: 'cozy',
  travelerGender: 'male',
  resources,
  unlockedUpgrades: ['tarp-pitched'],
  kitCollected: true,
  timestamp: 1,
};

const v3Save = {
  version: 3,
  day: 5,
  timeOfDay: 'dusk',
  energy: 40,
  chosenSite: 'pipe',
  selectedMode: 'cozy',
  travelerGender: 'female',
  resources,
  unlockedUpgrades: ['shell-1', 'slot-workbench'],
  kitCollected: true,
  lanternLit: true,
  stats: { maxDaysSurvived: 4, totalUpgradesBuilt: 2, totalExpansionsBuilt: 0 },
  timestamp: 2,
};

function expectOk(data: unknown) {
  const result = validateSave(data);
  if (!result.ok) throw new Error(`expected a valid save, got: ${result.error}`);
  return result;
}

describe('save migration', () => {
  it('migrates a v2 save to the current version, mapping the legacy tarp flag to shell-1', () => {
    const { save, warnings } = expectOk(v2Save);
    expect(save).toMatchObject({
      version: SAVE_VERSION,
      day: 3,
      timeOfDay: 'morning',
      dayPhase: 'day',
      phaseElapsedSec: 0,
      energy: 100,
      stamina: 100,
      strength: 100,
      weather: 'clear',
      travelerGender: 'male',
      unlockedUpgrades: ['shell-1'],
      lanternLit: false,
      discoveredRelics: [],
      resources,
    });
    expect(warnings).toEqual([]);
  });

  it('migrates a v3 save without losing day-loop progress', () => {
    const { save } = expectOk(v3Save);
    expect(save).toMatchObject({
      version: SAVE_VERSION,
      day: 5,
      timeOfDay: 'dusk',
      dayPhase: 'dusk',
      phaseElapsedSec: 0,
      energy: 40,
      stamina: 100,
      strength: 100,
      lanternLit: true,
      weather: 'clear',
      discoveredRelics: [],
      unlockedUpgrades: ['shell-1', 'slot-workbench'],
      stats: v3Save.stats,
    });
  });

  it('maps legacy afternoon saves to dayPhase "day" and preserves stamina/strength', () => {
    const { save } = expectOk({
      ...v3Save,
      timeOfDay: 'afternoon',
      stamina: 74,
      strength: 82,
      phaseElapsedSec: 95,
    });
    expect(save.dayPhase).toBe('day');
    expect(save.phaseElapsedSec).toBe(95);
    expect(save.stamina).toBe(74);
    expect(save.strength).toBe(82);
  });

  it('gives saves from before Food existed an empty food basket', () => {
    expect(expectOk(v2Save).save.resources).toEqual({ ...resources, food: 0 });
    expect(expectOk({ ...v3Save, resources: { ...resources, food: 4 } }).save.resources.food).toBe(4);
  });

  it('is stable when re-migrating a current save', () => {
    const { save } = expectOk({
      ...v3Save,
      version: SAVE_VERSION,
      weather: 'rain',
      discoveredRelics: ['brass-compass'],
    });
    expect(migrateSave(save)).toEqual(save);
  });

  it.each([
    ['breezy', 'wind'],
    ['storm', 'wind'],
    ['wind', 'wind'],
    ['rain', 'rain'],
    ['clear', 'clear'],
  ])('loads saved %s weather as %s', (saved, expected) => {
    const { save, warnings } = expectOk({ ...v3Save, version: SAVE_VERSION, weather: saved });
    expect(save.weather).toBe(expected);
    expect(warnings).toEqual([]);
    expect(parseSaveText(JSON.stringify({ ...v3Save, version: 3, weather: saved }))).toMatchObject({
      ok: true,
      save: { weather: expected },
    });
  });

  it('drops unknown or orphaned upgrades and relics and caps materials, reporting each clean-up', () => {
    const { save, warnings } = expectOk({
      ...v3Save,
      resources: { ...resources, stone: 999 },
      unlockedUpgrades: ['shell-2', 'slot-hearth', 'laser-turret'],
      discoveredRelics: ['faded-postcard', 'faded-postcard', 'mystery-orb'],
    });
    expect(save.unlockedUpgrades).toEqual(['slot-hearth']);
    expect(save.discoveredRelics).toEqual(['faded-postcard']);
    expect(save.resources.stone).toBe(60);
    expect(warnings).toEqual([
      'Skipped 2 invalid upgrades.',
      'Skipped 1 unknown relic.',
      'Trimmed materials above storage limits.',
    ]);
  });
});

describe('strict save validation', () => {
  const valid: SaveState = expectOk({ ...v3Save, version: SAVE_VERSION }).save;
  const json = (patch: Record<string, unknown>) => JSON.stringify({ ...valid, ...patch });

  it.each([
    ['unreadable JSON', '{ "day": 3,', /isn't readable/],
    ['a JSON array', '[]', /doesn't look like/],
    ['a missing version', json({ version: undefined }), /missing its version/],
    ['a future version', json({ version: SAVE_VERSION + 1 }), /newer version/],
    ['day 0', json({ day: 0 }), /day count/],
    ['a fractional day', json({ day: 2.5 }), /day count/],
    ['an unknown shelter', json({ chosenSite: 'moon-base' }), /shelter/],
    ['an unknown mode', json({ selectedMode: 'nightmare' }), /game mode/],
    ['an unknown traveler', json({ travelerGender: 'robot' }), /traveler/],
    ['an unknown time of day', json({ timeOfDay: 'midnight' }), /time of day/],
    ['unknown weather', json({ weather: 'meteor' }), /weather/],
    ['negative energy', json({ energy: -5 }), /energy/],
    ['negative stamina', json({ stamina: -2 }), /stamina/],
    ['negative strength', json({ strength: -1 }), /strength/],
    ['out-of-range day timer', json({ phaseElapsedSec: 999 }), /day timer/],
    ['unknown day phase', json({ dayPhase: 'midnight' }), /day phase/],
    ['a negative material', json({ resources: { ...resources, scrap: -1 } }), /“scrap”/],
    ['a fractional material', json({ resources: { ...resources, water: 1.5 } }), /“water”/],
    ['negative food', json({ resources: { ...resources, food: -3 } }), /“food”/],
    ['a missing material', json({ resources: { timber: 1 } }), /whole numbers/],
    ['a damaged upgrade list', json({ unlockedUpgrades: [1, 2] }), /upgrade list/],
    ['a damaged relic list', json({ discoveredRelics: 'postcard' }), /relic list/],
    ['damaged stats', json({ stats: { maxDaysSurvived: 'lots' } }), /milestone/],
  ])('rejects %s with a friendly message', (_label, text, message) => {
    const result = parseSaveText(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('accepts a valid current save unchanged', () => {
    expect(parseSaveText(JSON.stringify(valid))).toEqual({ ok: true, save: valid, warnings: [] });
  });
});
