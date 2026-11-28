import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_MAX_MISSES,
  NAIL_COUNT,
  ZONE_MARGIN,
  createNailState,
  inZone,
  markerAt,
  maxMisses,
  missesLeft,
  randomZone,
  strikeNail,
  sweepMs,
  zoneWidthRange,
  type NailState,
} from '../hitTheNail.ts';
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

const centre = (s: NailState) => ({ pos: s.zone.start + s.zone.width / 2, dir: 1 as const });
const leftOf = (s: NailState, dir: 1 | -1) => ({ pos: Math.max(0, s.zone.start - 0.03), dir });
const rightOf = (s: NailState, dir: 1 | -1) => ({ pos: Math.min(1, s.zone.start + s.zone.width + 0.03), dir });

describe('green zones', () => {
  it.each<[GameMode, number, number]>([
    ['cozy', 0.24, 0.28],
    ['challenge', 0.14, 0.17],
  ])('%s: width %f–%f, always fully on the bar', (mode, lo, hi) => {
    expect(zoneWidthRange(mode)).toEqual([lo, hi]);
    for (let seed = 1; seed <= 400; seed++) {
      const z = randomZone(mode, seeded(seed));
      expect(z.width).toBeGreaterThanOrEqual(lo - 1e-4);
      expect(z.width).toBeLessThanOrEqual(hi + 1e-4);
      expect(z.start).toBeGreaterThanOrEqual(ZONE_MARGIN - 1e-4);
      expect(z.start + z.width).toBeLessThanOrEqual(1 - ZONE_MARGIN + 1e-4);
    }
  });

  it('moves somewhere new for each nail (even with a stuck random source)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rng = seeded(seed);
      const a = randomZone('challenge', rng);
      const b = randomZone('challenge', rng, a);
      expect(Math.abs(a.start + a.width / 2 - (b.start + b.width / 2))).toBeGreaterThanOrEqual(0.2 - 1e-4);
    }
    const stuck = () => 0.5;
    const a = randomZone('cozy', stuck);
    const b = randomZone('cozy', stuck, a);
    expect(Math.abs(a.start - b.start)).toBeGreaterThan(0.2);
  });
});

describe('the pointer', () => {
  it('sweeps left → right → left at an even pace', () => {
    expect(markerAt(0, 1000)).toEqual({ pos: 0, dir: 1 });
    expect(markerAt(500, 1000)).toEqual({ pos: 0.5, dir: 1 });
    expect(markerAt(1500, 1000)).toEqual({ pos: 0.5, dir: -1 });
    expect(markerAt(2250, 1000).pos).toBeCloseTo(0.25);
    expect(markerAt(-50, 1000).pos).toBe(0);
  });

  it('is calm in Cozy and quicker on Challenge’s later nails', () => {
    expect(sweepMs('cozy', 0)).toBe(sweepMs('cozy', 2));
    expect(sweepMs('challenge', 0)).toBeLessThan(sweepMs('cozy', 0));
    expect(sweepMs('challenge', 1)).toBeLessThan(sweepMs('challenge', 0));
    expect(sweepMs('challenge', 2)).toBe(sweepMs('challenge', 1));
  });
});

describe('striking', () => {
  it.each<GameMode>(['cozy', 'challenge'])('%s: three hits in the green drive every nail and win', (mode) => {
    let s = createNailState(mode, seeded(1));
    const rng = seeded(2);
    for (let i = 0; i < NAIL_COUNT; i++) {
      const before = s.zone;
      const r = strikeNail(s, centre(s), rng);
      expect(r.result).toBe('hit');
      s = r.state;
      expect(s.driven).toBe(i + 1);
      if (i < NAIL_COUNT - 1) expect(s.zone).not.toEqual(before);
    }
    expect(s.status).toBe('win');
    expect(s.strikes).toBe(3);
    expect(strikeNail(s, centre(s)).result).toBe('invalid');
  });

  it('calls a miss early or late from the pointer’s direction', () => {
    const s = createNailState('cozy', seeded(3));
    expect(strikeNail(s, leftOf(s, 1)).result).toBe('early');
    expect(strikeNail(s, rightOf(s, 1)).result).toBe('late');
    expect(strikeNail(s, rightOf(s, -1)).result).toBe('early');
    expect(strikeNail(s, leftOf(s, -1)).result).toBe('late');
    expect(inZone(s.zone, s.zone.start)).toBe(true);
    expect(inZone(s.zone, s.zone.start + s.zone.width)).toBe(true);
  });

  it('Cozy never runs out of tries', () => {
    let s = createNailState('cozy', seeded(4));
    for (let i = 0; i < 20; i++) s = strikeNail(s, leftOf(s, 1)).state;
    expect(s.status).toBe('playing');
    expect(s.misses).toBe(20);
    expect(missesLeft(s)).toBeNull();
    expect(maxMisses('cozy')).toBeNull();
  });

  it('Challenge loses on the third miss, even after progress', () => {
    let s = createNailState('challenge', seeded(5));
    s = strikeNail(s, centre(s), seeded(6)).state;
    expect(missesLeft(s)).toBe(CHALLENGE_MAX_MISSES);
    s = strikeNail(s, leftOf(s, 1)).state;
    s = strikeNail(s, rightOf(s, 1)).state;
    expect(s.status).toBe('playing');
    expect(missesLeft(s)).toBe(1);
    s = strikeNail(s, leftOf(s, 1)).state;
    expect(s.status).toBe('loss');
    expect(s.driven).toBe(1);
    expect(strikeNail(s, centre(s)).result).toBe('invalid');
  });

  it('ignores a broken pointer reading and never mutates its input', () => {
    const s = createNailState('challenge', seeded(7));
    const snap = JSON.stringify(s);
    expect(strikeNail(s, { pos: Number.NaN, dir: 1 })).toEqual({ state: s, result: 'invalid' });
    strikeNail(s, centre(s));
    strikeNail(s, leftOf(s, 1));
    expect(JSON.stringify(s)).toBe(snap);
  });
});
