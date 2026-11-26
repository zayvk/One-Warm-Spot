/* ───── Old Apartment Terrace — Interactive Scene Config (v2) ───── */

import type {
  AssignableStationId,
  BuildSlotConfig,
  HotspotConfig,
  ShelterSceneConfig,
  StationConfig,
  StationId,
} from './types.ts';
import { SCENE_PROPS } from '../media.ts';

/* ── Randomizable box & weed variants ── */

export type TerraceBoxVariant = 'boxes-intact' | 'box-double' | 'box-single';
export type TerraceWeedVariant = 'weeds-1' | 'weeds-2' | 'weeds-3';
export type TerracePropVariant = TerraceBoxVariant | TerraceWeedVariant;

export interface TerracePropVariantConfig {
  sprite: string;
  spriteAfter?: string;
  label: string;
  reward: Record<string, number>;
  /** Base sprite height relative to the stage */
  propScale: number;
  collider: { rx: number; ry: number };
  /** Footprint radius (stage-height units) used to keep spawns apart */
  spawnRadius: number;
}

export const TERRACE_BOX_VARIANTS: Record<TerraceBoxVariant, TerracePropVariantConfig> = {
  'boxes-intact': {
    sprite: SCENE_PROPS['prop-boxes-intact'],
    spriteAfter: SCENE_PROPS['prop-boxes-cleared'],
    label: 'Broken Boxes — Rummage for materials',
    reward: { scrap: 2, timber: 3 },
    propScale: 0.095,
    collider: { rx: 0.04, ry: 0.024 },
    spawnRadius: 0.05,
  },
  'box-double': {
    sprite: SCENE_PROPS.boxDouble,
    label: 'Weathered Crates — Rummage for materials',
    reward: { timber: 4, cloth: 1 },
    propScale: 0.1,
    collider: { rx: 0.046, ry: 0.026 },
    spawnRadius: 0.055,
  },
  'box-single': {
    sprite: SCENE_PROPS.boxSingle,
    label: 'Abandoned Parcel — Rummage for materials',
    reward: { scrap: 1, timber: 1, cloth: 1 },
    propScale: 0.092,
    collider: { rx: 0.03, ry: 0.02 },
    spawnRadius: 0.042,
  },
};

export const TERRACE_WEED_VARIANTS: Record<TerraceWeedVariant, TerracePropVariantConfig> = {
  'weeds-1': {
    sprite: SCENE_PROPS['prop-weeds-1'],
    label: 'Overgrown Tufts — Clear for materials',
    reward: { seeds: 1, cloth: 1 },
    propScale: 0.064,
    collider: { rx: 0.03, ry: 0.018 },
    spawnRadius: 0.038,
  },
  'weeds-2': {
    sprite: SCENE_PROPS['prop-weeds-2'],
    label: 'Wall Brush — Clear for materials',
    reward: { seeds: 1, cloth: 1 },
    propScale: 0.072,
    collider: { rx: 0.032, ry: 0.02 },
    spawnRadius: 0.042,
  },
  'weeds-3': {
    sprite: SCENE_PROPS.weeds3,
    label: 'Concrete Dandelions — Clear for materials',
    reward: { seeds: 1, cloth: 1 },
    propScale: 0.053,
    collider: { rx: 0.032, ry: 0.017 },
    spawnRadius: 0.036,
  },
};

export const TERRACE_BOX_IDS = ['boxes-1', 'boxes-2', 'boxes-3'] as const;
export const TERRACE_WEED_IDS = ['weeds-1', 'weeds-2', 'weeds-3', 'weeds-4', 'weeds-5', 'weeds-6'] as const;

export interface TerracePropSpawn {
  x: number;
  y: number;
  variant: TerracePropVariant;
  /** Size multiplier (0.92–1.08 for generated layouts) */
  scale: number;
  flipX: boolean;
}

/** Spawn layout for every box & weed hotspot, keyed by hotspot id */
export type TerraceSpawns = Record<string, TerracePropSpawn>;

export function isBoxVariant(v: TerracePropVariant): v is TerraceBoxVariant {
  return v in TERRACE_BOX_VARIANTS;
}

export function terraceVariantConfig(v: TerracePropVariant): TerracePropVariantConfig {
  return isBoxVariant(v) ? TERRACE_BOX_VARIANTS[v] : TERRACE_WEED_VARIANTS[v];
}

