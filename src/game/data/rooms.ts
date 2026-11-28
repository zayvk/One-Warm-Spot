/* ───── Apartment room interiors: room types, curated anchor zones & a random layout generator (pure) ───── */

import { assetUrl } from '../engine/assetUrl.ts';
import type { ResourceId } from '../types/game.ts';

/** Random source returning a float in [0, 1) — injectable for deterministic tests */
export type RoomRng = () => number;

export type RoomType = 'bedroom' | 'kitchen' | 'living' | 'study';

/** Action pose performed by the traveler right before inspecting a room prop */
export type RoomActionPose = 'peek' | 'search' | 'reach' | 'fix';

/** Mini-game wired to a room prop (covers all 7 puzzles across the 20 props) */
export type RoomPuzzleId =
  | 'connect-wires'
  | 'tic-tac-toe'
  | 'dots-and-lines'
  | 'jigsaw'
  | 'find-the-object'
  | 'safe-dial'
  | 'hit-the-nail';

export const ROOM_PUZZLE_IDS: readonly RoomPuzzleId[] = [
  'connect-wires',
  'tic-tac-toe',
  'dots-and-lines',
  'jigsaw',
  'find-the-object',
  'safe-dial',
  'hit-the-nail',
];

export const ROOM_ACTION_POSES: readonly RoomActionPose[] = ['peek', 'search', 'reach', 'fix'];

/** Where in a room a prop may stand */
export type AnchorZoneType = 'back-wall' | 'side-wall' | 'mid-floor' | 'corner';

/** Room shells and props are painted for the same 1376×768 stage as the floors */
export const ROOM_ART_W = 1376;
export const ROOM_ART_H = 768;

/** Anatomical height multipliers relative to standing height (mirrors `shelterScene.ts`) */
export const ROOM_POSE_HEIGHT_SCALE: Record<'idle' | 'walk' | RoomActionPose, number> = {
  idle: 1.0,
  walk: 1.0,
  reach: 1.0,
  fix: 1.0,
  search: 0.72,
  peek: 0.6,
};

/** Walkable interior floor rectangle (stage fractions) */
export const ROOM_FLOOR_BOUNDS = {
  xMin: 0.1,
  xMax: 0.9,
  yMin: 0.745,
  yMax: 0.955,
} as const;

export interface RoomPropDef {
  id: string;
  /** Player-facing name (hover tag, toasts) */
  label: string;
  src: string;
  /** Image width ÷ height */
  aspect: number;
  /** Height as a fraction of the stage height when standing against the back wall */
  baseScale: number;
  allowFlip: boolean;
  zones: readonly AnchorZoneType[];
  /** Pose the traveler strikes upon walking up to this prop */
  actionPose: RoomActionPose;
  /** Scavenging mini-game launched after the pose beat */
  puzzle: RoomPuzzleId;
  /** Salvage awarded on winning the mini-game */
  reward: Partial<Record<ResourceId, number>>;
}

export interface AnchorZone {
  id: string;
  type: AnchorZoneType;
  /** Bottom-centre foot point, normalized to the stage */
  x: number;
  y: number;
  /** Perspective: 1 at the back wall, a little larger toward the viewer */
  depthScale: number;
  /** Random nudge: x in ±`x`, y in [yMin, yMax] */
  jitter: { x: number; yMin: number; yMax: number };
  /** Tallest prop (stage-height fraction) allowed here — keeps windows and radiators clear */
  maxHeight?: number;
}

export interface RoomDef {
  type: RoomType;
  name: string;
  shell: string;
  /** Which side of the painted shell has the sunlit window */
  windowSide: 'left' | 'right';
  /** Where the window light falls, for the drifting dust motes (stage fractions) */
  light: { x: number; y: number; w: number; h: number };
  props: readonly RoomPropDef[];
  zones: readonly AnchorZone[];
}

export interface PlacedRoomProp {
  propId: string;
  zoneId: string;
  /** Bottom-centre foot point, normalized to the stage */
  x: number;
  y: number;
  /** Rendered height as a fraction of the stage height */
  scale: number;
  flipX: boolean;
}

export interface GeneratedRoomLayout {
  doorId: string;
  roomType: RoomType;
  /** Back to front (ascending foot `y`) */
  props: PlacedRoomProp[];
}

export const MIN_ROOM_PROPS = 3;
export const MAX_ROOM_PROPS = 5;

