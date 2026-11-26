/* ───── Terrace In-Scene Prop State (localStorage `ows_terrace_state`) ───── */

import {
  TERRACE_BOX_IDS,
  TERRACE_BOX_VARIANTS,
  TERRACE_WEED_IDS,
  TERRACE_WEED_VARIANTS,
  terraceScene,
  type TerracePropSpawn,
  type TerracePropVariant,
  type TerraceSpawns,
} from '../data/scenes/terrace.ts';
import { generateTerraceSpawns } from './terraceSpawns.ts';

export const TERRACE_STATE_KEY = 'ows_terrace_state';

export type FirepitTier = 1 | 2 | 3;

export interface TerraceState {
  fireLit: boolean;
  searchedBoxes: string[];
  clearedWeeds: string[];
  /** IDs of non-tiered Terrace buildables the player has built in-scene */
  builtProps: string[];
  /** Fire pit progression: 1 twigs → 2 stacked logs → 3 stone-ring hearth */
  firepitTier: FirepitTier;
  /** This run's box & weed layout; `null` = hand-placed defaults (older saves) */
  spawns: TerraceSpawns | null;
}

const KNOWN_BUILDABLES = new Set((terraceScene.buildables ?? []).map((b) => b.id));
const SPAWN_IDS: readonly string[] = [...TERRACE_BOX_IDS, ...TERRACE_WEED_IDS];

export function emptyTerraceState(spawns: TerraceSpawns | null = null): TerraceState {
  return {
    fireLit: false,
    searchedBoxes: [],
    clearedWeeds: [],
    builtProps: [],
    firepitTier: 1,
    spawns,
  };
}

/** A brand-new rooftop for a fresh run, with its own random layout */
export function freshTerraceState(seed?: number): TerraceState {
  return emptyTerraceState(generateTerraceSpawns(seed));
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function parseFirepitTier(v: unknown): FirepitTier {
  return v === 2 || v === 3 ? v : 1;
}

function isUnitNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
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
 * Tolerant parser. No/unreadable data means a fresh run (new random layout);
 * older saves without `spawns` / `firepitTier` keep the default layout at Tier 1.
 */
export function parseTerraceState(raw: string | null): TerraceState {
  if (!raw) return freshTerraceState();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return freshTerraceState();
    const searchedBoxes = Array.isArray(parsed.searchedBoxes)
      ? stringList(parsed.searchedBoxes)
      : parsed.boxesSearched
        ? ['boxes-1']
        : [];
    return {
      fireLit: Boolean(parsed.fireLit),
      searchedBoxes,
      clearedWeeds: stringList(parsed.clearedWeeds),
      builtProps: [...new Set(stringList(parsed.builtProps).filter((id) => KNOWN_BUILDABLES.has(id)))],
      firepitTier: parseFirepitTier(parsed.firepitTier),
      spawns: parseSpawns(parsed.spawns),
    };
  } catch {
    return freshTerraceState();
  }
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

export function saveTerraceState(s: TerraceState): void {
  try {
    localStorage.setItem(TERRACE_STATE_KEY, JSON.stringify(s));
  } catch { /* ignore storage restrictions */ }
}

export function clearTerraceState(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TERRACE_STATE_KEY);
  } catch { /* ignore storage restrictions */ }
}
