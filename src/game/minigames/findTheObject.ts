/* ───── Find the Object: a procedurally piled "rummage drawer" with a target checklist ───── */

import type { GameMode } from '../types/game.ts';
import type { Rng } from './ticTacToe.ts';

export type RummageItemId =
  | 'thread'
  | 'seeds'
  | 'key'
  | 'coil'
  | 'matchbox'
  | 'mug'
  | 'spoon'
  | 'jar'
  | 'bolt'
  | 'pinecone'
  | 'rag'
  | 'button'
  | 'twine'
  | 'wrench'
  | 'leaf'
  | 'bottle'
  | 'patch'
  | 'nail';

export interface RummageItemDef {
  id: RummageItemId;
  name: string;
  /** Size as a fraction of the tray's height (the tray is `TRAY_ASPECT` times wider than tall) */
  width: number;
  height: number;
}

export interface PileItem {
  /** Unique per pile, e.g. `bolt-7` */
  instanceId: string;
  itemId: RummageItemId;
  /** Centre, normalized to the tray (0..1 across its width / height) */
  x: number;
  y: number;
  /** Degrees */
  rotation: number;
  /** Higher draws on top */
  zIndex: number;
  isTarget: boolean;
  found: boolean;
}

export interface RummageState {
  mode: GameMode;
  /** Every item in the pile, in no particular order (sort by `zIndex` to draw) */
  items: readonly PileItem[];
  /** The checklist, in display order (instance ids of the targets) */
  targetIds: readonly string[];
}

export interface CollectResult {
  state: RummageState;
  /** false for clutter, unknown ids or an already-found target (the state is then unchanged) */
  collected: boolean;
  complete: boolean;
}

/** The drawer is 1.6× wider than it is tall */
export const TRAY_ASPECT = 1.6;
/** Item centres always stay inside this safe band of the tray */
export const TRAY_BOUNDS = { minX: 0.12, maxX: 0.88, minY: 0.16, maxY: 0.84 } as const;
/** The art is drawn in a base box (in thousandths of the tray height) and scaled up by this */
export const RUMMAGE_ART_SCALE = 1.5;
/** How far a tapped piece of clutter scoots aside, in tray heights */
export const NUDGE_DISTANCE = 0.17;

const art = (w: number, h: number) => ({ width: (w * RUMMAGE_ART_SCALE) / 1000, height: (h * RUMMAGE_ART_SCALE) / 1000 });

export const RUMMAGE_ITEMS: readonly RummageItemDef[] = [
  { id: 'thread', name: 'Spool of Thread', ...art(120, 150) },
  { id: 'seeds', name: 'Seed Packet', ...art(130, 170) },
  { id: 'key', name: 'Brass Key', ...art(200, 90) },
  { id: 'coil', name: 'Copper Coil', ...art(170, 130) },
  { id: 'matchbox', name: 'Matchbox', ...art(170, 110) },
  { id: 'mug', name: 'Tin Mug', ...art(150, 140) },
  { id: 'spoon', name: 'Wooden Spoon', ...art(230, 80) },
  { id: 'jar', name: 'Glass Jar', ...art(130, 170) },
  { id: 'bolt', name: 'Rusty Bolt', ...art(170, 80) },
  { id: 'pinecone', name: 'Pinecone', ...art(120, 160) },
  { id: 'rag', name: 'Folded Rag', ...art(180, 120) },
  { id: 'button', name: 'Old Button', ...art(110, 110) },
  { id: 'twine', name: 'Twine Ball', ...art(140, 140) },
  { id: 'wrench', name: 'Small Wrench', ...art(220, 80) },
  { id: 'leaf', name: 'Dried Leaf', ...art(170, 110) },
  { id: 'bottle', name: 'Cork Bottle', ...art(90, 200) },
  { id: 'patch', name: 'Cloth Patch', ...art(140, 140) },
  { id: 'nail', name: 'Iron Nail', ...art(200, 50) },
];

export function getRummageItem(id: RummageItemId): RummageItemDef {
  return RUMMAGE_ITEMS.find((it) => it.id === id)!;
}