const PROP_DIR = '/source/props/rooms';
const prop = (
  room: string,
  id: string,
  label: string,
  w: number,
  h: number,
  baseScale: number,
  zones: readonly AnchorZoneType[],
  actionPose: RoomActionPose,
  puzzle: RoomPuzzleId,
  reward: Partial<Record<ResourceId, number>>,
  allowFlip = true,
): RoomPropDef => ({
  id,
  label,
  src: assetUrl(`${PROP_DIR}/prop-${room}-${id}.webp`),
  aspect: w / h,
  baseScale,
  allowFlip,
  zones,
  actionPose,
  puzzle,
  reward,
});

/**
 * The five standard spots every shell shares (back wall left / centre / right, side
 * walls at mid depth, the middle of the floor, two foreground corners), measured per
 * painting from its floor line (`fl`) and back-wall edges.
 */
function zonesFor(o: {
  fl: number;
  wallL: number;
  wallR: number;
  leftMax?: number;
  rightMax?: number;
  rightX?: number;
}): AnchorZone[] {
  const backY = o.fl + 0.016;
  const back = { x: 0.018, yMin: 0, yMax: 0.008 };
  const floor = { x: 0.025, yMin: -0.008, yMax: 0.008 };
  return [
    { id: 'back-left', type: 'back-wall', x: o.wallL + 0.11, y: backY, depthScale: 1, jitter: back },
    { id: 'back-center', type: 'back-wall', x: (o.wallL + o.wallR) / 2, y: backY, depthScale: 1, jitter: back },
    { id: 'back-right', type: 'back-wall', x: o.wallR - 0.11, y: backY, depthScale: 1, jitter: back },
    { id: 'left-mid', type: 'side-wall', x: 0.15, y: 0.818, depthScale: 1.15, jitter: floor, maxHeight: o.leftMax },
    { id: 'right-mid', type: 'side-wall', x: o.rightX ?? 0.85, y: 0.818, depthScale: 1.15, jitter: floor, maxHeight: o.rightMax },
    { id: 'center-floor', type: 'mid-floor', x: 0.5, y: 0.87, depthScale: 1.2, jitter: { x: 0.04, yMin: -0.01, yMax: 0.01 }, maxHeight: 0.3 },
    { id: 'front-left', type: 'corner', x: 0.16, y: 0.955, depthScale: 1.3, jitter: floor, maxHeight: 0.33 },
    { id: 'front-right', type: 'corner', x: 0.84, y: 0.955, depthScale: 1.3, jitter: floor, maxHeight: 0.33 },
  ];
}