/** Hand-placed layout (used for saves from before randomized placement), composed around the station zones */
export const DEFAULT_TERRACE_SPAWNS: TerraceSpawns = {
  'boxes-1': { x: 0.436, y: 0.85, variant: 'box-single', scale: 1.05, flipX: true },
  'boxes-2': { x: 0.594, y: 0.825, variant: 'boxes-intact', scale: 1.04, flipX: false },
  'boxes-3': { x: 0.731, y: 0.855, variant: 'box-double', scale: 1.06, flipX: false },
  'weeds-1': { x: 0.656, y: 0.767, variant: 'weeds-3', scale: 1.04, flipX: true },
  'weeds-2': { x: 0.823, y: 0.835, variant: 'weeds-2', scale: 1, flipX: true },
  'weeds-3': { x: 0.552, y: 0.623, variant: 'weeds-2', scale: 0.96, flipX: true },
  'weeds-4': { x: 0.285, y: 0.752, variant: 'weeds-1', scale: 0.94, flipX: true },
  'weeds-5': { x: 0.341, y: 0.848, variant: 'weeds-3', scale: 1, flipX: false },
  'weeds-6': { x: 0.525, y: 0.827, variant: 'weeds-1', scale: 1.02, flipX: false },
};

/** Box or weed hotspot for a spawn; the traveler stands on the open-floor side */
export function terraceSpawnHotspot(id: string, spawn: TerracePropSpawn): HotspotConfig {
  const v = terraceVariantConfig(spawn.variant);
  const collider = { rx: v.collider.rx * spawn.scale, ry: v.collider.ry * spawn.scale };
  return {
    id,
    type: isBoxVariant(spawn.variant) ? 'searchable' : 'weeds',
    position: { x: spawn.x, y: spawn.y },
    propSprite: v.sprite,
    propSpriteAfter: v.spriteAfter,
    propScale: v.propScale * spawn.scale,
    flipX: spawn.flipX,
    label: v.label,
    reward: { ...v.reward },
    collider,
    standOffset: {
      dx: (spawn.x < 0.5 ? 1 : -1) * (collider.rx + 0.018),
      dy: spawn.y > 0.78 ? -0.012 : 0.024,
    },
  };
}

/** Apply a run's spawn layout to the Terrace config (other hotspots untouched) */
export function withTerraceSpawns(base: ShelterSceneConfig, spawns: TerraceSpawns): ShelterSceneConfig {
  return {
    ...base,
    hotspots: base.hotspots.map((hs) => (spawns[hs.id] ? terraceSpawnHotspot(hs.id, spawns[hs.id]) : hs)),
  };
}

/* ── Fixed structures & flexible build slots ── */

/*
 * Composed in three zones so the middle of the rooftop stays open:
 * Living & Mending nook (back-left parapet), the Central Hearth, and a
 * Cooking & Utility line (back-right parapet against the stairwell).
 * The shelter, fire pit and stairwell door are fixed; the four build slots
 * host whichever of the farm, barrel, grill and sewing kit the player places there.
 */
const FIREPIT_POS = { x: 0.49, y: 0.72 };
const FIREPIT_STAND = { dx: -0.058, dy: 0.015 };
/** Shelter tucked into the back-left corner, sheltered by the brick wall */
const SHED_POS = { x: 0.3, y: 0.56 };
const STAIRWELL_POS = { x: 0.86, y: 0.66 };

/*
 * Stand spots are sized for the widest station tier (Hearth Kitchen collider
 * rx 0.05 / ry 0.026), so any station fits any slot. Wall slots stand out toward
 * the open floor; back-parapet slots stand in front.
 */
export const TERRACE_BUILD_SLOTS = [
  /** Along the sunny left brick parapet */
  { id: 'slot-1', position: { x: 0.17, y: 0.68 }, standOffset: { dx: 0.064, dy: 0.02 }, collider: { rx: 0.032, ry: 0.018 } },
  /** Back parapet, beside the shelter */
  { id: 'slot-2', position: { x: 0.46, y: 0.54 }, standOffset: { dx: 0, dy: 0.045 }, collider: { rx: 0.032, ry: 0.018 } },
  /** Back-right parapet */
  { id: 'slot-3', position: { x: 0.62, y: 0.56 }, standOffset: { dx: 0, dy: 0.045 }, collider: { rx: 0.032, ry: 0.018 } },
  /** Snug against the stairwell bulkhead */
  { id: 'slot-4', position: { x: 0.76, y: 0.57 }, standOffset: { dx: -0.056, dy: 0.03 }, collider: { rx: 0.032, ry: 0.018 } },
] as const satisfies readonly BuildSlotConfig[];

