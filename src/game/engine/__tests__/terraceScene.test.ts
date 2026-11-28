import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Quiet in-memory storage before the store module loads (it reads saves on import) */
vi.hoisted(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  });
});

import {
  freshTerraceState,
  isSpotFailedToday,
  loadTerraceState,
  parseTerraceState,
  resetFloorSpotsForNewDay,
  saveTerraceState,
  validateTerraceState,
  withSpotFailedToday,
} from '../terraceState.ts';
import { spendResources } from '../progression.ts';
import { findSpawnProblems, generateTerraceSpawns, regrowTerraceSpawns, seededRng } from '../terraceSpawns.ts';
import { buildBackup, parseBackupText } from '../backup.ts';
import { useGameStore } from '../../store/useGameStore.ts';
import { SAVE_VERSION } from '../saveSystem.ts';
import type { SlotAssignments } from '../buildSlots.ts';
import {
  DEFAULT_TERRACE_SPAWNS,
  TERRACE_CARDBOARD_IDS,
  TERRACE_CARDBOARD_VARIANTS,
  TERRACE_CRATE_VARIANTS,
  TERRACE_STATIONS,
  TERRACE_WEED_IDS,
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
    /* `boxes-2` was the broken crates in the hand-placed layout: now wooden crate-1, still opened */
    const legacy = JSON.stringify({ fireLit: true, searchedBoxes: ['boxes-2'], clearedWeeds: ['weeds-1'] });
    expect(parseTerraceState(legacy)).toEqual({
      fireLit: true,
      searchedBoxes: ['crate-1'],
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
      slotAssignments: { 'slot-1': null, 'slot-2': null, 'slot-3': null, 'slot-4': null },
      spawns: null,
      repairedSpots: [],
      failedTodaySpots: [],
      searchedRoomProps: [],
      failedRoomPropsToday: [],
      roomLayouts: {},
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
      /* A player-chosen layout, different from the old fixed spots */
      slotAssignments: { 'slot-1': 'grill', 'slot-2': 'rain-barrel', 'slot-3': 'sewing', 'slot-4': 'planter' } satisfies SlotAssignments,
    };
    expect(parseTerraceState(JSON.stringify(state))).toEqual(state);
    expect(validateTerraceState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('gives older rooftops without slot data their built stations back in their old spots', () => {
    const raw = JSON.stringify({ planterTier: 2, grillTier: 1, sewingTier: 0, barrelTier: 3 });
    expect(parseTerraceState(raw).slotAssignments).toEqual({
      'slot-1': 'planter',
      'slot-2': null,
      'slot-3': 'grill',
      'slot-4': 'rain-barrel',
    });
    /* Legacy one-off builds migrate to Tier 2 and take their old spots too */
    expect(parseTerraceState(JSON.stringify({ builtProps: ['herb-planter'] })).slotAssignments['slot-1']).toBe('planter');
  });

  it('keeps slot data consistent with what is actually built', () => {
    const raw = JSON.stringify({
      planterTier: 1,
      grillTier: 1,
      /* Grill sits in the farm's old spot, an unbuilt barrel claims a slot, and a duplicate/unknown slip in */
      slotAssignments: { 'slot-1': 'grill', 'slot-2': 'rain-barrel', 'slot-3': 'grill', 'slot-9': 'sewing' },
    });
    expect(parseTerraceState(raw).slotAssignments).toEqual({
      'slot-1': 'grill',
      'slot-2': 'planter',
      'slot-3': null,
      'slot-4': null,
    });
  });

  it('nudges saved props that now sit on a recomposed station, keeping the rest of the layout', () => {
    const spawns = generateTerraceSpawns(31);
    const stale = { ...spawns, 'crate-2': { ...spawns['crate-2'], x: 0.3, y: 0.58 } };
    const restored = parseTerraceState(JSON.stringify({ spawns: stale })).spawns!;
    expect(findSpawnProblems(restored)).toEqual([]);
    expect(restored['crate-2']).not.toMatchObject({ x: 0.3, y: 0.58 });
    expect(restored['weeds-1']).toEqual(spawns['weeds-1']);
  });

  it('falls back to the default layout when the saved spawns are damaged', () => {
    const spawns = generateTerraceSpawns(7);
    const missingOne = { ...spawns };
    delete missingOne['weeds-4'];
    const missingCrate = { ...spawns };
    delete missingCrate['crate-2'];
    const badVariant = { ...spawns, 'crate-1': { ...spawns['crate-1'], variant: 'weeds-1' } };
    /* A wooden crate id can't hold carton art, nor a carton id crate art */
    const crateAsCarton = { ...spawns, 'crate-1': { ...spawns['crate-1'], variant: 'cardboard-2' } };
    const cartonAsCrate = { ...spawns, 'cardboard-3': { ...spawns['crate-1'], variant: 'box-double' } };
    for (const bad of [missingOne, missingCrate, badVariant, crateAsCarton, cartonAsCrate]) {
      expect(parseTerraceState(JSON.stringify({ spawns: bad })).spawns).toBeNull();
      expect(validateTerraceState({ ...freshTerraceState(1), spawns: bad })).toBeNull();
    }
  });

  it('starts a fresh run with a newly generated layout for missing or unreadable data', () => {
    for (const raw of [null, '{oops']) {
      const state = parseTerraceState(raw);
      expect(state).toMatchObject({ firepitTier: 1, shelterTier: 1, grillTier: 0, searchedBoxes: [], fireLit: false });
      const ids = Object.keys(state.spawns ?? {});
      expect(ids).toEqual(expect.arrayContaining(['crate-1', 'crate-2', 'weeds-1', 'weeds-6']));
      expect(ids.length).toBeGreaterThanOrEqual(9);
      expect(ids.length).toBeLessThanOrEqual(10);
    }
  });
});

describe('wooden crates vs. cardboard cartons', () => {
  it('a searched wooden crate stays on the roof (opened) through save, reload and backups', () => {
    const state = { ...freshTerraceState(42), searchedBoxes: ['crate-2'] };
    const reloaded = parseTerraceState(JSON.stringify(state));
    expect(reloaded.searchedBoxes).toEqual(['crate-2']);
    expect(reloaded.spawns!['crate-2']).toEqual(state.spawns!['crate-2']);
    expect(validateTerraceState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('a searched carton is simply gone: its spawn is cleared and its floor is free again', () => {
    const fresh = freshTerraceState(42);
    const carton = TERRACE_CARDBOARD_IDS.find((id) => fresh.spawns![id])!;
    /* e.g. a rooftop saved mid-search, still listing the carton as searched */
    const raw = JSON.stringify({ ...fresh, searchedBoxes: [carton, 'crate-1'] });
    const state = parseTerraceState(raw);
    expect(state.spawns![carton]).toBeUndefined();
    expect(state.searchedBoxes).toEqual(['crate-1']);
    expect(findSpawnProblems(state.spawns!)).toEqual([]);

    /* With its spawn gone, the next windy morning can land a fresh carton right back in that id */
    const blown = regrowTerraceSpawns(state, 'wind', seededRng(5));
    expect(blown.refreshedBoxes).toContain(carton);
    expect(findSpawnProblems(blown.state.spawns!)).toEqual([]);
  });

  it('migrates layouts saved before crates & cartons split, following each box by its art', () => {
    const fresh = generateTerraceSpawns(9);
    /* An older generated layout: three `boxes-*` ids with shuffled art, the parcel opened, broken crates opened */
    const legacySpawns: Record<string, unknown> = {};
    for (const id of TERRACE_WEED_IDS) legacySpawns[id] = fresh[id];
    legacySpawns['boxes-1'] = { ...fresh['crate-2'] };
    legacySpawns['boxes-2'] = { ...DEFAULT_TERRACE_SPAWNS['cardboard-1'] };
    legacySpawns['boxes-3'] = { ...fresh['crate-1'] };
    const raw = { fireLit: false, spawns: legacySpawns, searchedBoxes: ['boxes-2', 'boxes-3'], clearedWeeds: [] };

    for (const state of [parseTerraceState(JSON.stringify(raw)), validateTerraceState(raw)!]) {
      expect(state.spawns!['crate-1']).toMatchObject({ variant: fresh['crate-2'].variant, x: fresh['crate-2'].x });
      expect(state.spawns!['crate-2']).toMatchObject({ variant: fresh['crate-1'].variant, x: fresh['crate-1'].x });
      /* The opened parcel became a carton that's already been carried off */
      expect(TERRACE_CARDBOARD_IDS.filter((id) => state.spawns![id])).toEqual([]);
      /* boxes-3 (now crate-2) stays opened on the roof */
      expect(state.searchedBoxes).toEqual(['crate-2']);
      expect(Object.keys(state.spawns!).some((id) => id.startsWith('boxes-'))).toBe(false);
    }
  });

  it('older hand-placed rooftops whose parcel was searched lose just that parcel', () => {
    const state = parseTerraceState(JSON.stringify({ searchedBoxes: ['boxes-1', 'boxes-3'] }));
    const expected: Record<string, unknown> = { ...DEFAULT_TERRACE_SPAWNS };
    delete expected['cardboard-1'];
    expect(state.spawns).toEqual(expected);
    expect(state.searchedBoxes).toEqual(['crate-2']);
    /* Even older saves only knew "the boxes were searched" */
    expect(parseTerraceState(JSON.stringify({ boxesSearched: true })).spawns!['cardboard-1']).toBeUndefined();
  });
});

describe('Terrace balance', () => {
  /* Worst case: the two wooden crates, the leanest single carton and each weed variant twice */
  const rooftopYield: Partial<Record<string, number>> = {};
  for (const v of [
    ...Object.values(TERRACE_CRATE_VARIANTS),
    TERRACE_CARDBOARD_VARIANTS['cardboard-1'],
    ...Object.values(TERRACE_WEED_VARIANTS),
    ...Object.values(TERRACE_WEED_VARIANTS),
  ]) {
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

describe('downstairs floor spot resets & failedTodaySpots', () => {
  const sampleRepaired = [
    'f3-fusebox',
    'f1-apt-1a',
    'f2-room-2a',
    'f2-cupboard',
    'f3-locker',
    'f4-trunk',
  ];

  it('clears daily containers on Clear while keeping wiring and wind-blown doors fixed', () => {
    expect(resetFloorSpotsForNewDay(sampleRepaired, 'clear')).toEqual([
      'f3-fusebox',
      'f1-apt-1a',
      'f2-room-2a',
    ]);
  });

  it('shorts out rain-reset electrical spots in Rain while keeping wind-only doors open', () => {
    expect(resetFloorSpotsForNewDay(sampleRepaired, 'rain')).toEqual([
      'f1-apt-1a',
      'f2-room-2a',
    ]);
  });

  it('slams wind-reset doors shut in Wind while keeping the fuse box repaired', () => {
    expect(resetFloorSpotsForNewDay(sampleRepaired, 'wind')).toEqual([
      'f3-fusebox',
    ]);
  });

  it('persists failedTodaySpots, migrates older saves to [], and validates strictly in backups', () => {
    const fresh = freshTerraceState(10);
    expect(fresh.failedTodaySpots).toEqual([]);
    expect(isSpotFailedToday(fresh, 'f1-apt-1a')).toBe(false);

    const failed = withSpotFailedToday(fresh, 'f1-apt-1a');
    expect(isSpotFailedToday(failed, 'f1-apt-1a')).toBe(true);
    expect(withSpotFailedToday(failed, 'f1-apt-1a')).toBe(failed);

    expect(parseTerraceState(JSON.stringify(failed)).failedTodaySpots).toEqual(['f1-apt-1a']);
    const { failedTodaySpots: _omit, ...older } = failed;
    expect(parseTerraceState(JSON.stringify(older)).failedTodaySpots).toEqual([]);

    const save = {
      version: SAVE_VERSION,
      day: 2,
      chosenSite: 'terrace' as const,
      selectedMode: 'cozy' as const,
      travelerGender: 'female' as const,
      resources: { timber: 5, scrap: 2, cloth: 3, stone: 1, seeds: 1, water: 4, food: 1 },
      unlockedUpgrades: [],
      kitCollected: true,
      stats: { maxDaysSurvived: 1, totalUpgradesBuilt: 0, totalExpansionsBuilt: 0 },
      timestamp: 1,
    };
    const roundTrip = parseBackupText(JSON.stringify(buildBackup(save, failed)));
    expect(roundTrip.ok && roundTrip.terrace?.failedTodaySpots).toEqual(['f1-apt-1a']);

    expect(validateTerraceState({ ...failed, failedTodaySpots: 'f1-apt-1a' })).toBeNull();
    expect(validateTerraceState({ ...failed, failedTodaySpots: ['f1-apt-1a', 42] })).toBeNull();
  });

  describe('sleepAtShelter overnight reset integration', () => {
    const mem = new Map<string, string>();
    const storageMock = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
      clear: () => { mem.clear(); },
    };

    beforeEach(() => {
      mem.clear();
      vi.stubGlobal('localStorage', storageMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('clears failedTodaySpots and applies weather resets on Day N+1 morning', () => {
      useGameStore.getState().chooseSite('terrace');
      const seeded = {
        ...freshTerraceState(12),
        repairedSpots: ['f3-fusebox', 'f1-apt-1a', 'f2-cupboard'],
        failedTodaySpots: ['f3-locker', 'f4-trunk'],
      };
      saveTerraceState(seeded);

      /* Force weather roll deterministically to rain (0.60 > cozy 50 clear, <= 75 rain) */
      const randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.6);
      useGameStore.getState().sleepAtShelter();
      randSpy.mockRestore();

      const after = loadTerraceState();
      expect(after.failedTodaySpots).toEqual([]);
      expect(after.repairedSpots).toEqual(['f1-apt-1a']);
      const latestNotice = useGameStore.getState().notices.at(-1);
      expect(latestNotice?.body).toContain('Rain shorted out downstairs wiring.');
    });
  });
});
