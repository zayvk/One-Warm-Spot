/* ───── Terrace In-Scene State (localStorage `ows_terrace_state`) ───── */

import {
  TERRACE_BOX_IDS,
  TERRACE_BOX_VARIANTS,
  TERRACE_STATIONS,
  TERRACE_WEED_IDS,
  TERRACE_WEED_VARIANTS,
  type TerracePropSpawn,
  type TerracePropVariant,
  type TerraceSpawns,
} from '../data/scenes/terrace.ts';
import type { StationId } from '../data/scenes/types.ts';
import { PERK_IDS } from '../data/recipes.ts';
import {
  generateTerraceSpawns,
  regrowTerraceSpawns,
  repairTerraceSpawns,
  type RegrowOutcome,
  type Rng,
} from './terraceSpawns.ts';
import { stationMaxTier, type StationTiers } from './stations.ts';

export const TERRACE_STATE_KEY = 'ows_terrace_state';

export interface TerraceState {
  fireLit: boolean;
  searchedBoxes: string[];
  clearedWeeds: string[];
  /** Shelter 1–3: cloth lean-to → timber shelter → insulated hut */
  shelterTier: number;
  /** Fire pit 1–3: twigs → stacked logs → stone-ring hearth */
  firepitTier: number;
  /** Farm 0–3 (0 = not built) */
  planterTier: number;
  /** Rainwater barrel 0–3 */
  barrelTier: number;
  /** Cooking grill 0–4 */
  grillTier: number;
  /** Sewing / knitting kit 0–5 */
  sewingTier: number;
  /** Harvestable today (refreshes each morning) */
  planterReady: boolean;
  /** Rainwater to collect today (refreshes each morning) */
  barrelReady: boolean;
  /** Mending perks crafted at the sewing kit */
  craftedPerks: string[];
  /** This run's box & weed layout; `null` = hand-placed defaults (older saves) */
  spawns: TerraceSpawns | null;
}

export const STATION_TIER_KEY: Record<StationId, keyof TerraceState> = {
  shelter: 'shelterTier',
  firepit: 'firepitTier',
  planter: 'planterTier',
  barrel: 'barrelTier',
  grill: 'grillTier',
  sewing: 'sewingTier',
};

/** Pre-station saves recorded one-off builds; they map onto Tier 2 of each station */
const LEGACY_BUILDS: Record<string, StationId> = {
  'shed-upgrade': 'shelter',
  'timber-shelter': 'shelter',
  'herb-planter': 'planter',
  'rain-barrel': 'barrel',
};

const SPAWN_IDS: readonly string[] = [...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS];

export function stationTiersOf(s: TerraceState): StationTiers {
  return {
    shelter: s.shelterTier,
    firepit: s.firepitTier,
    planter: s.planterTier,
    barrel: s.barrelTier,
    grill: s.grillTier,
    sewing: s.sewingTier,
  };
}

export function emptyTerraceState(spawns: TerraceSpawns | null = null): TerraceState {
  return {
    fireLit: false,
    searchedBoxes: [],
    clearedWeeds: [],
    shelterTier: 1,
    firepitTier: 1,
    planterTier: 0,
    barrelTier: 0,
    grillTier: 0,
    sewingTier: 0,
    planterReady: false,
    barrelReady: false,
    craftedPerks: [],
    spawns,
  };
}

/** A brand-new rooftop for a fresh run, with its own random layout */
export function freshTerraceState(seed?: number): TerraceState {
  return emptyTerraceState(generateTerraceSpawns(seed));
}

function isUnitNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function parseSpawn(v: unknown, isBox: boolean): TerracePropSpawn | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const variants = isBox ? TERRACE_BOX_VARIANTS : TERRACE_WEED_VARIANTS;
  if (!isUnitNumber(s.x) || !isUnitNumber(s.y)) return null;
  if (typeof s.variant !== 'string' || !(s.variant in variants)) return null;
  if (typeof s.scale !== 'number' || !Number.isFinite(s.scale) || s.scale < 0.8 || s.scale > 1.2) return null;
  return {
    x: s.x,
    y: s.y,
    variant: s.variant as TerracePropVariant,
    scale: s.scale,
    flipX: Boolean(s.flipX),
  };
}

/** All 9 spawns must be present and well-formed, otherwise use the default layout */
function parseSpawns(v: unknown): TerraceSpawns | null {
  if (!v || typeof v !== 'object') return null;
  const raw = v as Record<string, unknown>;
  const spawns: TerraceSpawns = {};
  for (const id of SPAWN_IDS) {
    const spawn = parseSpawn(raw[id], (TERRACE_BOX_IDS as readonly string[]).includes(id));
    if (!spawn) return null;
    spawns[id] = spawn;
  }
  return spawns;
}

/**
 * Shared normalizer. `strict` (backups) rejects any damaged field with `null`;
 * lenient mode (localStorage) falls back to safe defaults instead.
 */
