/* ───── Connect the Wires: pure fuse-box wiring rules (shuffle, matching, completion) ───── */

import type { GameMode } from '../types/game.ts';
import type { Rng } from './ticTacToe.ts';

export type WireId = 'terracotta' | 'sage' | 'ochre' | 'slate' | 'plum' | 'teal';

export interface WireSpec {
  id: WireId;
  /** Spoken / labelled colour name */
  name: string;
  /** Shape badge so the pairs read without relying on colour */
  symbol: string;
  symbolName: string;
}

/** Cozy uses the first four, Challenge all six */
export const WIRE_SPECS: readonly WireSpec[] = [
  { id: 'terracotta', name: 'Terracotta', symbol: '●', symbolName: 'circle' },
  { id: 'sage', name: 'Sage', symbol: '▲', symbolName: 'triangle' },
  { id: 'ochre', name: 'Ochre', symbol: '■', symbolName: 'square' },
  { id: 'slate', name: 'Slate', symbol: '◆', symbolName: 'diamond' },
  { id: 'plum', name: 'Plum', symbol: '★', symbolName: 'star' },
  { id: 'teal', name: 'Teal', symbol: '✚', symbolName: 'cross' },
];

export function wireCount(mode: GameMode): number {
  return mode === 'challenge' ? 6 : 4;
}

export function getWireSpec(id: WireId): WireSpec {
  return WIRE_SPECS.find((w) => w.id === id)!;
}

export interface WireState {
  mode: GameMode;
  /** Wires on the left terminal strip, top to bottom */
  left: readonly WireId[];
  /** Their matching terminals on the right, top to bottom — never one straight across */
  right: readonly WireId[];
  /** Wires already joined, in the order they were connected */
  connected: readonly WireId[];
}

export interface WireConnectResult {
  state: WireState;
  /** true only for a new, correct pair (the state is otherwise unchanged) */
  matched: boolean;
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How many wires would run straight across (same row on both sides) */
export function straightAcross(state: Pick<WireState, 'left' | 'right'>): number {
  return state.left.filter((id, i) => state.right[i] === id).length;
}

/**
 * A fresh fuse box: both terminal strips are shuffled, and the right strip is a
 * derangement of the left — every wire has to cross to a different row.
 */
export function createWireState(mode: GameMode, rng: Rng = Math.random): WireState {
  const ids = WIRE_SPECS.slice(0, wireCount(mode)).map((w) => w.id);
  const left = shuffled(ids, rng);
  let right = shuffled(ids, rng);
  for (let tries = 0; tries < 50 && straightAcross({ left, right }) > 0; tries++) right = shuffled(ids, rng);
  // Still a straight wire after the retries (a broken rng): rotate by one row, which is always a derangement
  if (straightAcross({ left, right }) > 0) right = [...left.slice(1), left[0]];
  return { mode, left, right, connected: [] };
}

/** Joins left terminal `leftIndex` to right terminal `rightIndex` if they're the same wire */
export function tryConnectWire(state: WireState, leftIndex: number, rightIndex: number): WireConnectResult {
  const id = state.left[leftIndex];
  if (id === undefined || state.right[rightIndex] !== id || state.connected.includes(id)) {
    return { state, matched: false };
  }
  return { state: { ...state, connected: [...state.connected, id] }, matched: true };
}

export function isWireConnected(state: WireState, id: WireId): boolean {
  return state.connected.includes(id);
}

export function countConnected(state: WireState): number {
  return state.connected.length;
}

export function isWireBoxFixed(state: WireState): boolean {
  return state.left.every((id) => state.connected.includes(id));
}
