/* ───── Tic-Tac-Toe: pure board rules & a mode-aware computer opponent ───── */

import type { GameMode } from '../types/game.ts';

/** Random source returning a float in [0, 1) — injectable for deterministic tests */
export type Rng = () => number;

export type Mark = 'player' | 'cpu';
export type Cell = Mark | null;
/** 9 cells, row by row (index = row * 3 + column) */
export type Board = readonly Cell[];

/** `win` / `loss` are from the player's point of view */
export type BoardStatus = 'playing' | 'win' | 'draw' | 'loss';

export interface BoardEvaluation {
  status: BoardStatus;
  /** The three cells that won (null while playing or on a draw) */
  winningLine: number[] | null;
}

export const BOARD_SIZE = 9;

export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** Cozy: how often the opponent bothers to take a win or block a threat */
export const COZY_SMART_CHANCE = 0.25;
/** Challenge: chance to play the second-best square on an early, non-critical turn */
export const CHALLENGE_SECOND_BEST_CHANCE = 0.15;
/** Challenge "early turns": fewer than this many marks on the board */
const EARLY_TURN_MARKS = 4;

export function emptyBoard(): Cell[] {
  return Array.from({ length: BOARD_SIZE }, () => null);
}

export function openCells(board: Board): number[] {
  const open: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) if (board[i] === null) open.push(i);
  return open;
}

function lineOwner(board: Board): { mark: Mark; line: number[] } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return { mark, line: [...line] };
  }
  return null;
}

export function evaluateBoard(board: Board): BoardEvaluation {
  const owner = lineOwner(board);
  if (owner) return { status: owner.mark === 'player' ? 'win' : 'loss', winningLine: owner.line };
  if (openCells(board).length === 0) return { status: 'draw', winningLine: null };
  return { status: 'playing', winningLine: null };
}

/**
 * A new board with `mark` placed at `index` (the original is never changed).
 * Returns `null` for an occupied or out-of-range cell, or a finished game.
 */
export function applyMove(board: Board, index: number, mark: Mark): Cell[] | null {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) return null;
  if (board[index] !== null || evaluateBoard(board).status !== 'playing') return null;
  const next = [...board];
  next[index] = mark;
  return next;
}

/** A cell that completes a line for `mark` right now, if any */
export function findWinningMove(board: Board, mark: Mark): number | null {
  for (const i of openCells(board)) {
    const next = [...board];
    next[i] = mark;
    if (lineOwner(next)?.mark === mark) return i;
  }
  return null;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/*
 * Perfect-play score from the computer's side, memoized per position (there are fewer
 * than 3⁹ of them): a win scores 1 + the open cells left (so sooner is better), a loss the
 * negative of that, a draw 0.
 */
const minimaxMemo = new Map<string, number>();

function minimax(board: Cell[], toMove: Mark): number {
  const key = `${board.map((c) => (c === null ? '.' : c === 'cpu' ? 'o' : 'x')).join('')}${toMove === 'cpu' ? 'o' : 'x'}`;
  const cached = minimaxMemo.get(key);
  if (cached !== undefined) return cached;

  const { status } = evaluateBoard(board);
  const open = openCells(board);
  let score: number;
  if (status === 'loss') score = 1 + open.length;
  else if (status === 'win') score = -(1 + open.length);
  else if (status === 'draw') score = 0;
  else {
    score = toMove === 'cpu' ? -Infinity : Infinity;
    for (const i of open) {
      board[i] = toMove;
      const s = minimax(board, toMove === 'cpu' ? 'player' : 'cpu');
      board[i] = null;
      score = toMove === 'cpu' ? Math.max(score, s) : Math.min(score, s);
    }
  }
  minimaxMemo.set(key, score);
  return score;
}

/** Every open cell with its minimax score for the computer, best first (ties shuffled by `rng`) */
export function rankCpuMoves(board: Board, rng: Rng = Math.random): { index: number; score: number }[] {
  const scored = openCells(board).map((index) => {
    const next = [...board];
    next[index] = 'cpu';
    return { index, score: minimax(next, 'player'), tie: rng() };
  });
  scored.sort((a, b) => b.score - a.score || a.tie - b.tie);
  return scored.map(({ index, score }) => ({ index, score }));
}

/**
 * The computer's next cell.
 * - **Cozy** (easy & forgiving): usually a random open cell; only ~25% of the time does it
 *   take a winning move or block the player's two-in-a-row.
 * - **Challenge** (smart): always wins when it can, always blocks, otherwise plays minimax —
 *   with a ~15% chance on early, non-critical turns of the second-best cell, so a clever
 *   player can still set up a winning fork instead of drawing forever.
 * Throws if the board has no open cell.
 */
export function chooseCpuMove(board: Board, mode: GameMode, rng: Rng = Math.random): number {
  const open = openCells(board);
  if (open.length === 0) throw new Error('No open cell for the computer to play');

  if (mode === 'cozy') {
    if (rng() < COZY_SMART_CHANCE) {
      const sharp = findWinningMove(board, 'cpu') ?? findWinningMove(board, 'player');
      if (sharp !== null) return sharp;
    }
    return pick(open, rng);
  }

  const win = findWinningMove(board, 'cpu');
  if (win !== null) return win;
  const block = findWinningMove(board, 'player');
  if (block !== null) return block;

  const ranked = rankCpuMoves(board, rng);
  const early = BOARD_SIZE - open.length < EARLY_TURN_MARKS;
  if (early && ranked.length > 1 && rng() < CHALLENGE_SECOND_BEST_CHANCE) return ranked[1].index;
  return ranked[0].index;
}
