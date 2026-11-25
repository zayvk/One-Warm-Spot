import { create } from 'zustand';
import type { GameMode, ResourceId, SaveState, SiteId, TravelerGender } from '../types/game.ts';
import { RESOURCES } from '../data/resources.ts';
import { clearSave, loadFromDisk, saveToDisk } from '../engine/saveSystem.ts';

/* ── Helpers ── */

const REDUCE_MOTION_KEY = 'ows_reduce_motion';
const SAVE_VERSION = 2;

function defaultResources(): Record<ResourceId, number> {
  return Object.fromEntries(
    RESOURCES.map((r) => [r.id, r.startAmount])
  ) as Record<ResourceId, number>;
}

function getInitialReduceMotion(): boolean {
  try {
    const stored = localStorage.getItem(REDUCE_MOTION_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

function freshRunState(): Pick<
  GameState,
  | 'day' | 'chosenSite' | 'selectedMode' | 'travelerGender'
  | 'resources' | 'unlockedUpgrades' | 'kitCollected' | 'tarpPitched'
> {
  return {
    day: 1,
    chosenSite: null,
    selectedMode: 'cozy',
    travelerGender: 'female',
    resources: defaultResources(),
    unlockedUpgrades: [],
    kitCollected: false,
    tarpPitched: false,
  };
}

/* ── Store shape ── */

export interface GameState {
  day: number;
  chosenSite: SiteId | null;
  selectedMode: GameMode;
  travelerGender: TravelerGender;
  resources: Record<ResourceId, number>;
  unlockedUpgrades: string[];
  kitCollected: boolean;
  tarpPitched: boolean;
  reduceMotion: boolean;

  /* Actions */
  chooseSite: (id: SiteId) => void;
  setMode: (m: GameMode) => void;
  setGender: (g: TravelerGender) => void;
  setReduceMotion: (enabled: boolean) => void;
  pitchTarp: () => void;
  resetGame: () => void;
  getSaveSnapshot: () => SaveState;
  applyImportedSave: (save: SaveState) => void;
  _save: () => void;
}

function stateToSave(s: GameState): SaveState {
  return {
    version: SAVE_VERSION,
    day: s.day,
    chosenSite: s.chosenSite,
    selectedMode: s.selectedMode,
    travelerGender: s.travelerGender,
    resources: s.resources,
    unlockedUpgrades: s.unlockedUpgrades,
    kitCollected: s.kitCollected,
    timestamp: Date.now(),
  };
}

/* ── Create store ── */

export const useGameStore = create<GameState>()((set, get) => {
  const loaded = loadFromDisk();

  const initialRun = loaded
    ? {
        day: loaded.day,
        chosenSite: loaded.chosenSite,
        selectedMode: loaded.selectedMode ?? 'cozy',
        travelerGender: loaded.travelerGender ?? 'female',
        resources: loaded.resources,
        unlockedUpgrades: loaded.unlockedUpgrades,
        kitCollected: Boolean(loaded.kitCollected),
        tarpPitched: loaded.unlockedUpgrades.includes('tarp-pitched'),
      }
    : freshRunState();

  return {
    ...initialRun,
    reduceMotion: getInitialReduceMotion(),

    chooseSite(id: SiteId) {
      set({ chosenSite: id, kitCollected: true });
      get()._save();
    },

    setMode(m: GameMode) {
      set({ selectedMode: m });
    },

    setGender(g: TravelerGender) {
      set({ travelerGender: g });
      if (get().chosenSite) {
        get()._save();
      }
    },

    setReduceMotion(enabled: boolean) {
      try {
        localStorage.setItem(REDUCE_MOTION_KEY, String(enabled));
      } catch {
        /* ignore storage restrictions */
      }
      set({ reduceMotion: enabled });
    },

    pitchTarp() {
      const s = get();
      if (s.resources.cloth < 1) return;
      const upgrades = [...s.unlockedUpgrades, 'tarp-pitched'];
      set({
        tarpPitched: true,
        resources: { ...s.resources, cloth: s.resources.cloth - 1 },
        unlockedUpgrades: upgrades,
      });
      get()._save();
    },

    resetGame() {
      clearSave();
      set(freshRunState());
    },

    getSaveSnapshot() {
      return stateToSave(get());
    },

    applyImportedSave(save: SaveState) {
      const normalized: SaveState = {
        version: SAVE_VERSION,
        day: save.day,
        chosenSite: save.chosenSite,
        selectedMode: save.selectedMode ?? 'cozy',
        travelerGender: save.travelerGender ?? 'female',
        resources: { ...defaultResources(), ...save.resources },
        unlockedUpgrades: [...save.unlockedUpgrades],
        kitCollected: Boolean(save.kitCollected),
        timestamp: Date.now(),
      };
      saveToDisk(normalized);
      set({
        day: normalized.day,
        chosenSite: normalized.chosenSite,
        selectedMode: normalized.selectedMode,
        travelerGender: normalized.travelerGender,
        resources: normalized.resources,
        unlockedUpgrades: normalized.unlockedUpgrades,
        kitCollected: normalized.kitCollected,
        tarpPitched: normalized.unlockedUpgrades.includes('tarp-pitched'),
      });
    },

    _save() {
      saveToDisk(stateToSave(get()));
    },
  };
});
