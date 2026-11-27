/* ───── Jigsaw Puzzle: pure interlocking-piece cutting, shuffling & placement ───── */

import type { GameMode } from '../types/game.ts';
import { JIGSAW_IMAGES, type JigsawImage } from '../data/media.ts';
import type { Rng } from './ticTacToe.ts';

/** `1` = tab sticks out, `-1` = blank cut in, `0` = flat outer border */
export type EdgeValue = 1 | -1 | 0;

export interface PieceEdges {
  top: EdgeValue;
  right: EdgeValue;
  bottom: EdgeValue;
  left: EdgeValue;
}

export interface JigsawPiece {
  /** Also the index of the slot it belongs in (row * gridSize + col) */
  id: number;
  row: number;
  col: number;
  edges: PieceEdges;
}

export interface JigsawState {
  mode: GameMode;
  imageId: string;
  gridSize: number;
  /** Indexed by piece id */
  pieces: readonly JigsawPiece[];
  /** Pieces still waiting in the tray, in their shuffled display order */
  tray: readonly number[];
  /** Board slots → the piece locked into it (only ever its own piece) */
  slots: readonly (number | null)[];
}

/**
 * `placed` = snapped & locked into its slot; `wrong` = not its slot, so it stays in the
 * tray untouched; `invalid` = unknown piece/slot, a piece already on the board, or an
 * already-filled slot.
 */
export type PlaceResult = 'placed' | 'wrong' | 'invalid';

/** How far a tab pokes out of its cell, as a fraction of the cell size */
export const JIGSAW_TAB_DEPTH = 0.27;

/** Cozy = 3×3 (9 pieces), Challenge = 4×4 (16 pieces) */
export function jigsawGridSize(mode: GameMode): number {
  return mode === 'challenge' ? 4 : 3;
}

/** Picks every inner seam at random; neighbours always share complementary edges */
export function generateEdges(gridSize: number, rng: Rng = Math.random): PieceEdges[] {
  const flip = (): EdgeValue => (rng() < 0.5 ? 1 : -1);
  const edges: PieceEdges[] = Array.from({ length: gridSize * gridSize }, () => ({ top: 0, right: 0, bottom: 0, left: 0 }));
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const piece = edges[r * gridSize + c];
      if (c < gridSize - 1) {
        const seam = flip();
        piece.right = seam;
        edges[r * gridSize + c + 1].left = -seam as EdgeValue;
      }
      if (r < gridSize - 1) {
        const seam = flip();
        piece.bottom = seam;
        edges[(r + 1) * gridSize + c].top = -seam as EdgeValue;
      }
    }
  }
  return edges;
}

/* Classic knob profile for one edge: `u` runs along the edge (0→1), `v` points out of the piece */
const KNOB: readonly (readonly [number, number])[][] = [
  [[0.4, 0], [0.42, 0.05], [0.39, 0.1]],
  [[0.33, 0.2], [0.4, JIGSAW_TAB_DEPTH], [0.5, JIGSAW_TAB_DEPTH]],
  [[0.6, JIGSAW_TAB_DEPTH], [0.67, 0.2], [0.61, 0.1]],
  [[0.58, 0.05], [0.6, 0], [0.66, 0]],
];

const fmt = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * SVG path for one piece whose cell spans (0,0)–(size,size), traced clockwise.
 * Tabs reach up to `JIGSAW_TAB_DEPTH * size` outside the cell, so pad any viewBox by that.
 */
export function buildPiecePath(edges: PieceEdges, size: number): string {
  // Each side: start corner, direction along the edge, outward normal
  const sides: [EdgeValue, [number, number], [number, number], [number, number]][] = [
    [edges.top, [0, 0], [1, 0], [0, -1]],
    [edges.right, [size, 0], [0, 1], [1, 0]],
    [edges.bottom, [size, size], [-1, 0], [0, 1]],
    [edges.left, [0, size], [0, -1], [-1, 0]],
  ];
  let d = 'M0 0';
  for (const [edge, [x0, y0], [dx, dy], [nx, ny]] of sides) {
    const at = (u: number, v: number): string =>
      `${fmt(x0 + dx * u * size + nx * v * edge * size)} ${fmt(y0 + dy * u * size + ny * v * edge * size)}`;
    if (edge !== 0) {
      d += ` L${at(0.34, 0)}`;
      for (const [a, b, c] of KNOB) d += ` C${at(a[0], a[1])} ${at(b[0], b[1])} ${at(c[0], c[1])}`;
    }
    d += ` L${at(1, 0)}`;
  }
  return `${d} Z`;
}

export function getJigsawImage(id: string): JigsawImage | undefined {
  return JIGSAW_IMAGES.find((img) => img.id === id);
}

/**
 * Picks a painting the player hasn't just seen. When every painting is excluded the
 * whole pool opens up again — still skipping the most recent one so a round never
 * repeats back-to-back.
 */
export function pickJigsawImage(
  excludeIds: readonly string[] = [],
  rng: Rng = Math.random,
  pool: readonly JigsawImage[] = JIGSAW_IMAGES,
): JigsawImage {
  let candidates = pool.filter((img) => !excludeIds.includes(img.id));
  if (candidates.length === 0) {
    const last = excludeIds[excludeIds.length - 1];
    candidates = pool.filter((img) => img.id !== last);
    if (candidates.length === 0) candidates = [...pool];
  }
  return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
}

function shuffled(ids: number[], rng: Rng): number[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A fresh puzzle: every piece waits in the tray (never pre-sorted), the board is empty */
export function createJigsawState(mode: GameMode, imageId: string, rng: Rng = Math.random): JigsawState {
  const gridSize = jigsawGridSize(mode);
  const edges = generateEdges(gridSize, rng);
  const pieces = edges.map((e, id) => ({ id, row: Math.floor(id / gridSize), col: id % gridSize, edges: e }));
  const ids = pieces.map((p) => p.id);
  let tray = shuffled(ids, rng);
  // A tray that happens to come out in board order would feel pre-solved — rotate it
  if (tray.every((id, i) => id === i)) tray = [...tray.slice(1), tray[0]];
  return { mode, imageId, gridSize, pieces, tray, slots: ids.map(() => null) };
}

/** Drops a tray piece on a slot: it locks in only on its own slot (the state is never mutated) */
export function placePiece(
  state: JigsawState,
  pieceId: number,
  slotIndex: number,
): { state: JigsawState; result: PlaceResult } {
  const inTray = state.tray.includes(pieceId);
  const validSlot = Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < state.slots.length;
  if (!inTray || !validSlot || state.slots[slotIndex] !== null) return { state, result: 'invalid' };
  if (pieceId !== slotIndex) return { state, result: 'wrong' };
  const slots = [...state.slots];
  slots[slotIndex] = pieceId;
  return { state: { ...state, slots, tray: state.tray.filter((id) => id !== pieceId) }, result: 'placed' };
}

export function countPlaced(state: JigsawState): number {
  return state.slots.filter((s) => s !== null).length;
}

export function isSolved(state: JigsawState): boolean {
  return state.slots.every((s, i) => s === i);
}