export const ROOMS: Record<RoomType, RoomDef> = {
  bedroom: {
    type: 'bedroom',
    name: 'Bedroom',
    shell: assetUrl('/source/rooms/room-bedroom-shell.webp'),
    windowSide: 'left',
    light: { x: 0.12, y: 0.12, w: 0.42, h: 0.62 },
    /* Window on the left wall (sill ~0.62): only low pieces stand under it */
    zones: zonesFor({ fl: 0.725, wallL: 0.235, wallR: 0.79, leftMax: 0.24 }),
    props: [
      prop('bedroom', 'bed', 'Iron Bed', 640, 455, 0.26, ['back-wall', 'side-wall'], 'search', 'find-the-object', {
        cloth: 2,
        seeds: 1,
      }),
      prop('bedroom', 'wardrobe', 'Old Wardrobe', 378, 640, 0.46, ['back-wall', 'side-wall'], 'reach', 'safe-dial', {
        cloth: 2,
        timber: 1,
      }),
      prop(
        'bedroom',
        'nightstand',
        'Bedside Table',
        430,
        640,
        0.16,
        ['back-wall', 'side-wall', 'corner'],
        'peek',
        'jigsaw',
        { cloth: 1, seeds: 1, scrap: 1 },
      ),
      prop('bedroom', 'dresser', 'Chest of Drawers', 556, 640, 0.3, ['back-wall', 'side-wall'], 'reach', 'hit-the-nail', {
        timber: 2,
        cloth: 1,
      }),
      prop(
        'bedroom',
        'suitcase',
        'Battered Suitcase',
        640,
        405,
        0.11,
        ['mid-floor', 'corner', 'side-wall'],
        'search',
        'find-the-object',
        { cloth: 2, scrap: 1 },
      ),
    ],
  },
  kitchen: {
    type: 'kitchen',
    name: 'Kitchen',
    shell: assetUrl('/source/rooms/room-kitchen-shell.webp'),
    windowSide: 'right',
    light: { x: 0.5, y: 0.1, w: 0.42, h: 0.6 },
    /* Window on the right wall (sill ~0.6) */
    zones: zonesFor({ fl: 0.74, wallL: 0.215, wallR: 0.785, rightMax: 0.26 }),
    props: [
      prop('kitchen', 'stove', 'Old Stove', 532, 640, 0.27, ['back-wall', 'side-wall'], 'fix', 'connect-wires', {
        scrap: 2,
        food: 1,
      }),
      prop('kitchen', 'cupboard', 'Kitchen Cupboard', 640, 467, 0.22, ['back-wall', 'side-wall'], 'fix', 'hit-the-nail', {
        timber: 2,
        food: 1,
      }),
      prop('kitchen', 'pantry', 'Tall Pantry', 348, 640, 0.43, ['back-wall', 'side-wall'], 'reach', 'jigsaw', {
        food: 2,
        water: 1,
      }),
      prop('kitchen', 'fridge', 'Rusty Fridge', 407, 640, 0.38, ['back-wall', 'side-wall'], 'reach', 'connect-wires', {
        food: 2,
        water: 1,
      }),
      prop('kitchen', 'table', 'Kitchen Table', 640, 531, 0.21, ['mid-floor', 'corner'], 'search', 'dots-and-lines', {
        food: 2,
        timber: 1,
      }),
    ],
  },
  living: {
    type: 'living',
    name: 'Living Room',
    shell: assetUrl('/source/rooms/room-living-shell.webp'),
    windowSide: 'left',
    light: { x: 0.1, y: 0.14, w: 0.46, h: 0.64 },
    /* Window on the left wall (sill ~0.72); radiator on the right wall */
    zones: zonesFor({ fl: 0.718, wallL: 0.265, wallR: 0.81, leftMax: 0.17, rightMax: 0.3, rightX: 0.8 }),
    props: [
      prop('living', 'sofa', 'Worn Sofa', 640, 382, 0.21, ['back-wall', 'mid-floor'], 'search', 'find-the-object', {
        cloth: 2,
        timber: 1,
      }),
      prop('living', 'table', 'Coffee Table', 640, 357, 0.11, ['mid-floor', 'corner'], 'search', 'find-the-object', {
        food: 1,
        cloth: 1,
      }),
      prop(
        'living',
        'tv',
        'Old Television',
        481,
        640,
        0.29,
        ['back-wall', 'side-wall', 'corner'],
        'fix',
        'connect-wires',
        { scrap: 3 },
        false,
      ),
      prop('living', 'armchair', 'Armchair', 640, 630, 0.23, ['side-wall', 'corner', 'mid-floor'], 'search', 'dots-and-lines', {
        cloth: 2,
        seeds: 1,
      }),
      prop('living', 'sideboard', 'Sideboard', 640, 519, 0.24, ['back-wall', 'side-wall'], 'fix', 'hit-the-nail', {
        timber: 2,
        scrap: 1,
      }),
    ],
  },
  study: {
    type: 'study',
    name: 'Study',
    shell: assetUrl('/source/rooms/room-study-shell.webp'),
    windowSide: 'left',
    light: { x: 0.12, y: 0.1, w: 0.4, h: 0.62 },
    /* Window on the left wall (sill ~0.62) */
    zones: zonesFor({ fl: 0.7, wallL: 0.252, wallR: 0.765, leftMax: 0.24 }),
    props: [
      prop('study', 'desk', 'Writing Desk', 640, 524, 0.23, ['back-wall', 'side-wall'], 'peek', 'find-the-object', {
        timber: 1,
        scrap: 1,
        seeds: 1,
      }),
      prop('study', 'cabinet', 'Filing Cabinet', 384, 640, 0.33, ['back-wall', 'side-wall'], 'peek', 'safe-dial', {
        scrap: 2,
        timber: 1,
      }),
      prop('study', 'trunk', 'Old Trunk', 640, 473, 0.14, ['mid-floor', 'corner', 'side-wall'], 'search', 'dots-and-lines', {
        timber: 2,
        cloth: 2,
      }),
      prop('study', 'bookshelf', 'Bookshelf', 356, 640, 0.43, ['back-wall', 'side-wall'], 'reach', 'jigsaw', {
        timber: 2,
        seeds: 1,
      }),
      prop(
        'study',
        'safe',
        'Iron Safe',
        618,
        640,
        0.2,
        ['back-wall', 'corner', 'side-wall'],
        'peek',
        'safe-dial',
        { scrap: 2, cloth: 2 },
        false,
      ),
    ],
  },
};

