import type { GameMode, Weather } from '../types/game.ts';
import { MODE_RULES, RAIN_UPGRADE } from '../data/modes.ts';
import type { Rng } from './scavenge.ts';

export const WEATHER_ORDER: readonly Weather[] = ['clear', 'rain', 'wind'];

/** Weather names older saves may hold; they load as today's equivalents */
const LEGACY_WEATHER: Readonly<Record<string, Weather>> = { breezy: 'wind', storm: 'wind' };

/** Every weather string a save may contain (current + legacy) */
export const SAVED_WEATHER_VALUES: ReadonlySet<string> = new Set<string>([
  ...WEATHER_ORDER,
  ...Object.keys(LEGACY_WEATHER),
]);

/** Map any saved weather (incl. legacy `'breezy'` / `'storm'`) onto the current set; unknown → clear */
export function normalizeWeather(value: unknown): Weather {
  if (typeof value !== 'string') return 'clear';
  if ((WEATHER_ORDER as readonly string[]).includes(value)) return value as Weather;
  return LEGACY_WEATHER[value] ?? 'clear';
}

/** Roll a new morning's weather from the mode's weighted table */
export function rollWeather(mode: GameMode, rng: Rng = Math.random): Weather {
  const weights = MODE_RULES[mode].weatherWeights;
  const total = WEATHER_ORDER.reduce((sum, w) => sum + weights[w], 0);
  let roll = rng() * total;
  for (const w of WEATHER_ORDER) {
    roll -= weights[w];
    if (roll < 0) return w;
  }
  return 'clear';
}

/** Soft rain fills a few cups overnight: +1–2 water, +1 more with a rain collector */
export function morningWaterBonus(
  weather: Weather,
  built: readonly string[],
  rng: Rng = Math.random,
): number {
  if (weather !== 'rain') return 0;
  return 1 + Math.floor(rng() * 2) + (built.includes(RAIN_UPGRADE) ? 1 : 0);
}

/* ── Rooftop weather perks ── */

/** Extra water a rain barrel holds on a rainy day */
export const RAIN_BARREL_BONUS = 1;
/** Extra material found in each box searched on a windy day */
export const WIND_BOX_BONUS = 1;

/**
 * Windy-day bonus for searching a box: +1 of one of the materials the box already
 * holds (chosen by `rng`). Empty on any other weather.
 */
export function windBoxBonus(
  reward: Readonly<Record<string, number>>,
  weather: Weather,
  rng: Rng = Math.random,
): Record<string, number> {
  if (weather !== 'wind') return {};
  const kinds = Object.keys(reward).filter((k) => (reward[k] ?? 0) > 0);
  if (kinds.length === 0) return {};
  const pickIndex = Math.min(kinds.length - 1, Math.floor(rng() * kinds.length));
  return { [kinds[pickIndex]]: WIND_BOX_BONUS };
}

/** Add two material bundles together */
export function mergeMaterials(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}