export const TERRACE_SLOT_IDS = TERRACE_BUILD_SLOTS.map((s) => s.id);

export const ASSIGNABLE_STATION_IDS: readonly AssignableStationId[] = ['planter', 'rain-barrel', 'grill', 'sewing'];

/** Assignable id → the station whose tier it carries */
export const ASSIGNABLE_STATION: Record<AssignableStationId, StationId> = {
  planter: 'planter',
  'rain-barrel': 'barrel',
  grill: 'grill',
  sewing: 'sewing',
};

/** Where each station stood before slots were flexible (used to migrate older rooftops) */
export const LEGACY_DEFAULT_SLOT: Record<AssignableStationId, string> = {
  planter: 'slot-1',
  sewing: 'slot-2',
  grill: 'slot-3',
  'rain-barrel': 'slot-4',
};

/* ── Multi-tier stations ── */

export const TERRACE_STATIONS: StationConfig[] = [
  {
    id: 'shelter',
    hotspotId: 'sleep-shed',
    icon: '🛖',
    baseTier: 1,
    buildStandOffset: { dx: 0.085, dy: 0.035 },
    tiers: [
      {
        tier: 1,
        name: 'Cloth Lean-to',
        sprite: SCENE_PROPS.clothShed,
        propScale: 0.19,
        cost: {},
        collider: { rx: 0.062, ry: 0.03 },
        standOffset: { dx: -0.03, dy: -0.012 },
        restOffset: { dx: 0.085, dy: 0.035 },
        effect: 'lantern',
      },
      {
        tier: 2,
        name: 'Timber Shelter',
        sprite: SCENE_PROPS.shedUpgraded,
        propScale: 0.225,
        cost: { timber: 3, cloth: 2 },
        collider: { rx: 0.064, ry: 0.032 },
        standOffset: { dx: 0.004, dy: -0.024 },
        restOffset: { dx: 0.085, dy: 0.035 },
        effect: 'lantern',
        glows: [{ x: 0.216, y: 0.585, size: 0.16 }],
      },
      {
        tier: 3,
        name: 'Insulated Hut',
        sprite: SCENE_PROPS.shelterT3,
        propScale: 0.24,
        cost: { timber: 4, scrap: 2, stone: 2 },
        collider: { rx: 0.068, ry: 0.034 },
        standOffset: { dx: 0.012, dy: -0.022 },
        restOffset: { dx: 0.09, dy: 0.035 },
        effect: 'warm',
        /* Warm window on the gable wall + the doorway lantern */
        glows: [
          { x: 0.3, y: 0.59, size: 0.2 },
          { x: 0.595, y: 0.73, size: 0.15 },
        ],
      },
    ],
  },
  {
    id: 'firepit',
    hotspotId: 'firepit',
    icon: '🔥',
    baseTier: 1,
    buildStandOffset: FIREPIT_STAND,
    tiers: [
      { tier: 1, name: 'Twig Fire Pit', sprite: SCENE_PROPS.firepitT1, propScale: 0.058, cost: {}, collider: { rx: 0.042, ry: 0.026 }, standOffset: FIREPIT_STAND, effect: 'logs' },
      { tier: 2, name: 'Stacked Logs', sprite: SCENE_PROPS.firepitT2, propScale: 0.088, cost: { timber: 2 }, collider: { rx: 0.042, ry: 0.026 }, standOffset: FIREPIT_STAND, effect: 'logs' },
      { tier: 3, name: 'Stone-Ring Hearth', sprite: SCENE_PROPS.firepit, propScale: 0.085, cost: { timber: 2, scrap: 1, stone: 2 }, collider: { rx: 0.042, ry: 0.026 }, standOffset: FIREPIT_STAND, effect: 'stones' },
    ],
  },
  /* Slot-placed stations: built into whichever free build slot the player picks */
  {
    id: 'planter',
    assignableId: 'planter',
    icon: '🌱',
    baseTier: 0,
    tiers: [
      { tier: 1, name: 'Seedling Crate', sprite: SCENE_PROPS.planterT1, propScale: 0.1, cost: { timber: 1, seeds: 1 }, collider: { rx: 0.034, ry: 0.02 }, effect: 'leaves' },
      { tier: 2, name: 'Herb Planter', sprite: SCENE_PROPS.planter, propScale: 0.14, cost: { timber: 2, seeds: 2 }, collider: { rx: 0.036, ry: 0.022 }, effect: 'leaves' },
      { tier: 3, name: 'Trellis Garden', sprite: SCENE_PROPS.planterT3, propScale: 0.165, cost: { timber: 3, scrap: 2, seeds: 2 }, collider: { rx: 0.04, ry: 0.024 }, effect: 'leaves' },
    ],
  },
  {
    id: 'barrel',
    assignableId: 'rain-barrel',
    icon: '💧',
    baseTier: 0,
    tiers: [
      { tier: 1, name: 'Bucket Barrel', sprite: SCENE_PROPS.barrelT1, propScale: 0.11, cost: { timber: 1, cloth: 1 }, collider: { rx: 0.022, ry: 0.015 }, effect: 'water' },
      { tier: 2, name: 'Rain Barrel', sprite: SCENE_PROPS.rainBarrel, propScale: 0.13, cost: { timber: 2, scrap: 2 }, collider: { rx: 0.024, ry: 0.016 }, effect: 'water' },
      { tier: 3, name: 'Guttered Rain Rig', sprite: SCENE_PROPS.barrelT3, propScale: 0.16, cost: { timber: 3, scrap: 2, stone: 2 }, collider: { rx: 0.036, ry: 0.022 }, effect: 'water' },
    ],
  },
  {
    id: 'grill',
    assignableId: 'grill',
    icon: '🍳',
    baseTier: 0,
    tiers: [
      { tier: 1, name: 'Grill Rack', sprite: SCENE_PROPS.grillT1, propScale: 0.05, cost: { scrap: 1, stone: 1 }, collider: { rx: 0.03, ry: 0.016 }, effect: 'stones' },
      { tier: 2, name: 'Camp Grill', sprite: SCENE_PROPS.grillT2, propScale: 0.11, cost: { scrap: 2, stone: 2 }, collider: { rx: 0.036, ry: 0.02 }, effect: 'stones' },
      { tier: 3, name: 'Grill Counter', sprite: SCENE_PROPS.grillT3, propScale: 0.13, cost: { timber: 2, stone: 2, scrap: 1 }, collider: { rx: 0.042, ry: 0.024 }, effect: 'logs' },
      { tier: 4, name: 'Hearth Kitchen', sprite: SCENE_PROPS.grillT4, propScale: 0.16, cost: { timber: 4, scrap: 2, stone: 2 }, collider: { rx: 0.05, ry: 0.026 }, effect: 'warm' },
    ],
  },
  {
    id: 'sewing',
    assignableId: 'sewing',
    icon: '🧵',
    baseTier: 0,
    tiers: [
      { tier: 1, name: 'Needle & Thread', sprite: SCENE_PROPS.sewT1, propScale: 0.045, cost: { cloth: 1 }, collider: { rx: 0.022, ry: 0.012 }, effect: 'fabric' },
      { tier: 2, name: 'Patch Scraps', sprite: SCENE_PROPS.sewT2, propScale: 0.045, cost: { cloth: 2 }, collider: { rx: 0.026, ry: 0.012 }, effect: 'fabric' },
      { tier: 3, name: 'Knitting Basket', sprite: SCENE_PROPS.sewT3, propScale: 0.1, cost: { timber: 2, cloth: 2 }, collider: { rx: 0.028, ry: 0.016 }, effect: 'fabric' },
      { tier: 4, name: 'Mending Bench', sprite: SCENE_PROPS.sewT4, propScale: 0.125, cost: { timber: 3, cloth: 2, scrap: 1 }, collider: { rx: 0.036, ry: 0.02 }, effect: 'fabric' },
      { tier: 5, name: 'Sewing Table', sprite: SCENE_PROPS.sewT5, propScale: 0.145, cost: { timber: 4, cloth: 3, scrap: 2 }, collider: { rx: 0.046, ry: 0.024 }, effect: 'fabric' },
    ],
  },
];

