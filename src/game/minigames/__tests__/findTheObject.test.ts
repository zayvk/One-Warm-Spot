import { describe, expect, it } from 'vitest';
import {
  NUDGE_DISTANCE,
  RUMMAGE_ITEMS,
  TRAY_ASPECT,
  TRAY_BOUNDS,
  collectTargetItem,
  countFound,
  createRummageState,
  getNextHintTargetId,
  getRummageItem,
  isRummageComplete,
  movePileItem,
  nudgeClutterItem,
  type PileItem,
  type RummageState,
} from '../findTheObject.ts';
import type { Rng } from '../ticTacToe.ts';
import type { GameMode } from '../../types/game.ts';

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

const inBounds = (it: PileItem) =>
  it.x >= TRAY_BOUNDS.minX && it.x <= TRAY_BOUNDS.maxX && it.y >= TRAY_BOUNDS.minY && it.y <= TRAY_BOUNDS.maxY;

const targets = (s: RummageState) => s.items.filter((it) => it.isTarget);
const clutter = (s: RummageState) => s.items.filter((it) => !it.isTarget);
const maxZ = (s: RummageState) => Math.max(...s.items.map((it) => it.zIndex));
const get = (s: RummageState, id: string) => s.items.find((it) => it.instanceId === id)!;

/** A clutter piece that isn't already on top of the pile */
function buriedClutter(s: RummageState): PileItem {
  return clutter(s).find((it) => it.zIndex < maxZ(s))!;
}

/** Do two items' bounding circles overlap? (in tray heights) */
function overlaps(a: PileItem, b: PileItem): boolean {
  const ra = Math.max(getRummageItem(a.itemId).width, getRummageItem(a.itemId).height) / 2;
  const rb = Math.max(getRummageItem(b.itemId).width, getRummageItem(b.itemId).height) / 2;
  return Math.hypot((a.x - b.x) * TRAY_ASPECT, a.y - b.y) < ra + rb;
}

describe('rummage catalog', () => {
  it('has 18 distinct, sensibly sized salvage items', () => {
    expect(RUMMAGE_ITEMS).toHaveLength(18);
    expect(new Set(RUMMAGE_ITEMS.map((it) => it.id)).size).toBe(18);
    expect(new Set(RUMMAGE_ITEMS.map((it) => it.name)).size).toBe(18);
    for (const it of RUMMAGE_ITEMS) {
      expect(it.width).toBeGreaterThan(0.05);
      expect(it.width).toBeLessThan(0.35);
      expect(it.height).toBeGreaterThan(0.05);
      expect(it.height).toBeLessThan(0.35);
    }
  });
});

