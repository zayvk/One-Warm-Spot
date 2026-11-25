/* ───── Shelter Scene Configuration Schema ───── */

export interface HotspotConfig {
  id: string;
  type: 'firepit' | 'searchable' | 'weeds' | 'sleep';
  /** Normalized 0.0–1.0 position on the stage */
  position: { x: number; y: number };
  /** Initial prop sprite path (from SCENE_PROPS or other) */
  propSprite: string;
  /** Sprite after interaction (e.g. cleared boxes) */
  propSpriteAfter?: string;
  /** Scale of the prop sprite relative to stage height */
  propScale?: number;
  /** Label shown on hover */
  label: string;
  /** Resources rewarded on first interaction */
  reward?: Record<string, number>;
}

export interface ShelterSceneConfig {
  /** Path to the stage backdrop image */
  backdrop: string;
  /** Normalized walkable floor area */
  walkableArea: { xMin: number; xMax: number; yMin: number; yMax: number };
  /** Where the traveler enters from (walks in from off-screen) */
  entryPoint: { x: number; y: number };
  /** Where the traveler settles after entry walk */
  idlePoint: { x: number; y: number };
  /** Interactive hotspots in the scene */
  hotspots: HotspotConfig[];
}
