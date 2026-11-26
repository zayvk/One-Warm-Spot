/* ───── Grill recipes & Sewing-kit mending perks ───── */

import type { ResourceId } from '../types/game.ts';

export interface Recipe {
  id: string;
  name: string;
  icon: string;
  /** Grill tier needed to cook it */
  minTier: number;
  ingredients: Partial<Record<ResourceId, number>>;
  stamina: number;
  strength: number;
  /** Needs the fire pit lit */
  needsFire?: boolean;
}

export const RECIPES: Recipe[] = [
  {
    id: 'cool-rainwater',
    name: 'Cool Rainwater',
    icon: '💧',
    minTier: 1,
    ingredients: { water: 1 },
    stamina: 10,
    strength: 5,
  },
  {
    id: 'toasted-seeds',
    name: 'Toasted Seeds',
    icon: '🌰',
    minTier: 1,
    ingredients: { seeds: 1 },
    stamina: 0,
    strength: 15,
    needsFire: true,
  },
  {
    id: 'herbal-tea',
    name: 'Warm Herbal Tea',
    icon: '🍵',
    minTier: 2,
    ingredients: { food: 1, water: 1 },
    stamina: 30,
    strength: 10,
    needsFire: true,
  },
  {
    id: 'veggie-stew',
    name: 'Rooftop Veggie Stew',
    icon: '🍲',
    minTier: 3,
    ingredients: { food: 2, water: 1 },
    stamina: 15,
    strength: 45,
  },
  {
    id: 'hearth-feast',
    name: 'Hearth Spiced Feast',
    icon: '🥘',
    minTier: 4,
    ingredients: { food: 2, seeds: 1, water: 1 },
    stamina: 40,
    strength: 65,
  },
];

export type PerkId = 'warm-sheets' | 'mended-gloves' | 'cozy-cloak';

export interface MendingPerk {
  id: PerkId;
  name: string;
  icon: string;
  /** Sewing-kit tier needed to craft it */
  minTier: number;
  cost: Partial<Record<ResourceId, number>>;
  /** Player-facing effect */
  effect: string;
}

export const MENDING_PERKS: MendingPerk[] = [
  {
    id: 'warm-sheets',
    name: 'Warm Patchwork Sheets',
    icon: '🛏️',
    minTier: 1,
    cost: { cloth: 2 },
    effect: '+10% Stamina restored when you sleep',
  },
  {
    id: 'mended-gloves',
    name: 'Mended Work Gloves',
    icon: '🧤',
    minTier: 3,
    cost: { cloth: 2, scrap: 1 },
    effect: 'Clearing weeds & searching boxes costs ~30% less Stamina',
  },
  {
    id: 'cozy-cloak',
    name: 'Quilted Cozy Cloak',
    icon: '🧥',
    minTier: 5,
    cost: { cloth: 4, timber: 1 },
    effect: 'Halves Strength drift as the day turns',
  },
];

export const PERK_IDS: ReadonlySet<string> = new Set(MENDING_PERKS.map((p) => p.id));
