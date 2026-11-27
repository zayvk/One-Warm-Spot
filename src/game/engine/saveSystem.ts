import type {
  DayPhase,
  GameMode,
  PlayerStats,
  ResourceId,
  SaveState,
  SiteId,
  TimeOfDay,
  TravelerGender,
} from '../types/game.ts';
import { RESOURCE_MAP } from '../data/resources.ts';
import { LEGACY_TARP_UPGRADE_ID, UPGRADES } from '../data/upgrades.ts';
import { RELIC_MAP } from '../data/relics.ts';
import { normalizeWeather, SAVED_WEATHER_VALUES } from './weather.ts';
import {
  clampPhaseElapsed,
  clampVitality,
  PHASE_DURATION_SEC,
  timeOfDayToDayPhase,
} from './dayCycle.ts';

const STORAGE_KEY = 'one-warm-spot-save';
const PROGRESS_KEY = 'one-warm-spot-progress';

/** v2: mode/gender · v3: day loop, lantern, stats · v4: weather, relics */
export const SAVE_VERSION = 4;
const MAX_DAY = 100_000;

const VALID_SITE_IDS: ReadonlySet<string> = new Set<SiteId>([
  'terrace',
  'pipe',
  'tree',
  'countryhouse',
  'farmhouse',
  'cave',
  'bunker',
  'beachhouse',
  'island',
]);

const VALID_RESOURCE_IDS: readonly ResourceId[] = [
  'timber',
  'scrap',
  'cloth',
  'stone',
  'seeds',
  'water',
  'food',
];

/** Materials added after saves already existed — absent in older saves, defaulting to 0 */
const LATER_RESOURCE_IDS: ReadonlySet<ResourceId> = new Set<ResourceId>(['food']);

const VALID_MODES: ReadonlySet<string> = new Set<GameMode>(['cozy', 'challenge']);
const VALID_GENDERS: ReadonlySet<string> = new Set<TravelerGender>(['female', 'male']);
const VALID_TIMES: ReadonlySet<string> = new Set<TimeOfDay>(['morning', 'afternoon', 'dusk', 'night']);
const VALID_DAY_PHASES: ReadonlySet<string> = new Set<DayPhase>(['day', 'dusk', 'night']);
/* Legacy 'breezy' / 'storm' stay loadable (migrated to 'wind') */
const VALID_WEATHER: ReadonlySet<string> = SAVED_WEATHER_VALUES;
const STAT_KEYS: readonly (keyof PlayerStats)[] = [
  'maxDaysSurvived',
  'totalUpgradesBuilt',
  'totalExpansionsBuilt',
];

function isWholeNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isValidStats(v: unknown): v is PlayerStats {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  return STAT_KEYS.every((k) => isWholeNumber(obj[k]));
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function isOptionalEnum(v: unknown, allowed: ReadonlySet<string>): boolean {
  return v === undefined || (typeof v === 'string' && allowed.has(v));
}

/* ───── Validation ───── */

export type SaveCheck =
  | { ok: true; save: SaveState; warnings: string[] }
  | { ok: false; error: string };

/**
 * Strict structural check of a raw (parsed JSON) save.
 * Returns a friendly, player-facing reason when the payload can't be trusted.
 */
export function findSaveProblem(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return "This file doesn't look like a One Warm Spot save.";
  }
  const obj = data as Record<string, unknown>;

  if (obj.version === undefined) return 'This save is missing its version number.';
  if (typeof obj.version !== 'number' || !Number.isInteger(obj.version) || obj.version < 1) {
    return 'This save has an unreadable version number.';
  }
  if (obj.version > SAVE_VERSION) {
    return `This save was made by a newer version of One Warm Spot (save v${obj.version}). Please update the game first.`;
  }

  if (!isWholeNumber(obj.day) || obj.day < 1 || obj.day > MAX_DAY) {
    return "The day count in this save isn't valid.";
  }

  if (obj.chosenSite !== null && (typeof obj.chosenSite !== 'string' || !VALID_SITE_IDS.has(obj.chosenSite))) {
    return "This save points to a shelter that doesn't exist.";
  }
  if (!isOptionalEnum(obj.selectedMode, VALID_MODES)) return 'This save has an unknown game mode.';
  if (!isOptionalEnum(obj.travelerGender, VALID_GENDERS)) return 'This save has an unknown traveler.';
  if (!isOptionalEnum(obj.timeOfDay, VALID_TIMES)) return 'This save has an unknown time of day.';
  if (!isOptionalEnum(obj.dayPhase, VALID_DAY_PHASES)) return 'This save has an unknown day phase.';
  if (!isOptionalEnum(obj.weather, VALID_WEATHER)) return 'This save has unknown weather.';

  if (obj.energy !== undefined && (typeof obj.energy !== 'number' || !Number.isFinite(obj.energy) || obj.energy < 0)) {
    return "The energy value in this save isn't valid.";
  }
  if (
    obj.phaseElapsedSec !== undefined &&
    (typeof obj.phaseElapsedSec !== 'number' ||
      !Number.isFinite(obj.phaseElapsedSec) ||
      obj.phaseElapsedSec < 0 ||
      obj.phaseElapsedSec > PHASE_DURATION_SEC)
  ) {
    return "The day timer in this save isn't valid.";
  }
  if (obj.stamina !== undefined && (typeof obj.stamina !== 'number' || !Number.isFinite(obj.stamina) || obj.stamina < 0)) {
    return "The stamina value in this save isn't valid.";
  }
  if (obj.strength !== undefined && (typeof obj.strength !== 'number' || !Number.isFinite(obj.strength) || obj.strength < 0)) {
    return "The strength value in this save isn't valid.";
  }

  if (!obj.resources || typeof obj.resources !== 'object' || Array.isArray(obj.resources)) {
    return 'This save is missing its materials.';
  }
  const res = obj.resources as Record<string, unknown>;
  for (const key of VALID_RESOURCE_IDS) {
    if (res[key] === undefined && LATER_RESOURCE_IDS.has(key)) continue;
    if (!isWholeNumber(res[key])) {
      return `Material amounts must be whole numbers of 0 or more (check “${key}”).`;
    }
  }

  if (!isStringArray(obj.unlockedUpgrades)) return 'The upgrade list in this save is damaged.';
  if (obj.discoveredRelics !== undefined && !isStringArray(obj.discoveredRelics)) {
    return 'The relic list in this save is damaged.';
  }
  if (
    (obj.kitCollected !== undefined && typeof obj.kitCollected !== 'boolean') ||
    (obj.lanternLit !== undefined && typeof obj.lanternLit !== 'boolean')
  ) {
    return 'This save has damaged camp details.';
  }
  if (obj.stats !== undefined && !isValidStats(obj.stats)) {
    return 'The milestone stats in this save are damaged.';
  }

  return null;
}

