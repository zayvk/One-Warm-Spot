import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_MAX_WRONG,
  DIAL_NOTCHES,
  MIN_TARGET_SPACING,
  TUMBLER_COUNT,
  attemptsLeft,
  catchWindow,
  createSafeState,
  currentTarget,
  dialDistance,
  lockTumbler,
  maxWrongAttempts,
  requiredDirection,
  rotateDial,
  tickAt,
  wrapNotch,
  type DialDirection,
  type SafeState,
} from '../safeDial.ts';
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

const steps = (dir: DialDirection, n: number) => (dir === 'cw' ? n : -n);

/** Notches to turn `dir` from `from` to land exactly on `to` (always at least one full step) */
function turnsTo(from: number, to: number, dir: DialDirection): number {
  const diff = dir === 'ccw' ? wrapNotch(to - from) : wrapNotch(from - to);
  return diff === 0 ? DIAL_NOTCHES : diff;
}

/** Turns the required way onto the current target (plus `offset` notches past it) */
function dialOnto(state: SafeState, offset = 0): SafeState {
  const dir = requiredDirection(state)!;
  return rotateDial(state, steps(dir, turnsTo(state.position, currentTarget(state)!, dir) + offset)).state;
}

describe('safe dial set-up', () => {
  it.each<GameMode>(['cozy', 'challenge'])('%s: three well-spaced targets with alternating directions', (mode) => {
    for (let seed = 1; seed <= 300; seed++) {
      const s = createSafeState(mode, seeded(seed));
      expect(s.targets).toHaveLength(TUMBLER_COUNT);
      expect(s.position).toBe(0);
      let from = 0;
      for (const t of s.targets) {
        expect(Number.isInteger(t) && t >= 0 && t < DIAL_NOTCHES).toBe(true);
        expect(dialDistance(t, from)).toBeGreaterThanOrEqual(MIN_TARGET_SPACING);
        from = t;
      }
      expect(s.directions[1]).not.toBe(s.directions[0]);
      expect(s.directions[2]).toBe(s.directions[0]);
    }
  });

  it('randomizes the combination and the starting direction, deterministically per seed', () => {
    const safes = Array.from({ length: 100 }, (_, i) => createSafeState('cozy', seeded(i + 1)));
    expect(new Set(safes.map((s) => s.targets.join())).size).toBeGreaterThan(90);
    expect(new Set(safes.map((s) => s.directions[0]))).toEqual(new Set(['cw', 'ccw']));
    expect(createSafeState('challenge', seeded(5))).toEqual(createSafeState('challenge', seeded(5)));
  });

  it('works with a stuck random source', () => {
    for (const stuck of [0, 0.9999]) {
      const s = createSafeState('cozy', () => stuck);
      expect(dialDistance(s.targets[0], 0)).toBeGreaterThanOrEqual(MIN_TARGET_SPACING);
      expect(dialDistance(s.targets[1], s.targets[0])).toBeGreaterThanOrEqual(MIN_TARGET_SPACING);
    }
  });

  it('has the right tolerances per mode', () => {
    expect(catchWindow('cozy')).toBe(2);
    expect(catchWindow('challenge')).toBe(1);
    expect(maxWrongAttempts('cozy')).toBeNull();
    expect(maxWrongAttempts('challenge')).toBe(CHALLENGE_MAX_WRONG);
  });
});

describe('turning the dial', () => {
  it('clockwise counts down and counter-clockwise up, wrapping round 0–39', () => {
    const s = createSafeState('cozy', seeded(1));
    expect(rotateDial(s, 1).state.position).toBe(39);
    expect(rotateDial(s, -1).state.position).toBe(1);
    expect(rotateDial(s, 41).state.position).toBe(39);
    expect(rotateDial(s, -40).state.position).toBe(0);
    expect(rotateDial(s, 3).state.turning).toBe('cw');
    expect(rotateDial(s, -3).state.turning).toBe('ccw');
    expect(rotateDial(s, 0)).toEqual({ state: s, ticks: [] });
  });

  it('ticks every notch, deeper near the target and a clunk on it — only turning the right way', () => {
    const s = createSafeState('cozy', seeded(2));
    const dir = requiredDirection(s)!;
    const n = turnsTo(0, s.targets[0], dir);
    const { ticks } = rotateDial(s, steps(dir, n));
    expect(ticks).toHaveLength(n);
    expect(ticks.at(-1)).toBe('catch');
    expect(ticks.slice(-3, -1)).toEqual(['near', 'near']);
    expect(ticks.filter((t) => t === 'catch')).toHaveLength(1);

    const wrongWay = rotateDial(s, steps(dir === 'cw' ? 'ccw' : 'cw', DIAL_NOTCHES)).ticks;
    expect(new Set(wrongWay)).toEqual(new Set(['tick']));
    expect(tickAt(s, s.targets[0], dir === 'cw' ? 'ccw' : 'cw')).toBe('tick');
  });
});

