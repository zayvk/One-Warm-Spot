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
  isBoxVariant,
  type TerraceBoxVariant,
  type TerracePropSpawn,
  type TerracePropVariant,
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

const { aspect, bounds, noSpawn, keepClear, gap, perimeterBand } = TERRACE_SPAWN_RULES;

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

/**
 * How far a point sits from the rooftop perimeter — the left/back walls, the
 * front & right edges and the front-left brick steps (lower = hugging an edge).
 */
export function perimeterDistance(x: number, y: number): number {
  const leftWallX = 0.2 * Math.sqrt(Math.max(0, 1 - ((y - 0.5) / 0.2) ** 2));
  const edges = [y - bounds.yMin, bounds.yMax - y, (bounds.xMax - x) * aspect, (x - leftWallX) * aspect];
  for (const z of noSpawn) {
    const dx = Math.max(0, z.xMin - x, x - z.xMax) * aspect;
    const dy = Math.max(0, z.yMin - y, y - z.yMax);
    edges.push(Math.hypot(dx, dy));
  }
  return Math.min(...edges);
}

function isSpawnClear(spawn: TerracePropSpawn): boolean {
  return isClearOfScenery(spawn.x, spawn.y, spawnRadius(spawn));
}

function crowds(a: TerracePropSpawn, b: TerracePropSpawn): boolean {
  return stageDist(a, b) < spawnRadius(a) + spawnRadius(b) + gap;
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
    if (!isSpawnClear(s)) problems.push(`${id} overlaps scenery or leaves the floor`);
  }
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = spawns[ids[i]];
      const b = spawns[ids[j]];
      if (a && b && crowds(a, b)) {
        problems.push(`${ids[i]} crowds ${ids[j]}`);
      }
    }
  }
  return problems;
}

const MAX_LAYOUT_ATTEMPTS = 12;
const MAX_PROP_SAMPLES = 400;
/* Boxes pick the tightest of a few perimeter spots (corners); weeds scatter anywhere along the edges */
const BOX_CANDIDATES = 4;
const WEED_CANDIDATES = 1;

interface PlaceOptions {
  variant: TerracePropVariant;
  /** Props already on the rooftop that the new one must not crowd */
  others: readonly TerracePropSpawn[];
  rng: Rng;
  scale?: number;
  flipX?: boolean;
}

/**
 * Find a collision-safe spot for one prop: inside the open floor, clear of walls,
 * stations, stand spots and the stairwell path, and never crowding `others`.
 * Strongly prefers the perimeter band; only falls back to the open floor if the
 * edges are full. Returns `null` if nothing fits.
 */
function placeProp({ variant, others, rng, scale, flipX }: PlaceOptions): TerracePropSpawn | null {
  const s = scale ?? 0.92 + rng() * 0.16;
  const flip = flipX ?? rng() < 0.5;
  const candidates = isBoxVariant(variant) ? BOX_CANDIDATES : WEED_CANDIDATES;
  let best: TerracePropSpawn | null = null;
  let fallback: TerracePropSpawn | null = null;
  let found = 0;

  for (let n = 0; n < MAX_PROP_SAMPLES && found < candidates; n++) {
    const spawn: TerracePropSpawn = {
      x: bounds.xMin + rng() * (bounds.xMax - bounds.xMin),
      y: bounds.yMin + rng() * (bounds.yMax - bounds.yMin),
      variant,
      scale: s,
      flipX: flip,
    };
    if (!isSpawnClear(spawn) || others.some((o) => crowds(o, spawn))) continue;
    const d = perimeterDistance(spawn.x, spawn.y);
    if (d > perimeterBand) {
      if (!fallback || d < perimeterDistance(fallback.x, fallback.y)) fallback = spawn;
      continue;
    }
    found++;
    if (!best || d < perimeterDistance(best.x, best.y)) best = spawn;
  }
  return best ?? fallback;
}

