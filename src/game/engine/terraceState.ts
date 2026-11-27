/* ───── Terrace In-Scene State (localStorage `ows_terrace_state`) ───── */

import {
  DEFAULT_TERRACE_SPAWNS,
  LEGACY_DEFAULT_BOX_IDS,
  TERRACE_BOX_IDS,
  TERRACE_CARDBOARD_IDS,
  TERRACE_CARDBOARD_VARIANTS,
  TERRACE_CRATE_IDS,
  TERRACE_CRATE_VARIANTS,
  TERRACE_STATIONS,
  TERRACE_WEED_IDS,
  TERRACE_WEED_VARIANTS,
  isCardboardId,
  isCrateId,
  type TerracePropSpawn,
  type TerracePropVariant,
  type TerraceSpawns,
} from '../data/scenes/terrace.ts';
import type { StationId } from '../data/scenes/types.ts';
import { BUILDING_FLOORS, type FloorResetRule } from '../data/floors.ts';
import type { Weather } from '../types/game.ts';
import { PERK_IDS } from '../data/recipes.ts';
import {
  generateTerraceSpawns,
  regrowTerraceSpawns,
  repairTerraceSpawns,
  type RegrowOutcome,
  type Rng,
} from './terraceSpawns.ts';
import { stationMaxTier, type StationTiers } from './stations.ts';
import {
  emptySlotAssignments,
  parseSlotAssignments,
  reconcileSlotAssignments,
  type SlotAssignments,
} from './buildSlots.ts';

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
  /** Which station stands in each flexible build slot (`null` = empty) */
  slotAssignments: SlotAssignments;
  /** This run's box & weed layout; `null` = hand-placed defaults (older saves) */
  spawns: TerraceSpawns | null;
  /** Downstairs scavenging spots completed/repaired right now (e.g. `f3-fusebox`) */
  repairedSpots: string[];
  /** Downstairs scavenging spots lost today and locked until tomorrow */
  failedTodaySpots: string[];
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
    slotAssignments: emptySlotAssignments(),
    spawns,
    repairedSpots: [],
    failedTodaySpots: [],
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

function parseSpawn(v: unknown, id: string): TerracePropSpawn | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  const variants = isCrateId(id) ? TERRACE_CRATE_VARIANTS : isCardboardId(id) ? TERRACE_CARDBOARD_VARIANTS : TERRACE_WEED_VARIANTS;
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

const LEGACY_BOX_ID_LIST = Object.keys(LEGACY_DEFAULT_BOX_IDS);

/**
 * Layouts saved before crates & cartons were split used `boxes-1..3` with any box art:
 * crate art becomes `crate-1/2`, the parcel becomes a carton. Returns the converted raw
 * layout plus how the old ids map, so searched boxes follow their prop.
 */
function migrateLegacyBoxes(raw: Record<string, unknown>): { raw: Record<string, unknown>; idMap: Record<string, string> } {
  if (!LEGACY_BOX_ID_LIST.some((id) => id in raw) || TERRACE_CRATE_IDS.some((id) => id in raw)) {
    return { raw, idMap: {} };
  }
  const out: Record<string, unknown> = { ...raw };
  const idMap: Record<string, string> = {};
  const crates = [...TERRACE_CRATE_IDS];
  const cartons = [...TERRACE_CARDBOARD_IDS];
  for (const legacyId of LEGACY_BOX_ID_LIST) {
    const spawn = raw[legacyId];
    delete out[legacyId];
    const variant = spawn && typeof spawn === 'object' ? (spawn as Record<string, unknown>).variant : undefined;
    const target = typeof variant === 'string' && variant in TERRACE_CRATE_VARIANTS ? crates.shift() : cartons.shift();
    if (!target) continue;
    out[target] = spawn;
    idMap[legacyId] = target;
  }
  return { raw: out, idMap };
}

