import { create } from 'zustand';
import type {
  GameMode,
  PlayerStats,
  ResourceId,
  SaveState,
  ScavengeZoneId,
  SiteId,
  TimeOfDay,
  TravelerGender,
  Weather,
} from '../types/game.ts';
import { UPGRADE_MAP } from '../data/upgrades.ts';
import { SITES } from '../data/sites.ts';
import { MODE_RULES, startingResources, WEATHER_INFO } from '../data/modes.ts';
import { RESOURCE_MAP } from '../data/resources.ts';
import {
  clearProgress,
  clearSave,
  loadFromDisk,
  loadProgress,
  migrateSave,
  SAVE_VERSION,
  saveProgress,
  saveToDisk,
} from '../engine/saveSystem.ts';
import {
  applyUpgradeBuild,
  computeCozyIndex,
  daysSurvivedOn,
  emptyStats,
  findNewUnlocks,
  getUnlockedSiteIds,
  MAX_ENERGY,
  nextTimeOfDay,
  REST_ENERGY_GAIN,
  type UpgradeStatus,
} from '../engine/progression.ts';
import {
  addResources,
  getScavengeBlock,
  runScavenge,
  type ScavengeBlock,
  type ScavengeResult,
} from '../engine/scavenge.ts';
import { morningWaterBonus, rollWeather } from '../engine/weather.ts';

/* ── Helpers ── */

const REDUCE_MOTION_KEY = 'ows_reduce_motion';

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

type RunState = Pick<
  GameState,
  | 'day' | 'timeOfDay' | 'energy' | 'chosenSite' | 'selectedMode' | 'travelerGender'
  | 'resources' | 'unlockedUpgrades' | 'kitCollected' | 'lanternLit'
  | 'weather' | 'discoveredRelics'
>;

function freshRunState(): RunState {
  return {
    day: 1,
    timeOfDay: 'morning',
    energy: MAX_ENERGY,
    chosenSite: null,
    selectedMode: 'cozy',
    travelerGender: 'female',
    resources: startingResources('cozy'),
    unlockedUpgrades: [],
    kitCollected: false,
    lanternLit: false,
    weather: 'clear',
    discoveredRelics: [],
  };
}

function runStateFromSave(save: SaveState): RunState {
  return {
    day: save.day,
    timeOfDay: save.timeOfDay ?? 'morning',
    energy: save.energy ?? MAX_ENERGY,
    chosenSite: save.chosenSite,
    selectedMode: save.selectedMode,
    travelerGender: save.travelerGender,
    resources: save.resources,
    unlockedUpgrades: save.unlockedUpgrades,
    kitCollected: save.kitCollected,
    lanternLit: Boolean(save.lanternLit),
    weather: save.weather ?? 'clear',
    discoveredRelics: save.discoveredRelics ?? [],
  };
}

function mergeStats(a: PlayerStats, b: PlayerStats | undefined): PlayerStats {
  if (!b) return { ...a };
  return {
    maxDaysSurvived: Math.max(a.maxDaysSurvived, b.maxDaysSurvived),
    totalUpgradesBuilt: Math.max(a.totalUpgradesBuilt, b.totalUpgradesBuilt),
    totalExpansionsBuilt: Math.max(a.totalExpansionsBuilt, b.totalExpansionsBuilt),
  };
}

/** Derive milestone stats from a single save (used to seed pre-v3 players) */
function statsFromSave(save: SaveState): PlayerStats {
  return {
    maxDaysSurvived: daysSurvivedOn(save.day),
    totalUpgradesBuilt: save.unlockedUpgrades.length,
    totalExpansionsBuilt: save.unlockedUpgrades.filter(
      (id) => UPGRADE_MAP[id]?.category === 'expansion',
    ).length,
  };
}

function milestoneSitesUnlocked(stats: PlayerStats): SiteId[] {
  return getUnlockedSiteIds(stats).filter((id) => !['terrace', 'pipe', 'tree'].includes(id));
}

let noticeSeq = 0;

/* ── Store shape ── */

export interface Notice {
  id: number;
  icon: string;
  title: string;
  body?: string;
  tone: 'morning' | 'unlock' | 'build';
}

export type ScavengeAttempt =
  | { ok: true; result: ScavengeResult }
  | { ok: false; block: ScavengeBlock };

