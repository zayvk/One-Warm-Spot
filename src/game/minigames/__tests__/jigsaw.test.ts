import { describe, expect, it } from 'vitest';
import {
  buildPiecePath,
  countPlaced,
  createJigsawState,
  generateEdges,
  isSolved,
  jigsawGridSize,
  pickJigsawImage,
  placePiece,
  type JigsawState,
} from '../jigsaw.ts';
import type { Rng } from '../ticTacToe.ts';
import { JIGSAW_IMAGES } from '../../data/media.ts';
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

/** Places every remaining piece on its own slot */
function solveAll(state: JigsawState): JigsawState {
  let s = state;
  for (const id of [...state.tray]) s = placePiece(s, id, id).state;
  return s;
}

describe('jigsaw edges', () => {
  it.each([3, 4])('%i×%i: neighbours interlock and the outer border is flat', (n) => {
    for (let seed = 1; seed <= 40; seed++) {
      const edges = generateEdges(n, seeded(seed));
      expect(edges).toHaveLength(n * n);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const e = edges[r * n + c];
          if (r === 0) expect(e.top).toBe(0);
          if (r === n - 1) expect(e.bottom).toBe(0);
          if (c === 0) expect(e.left).toBe(0);
          if (c === n - 1) expect(e.right).toBe(0);
          if (c < n - 1) {
            expect(Math.abs(e.right)).toBe(1);
            expect(e.right + edges[r * n + c + 1].left).toBe(0);
          }
          if (r < n - 1) {
            expect(Math.abs(e.bottom)).toBe(1);
            expect(e.bottom + edges[(r + 1) * n + c].top).toBe(0);
          }
        }
      }
    }
  });

  it('cuts both tabs and blanks across seeds', () => {
    const seams = Array.from({ length: 20 }, (_, s) => generateEdges(4, seeded(s + 1)))
      .flat()
      .flatMap((e) => [e.right, e.bottom])
      .filter((v) => v !== 0);
    expect(seams).toContain(1);
    expect(seams).toContain(-1);
  });

  it('draws flat edges as straight lines and tabs as curves that leave the cell', () => {
    const flat = buildPiecePath({ top: 0, right: 0, bottom: 0, left: 0 }, 100);
    expect(flat).toBe('M0 0 L100 0 L100 100 L0 100 L0 0 Z');

    // A top tab pokes above the cell (negative y), a top blank dips into it
    const tab = buildPiecePath({ top: 1, right: 0, bottom: 0, left: 0 }, 100);
    const blank = buildPiecePath({ top: -1, right: 0, bottom: 0, left: 0 }, 100);
    expect(tab).toContain('C');
    expect(tab).toMatch(/ 50 -27\b/);
    expect(blank).toMatch(/ 50 27\b/);
  });
});

