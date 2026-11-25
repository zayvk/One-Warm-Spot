import type { GameMode, Weather } from '../types/game.ts';
import { MODE_RULES, RAIN_UPGRADE } from '../data/modes.ts';
import type { Rng } from './scavenge.ts';

const WEATHER_ORDER: readonly Weather[] = ['clear', 'breezy', 'rain', 'storm'];

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