function normalizeTerraceState(obj: Record<string, unknown>, strict: boolean): TerraceState | null {
  if (strict) {
    if (typeof obj.fireLit !== 'boolean') return null;
    if (!isStringList(obj.searchedBoxes) || !isStringList(obj.clearedWeeds)) return null;
    if (obj.builtProps !== undefined && !isStringList(obj.builtProps)) return null;
    if (obj.craftedPerks !== undefined && !isStringList(obj.craftedPerks)) return null;
    for (const key of ['planterReady', 'barrelReady']) {
      if (obj[key] !== undefined && typeof obj[key] !== 'boolean') return null;
    }
  }

  const state = emptyTerraceState(null);
  state.fireLit = Boolean(obj.fireLit);
  state.searchedBoxes = Array.isArray(obj.searchedBoxes)
    ? stringList(obj.searchedBoxes)
    : obj.boxesSearched
      ? ['boxes-1']
      : [];
  state.clearedWeeds = stringList(obj.clearedWeeds);

  /* Legacy one-off builds become Tier 2 of their station */
  const legacy: Partial<Record<StationId, number>> = {};
  for (const id of stringList(obj.builtProps)) {
    const station = LEGACY_BUILDS[id];
    if (station) legacy[station] = 2;
  }

  for (const station of TERRACE_STATIONS) {
    const key = STATION_TIER_KEY[station.id];
    const raw = obj[key];
    let tier = legacy[station.id] ?? station.baseTier;
    if (raw !== undefined) {
      const valid = typeof raw === 'number' && Number.isInteger(raw) && raw >= station.baseTier && raw <= stationMaxTier(station);
      if (!valid && strict) return null;
      if (valid) tier = Math.max(tier, raw);
    }
    (state[key] as number) = tier;
  }

  /* A freshly built (or migrated) station starts ready */
  state.planterReady = state.planterTier >= 1 && (typeof obj.planterReady === 'boolean' ? obj.planterReady : true);
  state.barrelReady = state.barrelTier >= 1 && (typeof obj.barrelReady === 'boolean' ? obj.barrelReady : true);
  state.craftedPerks = [...new Set(stringList(obj.craftedPerks).filter((id) => PERK_IDS.has(id)))];

  if (obj.spawns === undefined || obj.spawns === null) {
    state.spawns = null;
  } else {
    state.spawns = parseSpawns(obj.spawns);
    if (!state.spawns && strict) return null;
    /* Layouts saved before the stations were recomposed: nudge only the props that now overlap */
    if (state.spawns) state.spawns = repairTerraceSpawns(state.spawns);
  }
  return state;
}

/**
 * Tolerant parser. No/unreadable data means a fresh run (new random layout);
 * older saves keep the default layout, and legacy builds migrate to station tiers.
 */
export function parseTerraceState(raw: string | null): TerraceState {
  if (!raw) return freshTerraceState();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return freshTerraceState();
    return normalizeTerraceState(parsed as Record<string, unknown>, false) ?? freshTerraceState();
  } catch {
    return freshTerraceState();
  }
}

/**
 * Strict check for rooftop state carried inside a backup file.
 * Returns the normalized state, or `null` if any field is damaged.
 */
export function validateTerraceState(v: unknown): TerraceState | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return normalizeTerraceState(v as Record<string, unknown>, true);
}

/** Load (and persist, so a freshly generated layout survives refresh / Continue) */
export function loadTerraceState(): TerraceState {
  try {
    const raw = localStorage.getItem(TERRACE_STATE_KEY);
    const state = parseTerraceState(raw);
    if (JSON.stringify(state) !== raw) saveTerraceState(state);
    return state;
  } catch {
    return freshTerraceState();
  }
}

/** The stored rooftop as-is (no fresh layout generated), or `null` if none */
export function readStoredTerraceState(): TerraceState | null {
  try {
    const raw = localStorage.getItem(TERRACE_STATE_KEY);
    return raw ? parseTerraceState(raw) : null;
  } catch {
    return null;
  }
}

export function saveTerraceState(s: TerraceState): void {
  try {
    localStorage.setItem(TERRACE_STATE_KEY, JSON.stringify(s));
  } catch { /* ignore storage restrictions */ }
}

/**
 * Overnight regrowth on the stored rooftop for the morning of `day` (persisted when
 * anything regrew). `null` if no rooftop has been saved yet.
 */
export function regrowStoredTerrace(day: number, rng?: Rng): RegrowOutcome<TerraceState> | null {
  const stored = readStoredTerraceState();
  if (!stored) return null;
  const outcome = regrowTerraceSpawns(stored, day, rng);
  if (outcome.state !== stored) saveTerraceState(outcome.state);
  return outcome;
}

export function clearTerraceState(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TERRACE_STATE_KEY);
  } catch { /* ignore storage restrictions */ }
}