describe('createRummageState', () => {
  it.each<[GameMode, number, number]>([
    ['cozy', 3, 16],
    ['challenge', 5, 35],
  ])('%s: %i targets in a pile of %i', (mode, nTargets, nTotal) => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = createRummageState(mode, seeded(seed));
      expect(s.mode).toBe(mode);
      expect(s.items).toHaveLength(nTotal);
      expect(targets(s)).toHaveLength(nTargets);
      expect(s.targetIds).toHaveLength(nTargets);
      expect(s.targetIds).toEqual(targets(s).map((t) => t.instanceId));
      expect(new Set(s.items.map((it) => it.instanceId)).size).toBe(nTotal);
      expect(s.items.every((it) => !it.found)).toBe(true);
    }
  });

  it.each<GameMode>(['cozy', 'challenge'])('%s: targets are unique and never appear as clutter', (mode) => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createRummageState(mode, seeded(seed));
      const targetKinds = targets(s).map((t) => t.itemId);
      expect(new Set(targetKinds).size).toBe(targetKinds.length);
      for (const c of clutter(s)) expect(targetKinds).not.toContain(c.itemId);
    }
  });

  it.each<GameMode>(['cozy', 'challenge'])('%s: every item lands inside the safe tray band with a distinct layer', (mode) => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = createRummageState(mode, seeded(seed));
      for (const it of s.items) {
        expect(inBounds(it)).toBe(true);
        expect(Number.isFinite(it.rotation)).toBe(true);
      }
      expect(new Set(s.items.map((it) => it.zIndex)).size).toBe(s.items.length);
    }
  });

  it('Cozy uses all-different clutter; Challenge repeats clutter kinds only when it must', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const cozy = createRummageState('cozy', seeded(seed));
      expect(new Set(clutter(cozy).map((c) => c.itemId)).size).toBe(13);
      const challenge = createRummageState('challenge', seeded(seed));
      expect(new Set(clutter(challenge).map((c) => c.itemId)).size).toBe(13);
    }
  });

  it('buries targets under overlapping clutter — deeper and more tilted in Challenge', () => {
    const stats = (mode: GameMode) => {
      let covers = 0;
      let tilt = 0;
      let n = 0;
      for (let seed = 1; seed <= 150; seed++) {
        const s = createRummageState(mode, seeded(seed));
        for (const t of targets(s)) {
          const over = clutter(s).filter((c) => c.zIndex > t.zIndex && overlaps(t, c));
          expect(over.length).toBeGreaterThanOrEqual(1);
          covers += over.length;
          n++;
        }
        tilt += clutter(s).reduce((sum, c) => sum + Math.abs(c.rotation), 0) / clutter(s).length;
      }
      return { covers: covers / n, tilt: tilt / 150 };
    };
    const cozy = stats('cozy');
    const challenge = stats('challenge');
    expect(challenge.covers).toBeGreaterThan(cozy.covers);
    expect(challenge.covers).toBeGreaterThanOrEqual(3);
    expect(challenge.tilt).toBeGreaterThan(cozy.tilt * 1.5);
  });

  it('places targets in the lower layers', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = createRummageState('challenge', seeded(seed));
      const topTarget = Math.max(...targets(s).map((t) => t.zIndex));
      expect(clutter(s).filter((c) => c.zIndex > topTarget).length).toBeGreaterThan(25);
    }
  });

  it('is deterministic for a seed', () => {
    expect(createRummageState('challenge', seeded(9))).toEqual(createRummageState('challenge', seeded(9)));
    expect(createRummageState('cozy', seeded(1))).not.toEqual(createRummageState('cozy', seeded(2)));
  });
});

