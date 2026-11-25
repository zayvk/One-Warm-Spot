import type {
  PlayerStats,
  ResourceId,
  Site,
  SiteId,
  TimeOfDay,
  Upgrade,
} from '../types/game.ts';
import { SITES } from '../data/sites.ts';
import { UPGRADE_MAP } from '../data/upgrades.ts';

/* ───── Time of Day ───── */

export const TIME_OF_DAY_ORDER: readonly TimeOfDay[] = ['morning', 'afternoon', 'dusk', 'night'];

export const TIME_OF_DAY_INFO: Record<TimeOfDay, { label: string; emoji: string }> = {
  morning: { label: 'Morning', emoji: '🌅' },
  afternoon: { label: 'Afternoon', emoji: '☀️' },
  dusk: { label: 'Dusk', emoji: '🌇' },
  night: { label: 'Night', emoji: '🌙' },
};

export const MAX_ENERGY = 100;
/** Energy regained by resting until the next time-of-day phase */
export const REST_ENERGY_GAIN = 15;

/** Next phase, or `null` at night (the player must sleep to start a new day) */
export function nextTimeOfDay(t: TimeOfDay): TimeOfDay | null {
  const i = TIME_OF_DAY_ORDER.indexOf(t);
  return i >= 0 && i < TIME_OF_DAY_ORDER.length - 1 ? TIME_OF_DAY_ORDER[i + 1] : null;
}

/** Full days survived once the player is on `day` (Day 1 = 0 survived) */
export function daysSurvivedOn(day: number): number {
  return Math.max(0, Math.floor(day) - 1);
}

/* ───── Upgrades & Cozy Index ───── */

export type UpgradeStatus = 'built' | 'available' | 'need-materials' | 'too-tired' | 'locked';

export function computeCozyIndex(builtIds: readonly string[]): number {
  let total = 0;
  for (const id of new Set(builtIds)) total += UPGRADE_MAP[id]?.cozy ?? 0;
  return total;
}

export function canAfford(
  cost: Upgrade['cost'],
  resources: Record<ResourceId, number>,
): boolean {
  return (Object.entries(cost) as [ResourceId, number][]).every(
    ([id, amount]) => (resources[id] ?? 0) >= amount,
  );
}

/** Deduct a material cost, or `null` if the stockpile can't cover it */
export function spendResources(
  resources: Record<ResourceId, number>,
  cost: Partial<Record<ResourceId, number>>,
): Record<ResourceId, number> | null {
  if (!canAfford(cost, resources)) return null;
  const next = { ...resources };
  for (const [id, amount] of Object.entries(cost) as [ResourceId, number][]) {
    next[id] = (next[id] ?? 0) - amount;
  }
  return next;
}

export function getUpgradeStatus(
  upgrade: Upgrade,
  builtIds: readonly string[],
  resources: Record<ResourceId, number>,
  energy: number,
): UpgradeStatus {
  if (builtIds.includes(upgrade.id)) return 'built';
  if (upgrade.requires && !builtIds.includes(upgrade.requires)) return 'locked';
  if (!canAfford(upgrade.cost, resources)) return 'need-materials';
  if (energy < upgrade.energy) return 'too-tired';
  return 'available';
}

export type BuildOutcome =
  | { ok: true; resources: Record<ResourceId, number>; energy: number; built: string[] }
  | { ok: false; status: Exclude<UpgradeStatus, 'available'> };

/** Pure build step: checks eligibility, then deducts materials and energy */
export function applyUpgradeBuild(
  upgrade: Upgrade,
  resources: Record<ResourceId, number>,
  energy: number,
  built: readonly string[],
): BuildOutcome {
  const status = getUpgradeStatus(upgrade, built, resources, energy);
  if (status !== 'available') return { ok: false, status };

  const next = { ...resources };
  for (const [rid, amount] of Object.entries(upgrade.cost) as [ResourceId, number][]) {
    next[rid] -= amount;
  }
  return {
    ok: true,
    resources: next,
    energy: Math.max(0, energy - upgrade.energy),
    built: [...built, upgrade.id],
  };
}

/* ───── Shelter Unlocks ───── */

export function emptyStats(): PlayerStats {
  return { maxDaysSurvived: 0, totalUpgradesBuilt: 0, totalExpansionsBuilt: 0 };
}

export function isSiteUnlocked(site: Site, stats: PlayerStats): boolean {
  const req = site.unlockRequirement;
  return !req || stats[req.stat] >= req.count;
}

export function getUnlockedSiteIds(stats: PlayerStats): SiteId[] {
  return SITES.filter((s) => isSiteUnlocked(s, stats)).map((s) => s.id);
}

/** Milestone sites that are unlocked but not yet announced to the player */
export function findNewUnlocks(stats: PlayerStats, announced: readonly SiteId[]): Site[] {
  return SITES.filter(
    (s) => s.unlockRequirement && isSiteUnlocked(s, stats) && !announced.includes(s.id),
  );
}
