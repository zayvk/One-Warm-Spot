/* ───── Terrace In-Scene Prop State (localStorage `ows_terrace_state`) ───── */

import { terraceScene } from '../data/scenes/terrace.ts';

export const TERRACE_STATE_KEY = 'ows_terrace_state';

export interface TerraceState {
  fireLit: boolean;
  searchedBoxes: string[];
  clearedWeeds: string[];
  /** IDs of Terrace buildables the player has built in-scene */
  builtProps: string[];
}

const KNOWN_BUILDABLES = new Set((terraceScene.buildables ?? []).map((b) => b.id));

export function emptyTerraceState(): TerraceState {
  return { fireLit: false, searchedBoxes: [], clearedWeeds: [], builtProps: [] };
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Tolerant parser: unknown/damaged fields fall back to a fresh rooftop */
export function parseTerraceState(raw: string | null): TerraceState {
  if (!raw) return emptyTerraceState();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return emptyTerraceState();
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
    };
  } catch {
    return emptyTerraceState();
  }
}

export function loadTerraceState(): TerraceState {
  try {
    return parseTerraceState(localStorage.getItem(TERRACE_STATE_KEY));
  } catch {
    return emptyTerraceState();
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