export const terraceScene: ShelterSceneConfig = {
  backdrop: '/source/scenes/terrace-stage.webp',

  walkableArea: { xMin: 0.12, xMax: 0.9, yMin: 0.53, yMax: 0.88 },
  obstacles: [
    /* Diagonal left parapet wall */
    { shape: 'ellipse', x: 0, y: 0.5, rx: 0.2, ry: 0.2 },
    /* Brick stairwell/lift bulkhead (right) */
    { shape: 'rect', xMin: 0.79, xMax: 1, yMin: 0.3, yMax: 0.7 },
  ],

  /* Pause at the stairwell threshold, then stroll a few steps onto the roof */
  entryPoint: { x: 0.84, y: 0.69 },
  idlePoint: { x: 0.72, y: 0.71 },

  /* Station hotspots start from their base tier; the scene swaps art, collider & stand spot per tier */
  hotspots: [
    {
      id: 'firepit',
      type: 'firepit',
      station: 'firepit',
      position: FIREPIT_POS,
      propSprite: SCENE_PROPS.firepitT1,
      propScale: 0.058,
      label: 'Light fire pit',
      collider: { rx: 0.042, ry: 0.026 },
      standOffset: FIREPIT_STAND,
    },
    {
      id: 'sleep-shed',
      type: 'sleep',
      station: 'shelter',
      position: SHED_POS,
      propSprite: SCENE_PROPS.clothShed,
      propScale: 0.19,
      label: 'Rest by shelter',
      collider: { rx: 0.062, ry: 0.03 },
      standOffset: { dx: -0.03, dy: -0.012 },
      restOffset: { dx: 0.085, dy: 0.035 },
    },
    /* ── 4 flexible build slots: an empty "Build here" blueprint until the player places a station ── */
    ...TERRACE_BUILD_SLOTS.map(
      (slot): HotspotConfig => ({
        id: slot.id,
        type: 'slot',
        position: slot.position,
        propSprite: '',
        label: 'Build here',
        standOffset: slot.standOffset,
      }),
    ),

    /* ── 3 searchable boxes + 6 weed patches (positions randomized per run) ── */
    ...TERRACE_BOX_IDS.map((id) => terraceSpawnHotspot(id, DEFAULT_TERRACE_SPAWNS[id])),
    ...TERRACE_WEED_IDS.map((id) => terraceSpawnHotspot(id, DEFAULT_TERRACE_SPAWNS[id])),

    /* ── Ajar rooftop stairwell/lift door: opens the elevator floor panel ── */
    {
      id: 'stairwell-door',
      type: 'door',
      position: STAIRWELL_POS,
      propSprite: '',
      label: 'Take the elevator',
      standOffset: { dx: -0.01, dy: 0.09 },
      hitRect: { dx: -0.065, dy: -0.32, w: 0.125, h: 0.4 },
    },
  ],

  stations: TERRACE_STATIONS,
  buildSlots: [...TERRACE_BUILD_SLOTS],
};

