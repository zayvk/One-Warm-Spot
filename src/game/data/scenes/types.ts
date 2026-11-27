/* ───── Shelter Scene Configuration Schema ───── */

import type { ResourceId } from '../../types/game.ts';
import type { StageSafeArea } from '../../engine/stageFit.ts';

export interface HotspotConfig {
  id: string;
  type: 'firepit' | 'searchable' | 'weeds' | 'sleep' | 'door' | 'planter' | 'barrel' | 'grill' | 'sewing' | 'slot';
  /** The upgradeable station living on this hotspot (its tier drives the sprite & collider) */
  station?: StationId;
  /** Normalized 0.0–1.0 anchor position (bottom-center on floor) */
  position: { x: number; y: number };
  /** Initial prop sprite path (from SCENE_PROPS or empty for backdrop regions) */
  propSprite: string;
  /** Sprite after interaction (e.g. cleared boxes) */
  propSpriteAfter?: string;
  /** Searchables: the prop fades away once searched, freeing its floor (light cardboard cartons) */
  clearsWhenSearched?: boolean;
  /** Searchables that stay once searched (wooden crates): hover text for the emptied prop */
  searchedLabel?: string;
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

/* ───── Multi-tier stations (Shelter, Fire Pit, Farm, Rainwater, Grill, Sewing) ───── */

export type StationId = 'shelter' | 'firepit' | 'planter' | 'barrel' | 'grill' | 'sewing';

/** Stations the player places in any free build slot (saved in `slotAssignments`) */
export type AssignableStationId = 'planter' | 'rain-barrel' | 'grill' | 'sewing';

/** Finishing flourish when a tier is built */
export type BuildEffect = 'lantern' | 'leaves' | 'water' | 'logs' | 'stones' | 'warm' | 'fabric';

export interface StationTierConfig {
  tier: number;
  /** Short name for this tier (station menu, hover label & lock hints) */
  name: string;
  sprite: string;
  /** Sprite height relative to the stage */
  propScale: number;
  /** Materials to reach this tier (empty for a station's starting tier) */
  cost: Partial<Record<ResourceId, number>>;
  collider: { rx: number; ry: number };
  /** Where the traveler stands to use the station at this tier */
  standOffset?: { dx: number; dy: number };
  /** Shelter only: where the traveler sits to rest during day/dusk */
  restOffset?: { dx: number; dy: number };
  effect: BuildEffect;
  /** Warm light points as fractions of the sprite (x from left, y from top) that glow at dusk/night */
  glows?: { x: number; y: number; size: number }[];
}

export interface StationConfig {
  id: StationId;
  /** Fixed hotspot this station lives on (shelter, fire pit). Omitted for slot-placed stations */
  hotspotId?: string;
  /** Set for stations the player places in a free build slot */
  assignableId?: AssignableStationId;
  /** Emoji shown in the station's action menu title */
  icon: string;
  /** Tier at the start of a run (0 = not built yet) */
  baseTier: 0 | 1;
  /** Tiers 1…max in order */
  tiers: StationTierConfig[];
  /** Where the traveler stands while building on a fixed hotspot (slots use their own stand spot) */
  buildStandOffset?: { dx: number; dy: number };
}

/** A predefined empty spot on the floor where any not-yet-placed station can be built */
export interface BuildSlotConfig {
  id: string;
  /** Normalized anchor (bottom-centre of whatever gets built here) */
  position: { x: number; y: number };
  /** Where the traveler stands to build and use whatever station is placed here */
  standOffset: { dx: number; dy: number };
  /** Footprint of the empty floor blueprint (not solid; the built tier's collider takes over) */
  collider: { rx: number; ry: number };
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
  /** Multi-tier stations upgraded in-scene with found materials */
  stations?: StationConfig[];
  /** Flexible build slots (each hosts one assignable station) */
  buildSlots?: BuildSlotConfig[];
  /** Region (stations, door, walk floor) kept on screen at any window shape; omitted = plain cover fit */
  safeArea?: StageSafeArea;
}