interface ModeRules {
  targets: number;
  clutter: number;
  /** Clutter pieces laid over each target, inclusive range */
  cover: readonly [number, number];
  /** How far a covering piece sits from its target's centre, as a fraction of the target's size (smaller = buries it deeper) */
  coverReach: readonly [number, number];
  /** Clutter pieces tucked underneath the targets */
  under: number;
  targetTilt: number;
  clutterTilt: number;
}

export const RUMMAGE_RULES: Record<GameMode, ModeRules> = {
  cozy: { targets: 3, clutter: 13, cover: [1, 2], coverReach: [0.5, 0.75], under: 3, targetTilt: 18, clutterTilt: 30 },
  challenge: { targets: 5, clutter: 30, cover: [3, 4], coverReach: [0.05, 0.3], under: 1, targetTilt: 50, clutterTilt: 75 },
};

function between(rng: Rng, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function intBetween(rng: Rng, lo: number, hi: number): number {
  return Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const clampX = (x: number) => Math.min(TRAY_BOUNDS.maxX, Math.max(TRAY_BOUNDS.minX, x));
const clampY = (y: number) => Math.min(TRAY_BOUNDS.maxY, Math.max(TRAY_BOUNDS.minY, y));

function randomSpot(rng: Rng): { x: number; y: number } {
  return { x: between(rng, TRAY_BOUNDS.minX, TRAY_BOUNDS.maxX), y: between(rng, TRAY_BOUNDS.minY, TRAY_BOUNDS.maxY) };
}

/** Distance in tray heights (x is stretched by the tray's aspect) */
function trayDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot((a.x - b.x) * TRAY_ASPECT, a.y - b.y);
}

/**
 * A fresh pile: Cozy hides 3 targets among 13 clutter pieces (lightly covered), Challenge
 * 5 among 30 (each under 3–4 pieces sitting almost right on top, tilted further). Targets are unique and their kind never
 * appears as clutter, so there are no look-alike decoys.
 */
export function createRummageState(mode: GameMode, rng: Rng = Math.random): RummageState {
  const rules = RUMMAGE_RULES[mode];
  const kinds = shuffled(RUMMAGE_ITEMS.map((it) => it.id), rng);
  const targetKinds = kinds.slice(0, rules.targets);
  const clutterPool = kinds.slice(rules.targets);

  // Clutter kinds: every non-target kind once before any repeats
  const clutterKinds: RummageItemId[] = [];
  while (clutterKinds.length < rules.clutter) clutterKinds.push(...shuffled(clutterPool, rng));
  clutterKinds.length = rules.clutter;

  let serial = 0;
  const make = (itemId: RummageItemId, spot: { x: number; y: number }, tilt: number, isTarget: boolean): PileItem => ({
    instanceId: `${itemId}-${serial++}`,
    itemId,
    x: clampX(spot.x),
    y: clampY(spot.y),
    rotation: Math.round(between(rng, -tilt, tilt)),
    zIndex: 0,
    isTarget,
    found: false,
  });

  // Targets spread out across the drawer
  const targets: PileItem[] = [];
  for (const kind of targetKinds) {
    let spot = randomSpot(rng);
    for (let tries = 0; tries < 40 && targets.some((t) => trayDistance(t, spot) < 0.3); tries++) spot = randomSpot(rng);
    targets.push(make(kind, spot, rules.targetTilt, true));
  }

  // Covering clutter laid over each target, then the rest scattered around
  const covers: PileItem[] = [];
  const queue = [...clutterKinds];
  for (const t of targets) {
    const def = getRummageItem(t.itemId);
    const size = (def.width + def.height) / 2;
    const n = intBetween(rng, rules.cover[0], rules.cover[1]);
    for (let k = 0; k < n && queue.length > 0; k++) {
      const angle = between(rng, 0, Math.PI * 2);
      const reach = size * between(rng, rules.coverReach[0], rules.coverReach[1]);
      const spot = { x: t.x + (Math.cos(angle) * reach) / TRAY_ASPECT, y: t.y + Math.sin(angle) * reach };
      covers.push(make(queue.shift()!, spot, rules.clutterTilt, false));
    }
  }
  const scattered = queue.map((kind) => make(kind, randomSpot(rng), rules.clutterTilt, false));

  // Layers: a few scattered pieces under the targets, then the targets, then everything else
  const under = scattered.slice(0, rules.under);
  const over = shuffled([...covers, ...scattered.slice(rules.under)], rng);
  const layered = [...under, ...targets, ...over].map((it, i) => ({ ...it, zIndex: i + 1 }));

  return { mode, items: layered, targetIds: targets.map((t) => t.instanceId) };
}

function topZ(state: RummageState): number {
  return state.items.reduce((m, it) => Math.max(m, it.zIndex), 0);
}

function lift(state: RummageState, instanceId: string, x: number, y: number, rotation?: number): RummageState {
  const top = topZ(state);
  const onTop = (it: PileItem) => it.zIndex === top && state.items.filter((o) => o.zIndex === top).length === 1;
  return {
    ...state,
    items: state.items.map((it) =>
      it.instanceId === instanceId
        ? { ...it, x: clampX(x), y: clampY(y), rotation: rotation ?? it.rotation, zIndex: onTop(it) ? it.zIndex : top + 1 }
        : it,
    ),
  };
}

function findClutter(state: RummageState, instanceId: string): PileItem | undefined {
  const it = state.items.find((i) => i.instanceId === instanceId);
  return it && !it.isTarget ? it : undefined;
}

/** Drags a clutter piece to (x, y), clamped inside the tray and lifted above the rest. Targets / unknown ids leave the state unchanged. */
export function movePileItem(state: RummageState, instanceId: string, x: number, y: number): RummageState {
  if (!findClutter(state, instanceId) || !Number.isFinite(x) || !Number.isFinite(y)) return state;
  return lift(state, instanceId, x, y);
}

/**
 * A quick tap on clutter: it scoots `NUDGE_DISTANCE` toward the nearest tray edge that
 * still has room (with a little wobble), lifted above the rest.
 */
export function nudgeClutterItem(state: RummageState, instanceId: string, rng: Rng = Math.random): RummageState {
  const item = findClutter(state, instanceId);
  if (!item) return state;
  // Room to each edge, in tray heights
  const edges = [
    { dx: -1, dy: 0, room: (item.x - TRAY_BOUNDS.minX) * TRAY_ASPECT },
    { dx: 1, dy: 0, room: (TRAY_BOUNDS.maxX - item.x) * TRAY_ASPECT },
    { dx: 0, dy: -1, room: item.y - TRAY_BOUNDS.minY },
    { dx: 0, dy: 1, room: TRAY_BOUNDS.maxY - item.y },
  ].filter((e) => e.room > 0.02);
  if (edges.length === 0) return state;
  const edge = edges.reduce((a, b) => (b.room < a.room ? b : a));
  const dist = Math.min(NUDGE_DISTANCE, edge.room);
  const wobble = between(rng, -0.04, 0.04);
  const x = item.x + (edge.dx * dist + edge.dy * wobble) / TRAY_ASPECT;
  const y = item.y + edge.dy * dist + edge.dx * wobble;
  return lift(state, instanceId, x, y, item.rotation + Math.round(between(rng, -12, 12)));
}

export function isRummageComplete(state: RummageState): boolean {
  return state.items.every((it) => !it.isTarget || it.found);
}

export function countFound(state: RummageState): number {
  return state.items.filter((it) => it.isTarget && it.found).length;
}

/** Picks up a target from the pile and ticks it off the checklist */
export function collectTargetItem(state: RummageState, instanceId: string): CollectResult {
  const item = state.items.find((it) => it.instanceId === instanceId);
  if (!item || !item.isTarget || item.found) return { state, collected: false, complete: isRummageComplete(state) };
  const next = { ...state, items: state.items.map((it) => (it.instanceId === instanceId ? { ...it, found: true } : it)) };
  return { state: next, collected: true, complete: isRummageComplete(next) };
}

/** The first target on the checklist still to find (Cozy's Hint), or null when done */
export function getNextHintTargetId(state: RummageState): string | null {
  return state.targetIds.find((id) => !state.items.find((it) => it.instanceId === id)?.found) ?? null;
}