function tryLayout(rng: Rng): TerraceSpawns | null {
  const placed: TerracePropSpawn[] = [];
  const spawns: TerraceSpawns = {};

  const boxVariants = shuffle(Object.keys(TERRACE_BOX_VARIANTS) as TerraceBoxVariant[], rng);
  const weedKinds = Object.keys(TERRACE_WEED_VARIANTS) as TerraceWeedVariant[];
  const weedVariants = shuffle([...weedKinds, ...weedKinds], rng);

  const plan = [
    ...TERRACE_BOX_IDS.map((id, i) => ({ id, variant: boxVariants[i] as TerracePropVariant })),
    ...TERRACE_WEED_IDS.map((id, i) => ({ id, variant: weedVariants[i] as TerracePropVariant })),
  ];

  for (const { id, variant } of plan) {
    const spawn = placeProp({ variant, others: placed, rng });
    if (!spawn) return null;
    placed.push(spawn);
    spawns[id] = spawn;
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

const SPAWN_IDS: readonly string[] = [...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS];

/**
 * Keep every valid prop where it is and move only the ones that now overlap
 * scenery or each other (e.g. a layout saved before the stations were recomposed).
 * Returns the same object when nothing needs to move.
 */
export function repairTerraceSpawns(spawns: TerraceSpawns, rng: Rng = Math.random): TerraceSpawns {
  if (findSpawnProblems(spawns).length === 0) return spawns;
  const fixed: TerraceSpawns = { ...spawns };
  const kept: TerracePropSpawn[] = [];
  const misplaced: string[] = [];
  for (const id of SPAWN_IDS) {
    const s = spawns[id];
    if (!s) continue;
    if (isSpawnClear(s) && !kept.some((k) => crowds(k, s))) kept.push(s);
    else misplaced.push(id);
  }
  for (const id of misplaced) {
    const s = spawns[id];
    const moved = placeProp({ variant: s.variant, others: kept, rng, scale: s.scale, flipX: s.flipX });
    if (!moved) return spawns;
    fixed[id] = moved;
    kept.push(moved);
  }
  return fixed;
}

/* ── Overnight regrowth ── */

/** Cleared weeds that sprout back each morning (at most the cleared count) */
export const WEEDS_REGROWN_PER_NIGHT = { min: 1, max: 2 } as const;
/** A searched box is replaced by a fresh one every this many days (on day % N === 0) */
export const BOX_REFRESH_EVERY_DAYS = 2;

/** The slice of rooftop state regrowth reads and rewrites */
export interface RegrowableRooftop {
  spawns: TerraceSpawns | null;
  clearedWeeds: string[];
  searchedBoxes: string[];
}

export interface RegrowOutcome<T extends RegrowableRooftop> {
  /** Rooftop after the night (the same object if nothing regrew) */
  state: T;
  regrownWeeds: string[];
  refreshedBoxes: string[];
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * A new morning on the rooftop (`day` = the day just begun):
 * - 1–2 cleared weeds sprout back at brand-new spots with fresh art, size & flip;
 * - on every 2nd day one searched box is replaced by a fresh one at a new edge spot.
 * New spots use the same collision-safe, perimeter-hugging placement as fresh layouts,
 * so the 3-box / 6-weed caps hold and nothing ever overlaps stations or other props.
 */
export function regrowTerraceSpawns<T extends RegrowableRooftop>(
  state: T,
  day: number,
  rng: Rng = Math.random,
): RegrowOutcome<T> {
  const spawns: TerraceSpawns = structuredClone(state.spawns ?? DEFAULT_TERRACE_SPAWNS);
  const cleared = state.clearedWeeds.filter((id) => (TERRACE_WEED_IDS as readonly string[]).includes(id));
  const searched = state.searchedBoxes.filter((id) => (TERRACE_BOX_IDS as readonly string[]).includes(id));
  const regrownWeeds: string[] = [];
  const refreshedBoxes: string[] = [];

  /* The moving prop's old spot is freed; every other spawn (even a cleared one) stays reserved */
  const relocate = (id: string, variant: TerracePropVariant): boolean => {
    const others = Object.entries(spawns).filter(([k]) => k !== id).map(([, s]) => s);
    const spawn = placeProp({ variant, others, rng });
    if (!spawn) return false;
    spawns[id] = spawn;
    return true;
  };

  if (cleared.length > 0) {
    const { min, max } = WEEDS_REGROWN_PER_NIGHT;
    const count = Math.min(cleared.length, min + Math.floor(rng() * (max - min + 1)));
    const weedKinds = Object.keys(TERRACE_WEED_VARIANTS) as TerraceWeedVariant[];
    for (const id of shuffle(cleared, rng).slice(0, count)) {
      if (relocate(id, pick(weedKinds, rng))) regrownWeeds.push(id);
    }
  }

  if (searched.length > 0 && day % BOX_REFRESH_EVERY_DAYS === 0) {
    const id = pick(searched, rng);
    const boxKinds = Object.keys(TERRACE_BOX_VARIANTS) as TerraceBoxVariant[];
    if (relocate(id, pick(boxKinds, rng))) refreshedBoxes.push(id);
  }

  if (regrownWeeds.length === 0 && refreshedBoxes.length === 0) {
    return { state, regrownWeeds, refreshedBoxes };
  }
  return {
    state: {
      ...state,
      spawns,
      clearedWeeds: state.clearedWeeds.filter((id) => !regrownWeeds.includes(id)),
      searchedBoxes: state.searchedBoxes.filter((id) => !refreshedBoxes.includes(id)),
    },
    regrownWeeds,
    refreshedBoxes,
  };
}
