/* ───── Randomized Terrace Box & Weed Placement (pure, seedable) ───── */

import {
  DEFAULT_TERRACE_SPAWNS,
  TERRACE_BOX_IDS,
  TERRACE_BOX_VARIANTS,
  TERRACE_SPAWN_RULES,
  TERRACE_WEED_IDS,
  TERRACE_WEED_VARIANTS,
  terraceScene,
  terraceVariantConfig,
  type TerraceBoxVariant,
  type TerracePropSpawn,
  type TerraceSpawns,
  type TerraceWeedVariant,
} from '../data/scenes/terrace.ts';

export type Rng = () => number;

/** Small deterministic PRNG (mulberry32) — same seed, same layout */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const { aspect, bounds, noSpawn, keepClear, gap } = TERRACE_SPAWN_RULES;

/** Distance in stage-height units (x is stretched by the stage aspect) */
function stageDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

function spawnRadius(s: TerracePropSpawn): number {
  return terraceVariantConfig(s.variant).spawnRadius * s.scale;
}

/** Is a prop of radius `r` (stage-height units) at (x, y) clear of walls, structures and the entry path? */
function isClearOfScenery(x: number, y: number, r: number): boolean {
  if (x < bounds.xMin || x > bounds.xMax || y < bounds.yMin || y > bounds.yMax) return false;
  const rx = r / aspect;
  for (const z of noSpawn) {
    if (x > z.xMin - rx && x < z.xMax + rx && y > z.yMin - r && y < z.yMax + r) return false;
  }
  for (const ob of terraceScene.obstacles ?? []) {
    if (ob.shape === 'ellipse') {
      const dx = (x - ob.x) / (ob.rx + rx);
      const dy = (y - ob.y) / (ob.ry + r);
      if (dx * dx + dy * dy < 1) return false;
    } else if (x > ob.xMin - rx && x < ob.xMax + rx && y > ob.yMin - r && y < ob.yMax + r) {
      return false;
    }
  }
  return keepClear.every((z) => stageDist({ x, y }, z) >= z.r + r);
}

/** How far a point sits from the nearest rooftop edge (lower = hugging a wall or corner) */
function edgeDistance(x: number, y: number): number {
  const leftWallX = 0.2 * Math.sqrt(Math.max(0, 1 - ((y - 0.5) / 0.2) ** 2));
  return Math.min(y - bounds.yMin, bounds.yMax - y, (bounds.xMax - x) * aspect, (x - leftWallX) * aspect);
}

/**
 * Every rule a layout must satisfy: all 9 props present, inside the open floor,
 * clear of walls, fixed structures and the entry path, and never crowding each other.
 * Returns human-readable problems (empty = valid).
 */
export function findSpawnProblems(spawns: TerraceSpawns): string[] {
  const problems: string[] = [];
  const ids = [...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS];
  for (const id of ids) {
    const s = spawns[id];
    if (!s) {
      problems.push(`${id} is missing`);
      continue;
    }
    if (!isClearOfScenery(s.x, s.y, spawnRadius(s))) problems.push(`${id} overlaps scenery or leaves the floor`);
  }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = spawns[ids[i]];
      const b = spawns[ids[j]];
      if (a && b && stageDist(a, b) < spawnRadius(a) + spawnRadius(b) + gap) {
        problems.push(`${ids[i]} crowds ${ids[j]}`);
      }
    }
  }
  return problems;
}

const MAX_LAYOUT_ATTEMPTS = 12;
const MAX_PROP_SAMPLES = 400;

function tryLayout(rng: Rng): TerraceSpawns | null {
  const placed: TerracePropSpawn[] = [];
  const spawns: TerraceSpawns = {};

  const boxVariants = shuffle(Object.keys(TERRACE_BOX_VARIANTS) as TerraceBoxVariant[], rng);
  const weedKinds = Object.keys(TERRACE_WEED_VARIANTS) as TerraceWeedVariant[];
  const weedVariants = shuffle([...weedKinds, ...weedKinds], rng);

  const plan = [
    ...TERRACE_BOX_IDS.map((id, i) => ({ id, variant: boxVariants[i], candidates: 10 })),
    /* Weeds lean toward wall edges & cracks about half the time */
    ...TERRACE_WEED_IDS.map((id, i) => ({ id, variant: weedVariants[i], candidates: rng() < 0.5 ? 3 : 1 })),
  ];

  for (const { id, variant, candidates } of plan) {
    const scale = 0.92 + rng() * 0.16;
    const flipX = rng() < 0.5;
    const r = terraceVariantConfig(variant).spawnRadius * scale;
    let best: TerracePropSpawn | null = null;
    let found = 0;

    for (let n = 0; n < MAX_PROP_SAMPLES && found < candidates; n++) {
      const x = bounds.xMin + rng() * (bounds.xMax - bounds.xMin);
      const y = bounds.yMin + rng() * (bounds.yMax - bounds.yMin);
      if (!isClearOfScenery(x, y, r)) continue;
      if (placed.some((p) => stageDist(p, { x, y }) < spawnRadius(p) + r + gap)) continue;
      found++;
      /* Best-of-N: keep the candidate hugging the rooftop edges most closely */
      if (!best || edgeDistance(x, y) < edgeDistance(best.x, best.y)) {
        best = { x, y, variant, scale, flipX };
      }
    }
    if (!best) return null;
    placed.push(best);
    spawns[id] = best;
  }
  return spawns;
}

/**
 * Fresh randomized Terrace layout: 3 boxes (one of each sprite, biased toward
 * edges & corners) and 6 weeds (two of each sprite), with 0.92–1.08× scale and
 * random flips. Falls back to the hand-placed layout if no fit is found.
 */
export function generateTerraceSpawns(seed: number = Math.floor(Math.random() * 2 ** 32)): TerraceSpawns {
  const rng = seededRng(seed);
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
    const layout = tryLayout(rng);
    if (layout) return layout;
  }
  return structuredClone(DEFAULT_TERRACE_SPAWNS);
}
