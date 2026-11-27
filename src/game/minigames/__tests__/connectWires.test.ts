import { describe, expect, it } from 'vitest';
import {
  WIRE_SPECS,
  countConnected,
  createWireState,
  isWireBoxFixed,
  straightAcross,
  tryConnectWire,
  wireCount,
  type WireState,
} from '../connectWires.ts';
import type { Rng } from '../ticTacToe.ts';
import {
  freshTerraceState,
  isSpotRepaired,
  parseTerraceState,
  validateTerraceState,
  withSpotRepaired,
} from '../../engine/terraceState.ts';
import { buildBackup, parseBackupText } from '../../engine/backup.ts';
import { SAVE_VERSION } from '../../engine/saveSystem.ts';
import { BUILDING_FLOORS } from '../../data/floors.ts';
import type { GameMode, SaveState } from '../../types/game.ts';

/** Small deterministic PRNG (mulberry32) */
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

/** Connects every wire in left-terminal order */
function solve(state: WireState): WireState {
  return state.left.reduce((s, id, i) => tryConnectWire(s, i, s.right.indexOf(id)).state, state);
}

describe('createWireState', () => {
  it.each<[GameMode, number]>([
    ['cozy', 4],
    ['challenge', 6],
  ])('%s: %i colour + symbol coded wires on both strips', (mode, n) => {
    expect(wireCount(mode)).toBe(n);
    for (let seed = 1; seed <= 100; seed++) {
      const s = createWireState(mode, seeded(seed));
      expect(s.left).toHaveLength(n);
      expect([...s.right].sort()).toEqual([...s.left].sort());
      expect(new Set(s.left).size).toBe(n);
      expect(s.connected).toEqual([]);
      expect(isWireBoxFixed(s)).toBe(false);
    }
  });

  it('Cozy uses terracotta, sage, ochre & slate; Challenge adds plum & teal — every symbol distinct', () => {
    expect(new Set(createWireState('cozy', seeded(1)).left)).toEqual(new Set(['terracotta', 'sage', 'ochre', 'slate']));
    expect(new Set(createWireState('challenge', seeded(1)).left)).toEqual(
      new Set(['terracotta', 'sage', 'ochre', 'slate', 'plum', 'teal']),
    );
    expect(new Set(WIRE_SPECS.map((w) => w.symbol)).size).toBe(WIRE_SPECS.length);
  });

  it.each<GameMode>(['cozy', 'challenge'])('%s: no wire ever runs straight across', (mode) => {
    for (let seed = 1; seed <= 300; seed++) {
      expect(straightAcross(createWireState(mode, seeded(seed)))).toBe(0);
    }
  });

  it('still deranges the terminals with a stuck random source', () => {
    for (const stuck of [0, 0.5, 0.9999]) {
      const s = createWireState('challenge', () => stuck);
      expect(straightAcross(s)).toBe(0);
      expect([...s.right].sort()).toEqual([...s.left].sort());
    }
  });

  it('shuffles differently across seeds and is deterministic per seed', () => {
    const layouts = new Set(Array.from({ length: 40 }, (_, i) => createWireState('cozy', seeded(i + 1)).right.join()));
    expect(layouts.size).toBeGreaterThan(5);
    expect(createWireState('challenge', seeded(7))).toEqual(createWireState('challenge', seeded(7)));
  });
});

describe('tryConnectWire', () => {
  it('locks a matching pair without mutating the old state', () => {
    const s = createWireState('cozy', seeded(3));
    const j = s.right.indexOf(s.left[0]);
    const r = tryConnectWire(s, 0, j);
    expect(r.matched).toBe(true);
    expect(r.state.connected).toEqual([s.left[0]]);
    expect(countConnected(r.state)).toBe(1);
    expect(s.connected).toEqual([]);
  });

  it('leaves the state untouched for a mismatch, a repeat or out-of-range terminals', () => {
    const s = createWireState('challenge', seeded(4));
    const wrong = s.right.findIndex((id) => id !== s.left[0]);
    expect(tryConnectWire(s, 0, wrong)).toEqual({ state: s, matched: false });
    const once = tryConnectWire(s, 0, s.right.indexOf(s.left[0])).state;
    expect(tryConnectWire(once, 0, s.right.indexOf(s.left[0]))).toEqual({ state: once, matched: false });
    expect(tryConnectWire(s, -1, 0).matched).toBe(false);
    expect(tryConnectWire(s, 0, 99).matched).toBe(false);
    expect(tryConnectWire(s, 6, 0).matched).toBe(false);
  });

  it.each<GameMode>(['cozy', 'challenge'])('%s: the box is fixed only once every wire is joined', (mode) => {
    const s = createWireState(mode, seeded(11));
    let cur = s;
    s.left.forEach((id, i) => {
      expect(isWireBoxFixed(cur)).toBe(false);
      cur = tryConnectWire(cur, i, cur.right.indexOf(id)).state;
      expect(countConnected(cur)).toBe(i + 1);
    });
    expect(isWireBoxFixed(cur)).toBe(true);
    expect(solve(s)).toEqual(cur);
  });
});