export const ROOM_TYPES: readonly RoomType[] = ['bedroom', 'kitchen', 'living', 'study'];

export function isRoomType(v: unknown): v is RoomType {
  return typeof v === 'string' && (ROOM_TYPES as readonly string[]).includes(v);
}

export function getRoomProp(roomType: RoomType, propId: string): RoomPropDef | undefined {
  return ROOMS[roomType].props.find((p) => p.id === propId);
}

/** Rendered width of a prop as a fraction of the stage width */
export function roomPropWidth(def: Pick<RoomPropDef, 'aspect'>, scale: number): number {
  return (scale * def.aspect * ROOM_ART_H) / ROOM_ART_W;
}

/**
 * Region of a room kept on screen at any window shape (stage fractions): the back wall
 * plus every placed piece of furniture, so nothing clickable is ever cropped.
 */
export function roomSafeArea(layout: GeneratedRoomLayout): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const area = { xMin: 0.22, xMax: 0.78, yMin: 0.2, yMax: 0.9 };
  for (const p of layout.props) {
    const def = getRoomProp(layout.roomType, p.propId);
    if (!def) continue;
    const half = roomPropWidth(def, p.scale) / 2;
    area.xMin = Math.min(area.xMin, p.x - half);
    area.xMax = Math.max(area.xMax, p.x + half);
    area.yMin = Math.min(area.yMin, p.y - p.scale);
    area.yMax = Math.max(area.yMax, p.y);
  }
  return {
    xMin: Math.max(0, area.xMin),
    xMax: Math.min(1, area.xMax),
    yMin: Math.max(0, area.yMin),
    yMax: Math.min(1, area.yMax + 0.02),
  };
}

