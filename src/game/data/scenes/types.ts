/* ───── Shelter Scene Configuration Schema ───── */

import type { ResourceId } from '../../types/game.ts';

export interface HotspotConfig {
  id: string;
  type: 'firepit' | 'searchable' | 'weeds' | 'sleep' | 'door';
  /** Normalized 0.0–1.0 anchor position (bottom-center on floor) */
  position: { x: number; y: number };
  /** Initial prop sprite path (from SCENE_PROPS or empty for backdrop regions) */
  propSprite: string;
  /** Sprite after interaction (e.g. cleared boxes) */
  propSpriteAfter?: string;
  /** Scale of the prop sprite relative to stage height */
  propScale?: number;
  /** Flip the prop sprite horizontally for organic variety */
  flipX?: boolean;
  /** Label shown on hover */
  label: string;
  /** Resources rewarded on first interaction */
  reward?: Record<string, number>;
  /** Normalized elliptical collision footprint on the floor */
  collider?: { rx: number; ry: number };
  /** Normalized offset from prop position where the traveler stands to interact */
  standOffset?: { dx: number; dy: number };
  /** Alternate stand offset when resting (sitting) beside a shelter during day/dusk */
  restOffset?: { dx: number; dy: number };
  /** Normalized clickable region relative to `position` (for backdrop features without a sprite) */
  hitRect?: { dx: number; dy: number; w: number; h: number };
  /** Gentle toast shown after interacting (door hotspots) */
  message?: string;
}

/** Static scenery the traveler can't walk into (painted walls, bulkheads…) */
export type SceneObstacle =
  | { shape: 'ellipse'; x: number; y: number; rx: number; ry: number }
  | { shape: 'rect'; xMin: number; xMax: number; yMin: number; yMax: number };

/** A visual upgrade the player builds in-scene by spending found materials */
export interface BuildableConfig {
  id: string;
  /** Short name for the build bar & hover label */
  name: string;
  /** Emoji shown on the build bar chip */
  icon: string;
  cost: Partial<Record<ResourceId, number>>;
  /** Normalized anchor (bottom-center on floor) */
  position: { x: number; y: number };
  propSprite: string;
  propScale: number;
  flipX?: boolean;
  /** Collider that becomes active once built */
  collider?: { rx: number; ry: number };
  /** Where the traveler stands while building */
  standOffset?: { dx: number; dy: number };
  /**
   * Upgrade an existing hotspot in place instead of placing a new prop.
   * Its sprite becomes `propSprite`, and any `hotspotOverrides` are merged in.
   */
  upgradesHotspot?: string;
  hotspotOverrides?: Partial<Pick<HotspotConfig, 'label' | 'propScale' | 'collider' | 'standOffset' | 'restOffset'>>;
  /** Another buildable that must be built first (e.g. Tier 2 before Tier 3) */
  requires?: string;
  /** For tiered upgrades of the fire pit: the tier this build reaches */
  tier?: 2 | 3;
  /** Finishing flourish once built */
  effect: 'lantern' | 'leaves' | 'water' | 'logs' | 'stones';
  /** Lantern glow anchor as a fraction of the sprite (0–1 from left, 0–1 from top) */
  lanternAnchor?: { x: number; y: number };
}

export interface ShelterSceneConfig {
  /** Path to the stage backdrop image */
  backdrop: string;
  /** Normalized walkable floor area */
  walkableArea: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Static painted scenery the traveler is pushed out of */
  obstacles?: SceneObstacle[];
  /** Where the traveler enters from (walks in from off-screen or a doorway) */
  entryPoint: { x: number; y: number };
  /** Where the traveler settles after entry walk */
  idlePoint: { x: number; y: number };
  /** Interactive hotspots in the scene */
  hotspots: HotspotConfig[];
  /** In-scene visual upgrades bought with found materials */
  buildables?: BuildableConfig[];
}
