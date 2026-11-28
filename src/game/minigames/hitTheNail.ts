/* ───── Hit the Nail: drive three nails with a timed hammer strike (pure rules) ───── */

import type { GameMode } from '../types/game.ts';
import type { Rng } from './ticTacToe.ts';

export const NAIL_COUNT = 3;
/** Challenge only: misses allowed before the board splits */
export const CHALLENGE_MAX_MISSES = 3;
/** The green zone always sits this far inside the bar's ends */
export const ZONE_MARGIN = 0.06;

export type NailStatus = 'playing' | 'win' | 'loss';
export type StrikeResult = 'hit' | 'early' | 'late' | 'invalid';

/** A span of the timing bar, normalized 0–1 */
export interface SweetZone {
  start: number;
  width: number;
}

export interface NailState {
  mode: GameMode;
  /** Nails driven flush so far (0–3); the next one is the active nail */
  driven: number;
  zone: SweetZone;
  misses: number;
  strikes: number;
  status: NailStatus;
}

/** Where the brass pointer is and which way it's travelling */
export interface Marker {
  pos: number;
  /** +1 moving right, −1 moving left */
  dir: 1 | -1;
}

/** Green-zone width range: Cozy roomy, Challenge narrow */
export function zoneWidthRange(mode: GameMode): readonly [number, number] {
  return mode === 'challenge' ? [0.14, 0.17] : [0.24, 0.28];
}

/** Milliseconds for the pointer to cross the bar once; Challenge speeds up on nails 2 and 3 */
export function sweepMs(mode: GameMode, nail: number): number {
  if (mode === 'cozy') return 1400;
  return nail === 0 ? 1150 : 950;
}

export function maxMisses(mode: GameMode): number | null {
  return mode === 'challenge' ? CHALLENGE_MAX_MISSES : null;
}

/**
 * A fresh green zone (random width in the mode's range, fully on the bar). With `avoid`,
 * its centre lands at least 0.2 of the bar away, so each nail asks for a new rhythm.
 */
export function randomZone(mode: GameMode, rng: Rng = Math.random, avoid?: SweetZone): SweetZone {
  const [lo, hi] = zoneWidthRange(mode);
  const width = lo + rng() * (hi - lo);
  const span = 1 - 2 * ZONE_MARGIN - width;
  let start = ZONE_MARGIN + rng() * span;
  if (avoid) {
    const avoidCentre = avoid.start + avoid.width / 2;
    for (let tries = 0; tries < 20 && Math.abs(start + width / 2 - avoidCentre) < 0.2; tries++) {
      start = ZONE_MARGIN + rng() * span;
    }
    /* Still too close (a stuck rng): take the far side of the bar */
    if (Math.abs(start + width / 2 - avoidCentre) < 0.2) {
      start = avoidCentre < 0.5 ? 1 - ZONE_MARGIN - width : ZONE_MARGIN;
    }
  }
  return { start: round4(start), width: round4(width) };
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function createNailState(mode: GameMode, rng: Rng = Math.random): NailState {
  return { mode, driven: 0, zone: randomZone(mode, rng), misses: 0, strikes: 0, status: 'playing' };
}

/** The pointer at `elapsedMs`: it starts at the left and swings left → right → left, evenly */
export function markerAt(elapsedMs: number, sweep: number): Marker {
  const t = Math.max(0, elapsedMs) / Math.max(1, sweep);
  const phase = t % 2;
  return phase < 1 ? { pos: phase, dir: 1 } : { pos: 2 - phase, dir: -1 };
}

export function inZone(zone: SweetZone, pos: number): boolean {
  return pos >= zone.start && pos <= zone.start + zone.width;
}

/**
 * Swing at the pointer's current spot. Inside the green → the active nail is driven and a new
 * zone appears for the next one. Outside → a miss, "early" if the pointer hadn't reached the
 * green yet on its way, "late" if it had already passed it. Challenge's third miss loses.
 */
export function strikeNail(state: NailState, marker: Marker, rng: Rng = Math.random): { state: NailState; result: StrikeResult } {
  if (state.status !== 'playing' || !Number.isFinite(marker.pos)) return { state, result: 'invalid' };
  const strikes = state.strikes + 1;
  if (inZone(state.zone, marker.pos)) {
    const driven = state.driven + 1;
    const done = driven >= NAIL_COUNT;
    return {
      state: {
        ...state,
        driven,
        strikes,
        zone: done ? state.zone : randomZone(state.mode, rng, state.zone),
        status: done ? 'win' : 'playing',
      },
      result: 'hit',
    };
  }
  const beforeZone = marker.pos < state.zone.start;
  const early = marker.dir === 1 ? beforeZone : !beforeZone;
  const misses = state.misses + 1;
  const limit = maxMisses(state.mode);
  return {
    state: { ...state, misses, strikes, status: limit !== null && misses >= limit ? 'loss' : 'playing' },
    result: early ? 'early' : 'late',
  };
}

export function missesLeft(state: NailState): number | null {
  const limit = maxMisses(state.mode);
  return limit === null ? null : Math.max(0, limit - state.misses);
}