export interface GameState {
  day: number;
  timeOfDay: TimeOfDay;
  energy: number;
  chosenSite: SiteId | null;
  selectedMode: GameMode;
  travelerGender: TravelerGender;
  resources: Record<ResourceId, number>;
  /** IDs of built upgrades */
  unlockedUpgrades: string[];
  kitCollected: boolean;
  lanternLit: boolean;
  /** Today's weather, rolled each new morning (Day 1 is always clear) */
  weather: Weather;
  /** IDs of Valley Relics found while scavenging */
  discoveredRelics: string[];
  /** Persistent milestone stats (kept when starting a new shelter) */
  stats: PlayerStats;
  announcedUnlocks: SiteId[];
  notices: Notice[];
  reduceMotion: boolean;

  /* Actions */
  chooseSite: (id: SiteId) => void;
  setMode: (m: GameMode) => void;
  setGender: (g: TravelerGender) => void;
  setReduceMotion: (enabled: boolean) => void;
  buildUpgrade: (id: string) => UpgradeStatus;
  /** Spend energy and one part of the day gathering materials at a valley spot */
  goScavenging: (zoneId: ScavengeZoneId) => ScavengeAttempt;
  /** Rest until the next phase; at night this sleeps to the next day */
  advanceTime: () => void;
  sleepToNextDay: () => void;
  lightLantern: () => void;
  resetGame: (opts?: { clearMilestones?: boolean }) => void;
  getSaveSnapshot: () => SaveState;
  applyImportedSave: (save: SaveState) => void;
  dismissNotice: (id: number) => void;
  _save: () => void;
}

function stateToSave(s: GameState): SaveState {
  return {
    version: SAVE_VERSION,
    day: s.day,
    timeOfDay: s.timeOfDay,
    energy: s.energy,
    chosenSite: s.chosenSite,
    selectedMode: s.selectedMode,
    travelerGender: s.travelerGender,
    resources: s.resources,
    unlockedUpgrades: s.unlockedUpgrades,
    kitCollected: s.kitCollected,
    lanternLit: s.lanternLit,
    weather: s.weather,
    discoveredRelics: s.discoveredRelics,
    stats: s.stats,
    timestamp: Date.now(),
  };
}

/* ── Create store ── */