describe('repaired downstairs spots', () => {
  const save: SaveState = {
    version: SAVE_VERSION,
    day: 2,
    chosenSite: 'terrace',
    selectedMode: 'cozy',
    travelerGender: 'male',
    resources: { timber: 5, scrap: 2, cloth: 3, stone: 0, seeds: 1, water: 4, food: 2 },
    unlockedUpgrades: [],
    kitCollected: true,
    stats: { maxDaysSurvived: 1, totalUpgradesBuilt: 0, totalExpansionsBuilt: 0 },
    timestamp: 1,
  };

  it('Floor 3’s fuse box is a live Connect the Wires puzzle paying 3 scrap', () => {
    const fusebox = BUILDING_FLOORS[3].hotspots.find((h) => h.id === 'f3-fusebox');
    expect(fusebox?.hasSparks).toBe(true);
    expect(fusebox).toMatchObject({
      puzzle: 'connect-wires',
      resetRule: 'rain',
      reward: { scrap: 3 },
      repairedLabel: 'Repaired Fuse Box',
    });
  });

  it('a fresh run has nothing repaired; marking a spot is immutable and idempotent', () => {
    const fresh = freshTerraceState(5);
    expect(fresh.repairedSpots).toEqual([]);
    expect(isSpotRepaired(fresh, 'f3-fusebox')).toBe(false);
    const fixed = withSpotRepaired(fresh, 'f3-fusebox');
    expect(isSpotRepaired(fixed, 'f3-fusebox')).toBe(true);
    expect(fresh.repairedSpots).toEqual([]);
    expect(withSpotRepaired(fixed, 'f3-fusebox')).toBe(fixed);
    expect(isSpotRepaired(null, 'f3-fusebox')).toBe(false);
  });

  it('survives a save round-trip; older saves load with nothing repaired', () => {
    const fixed = withSpotRepaired(freshTerraceState(6), 'f3-fusebox');
    expect(parseTerraceState(JSON.stringify(fixed)).repairedSpots).toEqual(['f3-fusebox']);
    const { repairedSpots: _omit, ...older } = fixed;
    expect(parseTerraceState(JSON.stringify(older)).repairedSpots).toEqual([]);
    // Lenient loading drops junk entries and duplicates
    expect(parseTerraceState(JSON.stringify({ ...fixed, repairedSpots: ['f3-fusebox', 7, 'f3-fusebox'] })).repairedSpots).toEqual([
      'f3-fusebox',
    ]);
  });

  it('backups carry repaired spots, accept older rooftops and reject a damaged list', () => {
    const fixed = withSpotRepaired(freshTerraceState(8), 'f3-fusebox');
    const result = parseBackupText(JSON.stringify(buildBackup(save, fixed)));
    expect(result.ok && result.terrace?.repairedSpots).toEqual(['f3-fusebox']);

    const { repairedSpots: _omit, ...older } = fixed;
    const legacy = parseBackupText(JSON.stringify({ ...save, terraceState: older }));
    expect(legacy.ok && legacy.terrace?.repairedSpots).toEqual([]);

    expect(validateTerraceState({ ...fixed, repairedSpots: 'f3-fusebox' })).toBeNull();
    expect(validateTerraceState({ ...fixed, repairedSpots: ['f3-fusebox', 3] })).toBeNull();
    expect(parseBackupText(JSON.stringify({ ...save, terraceState: { ...fixed, repairedSpots: [null] } })).ok).toBe(false);
  });
});