describe('moving clutter', () => {
  it('movePileItem moves clutter, lifts it above the pile and leaves the old state alone', () => {
    const s = createRummageState('cozy', seeded(3));
    const item = buriedClutter(s);
    const next = movePileItem(s, item.instanceId, 0.5, 0.5);
    const moved = get(next, item.instanceId);
    expect(moved).toMatchObject({ x: 0.5, y: 0.5 });
    expect(moved.zIndex).toBe(maxZ(s) + 1);
    expect(get(s, item.instanceId)).toEqual(item);
    // Lifting again while already on top doesn't keep climbing
    expect(get(movePileItem(next, item.instanceId, 0.6, 0.6), item.instanceId).zIndex).toBe(moved.zIndex);
  });

  it('movePileItem clamps inside the tray', () => {
    const s = createRummageState('challenge', seeded(4));
    const id = clutter(s)[0].instanceId;
    expect(get(movePileItem(s, id, -3, 9), id)).toMatchObject({ x: TRAY_BOUNDS.minX, y: TRAY_BOUNDS.maxY });
    expect(get(movePileItem(s, id, 5, -1), id)).toMatchObject({ x: TRAY_BOUNDS.maxX, y: TRAY_BOUNDS.minY });
  });

  it('movePileItem ignores targets, unknown ids and bad coordinates', () => {
    const s = createRummageState('cozy', seeded(5));
    expect(movePileItem(s, s.targetIds[0], 0.5, 0.5)).toBe(s);
    expect(movePileItem(s, 'nope-1', 0.5, 0.5)).toBe(s);
    expect(movePileItem(s, clutter(s)[0].instanceId, Number.NaN, 0.5)).toBe(s);
  });

  it('nudgeClutterItem scoots clutter toward its nearest open edge, inside the tray and on top', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = createRummageState(seed % 2 ? 'cozy' : 'challenge', seeded(seed));
      for (const item of clutter(s).slice(0, 6)) {
        const next = nudgeClutterItem(s, item.instanceId, seeded(seed * 7));
        const moved = get(next, item.instanceId);
        expect(inBounds(moved)).toBe(true);
        expect(moved.zIndex).toBeGreaterThanOrEqual(maxZ(s));
        const travelled = Math.hypot((moved.x - item.x) * TRAY_ASPECT, moved.y - item.y);
        expect(travelled).toBeGreaterThan(0.015);
        expect(travelled).toBeLessThanOrEqual(NUDGE_DISTANCE + 0.05);
      }
    }
  });

  it('nudges a piece near the left wall further left, and one pinned in a corner back out', () => {
    const s = createRummageState('cozy', seeded(6));
    const id = buriedClutter(s).instanceId;
    const nearLeft = movePileItem(s, id, 0.2, 0.5);
    expect(get(nudgeClutterItem(nearLeft, id, () => 0.5), id).x).toBeLessThan(0.2);
    const corner = movePileItem(s, id, TRAY_BOUNDS.minX, TRAY_BOUNDS.minY);
    const out = get(nudgeClutterItem(corner, id, () => 0.5), id);
    expect(out.x > TRAY_BOUNDS.minX || out.y > TRAY_BOUNDS.minY).toBe(true);
    expect(inBounds(out)).toBe(true);
  });

  it('nudgeClutterItem ignores targets and unknown ids', () => {
    const s = createRummageState('cozy', seeded(7));
    expect(nudgeClutterItem(s, s.targetIds[1])).toBe(s);
    expect(nudgeClutterItem(s, 'ghost-0')).toBe(s);
  });
});

describe('collecting targets', () => {
  it('rejects clutter, unknown ids and already-found targets without changing the state', () => {
    const s = createRummageState('cozy', seeded(8));
    expect(collectTargetItem(s, clutter(s)[0].instanceId)).toEqual({ state: s, collected: false, complete: false });
    expect(collectTargetItem(s, 'ghost-0')).toEqual({ state: s, collected: false, complete: false });
    const once = collectTargetItem(s, s.targetIds[0]);
    expect(once.collected).toBe(true);
    expect(get(once.state, s.targetIds[0]).found).toBe(true);
    expect(get(s, s.targetIds[0]).found).toBe(false);
    const twice = collectTargetItem(once.state, s.targetIds[0]);
    expect(twice.collected).toBe(false);
    expect(twice.state).toBe(once.state);
  });

  it.each<GameMode>(['cozy', 'challenge'])('%s: collecting every target completes the pile, in any order', (mode) => {
    const s = createRummageState(mode, seeded(10));
    let cur = s;
    const order = [...s.targetIds].reverse();
    order.forEach((id, i) => {
      expect(isRummageComplete(cur)).toBe(false);
      const r = collectTargetItem(cur, id);
      expect(r.collected).toBe(true);
      expect(r.complete).toBe(i === order.length - 1);
      cur = r.state;
      expect(countFound(cur)).toBe(i + 1);
    });
    expect(isRummageComplete(cur)).toBe(true);
  });

  it('getNextHintTargetId walks the checklist and returns null once everything is found', () => {
    const s = createRummageState('cozy', seeded(11));
    const [a, b, c] = s.targetIds;
    expect(getNextHintTargetId(s)).toBe(a);
    let cur = collectTargetItem(s, a).state;
    expect(getNextHintTargetId(cur)).toBe(b);
    cur = collectTargetItem(cur, c).state;
    expect(getNextHintTargetId(cur)).toBe(b);
    cur = collectTargetItem(cur, b).state;
    expect(getNextHintTargetId(cur)).toBeNull();
  });
});
