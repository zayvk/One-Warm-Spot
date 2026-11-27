import { describe, expect, it } from 'vitest';
import {
  allEdges,
  applyEdgeMove,
  availableEdges,
  boxesClosedBy,
  chooseDotsCpuMove,
  createDotsState,
  dotsGridSize,
  dotsStatus,
  edgeCount,
  edgeOwner,
  isSafeEdge,
  sacrificeCost,
  type DotsEdge,
  type DotsState,
} from '../dotsAndBoxes.ts';
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

const h = (row: number, col: number): DotsEdge => ({ dir: 'h', row, col });
const v = (row: number, col: number): DotsEdge => ({ dir: 'v', row, col });

/** Draws lines in order regardless of whose turn it is */
function draw(state: DotsState, edges: DotsEdge[]): DotsState {
  return edges.reduce((s, e) => applyEdgeMove(s, e)!.state, state);
}

function randomEdge(s: DotsState, rng: Rng): DotsEdge {
  const open = availableEdges(s);
  return open[Math.floor(rng() * open.length)];
}

/** A typical casual player: always grabs a free box, otherwise draws any line */
function greedyEdge(s: DotsState, rng: Rng): DotsEdge {
  const open = availableEdges(s);
  const closing = open.filter((e) => boxesClosedBy(s, e) > 0);
  const pool = closing.length > 0 ? closing : open;
  return pool[Math.floor(rng() * pool.length)];
}

/** Plays the player with `playerMove` against the computer in `ai` mode; returns the status */
function playGame(board: GameMode, ai: GameMode, playerMove: (s: DotsState, rng: Rng) => DotsEdge, seed: number) {
  const rng = seeded(seed);
  let s = createDotsState(board);
  while (dotsStatus(s) === 'playing') {
    const e = s.turn === 'cpu' ? chooseDotsCpuMove(s, ai, rng) : playerMove(s, rng);
    s = applyEdgeMove(s, e)!.state;
  }
  return { status: dotsStatus(s), state: s };
}

/** Every position reached across seeded random games */
function* randomPositions(mode: GameMode, games: number): Generator<DotsState> {
  for (let seed = 1; seed <= games; seed++) {
    const rng = seeded(seed);
    let s = createDotsState(mode);
    while (dotsStatus(s) === 'playing') {
      yield s;
      s = applyEdgeMove(s, randomEdge(s, rng))!.state;
    }
  }
}

/** Positions from careful games (mostly Challenge-style moves, a few random) — these reach the endgame where every line gives something away */
function* carefulPositions(mode: GameMode, games: number): Generator<DotsState> {
  for (let seed = 1; seed <= games; seed++) {
    const rng = seeded(seed);
    let s = createDotsState(mode);
    while (dotsStatus(s) === 'playing') {
      yield s;
      const e = rng() < 0.2 ? randomEdge(s, rng) : chooseDotsCpuMove(s, 'challenge', rng);
      s = applyEdgeMove(s, e)!.state;
    }
  }
}

describe('Dots & Lines board', () => {
  it.each<[GameMode, number, number, number]>([
    ['cozy', 4, 24, 9],
    ['challenge', 5, 40, 16],
  ])('%s: %i×%i dots → %i lines and %i boxes', (mode, dots, edges, boxes) => {
    expect(dotsGridSize(mode)).toBe(dots);
    const s = createDotsState(mode);
    expect(s.size).toBe(dots - 1);
    expect(edgeCount(s.size)).toBe(edges);
    expect(allEdges(s.size)).toHaveLength(edges);
    expect(new Set(allEdges(s.size).map((e) => `${e.dir}${e.row}-${e.col}`)).size).toBe(edges);
    expect(s.boxes.flat()).toHaveLength(boxes);
    expect(s.turn).toBe('player');
    expect(dotsStatus(s)).toBe('playing');
  });
});

