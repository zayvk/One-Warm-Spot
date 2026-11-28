/* ───── Safe Dial: a 40-notch combination dial with three tumblers (pure rules) ───── */

import type { GameMode } from '../types/game.ts';
import type { Rng } from './ticTacToe.ts';

export const DIAL_NOTCHES = 40;
export const TUMBLER_COUNT = 3;
/** Each target sits at least this many notches from the dial's start / the previous target */
export const MIN_TARGET_SPACING = 6;
/** The heavier "near" tick sounds within this many notches of the target */
export const NEAR_RANGE = 2;
/** Challenge only: wrong lock-ins allowed before the safe jams */
export const CHALLENGE_MAX_WRONG = 3;

/** `cw` = clockwise (the number under the index goes down), `ccw` = counter-clockwise (up) */
export type DialDirection = 'cw' | 'ccw';
export type SafeStatus = 'playing' | 'win' | 'loss';
/** What a notch sounds like as it passes the index */
export type DialTick = 'tick' | 'near' | 'catch';

export interface SafeState {
  mode: GameMode;
  /** Number currently under the index, 0–39 */
  position: number;
  targets: readonly number[];
  directions: readonly DialDirection[];
  /** Tumblers set so far (0–3) */
  set: number;
  /** Direction of the latest turn since the last tumbler was set (`null` = not turned yet) */
  turning: DialDirection | null;
  wrongAttempts: number;
  status: SafeStatus;
}

export type LockResult =
  | { kind: 'set' }
  | { kind: 'not-turned' }
  | { kind: 'wrong-direction' }
  | { kind: 'wrong-position'; close: boolean }
  | { kind: 'invalid' };

/** Lock-in tolerance either side of the target: Cozy ±2, Challenge ±1 */
export function catchWindow(mode: GameMode): number {
  return mode === 'challenge' ? 1 : 2;
}

/** Wrong lock-ins allowed (Cozy never fails) */
export function maxWrongAttempts(mode: GameMode): number | null {
  return mode === 'challenge' ? CHALLENGE_MAX_WRONG : null;
}

export function wrapNotch(n: number): number {
  return ((Math.round(n) % DIAL_NOTCHES) + DIAL_NOTCHES) % DIAL_NOTCHES;
}

/** Shortest distance between two notches around the dial */
export function dialDistance(a: number, b: number): number {
  const d = Math.abs(wrapNotch(a) - wrapNotch(b));
  return Math.min(d, DIAL_NOTCHES - d);
}

export function opposite(dir: DialDirection): DialDirection {
  return dir === 'cw' ? 'ccw' : 'cw';
}

/**
 * A fresh safe: the dial rests at 0, three random targets each ≥ 6 notches from the start /
 * previous target, and a random first direction that then alternates (↻ ↺ ↻ or ↺ ↻ ↺).
 */
export function createSafeState(mode: GameMode, rng: Rng = Math.random): SafeState {
  const targets: number[] = [];
  let from = 0;
  for (let i = 0; i < TUMBLER_COUNT; i++) {
    /* Any notch at least MIN_TARGET_SPACING away, chosen uniformly */
    const choices = Array.from({ length: DIAL_NOTCHES }, (_, n) => n).filter((n) => dialDistance(n, from) >= MIN_TARGET_SPACING);
    const t = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
    targets.push(t);
    from = t;
  }
  const first: DialDirection = rng() < 0.5 ? 'cw' : 'ccw';
  const directions = targets.map((_, i) => (i % 2 === 0 ? first : opposite(first)));
  return { mode, position: 0, targets, directions, set: 0, turning: null, wrongAttempts: 0, status: 'playing' };
}

export function currentTarget(state: SafeState): number | null {
  return state.status === 'playing' ? (state.targets[state.set] ?? null) : null;
}

export function requiredDirection(state: SafeState): DialDirection | null {
  return state.status === 'playing' ? (state.directions[state.set] ?? null) : null;
}

/** How a notch sounds: a heavy catch on the target and a deeper tick near it — only when turning the right way */
export function tickAt(state: SafeState, position: number, dir: DialDirection): DialTick {
  const target = currentTarget(state);
  if (target === null || dir !== requiredDirection(state)) return 'tick';
  const d = dialDistance(position, target);
  if (d === 0) return 'catch';
  return d <= NEAR_RANGE ? 'near' : 'tick';
}

/**
 * Turns the dial `steps` notches (positive = clockwise). Returns the new state and the tick
 * heard at every notch passed, in order. Ignored once the safe is open or jammed.
 */
export function rotateDial(state: SafeState, steps: number): { state: SafeState; ticks: DialTick[] } {
  const n = Math.trunc(steps);
  if (state.status !== 'playing' || n === 0 || !Number.isFinite(n)) return { state, ticks: [] };
  const dir: DialDirection = n > 0 ? 'cw' : 'ccw';
  const delta = dir === 'cw' ? -1 : 1;
  const ticks: DialTick[] = [];
  let position = state.position;
  for (let i = 0; i < Math.abs(n); i++) {
    position = wrapNotch(position + delta);
    ticks.push(tickAt(state, position, dir));
  }
  return { state: { ...state, position, turning: dir }, ticks };
}

/**
 * Tries to set the current tumbler at the dial's position. It catches when the dial was last
 * turned the required way and sits within the mode's catch window. A wrong lock-in is free
 * in Cozy; in Challenge the third one jams the safe (loss). Not having turned yet is ignored.
 */
export function lockTumbler(state: SafeState): { state: SafeState; result: LockResult } {
  if (state.status !== 'playing') return { state, result: { kind: 'invalid' } };
  if (state.turning === null) return { state, result: { kind: 'not-turned' } };
  const target = state.targets[state.set];
  const distance = dialDistance(state.position, target);
  const rightWay = state.turning === state.directions[state.set];

  if (rightWay && distance <= catchWindow(state.mode)) {
    const set = state.set + 1;
    return {
      state: { ...state, set, turning: null, status: set >= TUMBLER_COUNT ? 'win' : 'playing' },
      result: { kind: 'set' },
    };
  }

  const wrongAttempts = state.wrongAttempts + 1;
  const limit = maxWrongAttempts(state.mode);
  const next: SafeState = { ...state, wrongAttempts, status: limit !== null && wrongAttempts >= limit ? 'loss' : 'playing' };
  return {
    state: next,
    result: rightWay ? { kind: 'wrong-position', close: distance <= NEAR_RANGE + 2 } : { kind: 'wrong-direction' },
  };
}

export function attemptsLeft(state: SafeState): number | null {
  const limit = maxWrongAttempts(state.mode);
  return limit === null ? null : Math.max(0, limit - state.wrongAttempts);
}
