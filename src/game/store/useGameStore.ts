import { create } from 'zustand';
import type { ResourceId, SaveState, SiteId } from '../types/game.ts';
import { RESOURCES } from '../data/resources.ts';
import { clearSave, loadFromDisk, saveToDisk } from '../engine/saveSystem.ts';

/* ── Helpers ── */

function defaultResources(): Record<ResourceId, number> {
  return Object.fromEntries(
    RESOURCES.map((r) => [r.id, r.startAmount])
  ) as Record<ResourceId, number>;
}

const SAVE_VERSION = 1;

function freshState(): Pick<
  GameState,
  'day' | 'chosenSite' | 'resources' | 'unlockedUpgrades' | 'kitCollected' | 'tarpPitched'
> {
  return {
    day: 1,
    chosenSite: null,
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
  resources: Record<ResourceId, number>;
  unlockedUpgrades: string[];
  kitCollected: boolean;
  tarpPitched: boolean;

  /* Actions */
  chooseSite: (id: SiteId) => void;
  pitchTarp: () => void;
  resetGame: () => void;
  _save: () => void;
}

function stateToSave(s: GameState): SaveState {
  return {
    version: SAVE_VERSION,
    day: s.day,
    chosenSite: s.chosenSite,
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

    pitchTarp() {
      const s = get();
      if (s.resources.cloth < 1) return;           // costs 1 cloth
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
