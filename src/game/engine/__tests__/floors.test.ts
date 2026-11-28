import { describe, expect, it } from 'vitest';
import {
  BUILDING_FLOORS,
  BUILDING_FLOOR_ORDER,
  ELEVATOR_STOPS,
  floorBackdrop,
  floorCaption,
  liftRideTimeline,
  liftTickSequence,
  type BuildingFloorId,
  type DownstairsFloorId,
} from '../../data/floors.ts';
import { CUTSCENE_ASSETS, SCENE_STAGES } from '../../data/media.ts';

const STOPS = BUILDING_FLOOR_ORDER;
const PAIRS = STOPS.flatMap((from) => STOPS.filter((to) => to !== from).map((to) => [from, to] as const));

describe('liftTickSequence', () => {
  it.each([
    ['R', 3, ['R', 4, 3]],
    [3, 1, [3, 2, 1]],
    [2, 'R', [2, 3, 4, 'R']],
    [1, 2, [1, 2]],
    [4, 3, [4, 3]],
    [1, 'R', [1, 2, 3, 4, 'R']],
    ['R', 1, ['R', 4, 3, 2, 1]],
  ] as const)('%s → %s ticks %j', (from, to, expected) => {
    expect(liftTickSequence(from, to)).toEqual(expected);
  });

  it('starts at the origin, ends at the destination and moves one floor at a time', () => {
    for (const [from, to] of PAIRS) {
      const seq = liftTickSequence(from, to);
      expect(seq[0]).toBe(from);
      expect(seq.at(-1)).toBe(to);
      for (let i = 1; i < seq.length; i++) {
        expect(Math.abs(STOPS.indexOf(seq[i]) - STOPS.indexOf(seq[i - 1]))).toBe(1);
      }
    }
  });
});

describe('liftRideTimeline', () => {
  it('scales the ride by distance: ~2.8s for one floor, ~4.5s for four', () => {
    expect(liftRideTimeline(3, 2).total).toBe(2800);
    expect(liftRideTimeline('R', 4).total).toBe(2800);
    expect(liftRideTimeline(1, 'R').total).toBe(4500);
    expect(liftRideTimeline('R', 1).total).toBe(4500);
    expect(liftRideTimeline(1, 3).total).toBeGreaterThan(liftRideTimeline(1, 2).total);
    expect(liftRideTimeline(1, 3).total).toBeLessThan(liftRideTimeline(1, 4).total);
  });

  it('starts on the rooftop by stepping into the lift, and on a floor by pushing in toward it', () => {
    expect(liftRideTimeline('R', 2).intro).toBe('step-in');
    expect(liftRideTimeline(2, 'R').intro).toBe('push');
    expect(liftRideTimeline(4, 1).intro).toBe('push');
  });

  it('keeps every beat in order for every pair of stops', () => {
    for (const [from, to] of PAIRS) {
      const t = liftRideTimeline(from, to);
      const label = `${from} → ${to}`;
      expect(t.ticks.map((x) => x.floor), label).toEqual(liftTickSequence(from, to).slice(1));
      expect(t.floors).toBe(t.ticks.length);
      let last = t.rideStart;
      for (const tick of t.ticks) {
        expect(tick.at, label).toBeGreaterThan(last);
        last = tick.at;
      }
      expect(last, label).toBeLessThan(t.arrive);
      expect(t.swapBehind, label).toBeGreaterThan(t.intro === 'step-in' ? t.doorsClose + 800 : t.liftIn);
      expect(t.swapBehind, label).toBeLessThan(t.arrive);
      expect(t.arrive).toBeLessThan(t.doorsOpen);
      expect(t.doorsOpen).toBeLessThan(t.caption);
      expect(t.caption).toBeLessThan(t.stepOut);
      expect(t.stepOut).toBeLessThan(t.total);
    }
  });
});