describe('setting tumblers', () => {
  it.each<GameMode>(['cozy', 'challenge'])('%s: three good lock-ins open the safe', (mode) => {
    let s = createSafeState(mode, seeded(3));
    for (let i = 0; i < TUMBLER_COUNT; i++) {
      s = dialOnto(s);
      const r = lockTumbler(s);
      expect(r.result.kind).toBe('set');
      s = r.state;
      expect(s.set).toBe(i + 1);
      expect(s.turning).toBeNull();
    }
    expect(s.status).toBe('win');
    expect(lockTumbler(s).result.kind).toBe('invalid');
    expect(rotateDial(s, 3).ticks).toEqual([]);
  });

  it('Cozy catches within ±2 notches, Challenge only ±1', () => {
    const cozy = createSafeState('cozy', seeded(4));
    expect(lockTumbler(dialOnto(cozy, 2)).result.kind).toBe('set');
    expect(lockTumbler(dialOnto(cozy, 3)).result.kind).toBe('wrong-position');
    const challenge = createSafeState('challenge', seeded(4));
    expect(lockTumbler(dialOnto(challenge, 1)).result.kind).toBe('set');
    expect(lockTumbler(dialOnto(challenge, 2)).result.kind).toBe('wrong-position');
  });

  it('the right number turned the wrong way does not catch', () => {
    const s = createSafeState('cozy', seeded(6));
    const dir = requiredDirection(s)!;
    const other: DialDirection = dir === 'cw' ? 'ccw' : 'cw';
    const wrongWay = rotateDial(s, steps(other, turnsTo(0, s.targets[0], other))).state;
    expect(wrongWay.position).toBe(s.targets[0]);
    expect(lockTumbler(wrongWay).result.kind).toBe('wrong-direction');
  });

  it('setting without turning is ignored (no attempt used)', () => {
    const s = createSafeState('challenge', seeded(7));
    expect(lockTumbler(s)).toEqual({ state: s, result: { kind: 'not-turned' } });
    const afterSet = lockTumbler(dialOnto(s)).state;
    expect(lockTumbler(afterSet).result.kind).toBe('not-turned');
    expect(afterSet.wrongAttempts).toBe(0);
  });

  it('Cozy forgives any number of wrong lock-ins', () => {
    let s = dialOnto(createSafeState('cozy', seeded(8)), 6);
    for (let i = 0; i < 12; i++) s = lockTumbler(s).state;
    expect(s.status).toBe('playing');
    expect(s.wrongAttempts).toBe(12);
    expect(attemptsLeft(s)).toBeNull();
  });

  it('Challenge jams on the third wrong lock-in, flagging near misses', () => {
    let s = dialOnto(createSafeState('challenge', seeded(9)), 3);
    const first = lockTumbler(s);
    expect(first.result).toEqual({ kind: 'wrong-position', close: true });
    s = first.state;
    expect(attemptsLeft(s)).toBe(2);
    s = lockTumbler(s).state;
    expect(s.status).toBe('playing');
    s = lockTumbler(s).state;
    expect(s.status).toBe('loss');
    expect(attemptsLeft(s)).toBe(0);
    expect(lockTumbler(s).result.kind).toBe('invalid');
    expect(lockTumbler(dialOnto(createSafeState('challenge', seeded(9)), 12)).result).toEqual({ kind: 'wrong-position', close: false });
  });

  it('never mutates the state it was given', () => {
    const s = createSafeState('challenge', seeded(10));
    const snap = JSON.stringify(s);
    lockTumbler(dialOnto(s, 5));
    rotateDial(s, 7);
    expect(JSON.stringify(s)).toBe(snap);
  });
});
