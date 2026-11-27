import { describe, expect, it } from 'vitest';
import {
  applyMove,
  chooseCpuMove,
  emptyBoard,
  evaluateBoard,
  findWinningMove,
  openCells,
  rankCpuMoves,
  WIN_LINES,
  type Board,
  type Cell,
  type Mark,
  type Rng,
} from '../ticTacToe.ts';
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

/** "x" = player, "o" = cpu, "." = empty, row by row */
function board(rows: string): Cell[] {
  return rows
    .replace(/\s+/g, '')
    .split('')
    .map((c) => (c === 'x' ? 'player' : c === 'o' ? 'cpu' : null));
}

const swapMarks = (b: Board): Cell[] => b.map((c) => (c === 'player' ? 'cpu' : c === 'cpu' ? 'player' : null));

/** Every reachable position (player moves first) where it's the computer's turn */
function cpuTurnPositions(): Cell[][] {
  const seen = new Set<string>();
  const out: Cell[][] = [];
  const walk = (b: Cell[], toMove: Mark) => {
    const key = b.map((c) => c ?? '.').join('|');
    if (seen.has(key) || evaluateBoard(b).status !== 'playing') return;
    seen.add(key);
    if (toMove === 'cpu') out.push(b);
    for (const i of openCells(b)) walk(applyMove(b, i, toMove)!, toMove === 'cpu' ? 'player' : 'cpu');
  };
  walk(emptyBoard(), 'player');
  return out;
}
const POSITIONS = cpuTurnPositions();

type PlayerStrategy = (b: Board, rng: Rng) => number;
/** A sharp player: perfect play (the computer's own ranking, from the player's side) after a random opening */
const perfectPlayer: PlayerStrategy = (b, rng) =>
  openCells(b).length === 9 ? openCells(b)[Math.floor(rng() * 9)] : rankCpuMoves(swapMarks(b), rng)[0].index;
const randomPlayer: PlayerStrategy = (b, rng) => {
  const open = openCells(b);
  return open[Math.floor(rng() * open.length)];
};

/** Play one game (player first) and return how it ended for the player */
function playGame(mode: GameMode, player: PlayerStrategy, rng: Rng): 'win' | 'draw' | 'loss' {
  let b: Cell[] = emptyBoard();
  let toMove: Mark = 'player';
  for (;;) {
    const { status } = evaluateBoard(b);
    if (status !== 'playing') return status;
    const index = toMove === 'player' ? player(b, rng) : chooseCpuMove(b, mode, rng);
    const next = applyMove(b, index, toMove);
    if (!next) throw new Error(`illegal ${toMove} move ${index}`);
    b = next;
    toMove = toMove === 'player' ? 'cpu' : 'player';
  }
}

function tally(mode: GameMode, player: PlayerStrategy, games: number, seed: number) {
  const rng = seeded(seed);
  const t = { win: 0, draw: 0, loss: 0 };
  for (let i = 0; i < games; i++) t[playGame(mode, player, rng)]++;
  return t;
}

describe('Tic-Tac-Toe board', () => {
  it.each(WIN_LINES.map((line) => [line.join('-'), line] as const))('detects the %s line for either side', (_, line) => {
    const forPlayer: Cell[] = emptyBoard();
    const forCpu: Cell[] = emptyBoard();
    for (const i of line) {
      forPlayer[i] = 'player';
      forCpu[i] = 'cpu';
    }
    expect(evaluateBoard(forPlayer)).toEqual({ status: 'win', winningLine: [...line] });
    expect(evaluateBoard(forCpu)).toEqual({ status: 'loss', winningLine: [...line] });
  });

  it('spots rows, columns and diagonals in real games', () => {
    expect(evaluateBoard(board('xxx oo. ...')).winningLine).toEqual([0, 1, 2]);
    expect(evaluateBoard(board('xo. xo. .o.'))).toEqual({ status: 'loss', winningLine: [1, 4, 7] });
    expect(evaluateBoard(board('x.o .xo ..x'))).toEqual({ status: 'win', winningLine: [0, 4, 8] });
    expect(evaluateBoard(board('x.o xo. o.x')).winningLine).toEqual([2, 4, 6]);
  });

  it('calls a full board without a line a draw, and anything else still playing', () => {
    expect(evaluateBoard(board('xox xoo oxx'))).toEqual({ status: 'draw', winningLine: null });
    expect(evaluateBoard(emptyBoard())).toEqual({ status: 'playing', winningLine: null });
    expect(evaluateBoard(board('xox xoo ox.'))).toEqual({ status: 'playing', winningLine: null });
  });

  it('moves never change the original board', () => {
    const before = board('x.. .o. ...');
    const snapshot = [...before];
    const after = applyMove(before, 8, 'player');
    expect(before).toEqual(snapshot);
    expect(after).not.toBe(before);
    expect(after![8]).toBe('player');
    expect(after!.filter(Boolean)).toHaveLength(3);
  });

  it('rejects occupied cells, cells off the board and moves after the game is over', () => {
    const b = board('x.. .o. ...');
    expect(applyMove(b, 0, 'cpu')).toBeNull();
    expect(applyMove(b, 4, 'player')).toBeNull();
    expect(applyMove(b, -1, 'player')).toBeNull();
    expect(applyMove(b, 9, 'player')).toBeNull();
    expect(applyMove(b, 1.5, 'player')).toBeNull();
    expect(applyMove(board('xxx oo. ...'), 8, 'cpu')).toBeNull();
  });

  it('finds the cell that completes a line', () => {
    expect(findWinningMove(board('xx. oo. ...'), 'player')).toBe(2);
    expect(findWinningMove(board('xx. oo. ...'), 'cpu')).toBe(5);
    expect(findWinningMove(board('x.. .o. ...'), 'player')).toBeNull();
  });
});

