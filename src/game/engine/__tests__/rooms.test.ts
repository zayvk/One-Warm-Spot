import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* In-memory storage, installed before the store module loads (it reads saves on import) */
const mem = vi.hoisted(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  });
  return m;
});

import {
  MAX_ROOM_PROPS,
  MIN_ROOM_PROPS,
  ROOMS,
  ROOM_TYPES,
  generateRoomLayout,
  getRoomProp,
  parseRoomLayout,
  roomPropWidth,
  roomSafeArea,
  type GeneratedRoomLayout,
  type RoomRng,
} from '../../data/rooms.ts';
import { BUILDING_FLOORS, findEnterableDoor } from '../../data/floors.ts';
import {
  applyFloorNightReset,
  freshTerraceState,
  loadTerraceState,
  parseTerraceState,
  saveTerraceState,
  storeRoomLayout,
  storedRoomLayout,
  validateTerraceState,
  type TerraceState,
} from '../terraceState.ts';
import { buildBackup, parseBackupText } from '../backup.ts';
import { locationForScreen, parseResumeLocation } from '../resumeLocation.ts';
import { SAVE_VERSION } from '../saveSystem.ts';
import { useGameStore } from '../../store/useGameStore.ts';
import type { SaveState } from '../../types/game.ts';

/** Small deterministic PRNG (mulberry32) */
function seeded(seed: number): RoomRng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const layoutFor = (doorId: string, seed: number) => generateRoomLayout(doorId, seeded(seed));

const save: SaveState = {
  version: SAVE_VERSION,
  day: 2,
  chosenSite: 'terrace',
  selectedMode: 'cozy',
  travelerGender: 'female',
  resources: { timber: 5, scrap: 2, cloth: 3, stone: 0, seeds: 1, water: 4, food: 2 },
  unlockedUpgrades: [],
  kitCollected: true,
  stats: { maxDaysSurvived: 1, totalUpgradesBuilt: 0, totalExpansionsBuilt: 0 },
  timestamp: 1,
};

/** A rooftop with two opened doors (each with a room) and the fuse box repaired */
function withRooms(): TerraceState {
  return {
    ...freshTerraceState(3),
    repairedSpots: ['f1-apt-1a', 'f2-room-2a', 'f3-fusebox'],
    roomLayouts: { 'f1-apt-1a': layoutFor('f1-apt-1a', 1), 'f2-room-2a': layoutFor('f2-room-2a', 2) },
  };
}

describe('room data', () => {
  it('defines four room types, each with a shell and five props', () => {
    expect(ROOM_TYPES).toEqual(['bedroom', 'kitchen', 'living', 'study']);
    for (const type of ROOM_TYPES) {
      const room = ROOMS[type];
      expect(room.shell).toBe(`/source/rooms/room-${type}-shell.webp`);
      expect(room.props).toHaveLength(5);
      expect(new Set(room.props.map((p) => p.id)).size).toBe(5);
      for (const p of room.props) {
        expect(p.src).toBe(`/source/props/rooms/prop-${type}-${p.id}.webp`);
        expect(p.label).toMatch(/^[A-Z][A-Za-z ]+$/);
        expect(p.zones.length).toBeGreaterThan(0);
      }
      expect(new Set(room.zones.map((z) => z.id)).size).toBe(room.zones.length);
    }
  });

  it('marks every apartment room door enterable — including axe-gated ones — and nothing else', () => {
    const enterable = Object.values(BUILDING_FLOORS)
      .flatMap((f) => f.hotspots)
      .filter((h) => h.enterable)
      .map((h) => h.id)
      .sort();
    expect(enterable).toEqual(
      [
        'f1-apt-1a',
        'f1-apt-1b',
        'f1-side-door',
        'f2-boarded',
        'f2-room-2a',
        'f2-door-2b',
        'f3-broken-door',
        'f3-room-3a',
        'f3-room-3b',
        'f3-door-3c',
        'f4-broken-door',
        'f4-room-4a',
        'f4-boarded',
        'f4-boarded-studio',
      ].sort(),
    );
    expect(findEnterableDoor(3, 'f3-fusebox')).toBeUndefined();
    expect(findEnterableDoor(2, 'f1-apt-1a')).toBeUndefined();
    expect(findEnterableDoor(1, 'f1-apt-1a')?.label).toBe('Apartment 1A');
  });
});

