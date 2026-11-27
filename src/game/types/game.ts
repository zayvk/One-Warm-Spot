/* ───── Core Game Types ───── */

/** Game difficulty mode */
export type GameMode = 'cozy' | 'challenge';

/** Player avatar gender */
export type TravelerGender = 'female' | 'male';

/** Identifier for a shelter site */
export type SiteId =
  | 'terrace' | 'pipe' | 'tree' | 'countryhouse' | 'farmhouse'
  | 'cave' | 'bunker' | 'beachhouse' | 'island';

/** Time-of-day phases within a single day (legacy M1 drawers) */
export type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night';

/** 3-phase real-time day cycle used in the interactive shelter */
export type DayPhase = 'day' | 'dusk' | 'night';

/**
 * Gentle daily weather, rolled each new morning (Day 1 is always clear).
 * Older saves may still hold `'breezy'` / `'storm'`; they load as `'wind'`.
 */
export type Weather = 'clear' | 'rain' | 'wind';

/** Persistent milestone stats that drive shelter unlocks (kept across new shelters) */
export interface PlayerStats {
  maxDaysSurvived: number;
  totalUpgradesBuilt: number;
  totalExpansionsBuilt: number;
}

/** Milestone a locked shelter needs before it can be claimed */
export interface UnlockRequirement {
  stat: keyof PlayerStats;
  count: number;
}

/** A shelter site the player can choose */
export interface Site {
  id: SiteId;
  name: string;
  tagline: string;
  description: string;
  /** Omitted for always-open starter shelters */
  unlockRequirement?: UnlockRequirement;
  unlockHint?: string;
  /** Not playable yet in this build (stays locked regardless of milestones) */
  comingSoon?: boolean;
  /** Traces left behind by a previous traveler */
  leftBehind?: string;
  /** Which mode tab this site belongs to */
  mode: GameMode;
  /** Base color for the placeholder silhouette */
  silhouetteColor: number;
}

/** Identifier for a resource type */
export type ResourceId = 'timber' | 'scrap' | 'cloth' | 'stone' | 'seeds' | 'water' | 'food';

/** A gatherable / storable resource */
export interface Resource {
  id: ResourceId;
  name: string;
  emoji: string;
  startAmount: number;
  maxStack: number;
}

/** Survival kit item given on Day 1 */
export interface KitItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** How the item helps day-to-day */
  helps: string;
}

/** Macro upgrade category */
export type UpgradeCategory = 'shell' | 'dividers' | 'expansion' | 'slots';

/** An individual upgrade tier within a category */
export interface Upgrade {
  id: string;
  category: UpgradeCategory;
  name: string;
  tier: number;
  emoji: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  /** Energy spent doing the work */
  energy: number;
  /** Cozy Index points granted once built */
  cozy: number;
  /** Upgrade that must be built first (previous tier) */
  requires?: string;
}

/** Full save state shape (version 4) — optional fields may be absent in older saves */
export interface SaveState {
  version: number;
  day: number;
  timeOfDay?: TimeOfDay;
  dayPhase?: DayPhase;
  phaseElapsedSec?: number;
  energy?: number;
  stamina?: number;
  strength?: number;
  weather?: Weather;
  chosenSite: SiteId | null;
  selectedMode: GameMode;
  travelerGender: TravelerGender;
  resources: Record<ResourceId, number>;
  /** IDs of built upgrades (legacy name kept for save compatibility) */
  unlockedUpgrades: string[];
  kitCollected: boolean;
  lanternLit?: boolean;
  /** IDs of Valley Relics found while scavenging */
  discoveredRelics?: string[];
  /** Milestone stats snapshot, included so exported saves carry unlocks */
  stats?: PlayerStats;
  timestamp: number;
}

/* ───── Scavenging ───── */

export type ScavengeZoneId = 'highway' | 'pine-grove' | 'stone-creek' | 'greenhouse';

/** One material a scavenging spot can yield (base amounts, before mode rules) */
export interface ZoneYield {
  resource: ResourceId;
  min: number;
  max: number;
  /** Primary materials are guaranteed at least 1 and receive cozy bonuses */
  primary: boolean;
}

export interface ScavengeZone {
  id: ScavengeZoneId;
  name: string;
  emoji: string;
  blurb: string;
  yields: ZoneYield[];
  /** Short atmospheric discovery lines (one is picked per trip) */
  stories: string[];
}

/** A small keepsake found while scavenging, readable in the Field Journal */
export interface Relic {
  id: string;
  name: string;
  emoji: string;
  note: string;
}