function shuffled<T>(items: readonly T[], rng: RoomRng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fitsZone(def: RoomPropDef, zone: AnchorZone): boolean {
  return def.zones.includes(zone.type) && (zone.maxHeight === undefined || def.baseScale * zone.depthScale <= zone.maxHeight);
}

interface Box {
  left: number;
  right: number;
  top: number;
  y: number;
  h: number;
}

function boxOf(def: RoomPropDef, p: PlacedRoomProp): Box {
  const w = roomPropWidth(def, p.scale);
  return { left: p.x - w / 2, right: p.x + w / 2, top: p.y - p.scale, y: p.y, h: p.scale };
}

/**
 * Two pieces clash when they stand side by side at the same depth and overlap, or when
 * the front one hides a large part of the one behind it.
 */
function clashes(a: Box, b: Box): boolean {
  const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  if (overlap <= 0) return false;
  const ratio = overlap / Math.min(a.right - a.left, b.right - b.left);
  if (Math.abs(a.y - b.y) < 0.04) return ratio > 0.08;
  const [back, front] = a.y < b.y ? [a, b] : [b, a];
  const hidden = Math.min(1, Math.max(0, (back.y - front.top) / back.h));
  return ratio > 0.25 && hidden > 0.45;
}

function place(def: RoomPropDef, zone: AnchorZone, rng: RoomRng): PlacedRoomProp {
  const scale = Math.round(def.baseScale * zone.depthScale * 1000) / 1000;
  const half = roomPropWidth(def, scale) / 2;
  const x = zone.x + (rng() * 2 - 1) * zone.jitter.x;
  const y = zone.y + zone.jitter.yMin + rng() * (zone.jitter.yMax - zone.jitter.yMin);
  return {
    propId: def.id,
    zoneId: zone.id,
    x: Math.round(Math.min(0.98 - half, Math.max(0.02 + half, x)) * 1000) / 1000,
    y: Math.round(Math.min(0.99, y) * 1000) / 1000,
    scale,
    flipX: def.allowFlip && rng() < 0.5,
  };
}

const byDepth = (a: PlacedRoomProp, b: PlacedRoomProp) => a.y - b.y;

/**
 * A fresh room behind `doorId`: a random room type, and 3–5 of its props, each on its own
 * compatible anchor zone (small jitter, optional mirror), never clashing with one another,
 * sorted back to front for 2.5D layering.
 */
export function generateRoomLayout(doorId: string, rng: RoomRng = Math.random): GeneratedRoomLayout {
  const roomType = ROOM_TYPES[Math.min(ROOM_TYPES.length - 1, Math.floor(rng() * ROOM_TYPES.length))];
  const room = ROOMS[roomType];
  const target = MIN_ROOM_PROPS + Math.min(MAX_ROOM_PROPS - MIN_ROOM_PROPS, Math.floor(rng() * (MAX_ROOM_PROPS - MIN_ROOM_PROPS + 1)));

  let best: PlacedRoomProp[] = [];
  for (let attempt = 0; attempt < 24 && best.length < target; attempt++) {
    const placed: PlacedRoomProp[] = [];
    const boxes: Box[] = [];
    for (const def of shuffled(room.props, rng)) {
      if (placed.length === target) break;
      const free = room.zones.filter((z) => fitsZone(def, z) && !placed.some((p) => p.zoneId === z.id));
      for (const zone of shuffled(free, rng)) {
        const p = place(def, zone, rng);
        const box = boxOf(def, p);
        if (boxes.some((b) => clashes(b, box))) continue;
        placed.push(p);
        boxes.push(box);
        break;
      }
    }
    if (placed.length > best.length) best = placed;
  }

  /* Never fewer than three: fall back to one back-wall piece per back-wall spot */
  if (best.length < MIN_ROOM_PROPS) {
    const backZones = room.zones.filter((z) => z.type === 'back-wall');
    const backProps = room.props.filter((p) => p.zones.includes('back-wall'));
    best = backZones.slice(0, MIN_ROOM_PROPS).map((z, i) => place(backProps[i], z, rng));
  }
  return { doorId, roomType, props: best.sort(byDepth) };
}

function isUnit(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * Validates a saved layout (props from the room's own pool, each on its own zone, sane
 * numbers). Returns it normalized (re-sorted back to front), or `null` if anything is off.
 */
export function parseRoomLayout(v: unknown, doorId: string): GeneratedRoomLayout | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (!isRoomType(o.roomType) || !Array.isArray(o.props)) return null;
  const room = ROOMS[o.roomType];
  if (o.props.length < 1 || o.props.length > MAX_ROOM_PROPS) return null;
  const props: PlacedRoomProp[] = [];
  for (const raw of o.props as unknown[]) {
    if (!raw || typeof raw !== 'object') return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.propId !== 'string' || !room.props.some((d) => d.id === p.propId)) return null;
    if (typeof p.zoneId !== 'string' || !room.zones.some((z) => z.id === p.zoneId)) return null;
    if (props.some((q) => q.propId === p.propId || q.zoneId === p.zoneId)) return null;
    if (!isUnit(p.x) || !isUnit(p.y) || !isUnit(p.scale) || p.scale === 0) return null;
    if (typeof p.flipX !== 'boolean') return null;
    props.push({ propId: p.propId, zoneId: p.zoneId, x: p.x, y: p.y, scale: p.scale, flipX: p.flipX });
  }
  return { doorId, roomType: o.roomType, props: props.sort(byDepth) };
}

/** Traveler entry stance near the room doorway side */
export function roomEntryPoint(): { x: number; y: number } {
  return { x: 0.13, y: 0.9 };
}

/** Traveler sprite height as a fraction of room stage height, with perspective depth & anatomical pose scaling */
export function roomTravelerScale(y: number, pose: 'idle' | 'walk' | RoomActionPose): number {
  const t = Math.max(0, Math.min(1, (y - 0.72) / 0.24));
  const standing = 0.39 * (0.88 + 0.36 * t);
  return Math.round(standing * ROOM_POSE_HEIGHT_SCALE[pose] * 10000) / 10000;
}

/** Stand target beside a placed prop inside the walkable room floor, plus whether to face right toward it */
export function roomStandTarget(
  placed: PlacedRoomProp,
  def: Pick<RoomPropDef, 'aspect'>,
): { x: number; y: number; facingRight: boolean } {
  const halfW = roomPropWidth(def, placed.scale) / 2;
  const gap = Math.max(0.055, halfW * 0.78 + 0.035);
  /* Stand on the inward side toward room center when near walls, so the traveler stays on open floorboards */
  const stepSign = placed.x >= 0.5 ? -1 : 1;
  const rawX = placed.x + stepSign * gap;
  const rawY = placed.y + 0.012;
  const x = Math.min(ROOM_FLOOR_BOUNDS.xMax, Math.max(ROOM_FLOOR_BOUNDS.xMin, rawX));
  const y = Math.min(ROOM_FLOOR_BOUNDS.yMax, Math.max(ROOM_FLOOR_BOUNDS.yMin, rawY));
  return {
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
    facingRight: placed.x >= x,
  };
}