describe('createJigsawState', () => {
  it.each<[GameMode, number]>([
    ['cozy', 3],
    ['challenge', 4],
  ])('%s mode cuts a %i×%i puzzle', (mode, n) => {
    expect(jigsawGridSize(mode)).toBe(n);
    const state = createJigsawState(mode, 'bridge', seeded(7));
    expect(state.gridSize).toBe(n);
    expect(state.pieces).toHaveLength(n * n);
    expect(state.slots).toHaveLength(n * n);
  });

  it('starts with every piece in the tray, never pre-solved or pre-sorted', () => {
    for (const mode of ['cozy', 'challenge'] as GameMode[]) {
      for (let seed = 1; seed <= 200; seed++) {
        const state = createJigsawState(mode, 'tea', seeded(seed));
        const n = state.pieces.length;
        expect([...state.tray].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
        expect(state.slots.every((s) => s === null)).toBe(true);
        expect(state.tray.every((id, i) => id === i)).toBe(false);
        expect(isSolved(state)).toBe(false);
        expect(countPlaced(state)).toBe(0);
      }
    }
  });

  it('still shuffles when the random source would leave the tray in order', () => {
    // An rng of ~1 makes Fisher–Yates swap every card with itself
    const state = createJigsawState('cozy', 'tea', () => 0.9999);
    expect(state.tray.every((id, i) => id === i)).toBe(false);
  });

  it('is deterministic for a seed', () => {
    expect(createJigsawState('challenge', 'map', seeded(42))).toEqual(createJigsawState('challenge', 'map', seeded(42)));
  });
});

describe('placePiece', () => {
  it('locks a piece into its own slot without mutating the old state', () => {
    const state = createJigsawState('cozy', 'clock', seeded(3));
    const { state: next, result } = placePiece(state, 4, 4);
    expect(result).toBe('placed');
    expect(next.slots[4]).toBe(4);
    expect(next.tray).not.toContain(4);
    expect(countPlaced(next)).toBe(1);
    expect(state.slots[4]).toBeNull();
    expect(state.tray).toContain(4);
  });

  it('leaves a piece in the tray when dropped on the wrong slot', () => {
    const state = createJigsawState('cozy', 'clock', seeded(3));
    const { state: next, result } = placePiece(state, 2, 5);
    expect(result).toBe('wrong');
    expect(next).toBe(state);
  });

  it('never moves a locked piece or fills a taken slot', () => {
    const placed = placePiece(createJigsawState('challenge', 'radio', seeded(9)), 6, 6).state;
    expect(placePiece(placed, 6, 7)).toEqual({ state: placed, result: 'invalid' });
    expect(placePiece(placed, 6, 6).result).toBe('invalid');
    expect(placePiece(placed, 99, 0).result).toBe('invalid');
    expect(placePiece(placed, 1, -1).result).toBe('invalid');
    expect(placePiece(placed, 1, 16).result).toBe('invalid');
  });

  it.each<GameMode>(['cozy', 'challenge'])('detects completion only once every %s piece is home', (mode) => {
    const state = createJigsawState(mode, 'bed', seeded(11));
    const lastId = state.tray[state.tray.length - 1];
    let s = state;
    for (const id of state.tray.slice(0, -1)) s = placePiece(s, id, id).state;
    expect(isSolved(s)).toBe(false);
    expect(countPlaced(s)).toBe(state.pieces.length - 1);
    s = placePiece(s, lastId, lastId).state;
    expect(isSolved(s)).toBe(true);
    expect(s.tray).toHaveLength(0);
    expect(solveAll(state)).toEqual(s);
  });
});

describe('pickJigsawImage', () => {
  it('offers the 15 paintings plus bonus shelter scenes, each with a unique id', () => {
    const ids = JIGSAW_IMAGES.map((img) => img.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JIGSAW_IMAGES.filter((img) => img.square)).toHaveLength(15);
    for (const img of JIGSAW_IMAGES) expect(img.src).toMatch(/^\/source\/.+\.webp$/);
  });

  it('never picks an excluded painting while others remain', () => {
    const exclude = JIGSAW_IMAGES.slice(0, -2).map((img) => img.id);
    const allowed = JIGSAW_IMAGES.slice(-2).map((img) => img.id);
    for (let seed = 1; seed <= 100; seed++) {
      expect(allowed).toContain(pickJigsawImage(exclude, seeded(seed)).id);
    }
  });

  it('reopens the pool once everything is excluded, still skipping the latest', () => {
    const all = JIGSAW_IMAGES.map((img) => img.id);
    const latest = all[all.length - 1];
    const seen = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const id = pickJigsawImage(all, seeded(seed)).id;
      expect(id).not.toBe(latest);
      seen.add(id);
    }
    expect(seen.size).toBe(all.length - 1);
  });

  it('handles a one-painting pool and an rng that returns ~1', () => {
    const solo = [JIGSAW_IMAGES[0]];
    expect(pickJigsawImage([JIGSAW_IMAGES[0].id], Math.random, solo)).toBe(JIGSAW_IMAGES[0]);
    expect(pickJigsawImage([], () => 0.99999999)).toBe(JIGSAW_IMAGES[JIGSAW_IMAGES.length - 1]);
  });
});
