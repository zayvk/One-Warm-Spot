/* ───── Dots & Lines (Dots and Boxes): pure rules & a mode-aware computer opponent ───── */

import type { GameMode } from '../types/game.ts';
import type { Rng } from './ticTacToe.ts';

export type DotsPlayer = 'player' | 'cpu';
/** `win` / `loss` are from the player's point of view */
export type DotsStatus = 'playing' | 'win' | 'draw' | 'loss';

/**
 * A line between two neighbouring dots. `h[row][col]` joins dot (row, col) to
 * (row, col + 1); `v[row][col]` joins dot (row, col) to (row + 1, col).
 */
export interface DotsEdge {
  dir: 'h' | 'v';
  row: number;
  col: number;
}

export interface BoxRef {
  row: number;
  col: number;
}

export interface DotsMove {
  edge: DotsEdge;
  by: DotsPlayer;
  completed: readonly BoxRef[];
}

export interface DotsState {
  mode: GameMode;
  /** Boxes per side (= dots per side − 1) */
  size: number;
  /** Horizontal lines: (size + 1) rows × size columns */
  h: readonly (readonly (DotsPlayer | null)[])[];
  /** Vertical lines: size rows × (size + 1) columns */
  v: readonly (readonly (DotsPlayer | null)[])[];
  /** Who closed each box (size × size) */
  boxes: readonly (readonly (DotsPlayer | null)[])[];
  turn: DotsPlayer;
  playerScore: number;
  cpuScore: number;
  lastMove: DotsMove | null;
}

export interface DotsMoveResult {
  state: DotsState;
  /** Boxes this line closed (0, 1 or 2) — any closed box means the same player goes again */
  completedBoxes: BoxRef[];
}

/** How often the Cozy opponent bothers to close an available box */
export const COZY_TAKE_CHANCE = 0.45;

/** Dots per side: Cozy 4×4 (3×3 = 9 boxes, never a tie), Challenge 5×5 (4×4 = 16 boxes) */
export function dotsGridSize(mode: GameMode): number {
  return mode === 'challenge' ? 5 : 4;
}

export function edgeCount(size: number): number {
  return 2 * size * (size + 1);
}

export function edgeKey(e: DotsEdge): string {
  return `${e.dir}${e.row}-${e.col}`;
}

export function createDotsState(mode: GameMode, first: DotsPlayer = 'player'): DotsState {
  const size = dotsGridSize(mode) - 1;
  const grid = (rows: number, cols: number) => Array.from({ length: rows }, () => Array<DotsPlayer | null>(cols).fill(null));
  return {
    mode,
    size,
    h: grid(size + 1, size),
    v: grid(size, size + 1),
    boxes: grid(size, size),
    turn: first,
    playerScore: 0,
    cpuScore: 0,
    lastMove: null,
  };
}

export function isEdgeInBounds(size: number, e: DotsEdge): boolean {
  if (!Number.isInteger(e.row) || !Number.isInteger(e.col) || e.row < 0 || e.col < 0) return false;
  if (e.dir === 'h') return e.row <= size && e.col < size;
  if (e.dir === 'v') return e.row < size && e.col <= size;
  return false;
}

export function edgeOwner(state: DotsState, e: DotsEdge): DotsPlayer | null {
  return (e.dir === 'h' ? state.h : state.v)[e.row][e.col];
}

/** Every line on the board, row by row (horizontal first, then vertical) */
export function allEdges(size: number): DotsEdge[] {
  const edges: DotsEdge[] = [];
  for (let row = 0; row <= size; row++) for (let col = 0; col < size; col++) edges.push({ dir: 'h', row, col });
  for (let row = 0; row < size; row++) for (let col = 0; col <= size; col++) edges.push({ dir: 'v', row, col });
  return edges;
}

export function availableEdges(state: DotsState): DotsEdge[] {
  return allEdges(state.size).filter((e) => edgeOwner(state, e) === null);
}

/** The 1 (border) or 2 boxes a line is a side of */
export function edgeBoxes(size: number, e: DotsEdge): BoxRef[] {
  const out: BoxRef[] = [];
  if (e.dir === 'h') {
    if (e.row > 0) out.push({ row: e.row - 1, col: e.col });
    if (e.row < size) out.push({ row: e.row, col: e.col });
  } else {
    if (e.col > 0) out.push({ row: e.row, col: e.col - 1 });
    if (e.col < size) out.push({ row: e.row, col: e.col });
  }
  return out;
}

/** How many of a box's four sides are drawn */
export function boxSides(state: DotsState, row: number, col: number): number {
  return (
    (state.h[row][col] ? 1 : 0) +
    (state.h[row + 1][col] ? 1 : 0) +
    (state.v[row][col] ? 1 : 0) +
    (state.v[row][col + 1] ? 1 : 0)
  );
}