describe('Challenge opponent', () => {
  it('always takes an immediate win (before blocking), in every reachable position', () => {
    let checked = 0;
    for (const b of POSITIONS) {
      if (findWinningMove(b, 'cpu') === null) continue;
      for (const seed of [1, 2, 3]) {
        const move = chooseCpuMove(b, 'challenge', seeded(seed));
        expect(evaluateBoard(applyMove(b, move, 'cpu')!).status).toBe('loss');
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('always blocks an immediate player win when it cannot win itself', () => {
    let checked = 0;
    for (const b of POSITIONS) {
      if (findWinningMove(b, 'cpu') !== null || findWinningMove(b, 'player') === null) continue;
      for (const seed of [1, 2, 3]) {
        const after = applyMove(b, chooseCpuMove(b, 'challenge', seeded(seed)), 'cpu')!;
        /* With only one threat, the block leaves the player no immediate win */
        const threats = openCells(b).filter((i) => evaluateBoard(applyMove(b, i, 'player')!).status === 'win');
        if (threats.length === 1) expect(findWinningMove(after, 'player')).toBeNull();
        else expect(threats).toContain(openCells(b).find((i) => after[i] === 'cpu'));
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('plays a sharp, mostly unbeatable game — but a perfect player can sometimes find a fork', () => {
    const vsRandom = tally('challenge', randomPlayer, 400, 11);
    expect(vsRandom.win / 400).toBeLessThan(0.05);
    expect(vsRandom.loss / 400).toBeGreaterThan(0.6);
    const vsPerfect = tally('challenge', perfectPlayer, 400, 12);
    expect(vsPerfect.draw / 400).toBeGreaterThan(0.6);
    expect(vsPerfect.loss).toBe(0);
  });

  it('is deterministic for a seeded rng', () => {
    const b = board('x.. ... ...');
    expect(chooseCpuMove(b, 'challenge', seeded(7))).toBe(chooseCpuMove(b, 'challenge', seeded(7)));
    expect(tally('challenge', perfectPlayer, 30, 5)).toEqual(tally('challenge', perfectPlayer, 30, 5));
  });
});

describe('Cozy opponent', () => {
  it('only ever picks an open cell, in every reachable position', () => {
    for (const b of POSITIONS) {
      for (const seed of [1, 2]) {
        const move = chooseCpuMove(b, 'cozy', seeded(seed));
        expect(b[move]).toBeNull();
      }
    }
  });

  it('is measurably more forgiving than Challenge across seeded games', () => {
    const cozyPerfect = tally('cozy', perfectPlayer, 400, 21);
    const challengePerfect = tally('challenge', perfectPlayer, 400, 21);
    expect(cozyPerfect.win / 400).toBeGreaterThan(0.7);
    expect(cozyPerfect.win).toBeGreaterThan(challengePerfect.win * 3);

    /* Even a random player wins a fair share and loses far less often */
    const cozyRandom = tally('cozy', randomPlayer, 400, 22);
    const challengeRandom = tally('challenge', randomPlayer, 400, 22);
    expect(cozyRandom.win).toBeGreaterThan(challengeRandom.win * 4);
    expect(cozyRandom.loss).toBeLessThan(challengeRandom.loss);
  });

  it('still takes a win or blocks now and then (about a quarter of the time)', () => {
    const b = board('xx. oo. x..');
    let sharp = 0;
    const rng = seeded(3);
    for (let i = 0; i < 2000; i++) if (chooseCpuMove(b, 'cozy', rng) === 5) sharp++;
    /* 25% deliberate + a share of random picks (1 of 3 open cells) */
    expect(sharp / 2000).toBeGreaterThan(0.4);
    expect(sharp / 2000).toBeLessThan(0.6);
  });

  it('refuses a full board', () => {
    expect(() => chooseCpuMove(board('xox xoo oxx'), 'cozy')).toThrow();
  });
});