describe('applyEdgeMove', () => {
  it('passes the turn when no box closes, without mutating the old state', () => {
    const s = createDotsState('cozy');
    const r = applyEdgeMove(s, h(0, 0))!;
    expect(r.completedBoxes).toEqual([]);
    expect(r.state.turn).toBe('cpu');
    expect(edgeOwner(r.state, h(0, 0))).toBe('player');
    expect(r.state.lastMove).toEqual({ edge: h(0, 0), by: 'player', completed: [] });
    expect(edgeOwner(s, h(0, 0))).toBeNull();
    expect(s.turn).toBe('player');
  });

  it('closing one box scores it and grants an extra turn', () => {
    // player h(0,0), cpu v(0,0), player h(1,0) → cpu's turn; cpu closes the box with v(0,1)
    const s = draw(createDotsState('cozy'), [h(0, 0), v(0, 0), h(1, 0)]);
    expect(s.turn).toBe('cpu');
    const r = applyEdgeMove(s, v(0, 1))!;
    expect(r.completedBoxes).toEqual([{ row: 0, col: 0 }]);
    expect(r.state.boxes[0][0]).toBe('cpu');
    expect(r.state.cpuScore).toBe(1);
    expect(r.state.playerScore).toBe(0);
    expect(r.state.turn).toBe('cpu');
  });

  it('closing two boxes with one line scores both and grants an extra turn', () => {
    // Two side-by-side boxes, everything but their shared middle line drawn
    const s = draw(createDotsState('cozy'), [h(0, 0), h(1, 0), v(0, 0), h(0, 1), h(1, 1), v(0, 2)]);
    expect(s.playerScore + s.cpuScore).toBe(0);
    const mover = s.turn;
    const r = applyEdgeMove(s, v(0, 1))!;
    expect(r.completedBoxes).toHaveLength(2);
    expect(r.state.boxes[0][0]).toBe(mover);
    expect(r.state.boxes[0][1]).toBe(mover);
    expect(mover === 'player' ? r.state.playerScore : r.state.cpuScore).toBe(2);
    expect(r.state.turn).toBe(mover);
  });

  it('rejects drawn, out-of-range and malformed lines', () => {
    const s = applyEdgeMove(createDotsState('cozy'), h(0, 0))!.state;
    const snapshot = JSON.stringify(s);
    expect(applyEdgeMove(s, h(0, 0))).toBeNull();
    expect(applyEdgeMove(s, h(4, 0))).toBeNull();
    expect(applyEdgeMove(s, h(0, 3))).toBeNull();
    expect(applyEdgeMove(s, v(3, 0))).toBeNull();
    expect(applyEdgeMove(s, v(0, 4))).toBeNull();
    expect(applyEdgeMove(s, v(-1, 0))).toBeNull();
    expect(applyEdgeMove(s, h(0.5, 0))).toBeNull();
    expect(applyEdgeMove(s, { dir: 'd' as 'h', row: 0, col: 0 })).toBeNull();
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it.each<GameMode>(['cozy', 'challenge'])('%s: a full game claims every line and box', (mode) => {
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = playGame(mode, mode, randomEdge, seed);
      const n = state.size;
      expect(availableEdges(state)).toHaveLength(0);
      expect(state.boxes.flat().every((b) => b !== null)).toBe(true);
      expect(state.playerScore + state.cpuScore).toBe(n * n);
      expect(state.playerScore).toBe(state.boxes.flat().filter((b) => b === 'player').length);
      expect(applyEdgeMove(state, h(0, 0))).toBeNull();
    }
  });
});

describe('dotsStatus', () => {
  it('reports win / loss / draw from the final score', () => {
    const base = { ...createDotsState('challenge') };
    expect(dotsStatus({ ...base, playerScore: 9, cpuScore: 7 })).toBe('win');
    expect(dotsStatus({ ...base, playerScore: 7, cpuScore: 9 })).toBe('loss');
    expect(dotsStatus({ ...base, playerScore: 8, cpuScore: 8 })).toBe('draw');
    expect(dotsStatus({ ...base, playerScore: 8, cpuScore: 7 })).toBe('playing');
  });

  it('Cozy (9 boxes) can never tie, Challenge (16) can', () => {
    const smart = (s: DotsState, rng: Rng) => chooseDotsCpuMove(s, 'challenge', rng);
    const statuses = (mode: GameMode) =>
      new Set(Array.from({ length: 200 }, (_, i) => playGame(mode, 'challenge', smart, i + 1).status));
    expect(statuses('cozy').has('draw')).toBe(false);
    expect(statuses('challenge')).toContain('draw');
  });
});

describe('chooseDotsCpuMove — challenge', () => {
  it('always closes a box when one is available, preferring a double', () => {
    let checked = 0;
    for (const s of randomPositions('challenge', 40)) {
      const closing = availableEdges(s).filter((e) => boxesClosedBy(s, e) > 0);
      if (closing.length === 0) continue;
      const most = Math.max(...closing.map((e) => boxesClosedBy(s, e)));
      expect(boxesClosedBy(s, chooseDotsCpuMove(s, 'challenge', seeded(checked + 1)))).toBe(most);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('prefers a safe line over handing the player a box', () => {
    let checked = 0;
    for (const s of carefulPositions('challenge', 40)) {
      const open = availableEdges(s);
      if (open.some((e) => boxesClosedBy(s, e) > 0) || !open.some((e) => isSafeEdge(s, e))) continue;
      const e = chooseDotsCpuMove(s, 'challenge', seeded(checked + 1));
      expect(isSafeEdge(s, e)).toBe(true);
      expect(sacrificeCost(s, e)).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('when every line gives something away, gives away the smallest chain', () => {
    let checked = 0;
    let meaningful = 0;
    for (const s of carefulPositions('challenge', 60)) {
      const open = availableEdges(s);
      if (open.some((e) => boxesClosedBy(s, e) > 0 || isSafeEdge(s, e))) continue;
      const costs = open.map((e) => sacrificeCost(s, e));
      const e = chooseDotsCpuMove(s, 'challenge', seeded(checked + 1));
      expect(sacrificeCost(s, e)).toBe(Math.min(...costs));
      if (Math.max(...costs) > Math.min(...costs)) meaningful++;
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
    expect(meaningful).toBeGreaterThan(5);
  });

  it('sacrificeCost counts the whole chain the opponent can sweep', () => {
    // Top row of the 3×3 board: a corridor of three boxes (tops and bottoms drawn), open at both ends
    const s = draw(createDotsState('cozy'), [h(0, 0), h(0, 1), h(0, 2), h(1, 0), h(1, 1), h(1, 2)]);
    expect(sacrificeCost(s, v(0, 0))).toBe(3);
    expect(sacrificeCost(s, v(0, 1))).toBe(3);
    expect(sacrificeCost(s, h(3, 0))).toBe(0);
  });

  it('is deterministic for a seed and refuses a full board', () => {
    for (const s of [...randomPositions('challenge', 3)].slice(0, 40)) {
      expect(chooseDotsCpuMove(s, 'challenge', seeded(5))).toEqual(chooseDotsCpuMove(s, 'challenge', seeded(5)));
    }
    const done = playGame('cozy', 'cozy', randomEdge, 1).state;
    expect(() => chooseDotsCpuMove(done, 'challenge')).toThrow();
    expect(() => chooseDotsCpuMove(done, 'cozy')).toThrow();
  });
});

describe('chooseDotsCpuMove — cozy', () => {
  it('only ever picks open, in-range lines', () => {
    for (const s of randomPositions('cozy', 30)) {
      const e = chooseDotsCpuMove(s, 'cozy', seeded(s.h.flat().filter(Boolean).length + 1));
      expect(edgeOwner(s, e)).toBeNull();
      expect(applyEdgeMove(s, e)).not.toBeNull();
    }
  });

  it('leaves free boxes for the player much of the time', () => {
    let chances = 0;
    let taken = 0;
    for (const s of randomPositions('challenge', 60)) {
      if (!availableEdges(s).some((e) => boxesClosedBy(s, e) > 0)) continue;
      chances++;
      if (boxesClosedBy(s, chooseDotsCpuMove(s, 'cozy', seeded(chances))) > 0) taken++;
    }
    const rate = taken / chances;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.75);
  });

  it('is measurably more forgiving than Challenge across seeded games', () => {
    const winRate = (board: GameMode, ai: GameMode) => {
      let wins = 0;
      for (let seed = 1; seed <= 300; seed++) if (playGame(board, ai, greedyEdge, seed).status === 'win') wins++;
      return wins / 300;
    };
    // A casual box-grabbing player on each mode's own board
    const vsCozy = winRate('cozy', 'cozy');
    const vsChallenge = winRate('challenge', 'challenge');
    expect(vsCozy).toBeGreaterThan(0.7);
    expect(vsChallenge).toBeLessThan(0.15);
    // Same board, only the opponent changes
    expect(winRate('cozy', 'challenge')).toBeLessThan(vsCozy / 3);
  });
});
