import { create } from 'zustand';
import type { GameMode, ResourceId, SaveState, SiteId, TravelerGender } from '../types/game.ts';
import { RESOURCES } from '../data/resources.ts';
import { clearSave, loadFromDisk, saveToDisk } from '../engine/saveSystem.ts';

/* ── Helpers ── */

function defaultResources(): Record<ResourceId, number> {
  return Object.fromEntries(
    RESOURCES.map((r) => [r.id, r.startAmount])
  ) as Record<ResourceId, number>;
}

const SAVE_VERSION = 2;

function freshState(): Pick<
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

  /* Actions */
  chooseSite: (id: SiteId) => void;
  setMode: (m: GameMode) => void;
  setGender: (g: TravelerGender) => void;
  pitchTarp: () => void;
  resetGame: () => void;
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

  const initial = loaded
    ? {
        day: loaded.day,
        chosenSite: loaded.chosenSite,
        selectedMode: loaded.selectedMode ?? 'cozy',
        travelerGender: loaded.travelerGender ?? 'female',
        resources: loaded.resources,
        unlockedUpgrades: loaded.unlockedUpgrades,
        kitCollected: loaded.kitCollected,
        tarpPitched: loaded.unlockedUpgrades.includes('tarp-pitched'),
      }
    : freshState();

  return {
    ...initial,

    chooseSite(id: SiteId) {
      set({ chosenSite: id, kitCollected: true });
      get()._save();
    },

    setMode(m: GameMode) {
      set({ selectedMode: m });
    },

    setGender(g: TravelerGender) {
      set({ travelerGender: g });
      get()._save();
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
      set(freshState());
    },

    _save() {
      saveToDisk(stateToSave(get()));
    },
  };
});