/* ── Spawn rules for randomized box & weed placement ── */

export interface SpawnCircle {
  x: number;
  y: number;
  /** Radius in stage-height units */
  r: number;
}

function standSpot(pos: { x: number; y: number }, stand: { dx: number; dy: number }, r: number): SpawnCircle {
  return { x: pos.x + stand.dx, y: pos.y + stand.dy, r };
}

export const TERRACE_SPAWN_RULES = {
  /** Stage art aspect (1376×768) — x distances are scaled by this */
  aspect: 1376 / 768,
  /** Open rooftop floor where prop anchors may land */
  bounds: { xMin: 0.16, xMax: 0.86, yMin: 0.555, yMax: 0.86 },
  /** Extra no-spawn rects (front-left low brick wall / steps) */
  noSpawn: [{ xMin: 0, xMax: 0.29, yMin: 0.83, yMax: 1 }],
  /** Every station at its largest tier, their stand spots and the entry path stay clear */
  keepClear: [
    { x: FIREPIT_POS.x, y: FIREPIT_POS.y, r: 0.085 },
    standSpot(FIREPIT_POS, FIREPIT_STAND, 0.04),
    { x: SHED_POS.x, y: SHED_POS.y - 0.01, r: 0.125 },
    /* Rest / build spot beside the shelter (T1–T3 rest offsets) */
    standSpot(SHED_POS, { dx: 0.0875, dy: 0.035 }, 0.045),
    /* Any station (at its largest tier) can stand in any build slot, so each slot keeps the widest zone clear */
    ...TERRACE_BUILD_SLOTS.flatMap((slot) => [
      { x: slot.position.x, y: slot.position.y - 0.015, r: 0.1 },
      standSpot(slot.position, slot.standOffset, 0.04),
    ]),
    { x: 0.84, y: 0.69, r: 0.07 },
    { x: 0.78, y: 0.7, r: 0.06 },
    { x: 0.72, y: 0.71, r: 0.055 },
    { x: 0.85, y: 0.75, r: 0.05 },
  ] as SpawnCircle[],
  /** Breathing room between neighbouring props (stage-height units) */
  gap: 0.018,
  /** Boxes & weeds prefer spots within this distance of a wall, edge or the front-left steps */
  perimeterBand: 0.1,
} as const;
