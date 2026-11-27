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
    weatherWeights: { clear: 50, rain: 25, wind: 25 },
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
    weatherWeights: { clear: 40, rain: 30, wind: 30 },
  },
};

/** Day 1 materials for a mode (Challenge ≈ 60%, never below 1 of anything you'd normally start with) */
export function startingResources(mode: GameMode): Record<ResourceId, number> {
  const k = MODE_RULES[mode].startMultiplier;
  return Object.fromEntries(
    RESOURCES.map((r) => [
      r.id,
      k === 1 || r.startAmount === 0 ? r.startAmount : Math.max(1, Math.round(r.startAmount * k)),
    ]),
  ) as Record<ResourceId, number>;
}

/*
 * ⚠️ TEST MODE — generous starting pool.
 * While the Terrace stations are being tuned, every fresh run starts with enough
 * materials (together with the rooftop's boxes & weeds) to build every station tier,
 * craft every mending perk and cook each recipe right away.
 * Set to `false` to restore normal Day 1 scarcity (once downstairs scavenging lands).
 */
export const TEST_MODE_GENEROUS_START = true;

export const GENEROUS_TEST_POOL: Readonly<Record<ResourceId, number>> = {
  timber: 40,
  cloth: 15,
  seeds: 10,
  water: 8,
  scrap: 20,
  stone: 16,
  food: 6,
};

/** Materials a freshly claimed shelter starts with (honours TEST_MODE_GENEROUS_START) */
export function freshRunResources(mode: GameMode): Record<ResourceId, number> {
  return TEST_MODE_GENEROUS_START ? { ...GENEROUS_TEST_POOL } : startingResources(mode);
}

/* ───── Weather ───── */

export interface WeatherInfo {
  /** Short HUD label */
  label: string;
  emoji: string;
  /** What it does on the rooftop (HUD chip tooltip) */
  hint: string;
  /** Morning toast line */
  morning: string;
}

export const WEATHER_INFO: Record<Weather, WeatherInfo> = {
  clear: {
    label: 'Clear',
    emoji: '☀️',
    hint: 'Calm skies over the rooftop',
    morning: 'Clear skies greet the rooftop.',
  },
  rain: {
    label: 'Rain',
    emoji: '🌧️',
    hint: 'Extra water from the barrel & faster weed growth',
    morning: 'Soft rain patters on the rooftop.',
  },
  wind: {
    label: 'Wind',
    emoji: '🍃',
    hint: 'Fresh boxes blown onto the roof with bonus materials',
    morning: 'A gusty breeze sweeps the rooftop.',
  },
};

/** Upgrade that adds +1 water on rainy mornings */
export const RAIN_UPGRADE = 'slot-rain-collector';