export const useGameStore = create<GameState>()((set, get) => {
  const loaded = loadFromDisk();
  const storedProgress = loadProgress();
  // Persist the migrated (v3) shape right away so legacy fields never linger
  if (loaded) saveToDisk(loaded);

  let initialStats = storedProgress?.stats ?? emptyStats();
  if (loaded) {
    initialStats = mergeStats(initialStats, loaded.stats);
    if (!storedProgress) initialStats = mergeStats(initialStats, statsFromSave(loaded));
  }
  const initialAnnounced = storedProgress?.announcedUnlocks ?? milestoneSitesUnlocked(initialStats);
  if (!storedProgress) {
    saveProgress({ stats: initialStats, announcedUnlocks: initialAnnounced });
  }

  /** Persist stats and queue gentle toasts for any newly reached milestones */
  function commitStats(stats: PlayerStats, extraNotices: Notice[] = []): void {
    const s = get();
    const fresh = findNewUnlocks(stats, s.announcedUnlocks);
    const announcedUnlocks = [...s.announcedUnlocks, ...fresh.map((site) => site.id)];
    const unlockNotices: Notice[] = fresh.map((site) => ({
      id: ++noticeSeq,
      icon: '🔓',
      title: `New shelter unlocked: ${site.name}`,
      body: site.tagline,
      tone: 'unlock',
    }));
    set({
      stats,
      announcedUnlocks,
      notices: [...s.notices, ...extraNotices, ...unlockNotices],
    });
    saveProgress({ stats, announcedUnlocks });
  }

  return {
    ...(loaded ? runStateFromSave(loaded) : freshRunState()),
    stats: initialStats,
    announcedUnlocks: initialAnnounced,
    notices: [],
    reduceMotion: getInitialReduceMotion(),

    chooseSite(id: SiteId) {
      // Claiming always begins a fresh run with the site's mode rules
      const s = get();
      const mode = SITES.find((site) => site.id === id)?.mode ?? s.selectedMode;
      set({
        ...freshRunState(),
        chosenSite: id,
        selectedMode: mode,
        travelerGender: s.travelerGender,
        resources: startingResources(mode),
        kitCollected: true,
      });
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

    buildUpgrade(id: string) {
      const s = get();
      const upgrade = UPGRADE_MAP[id];
      if (!upgrade) return 'locked';
      const outcome = applyUpgradeBuild(upgrade, s.resources, s.energy, s.unlockedUpgrades);
      if (!outcome.ok) return outcome.status;

      set({
        resources: outcome.resources,
        energy: outcome.energy,
        unlockedUpgrades: outcome.built,
      });
      commitStats({
        ...s.stats,
        totalUpgradesBuilt: s.stats.totalUpgradesBuilt + 1,
        totalExpansionsBuilt:
          s.stats.totalExpansionsBuilt + (upgrade.category === 'expansion' ? 1 : 0),
      });
      get()._save();
      return 'built';
    },

    goScavenging(zoneId: ScavengeZoneId) {
      const s = get();
      const block = getScavengeBlock(
        s.timeOfDay,
        s.weather,
        s.unlockedUpgrades,
        s.energy,
        s.selectedMode,
      );
      if (block) return { ok: false, block };

      const result = runScavenge(
        zoneId,
        s.selectedMode,
        computeCozyIndex(s.unlockedUpgrades),
        Math.random,
        s.discoveredRelics,
      );
      set({
        energy: Math.max(0, s.energy - MODE_RULES[s.selectedMode].scavengeEnergy),
        timeOfDay: nextTimeOfDay(s.timeOfDay) ?? s.timeOfDay,
        resources: addResources(s.resources, result.gathered),
        discoveredRelics: result.relic
          ? [...s.discoveredRelics, result.relic.id]
          : s.discoveredRelics,
      });
      get()._save();
      return { ok: true, result };
    },

    advanceTime() {
      const s = get();
      const next = nextTimeOfDay(s.timeOfDay);
      if (!next) {
        get().sleepToNextDay();
        return;
      }
      set({ timeOfDay: next, energy: Math.min(MAX_ENERGY, s.energy + REST_ENERGY_GAIN) });
      get()._save();
    },

    sleepToNextDay() {
      const s = get();
      const day = s.day + 1;
      const weather = rollWeather(s.selectedMode);
      const water = morningWaterBonus(weather, s.unlockedUpgrades);
      set({
        day,
        timeOfDay: 'morning',
        energy: MAX_ENERGY,
        weather,
        resources: water > 0 ? addResources(s.resources, { water }) : s.resources,
      });
      const info = WEATHER_INFO[weather];
      const weatherLine =
        water > 0
          ? `Soft rain overnight — +${water} ${RESOURCE_MAP.water.emoji} collected.`
          : weather === 'storm'
            ? 'A dust squall is passing — a cozy morning to craft or rest indoors.'
            : `Energy restored. ${info.label} skies today.`;
      commitStats(
        { ...s.stats, maxDaysSurvived: Math.max(s.stats.maxDaysSurvived, daysSurvivedOn(day)) },
        [
          {
            id: ++noticeSeq,
            icon: info.emoji,
            title: `Morning of Day ${day}`,
            body: weatherLine,
            tone: 'morning',
          },
        ],
      );
      get()._save();
    },

    lightLantern() {
      if (get().lanternLit) return;
      set({ lanternLit: true });
      get()._save();
    },

    resetGame(opts) {
      clearSave();
      if (opts?.clearMilestones) {
        clearProgress();
        const stats = emptyStats();
        set({ stats, announcedUnlocks: [] });
        saveProgress({ stats, announcedUnlocks: [] });
      }
      set({ ...freshRunState(), notices: [] });
    },

    getSaveSnapshot() {
      return stateToSave(get());
    },

    applyImportedSave(save: SaveState) {
      const normalized = migrateSave(save);
      set(runStateFromSave(normalized));
      const imported = normalized.stats ?? statsFromSave(normalized);
      commitStats(mergeStats(get().stats, imported));
      get()._save();
    },

    dismissNotice(id: number) {
      set({ notices: get().notices.filter((n) => n.id !== id) });
    },

    _save() {
      saveToDisk(stateToSave(get()));
    },
  };
});
