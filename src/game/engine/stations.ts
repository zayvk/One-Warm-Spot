/* ───── Multi-tier stations: pure tier, harvest, sleep, perk & cooking rules ───── */

import type { ResourceId } from '../types/game.ts';
import type { StationConfig, StationId, StationTierConfig } from '../data/scenes/types.ts';
import type { MendingPerk, Recipe } from '../data/recipes.ts';
import { RESOURCE_MAP } from '../data/resources.ts';
import { TERRACE_STATIONS } from '../data/scenes/terrace.ts';
import { canAfford, spendResources } from './progression.ts';
import {
  clampVitality,
  MAX_VITALITY,
  PHASE_STRENGTH_DECAY,
  SLEEP_STRENGTH_DECAY,
  type SleepComfort,
} from './dayCycle.ts';

export type StationTiers = Record<StationId, number>;
export type ResourceGains = Partial<Record<ResourceId, number>>;

export const STATION_IDS: readonly StationId[] = ['shelter', 'firepit', 'planter', 'barrel', 'grill', 'sewing'];

export function stationMaxTier(station: StationConfig): number {
  return station.tiers.length;
}

/** Config for a built tier (`null` for tier 0 / unknown tiers) */
export function stationTierConfig(station: StationConfig, tier: number): StationTierConfig | null {
  return station.tiers.find((t) => t.tier === tier) ?? null;
}

/** The tier the player can build next, or `null` once the station is maxed */
export function nextStationTier(station: StationConfig, tier: number): StationTierConfig | null {
  return stationTierConfig(station, tier + 1);
}

export function clampStationTier(station: StationConfig, tier: unknown): number {
  const t = typeof tier === 'number' && Number.isInteger(tier) ? tier : station.baseTier;
  return Math.max(station.baseTier, Math.min(stationMaxTier(station), t));
}

/* ── Daily station yields ── */

/** Farm harvest: +1/+2/+3 Food by tier, plus a Seed back from T2 up */
export function planterHarvest(tier: number): ResourceGains {
  if (tier < 1) return {};
  return tier >= 2 ? { food: tier, seeds: 1 } : { food: tier };
}

/** Rainwater collected: +1/+2/+3 Water by tier */
export function barrelCollect(tier: number): ResourceGains {
  return tier < 1 ? {} : { water: tier };
}

/* ── Sleep & mending perks ── */

const SLEEP_STAMINA_BY_SHELTER: Record<number, number> = { 1: 75, 2: 90, 3: 100 };

/** Shelter T1/T2/T3 refills Stamina to 75/90/100 (+10 with Warm Sheets); T3 halves overnight Strength loss */
export function sleepComfort(shelterTier: number, perks: readonly string[]): SleepComfort {
  const base = SLEEP_STAMINA_BY_SHELTER[Math.max(1, Math.min(3, shelterTier))];
  return {
    staminaTarget: Math.min(MAX_VITALITY, base + (perks.includes('warm-sheets') ? 10 : 0)),
    strengthLoss: shelterTier >= 3 ? 5 : SLEEP_STRENGTH_DECAY,
  };
}

/** Mended Work Gloves make gathering ~30% lighter on Stamina */
export function gatherStaminaCost(base: number, perks: readonly string[]): number {
  return perks.includes('mended-gloves') ? Math.round(base * 0.7) : base;
}

/** Quilted Cozy Cloak halves how much Strength drifts as the day turns */
export function strengthDriftFactor(perks: readonly string[]): number {
  return perks.includes('cozy-cloak') ? 0.5 : 1;
}

export function phaseStrengthDecay(factor: number): number {
  return Math.round(PHASE_STRENGTH_DECAY * factor);
}

/* ── Cooking & mending ── */

function shortfall(cost: ResourceGains, resources: Record<ResourceId, number>): string | null {
  const missing = (Object.entries(cost) as [ResourceId, number][])
    .filter(([id, n]) => (resources[id] ?? 0) < n)
    .map(([id, n]) => `${n - (resources[id] ?? 0)} ${RESOURCE_MAP[id]?.emoji ?? id}`);
  return missing.length ? `Need ${missing.join(' ')} more` : null;
}

/** Cozy player-facing requirement label for a locked recipe or perk */
export function stationRequirementHint(stationId: StationId, minTier: number): string {
  const station = TERRACE_STATIONS.find((s) => s.id === stationId);
  const name = station ? stationTierConfig(station, minTier)?.name : undefined;
  if (name) return `Needs ${name}`;
  return stationId === 'grill' ? 'Upgrade cooking grill first' : 'Upgrade sewing kit first';
}

export interface CookContext {
  grillTier: number;
  fireLit: boolean;
  resources: Record<ResourceId, number>;
}

/** Why a recipe can't be cooked right now (`null` = ready to cook) */
export function recipeBlocker(recipe: Recipe, ctx: CookContext): string | null {
  if (ctx.grillTier < recipe.minTier) return stationRequirementHint('grill', recipe.minTier);
  if (recipe.needsFire && !ctx.fireLit) return 'Light the fire pit first';
  return shortfall(recipe.ingredients, ctx.resources);
}

export interface CookOutcome {
  resources: Record<ResourceId, number>;
  stamina: number;
  strength: number;
}

/** Eat a dish: ingredients are used up and Stamina & Strength restored (capped at 100) */
export function applyRecipe(
  recipe: Recipe,
  resources: Record<ResourceId, number>,
  stamina: number,
  strength: number,
): CookOutcome | null {
  const next = spendResources(resources, recipe.ingredients);
  if (!next) return null;
  return {
    resources: next,
    stamina: clampVitality(stamina + recipe.stamina),
    strength: clampVitality(strength + recipe.strength),
  };
}

export interface MendContext {
  sewingTier: number;
  perks: readonly string[];
  resources: Record<ResourceId, number>;
}

/** Why a perk can't be crafted right now (`null` = ready) */
export function perkBlocker(perk: MendingPerk, ctx: MendContext): string | null {
  if (ctx.perks.includes(perk.id)) return 'Already crafted';
  if (ctx.sewingTier < perk.minTier) return stationRequirementHint('sewing', perk.minTier);
  return canAfford(perk.cost, ctx.resources) ? null : shortfall(perk.cost, ctx.resources);
}