describe('building floor config', () => {
  const floors = Object.values(BUILDING_FLOORS);
  const expectedIds: Record<DownstairsFloorId, string[]> = {
    1: ['f1-apt-1a', 'lift', 'f1-apt-1b', 'f1-side-door'],
    2: ['f2-cupboard', 'f2-boarded', 'lift', 'f2-room-2a', 'f2-door-2b'],
    3: ['f3-broken-door', 'f3-room-3a', 'lift', 'f3-room-3b', 'f3-fusebox', 'f3-door-3c', 'f3-locker'],
    4: ['f4-broken-door', 'f4-room-4a', 'lift', 'f4-boarded', 'f4-boarded-studio', 'f4-trunk', 'f4-bookshelf'],
  };

  it('defines floors 1–4, each with its own painting and the expected hotspots', () => {
    expect(floors.map((f) => f.id)).toEqual([1, 2, 3, 4]);
    expect(new Set(floors.map((f) => f.backdrop)).size).toBe(4);
    expect(floors.map((f) => f.backdrop)).toEqual([
      CUTSCENE_ASSETS.terraceLobby,
      CUTSCENE_ASSETS.terraceFloor2,
      CUTSCENE_ASSETS.terraceFloor3,
      CUTSCENE_ASSETS.terraceFloor4,
    ]);
    for (const floor of floors) {
      expect(floor.hotspots.map((h) => h.id), `floor ${floor.id}`).toEqual(expectedIds[floor.id]);
    }
  });

  it('gives every floor exactly one lift and keeps every hotspot on the painting', () => {
    for (const floor of floors) {
      expect(floor.hotspots.filter((h) => h.kind === 'lift')).toHaveLength(1);
      for (const { id, rect } of floor.hotspots) {
        expect(rect.width, id).toBeGreaterThan(0);
        expect(rect.height, id).toBeGreaterThan(0);
        expect(rect.left, id).toBeGreaterThanOrEqual(0);
        expect(rect.top, id).toBeGreaterThanOrEqual(0);
        expect(rect.left + rect.width, id).toBeLessThanOrEqual(100);
        expect(rect.top + rect.height, id).toBeLessThanOrEqual(100);
      }
    }
  });

  it('only the Floor 3 fuse box sparks', () => {
    const sparking = floors.flatMap((f) => f.hotspots.filter((h) => h.hasSparks).map((h) => h.id));
    expect(sparking).toEqual(['f3-fusebox']);
  });

  it('wires Connect the Wires, Tic-Tac-Toe, and Dots & Lines with rewards and reset rules across Floors 1–4', () => {
    const scavenge = floors.flatMap((f) => f.hotspots.filter((h) => h.kind === 'scavenge'));
    const byId = Object.fromEntries(scavenge.map((h) => [h.id, h]));

    expect(byId['f3-fusebox']).toMatchObject({ puzzle: 'connect-wires', resetRule: 'rain', reward: { scrap: 3 } });
    expect(byId['f1-apt-1a']).toMatchObject({ puzzle: 'tic-tac-toe', resetRule: 'wind', reward: { timber: 2, cloth: 1 } });
    expect(byId['f3-locker']).toMatchObject({ puzzle: 'tic-tac-toe', resetRule: 'daily', reward: { scrap: 2, stone: 1 } });
    expect(byId['f2-cupboard']).toMatchObject({ puzzle: 'dots-and-lines', resetRule: 'daily', reward: { cloth: 2, seeds: 1 } });
    expect(byId['f4-trunk']).toMatchObject({ puzzle: 'dots-and-lines', resetRule: 'daily', reward: { cloth: 2, food: 1 } });
    expect(byId['f4-bookshelf'].puzzle).toBeUndefined();
  });

  it('gates boarded doors behind the future axe while preserving their puzzle metadata', () => {
    const byId = Object.fromEntries(floors.flatMap((f) => f.hotspots).map((h) => [h.id, h]));
    expect(byId['f2-boarded']).toMatchObject({
      requiresTool: 'axe',
      resetRule: 'wind',
      puzzle: 'tic-tac-toe',
      reward: { timber: 2, scrap: 1 },
    });
    expect(byId['f4-boarded']).toMatchObject({
      requiresTool: 'axe',
      resetRule: 'wind',
      puzzle: 'tic-tac-toe',
      reward: { timber: 2, scrap: 1 },
    });
    expect(byId['f4-boarded-studio']).toMatchObject({
      requiresTool: 'axe',
      resetRule: 'wind',
      puzzle: 'tic-tac-toe',
      reward: { timber: 2, cloth: 2 },
    });
  });

  it('offers every stop on the elevator panel, top to bottom, with matching floor captions', () => {
    expect(ELEVATOR_STOPS.map((s) => s.id)).toEqual(['R', 4, 3, 2, 1]);
    expect(floorBackdrop('R')).toBe(SCENE_STAGES.terrace);
    const captions = (['R', 1, 2, 3, 4] as BuildingFloorId[]).map((f) => floorCaption(f, 'Old Apartment Terrace'));
    expect(captions).toEqual([
      'Old Apartment Terrace',
      'Ground Floor · Lobby',
      'Floor 2 · Residential Hallway',
      'Floor 3 · Utility Corridor',
      'Floor 4 · Skylight Landing',
    ]);
    expect(ELEVATOR_STOPS.map((s) => s.label)).toEqual([
      'Rooftop Terrace',
      floorCaption(4),
      floorCaption(3),
      floorCaption(2),
      floorCaption(1),
    ]);
  });
});