/** Type guard wrapper around {@link findSaveProblem} */
export function isValidSaveState(data: unknown): data is SaveState {
  return findSaveProblem(data) === null;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Normalize a structurally valid (possibly older) save into the current v4
 * shape. v2 → v3: legacy `'tarp-pitched'` flag becomes `shell-1`, day-loop
 * defaults are filled. v3 → v4: `weather: 'clear'`, `discoveredRelics: []`. Legacy weather
 * (`'breezy'` / `'storm'`) becomes `'wind'`.
 * Unknown/orphaned upgrades and relics are dropped and materials are capped
 * at their storage limit; each clean-up is reported in `warnings`.
 */
export function migrateSave(save: SaveState, warnings: string[] = []): SaveState {
  const requested = new Set(
    save.unlockedUpgrades.map((id) => (id === LEGACY_TARP_UPGRADE_ID ? 'shell-1' : id)),
  );
  const built: string[] = [];
  for (const u of UPGRADES) {
    if (requested.has(u.id) && (!u.requires || built.includes(u.requires))) built.push(u.id);
  }
  const skippedUpgrades = requested.size - built.length;
  if (skippedUpgrades > 0) warnings.push(`Skipped ${plural(skippedUpgrades, 'invalid upgrade')}.`);

  const relics = [...new Set(save.discoveredRelics ?? [])];
  const knownRelics = relics.filter((id) => RELIC_MAP[id]);
  if (knownRelics.length < relics.length) {
    warnings.push(`Skipped ${plural(relics.length - knownRelics.length, 'unknown relic')}.`);
  }

  let trimmed = false;
  const resources = Object.fromEntries(
    VALID_RESOURCE_IDS.map((id) => {
      const cap = RESOURCE_MAP[id].maxStack;
      const amount = save.resources[id] ?? 0;
      if (amount > cap) trimmed = true;
      return [id, Math.min(cap, amount)];
    }),
  ) as Record<ResourceId, number>;
  if (trimmed) warnings.push('Trimmed materials above storage limits.');

  const timeOfDay = save.timeOfDay ?? 'morning';
  const dayPhase = save.dayPhase ?? timeOfDayToDayPhase(save.timeOfDay);

  return {
    version: SAVE_VERSION,
    day: Math.max(1, Math.floor(save.day)),
    timeOfDay,
    dayPhase,
    phaseElapsedSec: clampPhaseElapsed(save.phaseElapsedSec ?? 0),
    energy: Math.round(Math.min(100, Math.max(0, save.energy ?? 100))),
    stamina: clampVitality(save.stamina ?? 100),
    strength: clampVitality(save.strength ?? 100),
    weather: normalizeWeather(save.weather),
    chosenSite: save.chosenSite,
    selectedMode: save.selectedMode ?? 'cozy',
    travelerGender: save.travelerGender ?? 'female',
    resources,
    unlockedUpgrades: built,
    kitCollected: Boolean(save.kitCollected),
    lanternLit: Boolean(save.lanternLit),
    discoveredRelics: knownRelics,
    stats: save.stats ? { ...save.stats } : undefined,
    timestamp: typeof save.timestamp === 'number' ? save.timestamp : Date.now(),
  };
}

/** Validate + migrate any parsed JSON value */
export function validateSave(data: unknown): SaveCheck {
  const problem = findSaveProblem(data);
  if (problem) return { ok: false, error: problem };
  const warnings: string[] = [];
  const save = migrateSave(data as SaveState, warnings);
  return { ok: true, save, warnings };
}

/** Parse raw save text (file contents or localStorage) */
export function parseSaveText(text: string): SaveCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't readable — expected a One Warm Spot save (.json)." };
  }
  return validateSave(parsed);
}

/* ───── Run save (localStorage) ───── */

export function saveToDisk(state: SaveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('[SaveSystem] Could not write to localStorage');
  }
}

/** Load + migrate the run save, or null if absent / unreadable */
export function loadFromDisk(): SaveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const result = parseSaveText(raw);
    if (!result.ok) {
      console.warn(`[SaveSystem] Ignoring stored save: ${result.error}`);
      return null;
    }
    return result.save;
  } catch {
    console.warn('[SaveSystem] Could not read from localStorage');
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn('[SaveSystem] Could not clear localStorage');
  }
}

/* ───── Persistent milestone progress (survives starting a new shelter) ───── */

export interface ProgressState {
  stats: PlayerStats;
  /** Milestone shelters the player has already been told about */
  announcedUnlocks: SiteId[];
}

export function loadProgress(): ProgressState | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    if (!isValidStats(obj.stats)) return null;
    const announced = Array.isArray(obj.announcedUnlocks)
      ? obj.announcedUnlocks.filter(
          (id): id is SiteId => typeof id === 'string' && VALID_SITE_IDS.has(id),
        )
      : [];
    return { stats: { ...obj.stats }, announcedUnlocks: announced };
  } catch {
    console.warn('[SaveSystem] Could not read progress');
    return null;
  }
}

export function saveProgress(progress: ProgressState): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    console.warn('[SaveSystem] Could not write progress');
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    console.warn('[SaveSystem] Could not clear progress');
  }
}

/* ───── JSON backup files live in `backup.ts` (save + stats + Terrace rooftop) ───── */