describe('generateRoomLayout', () => {
  it('builds a valid room: 3–5 unique props from its own pool, each on its own compatible zone, back to front', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const layout = layoutFor('f2-door-2b', seed);
      expect(layout.doorId).toBe('f2-door-2b');
      expect(ROOM_TYPES).toContain(layout.roomType);
      const room = ROOMS[layout.roomType];
      expect(layout.props.length).toBeGreaterThanOrEqual(MIN_ROOM_PROPS);
      expect(layout.props.length).toBeLessThanOrEqual(MAX_ROOM_PROPS);
      expect(new Set(layout.props.map((p) => p.propId)).size).toBe(layout.props.length);
      expect(new Set(layout.props.map((p) => p.zoneId)).size).toBe(layout.props.length);
      for (const [i, p] of layout.props.entries()) {
        const def = getRoomProp(layout.roomType, p.propId)!;
        const zone = room.zones.find((z) => z.id === p.zoneId)!;
        expect(def).toBeDefined();
        expect(def.zones).toContain(zone.type);
        if (zone.maxHeight !== undefined) expect(p.scale).toBeLessThanOrEqual(zone.maxHeight + 1e-9);
        if (!def.allowFlip) expect(p.flipX).toBe(false);
        /* The whole piece stays on the stage */
        const half = roomPropWidth(def, p.scale) / 2;
        expect(p.x - half).toBeGreaterThanOrEqual(0.01);
        expect(p.x + half).toBeLessThanOrEqual(0.99);
        expect(p.y - p.scale).toBeGreaterThan(0.1);
        expect(p.y).toBeLessThanOrEqual(0.99);
        if (i > 0) expect(p.y).toBeGreaterThanOrEqual(layout.props[i - 1].y);
      }
    }
  });

  it('never lets two pieces at the same depth overlap side by side', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const layout = layoutFor('f1-apt-1b', seed);
      const boxes = layout.props.map((p) => {
        const w = roomPropWidth(getRoomProp(layout.roomType, p.propId)!, p.scale);
        return { l: p.x - w / 2, r: p.x + w / 2, y: p.y, w };
      });
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          if (Math.abs(a.y - b.y) >= 0.04) continue;
          const overlap = Math.min(a.r, b.r) - Math.max(a.l, b.l);
          expect(overlap / Math.min(a.w, b.w)).toBeLessThanOrEqual(0.08 + 1e-9);
        }
      }
    }
  });

  it('varies the room type and prop count across seeds, and is deterministic per seed', () => {
    const layouts = Array.from({ length: 200 }, (_, i) => layoutFor('f3-room-3a', i + 1));
    expect(new Set(layouts.map((l) => l.roomType))).toEqual(new Set(ROOM_TYPES));
    expect(new Set(layouts.map((l) => l.props.length))).toEqual(new Set([3, 4, 5]));
    expect(layoutFor('f3-room-3a', 9)).toEqual(layoutFor('f3-room-3a', 9));
  });

  it('copes with a stuck random source', () => {
    for (const stuck of [0, 0.5, 0.9999]) {
      const layout = generateRoomLayout('f4-room-4a', () => stuck);
      expect(layout.props.length).toBeGreaterThanOrEqual(MIN_ROOM_PROPS);
      expect(new Set(layout.props.map((p) => p.zoneId)).size).toBe(layout.props.length);
    }
  });

  it('keeps every placed piece inside the room’s safe framing area', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const layout = layoutFor('f1-side-door', seed);
      const safe = roomSafeArea(layout);
      for (const p of layout.props) {
        const half = roomPropWidth(getRoomProp(layout.roomType, p.propId)!, p.scale) / 2;
        expect(safe.xMin).toBeLessThanOrEqual(p.x - half + 1e-9);
        expect(safe.xMax).toBeGreaterThanOrEqual(p.x + half - 1e-9);
        expect(safe.yMin).toBeLessThanOrEqual(p.y - p.scale + 1e-9);
        expect(safe.yMax).toBeGreaterThanOrEqual(p.y);
      }
    }
  });
});

describe('parseRoomLayout', () => {
  const good = layoutFor('f1-apt-1a', 4);
  const tweak = (fn: (l: GeneratedRoomLayout) => unknown) => parseRoomLayout(fn(structuredClone(good)), 'f1-apt-1a');

  it('accepts a generated layout and re-sorts it back to front', () => {
    expect(parseRoomLayout(good, 'f1-apt-1a')).toEqual(good);
    expect(tweak((l) => ({ ...l, props: [...l.props].reverse() }))).toEqual(good);
  });

  it('rejects unknown rooms, foreign or repeated props and zones, and bad numbers', () => {
    const other = ROOM_TYPES.find((t) => t !== good.roomType)!;
    expect(tweak((l) => ({ ...l, roomType: 'attic' }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: l.props.map((p, i) => (i === 0 ? { ...p, propId: ROOMS[other].props[0].id } : p)) }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: [l.props[0], l.props[0]] }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: l.props.map((p, i) => (i === 1 ? { ...p, zoneId: l.props[0].zoneId } : p)) }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: l.props.map((p) => ({ ...p, x: 1.4 })) }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: l.props.map((p) => ({ ...p, scale: 0 })) }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: l.props.map((p) => ({ ...p, flipX: 'yes' })) }))).toBeNull();
    expect(tweak((l) => ({ ...l, props: [] }))).toBeNull();
    expect(parseRoomLayout(null, 'x')).toBeNull();
  });
});

