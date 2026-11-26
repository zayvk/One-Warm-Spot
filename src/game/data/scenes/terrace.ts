/* ───── Old Apartment Terrace — Interactive Scene Config (v2) ───── */

import type { HotspotConfig, ShelterSceneConfig } from './types.ts';
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

/** Hand-placed layout (used for saves from before randomized placement) */
export const DEFAULT_TERRACE_SPAWNS: TerraceSpawns = {
  'boxes-1': { x: 0.25, y: 0.555, variant: 'boxes-intact', scale: 1, flipX: false },
  'boxes-2': { x: 0.18, y: 0.8, variant: 'box-double', scale: 1, flipX: false },
  'boxes-3': { x: 0.66, y: 0.555, variant: 'box-single', scale: 1, flipX: true },
  'weeds-1': { x: 0.45, y: 0.53, variant: 'weeds-3', scale: 0.94, flipX: false },
  'weeds-2': { x: 0.575, y: 0.535, variant: 'weeds-1', scale: 1.03, flipX: true },
  'weeds-3': { x: 0.145, y: 0.665, variant: 'weeds-2', scale: 1.03, flipX: false },
  'weeds-4': { x: 0.37, y: 0.835, variant: 'weeds-3', scale: 1.06, flipX: true },
  'weeds-5': { x: 0.655, y: 0.81, variant: 'weeds-2', scale: 0.97, flipX: true },
  'weeds-6': { x: 0.85, y: 0.865, variant: 'weeds-1', scale: 0.97, flipX: false },
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

/* ── Fixed structures ── */

const FIREPIT_POS = { x: 0.5, y: 0.7 };
const FIREPIT_STAND = { dx: -0.058, dy: 0.015 };
const SHED_POS = { x: 0.36, y: 0.61 };
const HERB_PLANTER_POS = { x: 0.24, y: 0.69 };
const RAIN_BARREL_POS = { x: 0.75, y: 0.59 };
const STAIRWELL_POS = { x: 0.86, y: 0.66 };

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

  hotspots: [
    /* ── Central Fire Pit (Tier 1 makeshift twigs; upgraded in-scene) ── */
    {
      id: 'firepit',
      type: 'firepit',
      position: FIREPIT_POS,
      propSprite: SCENE_PROPS.firepitT1,
      propScale: 0.058,
      label: 'Light fire pit',
      collider: { rx: 0.042, ry: 0.026 },
      standOffset: FIREPIT_STAND,
    },

    /* ── Shabby cloth lean-to, tucked behind-left of the fire ── */
    {
      id: 'sleep-shed',
      type: 'sleep',
      position: SHED_POS,
      propSprite: SCENE_PROPS.clothShed,
      propScale: 0.19,
      label: 'Rest by shelter',
      collider: { rx: 0.062, ry: 0.03 },
      standOffset: { dx: -0.03, dy: -0.012 },
      restOffset: { dx: 0.085, dy: 0.035 },
    },

    /* ── 3 searchable boxes + 6 weed patches (positions randomized per run) ── */
    ...TERRACE_BOX_IDS.map((id) => terraceSpawnHotspot(id, DEFAULT_TERRACE_SPAWNS[id])),
    ...TERRACE_WEED_IDS.map((id) => terraceSpawnHotspot(id, DEFAULT_TERRACE_SPAWNS[id])),

    /* ── Ajar rooftop stairwell/lift door ── */
    {
      id: 'stairwell-door',
      type: 'door',
      position: STAIRWELL_POS,
      propSprite: '',
      label: 'Stairwell downstairs (coming soon)',
      standOffset: { dx: -0.01, dy: 0.09 },
      hitRect: { dx: -0.065, dy: -0.32, w: 0.125, h: 0.4 },
      message: 'The stairs lead down into the quiet building—more to explore soon.',
    },
  ],

  /* ── In-scene visual upgrades (spend found materials) ── */
  buildables: [
    {
      id: 'firepit-t2',
      name: 'Stack Firepit Logs',
      icon: '🔥',
      cost: { timber: 2 },
      position: FIREPIT_POS,
      propSprite: SCENE_PROPS.firepitT2,
      propScale: 0.088,
      upgradesHotspot: 'firepit',
      hotspotOverrides: { propScale: 0.088 },
      tier: 2,
      standOffset: FIREPIT_STAND,
      effect: 'logs',
    },
    {
      id: 'firepit-t3',
      name: 'Stone-Ring Hearth',
      icon: '🧱',
      cost: { timber: 2, scrap: 1 },
      position: FIREPIT_POS,
      propSprite: SCENE_PROPS.firepit,
      propScale: 0.085,
      upgradesHotspot: 'firepit',
      hotspotOverrides: { propScale: 0.085 },
      requires: 'firepit-t2',
      tier: 3,
      standOffset: FIREPIT_STAND,
      effect: 'stones',
    },
    {
      id: 'shed-upgrade',
      name: 'Upgrade Shelter',
      icon: '🛖',
      cost: { timber: 3, cloth: 2 },
      position: SHED_POS,
      propSprite: SCENE_PROPS.shedUpgraded,
      propScale: 0.225,
      upgradesHotspot: 'sleep-shed',
      hotspotOverrides: {
        propScale: 0.225,
        collider: { rx: 0.064, ry: 0.032 },
        standOffset: { dx: 0.004, dy: -0.024 },
        restOffset: { dx: 0.085, dy: 0.035 },
      },
      standOffset: { dx: 0.085, dy: 0.035 },
      effect: 'lantern',
      lanternAnchor: { x: 0.216, y: 0.585 },
    },
    {
      id: 'herb-planter',
      name: 'Herb Planter',
      icon: '🌿',
      cost: { timber: 2, seeds: 2 },
      position: HERB_PLANTER_POS,
      propSprite: SCENE_PROPS.planter,
      propScale: 0.14,
      collider: { rx: 0.036, ry: 0.022 },
      standOffset: { dx: 0.058, dy: 0.02 },
      effect: 'leaves',
    },
    {
      id: 'rain-barrel',
      name: 'Rain Barrel',
      icon: '🛢️',
      cost: { scrap: 2, timber: 1 },
      position: RAIN_BARREL_POS,
      propSprite: SCENE_PROPS.rainBarrel,
      propScale: 0.13,
      collider: { rx: 0.024, ry: 0.016 },
      standOffset: { dx: -0.045, dy: 0.025 },
      effect: 'water',
    },
  ],
};