export function isDotsGameOver(state: DotsState): boolean {
  return state.playerScore + state.cpuScore === state.size * state.size;
}

export function dotsStatus(state: DotsState): DotsStatus {
  if (!isDotsGameOver(state)) return 'playing';
  if (state.playerScore > state.cpuScore) return 'win';
  if (state.playerScore < state.cpuScore) return 'loss';
  return 'draw';
}

/**
 * Draws a line for whoever's turn it is. Closing 1 or 2 boxes scores them and keeps the
 * turn; otherwise the turn passes. Returns null for an out-of-range or already-drawn line
 * (the state is never mutated).
 */
export function applyEdgeMove(state: DotsState, edge: DotsEdge): DotsMoveResult | null {
  if (!isEdgeInBounds(state.size, edge) || edgeOwner(state, edge) !== null) return null;
  const by = state.turn;
  const h = state.h.map((r) => [...r]);
  const v = state.v.map((r) => [...r]);
  (edge.dir === 'h' ? h : v)[edge.row][edge.col] = by;
  const next: DotsState = { ...state, h, v };

  const completedBoxes = edgeBoxes(state.size, edge).filter(
    (b) => state.boxes[b.row][b.col] === null && boxSides(next, b.row, b.col) === 4,
  );
  const boxes = completedBoxes.length > 0 ? state.boxes.map((r) => [...r]) : state.boxes;
  for (const b of completedBoxes) (boxes as (DotsPlayer | null)[][])[b.row][b.col] = by;
  const gained = completedBoxes.length;

  return {
    state: {
      ...next,
      boxes,
      playerScore: state.playerScore + (by === 'player' ? gained : 0),
      cpuScore: state.cpuScore + (by === 'cpu' ? gained : 0),
      turn: gained > 0 ? by : by === 'player' ? 'cpu' : 'player',
      lastMove: { edge: { ...edge }, by, completed: completedBoxes },
    },
    completedBoxes,
  };
}

/** How many boxes drawing this line would close right now */
export function boxesClosedBy(state: DotsState, e: DotsEdge): number {
  if (edgeOwner(state, e) !== null) return 0;
  return edgeBoxes(state.size, e).filter((b) => state.boxes[b.row][b.col] === null && boxSides(state, b.row, b.col) === 3).length;
}

/** Safe = closes nothing and leaves no box with three sides for the opponent to take */
export function isSafeEdge(state: DotsState, e: DotsEdge): boolean {
  if (edgeOwner(state, e) !== null) return false;
  return edgeBoxes(state.size, e).every((b) => boxSides(state, b.row, b.col) < 2);
}

/**
 * Boxes the opponent could sweep straight after this line is drawn (taking every box
 * that becomes closable, one after another) — the size of the chain it gives away.
 */
export function sacrificeCost(state: DotsState, e: DotsEdge): number {
  const first = applyEdgeMove(state, e);
  if (!first) return Number.POSITIVE_INFINITY;
  let s = first.state;
  let swept = 0;
  for (;;) {
    const take = availableEdges(s).find((x) => boxesClosedBy(s, x) > 0);
    if (!take) return swept;
    const r = applyEdgeMove(s, take)!;
    swept += r.completedBoxes.length;
    s = r.state;
  }
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** All items sharing the best (highest) score */
function best<T>(items: readonly T[], score: (t: T) => number): T[] {
  let top = Number.NEGATIVE_INFINITY;
  let out: T[] = [];
  for (const it of items) {
    const s = score(it);
    if (s > top) {
      top = s;
      out = [it];
    } else if (s === top) {
      out.push(it);
    }
  }
  return out;
}

/**
 * The computer's next line (for whoever's turn it is).
 * - Cozy: closes an available box only `COZY_TAKE_CHANCE` of the time, otherwise draws any
 *   open line — which now and then opens a juicy chain for the player.
 * - Challenge: always closes a box when it can (preferring a double), otherwise a safe
 *   line, and when only giveaways remain, the one that hands over the smallest chain.
 */
export function chooseDotsCpuMove(state: DotsState, mode: GameMode, rng: Rng = Math.random): DotsEdge {
  const open = availableEdges(state);
  if (open.length === 0) throw new Error('No open line for the computer to draw');
  const closing = open.filter((e) => boxesClosedBy(state, e) > 0);

  if (mode === 'cozy') {
    if (closing.length > 0 && rng() < COZY_TAKE_CHANCE) return pick(closing, rng);
    return pick(open, rng);
  }

  if (closing.length > 0) return pick(best(closing, (e) => boxesClosedBy(state, e)), rng);
  const safe = open.filter((e) => isSafeEdge(state, e));
  if (safe.length > 0) return pick(safe, rng);
  return pick(best(open, (e) => -sacrificeCost(state, e)), rng);
}