describe('saved room layouts', () => {
  it('round-trip in the rooftop save; older saves have none', () => {
    const state = withRooms();
    expect(parseTerraceState(JSON.stringify(state)).roomLayouts).toEqual(state.roomLayouts);
    const { roomLayouts: _omit, ...older } = state;
    expect(parseTerraceState(JSON.stringify(older)).roomLayouts).toEqual({});
  });

  it('only doors that are still open keep their room; damaged entries are dropped when loading', () => {
    const state = withRooms();
    const loaded = parseTerraceState(
      JSON.stringify({
        ...state,
        repairedSpots: ['f1-apt-1a', 'f3-fusebox'],
        roomLayouts: { ...state.roomLayouts, 'f3-fusebox': { roomType: 'attic', props: [] } },
      }),
    );
    expect(Object.keys(loaded.roomLayouts)).toEqual(['f1-apt-1a']);
  });

  it('travel inside backups, which reject a damaged room', () => {
    const state = withRooms();
    const result = parseBackupText(JSON.stringify(buildBackup(save, state)));
    expect(result.ok && result.terrace?.roomLayouts).toEqual(state.roomLayouts);
    expect(validateTerraceState({ ...state, roomLayouts: [] })).toBeNull();
    expect(validateTerraceState({ ...state, roomLayouts: { 'f1-apt-1a': { roomType: 'kitchen', props: 'sofa' } } })).toBeNull();
  });
});

describe('overnight reset', () => {
  it('wind re-locks doors and forgets their rooms; rain keeps them', () => {
    const state = withRooms();
    const windy = applyFloorNightReset(state, 'wind');
    expect(windy.state.repairedSpots).toEqual(['f3-fusebox']);
    expect(windy.state.roomLayouts).toEqual({});
    expect(windy.resetIds).toEqual(['f1-apt-1a', 'f2-room-2a']);

    const rainy = applyFloorNightReset(state, 'rain');
    expect(rainy.state.repairedSpots).toEqual(['f1-apt-1a', 'f2-room-2a']);
    expect(rainy.state.roomLayouts).toEqual(state.roomLayouts);
  });

  it('hands back the same state when nothing re-locks', () => {
    const state = withRooms();
    expect(applyFloorNightReset(state, 'clear').state).toBe(state);
  });

  describe('through sleepAtShelter', () => {
    beforeEach(() => mem.clear());
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('a windy morning clears the rooms behind re-locked doors so they regenerate fresh', () => {
      useGameStore.getState().chooseSite('terrace');
      saveTerraceState(withRooms());
      /* 0.9 rolls wind (past cozy's 50% clear and 25% rain) */
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      useGameStore.getState().sleepAtShelter();
      vi.restoreAllMocks();

      const after = loadTerraceState();
      expect(after.repairedSpots).toEqual(['f3-fusebox']);
      expect(after.roomLayouts).toEqual({});
      expect(storedRoomLayout('f1-apt-1a')).toBeNull();
    });

    it('stores a room only for an open door, and never replaces one already there', () => {
      saveTerraceState({ ...freshTerraceState(5), repairedSpots: ['f2-door-2b'] });
      const first = layoutFor('f2-door-2b', 1);
      storeRoomLayout('f2-door-2b', first);
      storeRoomLayout('f2-door-2b', layoutFor('f2-door-2b', 2));
      expect(storedRoomLayout('f2-door-2b')).toEqual(first);
      storeRoomLayout('f1-apt-1a', layoutFor('f1-apt-1a', 3));
      expect(storedRoomLayout('f1-apt-1a')).toBeNull();
    });
  });
});

describe('resuming inside a room after a refresh', () => {
  const stored = (v: unknown) => JSON.stringify(v);

  it('records the room, or the floor when no door is known', () => {
    expect(locationForScreen('room', 2, 'R', 'f2-room-2a')).toEqual({ screen: 'room', floor: 2, doorId: 'f2-room-2a' });
    expect(locationForScreen('room', 2, 'R')).toEqual({ screen: 'floor', floor: 2 });
  });

  it('resumes in the room while its door is open', () => {
    const loc = { screen: 'room', floor: 2, doorId: 'f2-room-2a' };
    expect(parseResumeLocation(stored(loc), 'terrace', (id) => id === 'f2-room-2a')).toEqual(loc);
  });

  it('falls back to the floor outside when the door re-locked, is unknown, or isn’t a room door', () => {
    const closed = () => false;
    expect(parseResumeLocation(stored({ screen: 'room', floor: 2, doorId: 'f2-room-2a' }), 'terrace', closed)).toEqual({ screen: 'floor', floor: 2 });
    for (const doorId of ['f2-cupboard', 'f1-apt-1a', 'nope', 7]) {
      expect(parseResumeLocation(stored({ screen: 'room', floor: 2, doorId }), 'terrace')).toEqual({ screen: 'floor', floor: 2 });
    }
  });

  it('needs a Terrace run and a real floor', () => {
    expect(parseResumeLocation(stored({ screen: 'room', floor: 2, doorId: 'f2-room-2a' }), 'pipe')).toEqual({ screen: 'title' });
    expect(parseResumeLocation(stored({ screen: 'room', floor: 7, doorId: 'f2-room-2a' }), 'terrace')).toEqual({ screen: 'title' });
  });
});