/** Both crates and all 6 weeds must be present and well-formed (cartons only while on the roof), otherwise the default layout */
function parseSpawns(raw: Record<string, unknown>): TerraceSpawns | null {
  const spawns: TerraceSpawns = {};
  for (const id of SPAWN_IDS) {
    if (raw[id] === undefined && isCardboardId(id)) continue;
    const spawn = parseSpawn(raw[id], id);
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
    if (obj.repairedSpots !== undefined && !isStringList(obj.repairedSpots)) return null;
    if (obj.failedTodaySpots !== undefined && !isStringList(obj.failedTodaySpots)) return null;
    for (const key of ['planterReady', 'barrelReady']) {
      if (obj[key] !== undefined && typeof obj[key] !== 'boolean') return null;
    }
  }

  const state = emptyTerraceState(null);
  state.fireLit = Boolean(obj.fireLit);
  const rawSearched = Array.isArray(obj.searchedBoxes)
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
  /* Saves from before the downstairs puzzles have none */
  state.repairedSpots = [...new Set(stringList(obj.repairedSpots))];
  state.failedTodaySpots = [...new Set(stringList(obj.failedTodaySpots))];

  /* Older rooftops have no slot data: built stations go back to their old spots */
  const slots = parseSlotAssignments(obj.slotAssignments, strict);
  if (!slots) return null;
  state.slotAssignments = reconcileSlotAssignments(slots, stationTiersOf(state));

  /* Older box ids follow their prop: by art in saved layouts, by spot in the hand-placed one */
  let idMap: Record<string, string> = LEGACY_DEFAULT_BOX_IDS;
  if (obj.spawns === undefined || obj.spawns === null) {
    state.spawns = null;
  } else {
    if (typeof obj.spawns !== 'object' || Array.isArray(obj.spawns)) {
      if (strict) return null;
    } else {
      const migrated = migrateLegacyBoxes(obj.spawns as Record<string, unknown>);
      idMap = migrated.idMap;
      state.spawns = parseSpawns(migrated.raw);
    }
    if (!state.spawns && strict) return null;
    /* Layouts saved before the stations were recomposed: nudge only the props that now overlap */
    if (state.spawns) state.spawns = repairTerraceSpawns(state.spawns);
  }
  if (!state.spawns) idMap = LEGACY_DEFAULT_BOX_IDS;

  /*
   * Searched wooden crates stay on the roof (kept in `searchedBoxes`); a searched carton
   * is gone, so it simply has no spawn.
   */
  const searched = [...new Set(rawSearched.map((id) => idMap[id] ?? id))];
  const searchedCartons = searched.filter((id) => isCardboardId(id));
  if (searchedCartons.length > 0) {
    const spawns = state.spawns ?? structuredClone(DEFAULT_TERRACE_SPAWNS);
    for (const id of searchedCartons) delete spawns[id];
    state.spawns = spawns;
  }
  state.searchedBoxes = searched.filter((id) => isCrateId(id));
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

export function isSpotRepaired(state: Pick<TerraceState, 'repairedSpots'> | null, spotId: string): boolean {
  return Boolean(state?.repairedSpots.includes(spotId));
}

/** Records a downstairs spot as fixed (immutable; the same state back if it already was) */
export function withSpotRepaired(state: TerraceState, spotId: string): TerraceState {
  return isSpotRepaired(state, spotId) ? state : { ...state, repairedSpots: [...state.repairedSpots, spotId] };
}

/** Marks a downstairs spot fixed in the stored rooftop state and persists it */
export function markStoredSpotRepaired(spotId: string): TerraceState {
  const state = withSpotRepaired(loadTerraceState(), spotId);
  saveTerraceState(state);
  return state;
}

export function isSpotFailedToday(state: Pick<TerraceState, 'failedTodaySpots'> | null, spotId: string): boolean {
  return Boolean(state?.failedTodaySpots.includes(spotId));
}

/** Records a downstairs spot lost today (immutable; locked until tomorrow) */
export function withSpotFailedToday(state: TerraceState, spotId: string): TerraceState {
  return isSpotFailedToday(state, spotId) ? state : { ...state, failedTodaySpots: [...state.failedTodaySpots, spotId] };
}

/** Marks a downstairs spot lost today in the stored rooftop state and persists it */
export function markStoredSpotFailedToday(spotId: string): TerraceState {
  const state = withSpotFailedToday(loadTerraceState(), spotId);
  saveTerraceState(state);
  return state;
}

const FLOOR_RESET_RULES: Readonly<Record<string, FloorResetRule | undefined>> = Object.fromEntries(
  Object.values(BUILDING_FLOORS)
    .flatMap((f) => f.hotspots)
    .map((h) => [h.id, h.resetRule]),
);

export function floorSpotResetRule(spotId: string): FloorResetRule | undefined {
  return FLOOR_RESET_RULES[spotId];
}

/**
 * Overnight reset for downstairs scavenging spots under the new morning's `weather`:
 * - Always clears `'daily'` containers (cupboards, trunks, lockers)
 * - Clears `'rain'` wiring spots (e.g. Floor 3 Fuse Box) when `weather === 'rain'`
 * - Clears `'wind'` door spots when `weather === 'wind'`
 */
export function resetFloorSpotsForNewDay(repairedSpots: readonly string[], weather: Weather): string[] {
  return repairedSpots.filter((id) => {
    const rule = FLOOR_RESET_RULES[id];
    if (rule === 'daily') return false;
    if (weather === 'rain' && rule === 'rain') return false;
    if (weather === 'wind' && rule === 'wind') return false;
    return true;
  });
}

/**
 * Overnight regrowth on the stored rooftop under the new morning's `weather`
 * (persisted when anything changed). `null` if no rooftop has been saved yet.
 */
export function regrowStoredTerrace(weather: Weather = 'clear', rng?: Rng): RegrowOutcome<TerraceState> | null {
  const stored = readStoredTerraceState();
  if (!stored) return null;
  const outcome = regrowTerraceSpawns(stored, weather, rng);
  if (outcome.state !== stored) saveTerraceState(outcome.state);
  return outcome;
}

export function clearTerraceState(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TERRACE_STATE_KEY);
  } catch { /* ignore storage restrictions */ }
}
