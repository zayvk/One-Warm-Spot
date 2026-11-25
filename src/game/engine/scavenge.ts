import type {
  GameMode,
  Relic,
  ResourceId,
  ScavengeZoneId,
  TimeOfDay,
  Weather,
} from '../types/game.ts';
import { SCAVENGE_ZONE_MAP } from '../data/scavengeZones.ts';
import { MODE_RULES, STORM_SHELTER_UPGRADE } from '../data/modes.ts';
import { RELICS } from '../data/relics.ts';
import { RESOURCE_MAP } from '../data/resources.ts';

/** Random source returning a float in [0, 1) — injectable for tests */
export type Rng = () => number;

/** +1 bonus material for every this many Cozy Index points */
export const COZY_BONUS_STEP = 25;

export type ResourceGains = Partial<Record<ResourceId, number>>;

export interface ScavengeResult {
  zoneId: ScavengeZoneId;
  mode: GameMode;
  /** Materials brought home (base yield + guaranteed top-up + cozy bonus) */
  gathered: ResourceGains;
  /** How many of the gathered materials came from the Cozy Index bonus */
  bonus: number;
  story: string;
  relic: Relic | null;
}

/** Why a trip can't start right now (null = good to go) */
export type ScavengeBlock = 'dark' | 'storm' | 'tired';

function randInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function totalGathered(gains: ResourceGains): number {
  return Object.values(gains).reduce((sum, n) => sum + (n ?? 0), 0);
}

export function cozyBonus(cozyIndex: number): number {
  const ci = Math.max(0, Math.min(100, Number.isFinite(cozyIndex) ? cozyIndex : 0));
  return Math.floor(ci / COZY_BONUS_STEP);
}

/**
 * Simulate one scavenging trip. Pure — the caller applies the result.
 * Base yields are drawn first (so Cozy vs. Challenge and different Cozy
 * Index values are directly comparable for the same `rng` sequence), then
 * the guaranteed minimum top-up, cozy bonus, story line and relic roll.
 */
export function runScavenge(
  zoneId: ScavengeZoneId,
  mode: GameMode,
  cozyIndex: number,
  rng: Rng = Math.random,
  discoveredRelics: readonly string[] = [],
): ScavengeResult {
  const zone = SCAVENGE_ZONE_MAP[zoneId];
  if (!zone) throw new Error(`Unknown scavenging zone: ${zoneId}`);
  const rules = MODE_RULES[mode];

  const gathered: ResourceGains = {};
  for (const y of zone.yields) {
    let amount = Math.floor(randInt(y.min, y.max, rng) * rules.yieldMultiplier);
    if (y.primary) amount = Math.max(1, amount);
    if (amount > 0) gathered[y.resource] = amount;
  }

  const primaries = zone.yields.filter((y) => y.primary).map((y) => y.resource);
  for (let i = 0, total = totalGathered(gathered); total < rules.minTripTotal; i++, total++) {
    const r = primaries[i % primaries.length];
    gathered[r] = (gathered[r] ?? 0) + 1;
  }

  const bonus = cozyBonus(cozyIndex);
  for (let b = 0; b < bonus; b++) {
    const r = pick(primaries, rng);
    gathered[r] = (gathered[r] ?? 0) + 1;
  }

  const story = pick(zone.stories, rng);

  let relic: Relic | null = null;
  if (rng() < rules.relicChance) {
    const remaining = RELICS.filter((r) => !discoveredRelics.includes(r.id));
    if (remaining.length > 0) relic = pick(remaining, rng);
  }

  return { zoneId, mode, gathered, bonus, story, relic };
}

/** Scavenging is a daytime activity; storms close the morning unless walls are fortified */
export function getScavengeBlock(
  timeOfDay: TimeOfDay,
  weather: Weather,
  built: readonly string[],
  energy: number,
  mode: GameMode,
): ScavengeBlock | null {
  if (timeOfDay === 'dusk' || timeOfDay === 'night') return 'dark';
  if (weather === 'storm' && timeOfDay === 'morning' && !built.includes(STORM_SHELTER_UPGRADE)) {
    return 'storm';
  }
  if (energy < MODE_RULES[mode].scavengeEnergy) return 'tired';
  return null;
}

/** Add gains to a stockpile, capping each material at its storage limit */
export function addResources(
  resources: Record<ResourceId, number>,
  gains: ResourceGains,
): Record<ResourceId, number> {
  const next = { ...resources };
  for (const [id, amount] of Object.entries(gains) as [ResourceId, number][]) {
    const cap = RESOURCE_MAP[id]?.maxStack ?? Number.POSITIVE_INFINITY;
    next[id] = Math.min(cap, (next[id] ?? 0) + amount);
  }
  return next;
}