/* ── Spawn rules for randomized box & weed placement ── */

export interface SpawnCircle {
  x: number;
  y: number;
  /** Radius in stage-height units */
  r: number;
}

export const TERRACE_SPAWN_RULES = {
  /** Stage art aspect (1376×768) — x distances are scaled by this */
  aspect: 1376 / 768,
  /** Open rooftop floor where prop anchors may land */
  bounds: { xMin: 0.16, xMax: 0.86, yMin: 0.555, yMax: 0.86 },
  /** Extra no-spawn rects (front-left low brick wall) */
  noSpawn: [{ xMin: 0, xMax: 0.29, yMin: 0.83, yMax: 1 }],
  /** Fixed structures, their stand spots and the entry path stay clear */
  keepClear: [
    { x: FIREPIT_POS.x, y: FIREPIT_POS.y, r: 0.085 },
    { x: FIREPIT_POS.x + FIREPIT_STAND.dx, y: FIREPIT_POS.y + FIREPIT_STAND.dy, r: 0.04 },
    { x: SHED_POS.x, y: SHED_POS.y - 0.01, r: 0.12 },
    { x: 0.445, y: 0.645, r: 0.04 },
    { x: HERB_PLANTER_POS.x, y: HERB_PLANTER_POS.y, r: 0.08 },
    { x: 0.298, y: 0.71, r: 0.035 },
    { x: RAIN_BARREL_POS.x, y: RAIN_BARREL_POS.y, r: 0.065 },
    { x: 0.705, y: 0.615, r: 0.035 },
    { x: 0.84, y: 0.69, r: 0.07 },
    { x: 0.78, y: 0.7, r: 0.06 },
    { x: 0.72, y: 0.71, r: 0.055 },
    { x: 0.85, y: 0.75, r: 0.05 },
  ] as SpawnCircle[],
  /** Breathing room between neighbouring props (stage-height units) */
  gap: 0.018,
} as const;
