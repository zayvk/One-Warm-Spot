import type { GameMode, ResourceId, Weather } from '../types/game.ts';
import { RESOURCES } from './resources.ts';

/**
 * Cozy vs. Challenge rules. Both modes keep the game's promise:
 * zero permadeath, zero raids — Challenge is simply leaner and breezier.
 */
export interface ModeRules {
  id: GameMode;
  label: string;
  emoji: string;
  /** Fraction of the standard Day 1 materials you arrive with */
  startMultiplier: number;
  /** Energy spent on each scavenging trip */
  scavengeEnergy: number;
  /** Multiplier applied to base zone yields (floored) */
  yieldMultiplier: number;
  /** A trip always brings home at least this many materials */
  minTripTotal: number;
  /** Chance per trip to turn up a Valley Relic */
  relicChance: number;
  /** Relative odds for each new morning's weather */
  weatherWeights: Record<Weather, number>;
}

export const MODE_RULES: Record<GameMode, ModeRules> = {
  cozy: {
    id: 'cozy',
    label: 'Cozy',
    emoji: '☀️',
    startMultiplier: 1,
    scavengeEnergy: 25,
    yieldMultiplier: 1,
    minTripTotal: 4,
    relicChance: 0.25,
    weatherWeights: { clear: 50, breezy: 30, rain: 18, storm: 2 },
  },
  challenge: {
    id: 'challenge',
    label: 'Challenge',
    emoji: '⛰️',
    startMultiplier: 0.6,
    scavengeEnergy: 35,
    yieldMultiplier: 0.75,
    minTripTotal: 3,
    relicChance: 0.2,
    weatherWeights: { clear: 34, breezy: 26, rain: 20, storm: 20 },
  },
};

/** Day 1 materials for a mode (Challenge ≈ 60%, never below 1 of anything) */
export function startingResources(mode: GameMode): Record<ResourceId, number> {
  const k = MODE_RULES[mode].startMultiplier;
  return Object.fromEntries(
    RESOURCES.map((r) => [r.id, k === 1 ? r.startAmount : Math.max(1, Math.round(r.startAmount * k))]),
  ) as Record<ResourceId, number>;
}

/* ───── Weather ───── */

export const WEATHER_INFO: Record<Weather, { label: string; emoji: string; hint: string }> = {
  clear: {
    label: 'Clear',
    emoji: '☀️',
    hint: 'Clear skies — a fine day to scavenge and build.',
  },
  breezy: {
    label: 'Breezy',
    emoji: '🍃',
    hint: 'A soft breeze moves through the valley.',
  },
  rain: {
    label: 'Soft Rain',
    emoji: '🌦️',
    hint: 'Soft rain topped up your water this morning.',
  },
  storm: {
    label: 'Dust Squall',
    emoji: '🌪️',
    hint: 'A dust squall keeps you indoors this morning — scavenging reopens in the afternoon (fortified walls let you brave it).',
  },
};

/** Upgrade that lets the player scavenge through storm mornings */
export const STORM_SHELTER_UPGRADE = 'shell-2';
/** Upgrade that adds +1 water on rainy mornings */
export const RAIN_UPGRADE = 'slot-rain-collector';
