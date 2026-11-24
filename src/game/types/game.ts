/* ───── Core Game Types ───── */

/** Identifier for a shelter site */
export type SiteId = 'terrace' | 'pipe' | 'tree' | 'cave' | 'bunker';

/** A shelter site the player can choose */
export interface Site {
  id: SiteId;
  name: string;
  tagline: string;
  description: string;
  unlocked: boolean;
  unlockHint?: string;
  /** Traces left behind by a previous traveler */
  leftBehind?: string;
  /** Base color for the placeholder silhouette */
  silhouetteColor: number;
}

/** Identifier for a resource type */
export type ResourceId = 'timber' | 'scrap' | 'cloth' | 'stone' | 'seeds' | 'water';

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
}

/** Macro upgrade category */
export type UpgradeCategory = 'shell' | 'dividers' | 'expansion' | 'slots';

/** An individual upgrade tier within a category */
export interface Upgrade {
  id: string;
  category: UpgradeCategory;
  name: string;
  tier: number;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
}

/** Full save state shape */
export interface SaveState {
  version: number;
  day: number;
  chosenSite: SiteId | null;
  resources: Record<ResourceId, number>;
  unlockedUpgrades: string[];
  kitCollected: boolean;
  timestamp: number;
}
