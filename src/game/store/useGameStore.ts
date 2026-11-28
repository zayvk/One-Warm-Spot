import { create } from 'zustand';
import type {
  DayPhase,
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
import { freshRunResources, MODE_RULES, startingResources, WEATHER_INFO } from '../data/modes.ts';
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
import {
  clearTerraceState,
  floorSpotResetRule,
  readStoredTerraceState,
  regrowStoredTerrace,
  applyFloorNightReset,
  saveTerraceState,
  type TerraceState,
} from '../engine/terraceState.ts';
import type { RegrowOutcome } from '../engine/terraceSpawns.ts';
import {
  advancePhaseClock,
  applyRest,
  applySleep,
  clampVitality,
  dayPhaseToTimeOfDay,
  MAX_VITALITY,
  timeOfDayToDayPhase,
  type SleepComfort,
} from '../engine/dayCycle.ts';
import { applyRecipe, phaseStrengthDecay } from '../engine/stations.ts';
import type { Recipe } from '../data/recipes.ts';

/* ── Helpers ── */

/**
 * Morning toast line for what the night's weather did to the rooftop ('' when nothing
 * changed). Each weather has its own distinct effect: calm → a weed patch, rain → weeds
 * (and a full barrel), wind → cardboard boxes.
 */
function morningRooftopNote(weather: Weather, weeds: number, boxes: number, barrelBuilt: boolean): string {
  if (weather === 'rain') {
    if (weeds > 0 && barrelBuilt) return 'Soft rain filled the barrel and sprouted extra weeds overnight.';
    if (weeds > 0) return 'Soft rain sprouted extra weeds overnight.';
    return barrelBuilt ? 'Soft rain filled the barrel overnight.' : '';
  }
  if (weather === 'wind') {
    if (boxes === 0) return '';
    return boxes === 1
      ? 'Gusty wind carried a fresh cardboard box onto the roof overnight.'
      : 'Gusty wind carried fresh boxes onto the roof overnight.';
  }
  return weeds > 0 ? 'A fresh weed patch sprouted overnight.' : '';
}

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
  | 'day' | 'timeOfDay' | 'dayPhase' | 'phaseElapsedSec' | 'energy' | 'stamina' | 'strength'
  | 'chosenSite' | 'selectedMode' | 'travelerGender'
  | 'resources' | 'unlockedUpgrades' | 'kitCollected' | 'lanternLit'
  | 'weather' | 'discoveredRelics'
>;

function freshRunState(): RunState {
  return {
    day: 1,
    timeOfDay: 'morning',
    dayPhase: 'day',
    phaseElapsedSec: 0,
    energy: MAX_ENERGY,
    stamina: MAX_VITALITY,
    strength: MAX_VITALITY,
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
  const dayPhase = save.dayPhase ?? timeOfDayToDayPhase(save.timeOfDay);
  return {
    day: save.day,
    timeOfDay: save.timeOfDay ?? dayPhaseToTimeOfDay(dayPhase),
    dayPhase,
    phaseElapsedSec: save.phaseElapsedSec ?? 0,
    energy: save.energy ?? MAX_ENERGY,
    stamina: clampVitality(save.stamina ?? MAX_VITALITY),
    strength: clampVitality(save.strength ?? MAX_VITALITY),
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
  return getUnlockedSiteIds(stats).filter((id) => SITES.find((s) => s.id === id)?.unlockRequirement);
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
  dayPhase: DayPhase;
  phaseElapsedSec: number;
  energy: number;
  stamina: number;
  strength: number;
  timePaused: boolean;
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
  /** Real-time 3-phase clock tick (paused outside shelter or in menus) */
  tickDayCycle: (deltaSec: number) => void;
  spendStamina: (amount: number) => void;
  restAtShelter: () => boolean;
  /** Sleep into Day N+1; `comfort` comes from the shelter tier & mending perks */
  /** Sleep into Day N+1; returns the Terrace's overnight regrowth (`null` off the Terrace) */
  sleepAtShelter: (comfort?: SleepComfort) => RegrowOutcome<TerraceState> | null;
  /** Eat a grill recipe: spends ingredients, restores Stamina & Strength */
  cookRecipe: (recipe: Recipe) => boolean;
  /** Runtime multiplier on Strength drift per phase (Quilted Cozy Cloak = 0.5) */
  strengthDriftFactor: number;
  setStrengthDriftFactor: (factor: number) => void;
  setTimePaused: (paused: boolean) => void;
  lightLantern: () => void;
  resetGame: (opts?: { clearMilestones?: boolean }) => void;
  getSaveSnapshot: () => SaveState;
  applyImportedSave: (save: SaveState) => void;
  /** Restore a full backup: run save + stats + Terrace rooftop (`null` = start the rooftop fresh) */
  applyImportedBackup: (save: SaveState, terrace: TerraceState | null) => void;
  /** Bumped when the shelter scene must reload its persisted state (e.g. after a backup import) */
  sceneRevision: number;
  dismissNotice: (id: number) => void;
  /** Queue a gentle toast (e.g. in-scene discoveries) */
  pushNotice: (notice: Omit<Notice, 'id'>) => void;
  _save: () => void;
}

function stateToSave(s: GameState): SaveState {
  return {
    version: SAVE_VERSION,
    day: s.day,
    timeOfDay: s.timeOfDay,
    dayPhase: s.dayPhase,
    phaseElapsedSec: Math.round(s.phaseElapsedSec),
    energy: s.energy,
    stamina: s.stamina,
    strength: s.strength,
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
    timePaused: false,
    strengthDriftFactor: 1,
    sceneRevision: 0,
    reduceMotion: getInitialReduceMotion(),

    chooseSite(id: SiteId) {
      // Claiming always begins a fresh run with the site's mode rules
      clearTerraceState();
      const s = get();
      const mode = SITES.find((site) => site.id === id)?.mode ?? s.selectedMode;
      set({
        ...freshRunState(),
        chosenSite: id,
        selectedMode: mode,
        travelerGender: s.travelerGender,
        resources: freshRunResources(mode),
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
      const block = getScavengeBlock(s.timeOfDay, s.energy, s.selectedMode);
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
          : `Energy restored. ${info.morning}`;
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

    tickDayCycle(deltaSec: number) {
      const s = get();
      if (s.timePaused || !s.chosenSite) return;
      const res = advancePhaseClock(
        s.dayPhase,
        s.phaseElapsedSec,
        deltaSec,
        s.strength,
        phaseStrengthDecay(s.strengthDriftFactor),
      );
      if (
        res.dayPhase === s.dayPhase &&
        res.phaseElapsedSec === s.phaseElapsedSec &&
        res.strength === s.strength
      ) {
        return;
      }
      set({
        dayPhase: res.dayPhase,
        timeOfDay: dayPhaseToTimeOfDay(res.dayPhase),
        phaseElapsedSec: res.phaseElapsedSec,
        strength: res.strength,
      });
      if (res.phaseChanged || Math.floor(res.phaseElapsedSec) % 10 === 0) {
        get()._save();
      }
    },

    spendStamina(amount: number) {
      const s = get();
      const next = clampVitality(s.stamina - Math.max(0, amount));
      if (next === s.stamina) return;
      set({ stamina: next });
      get()._save();
    },

    restAtShelter() {
      const s = get();
      const outcome = applyRest(s.dayPhase, s.stamina, s.strength, phaseStrengthDecay(s.strengthDriftFactor));
      if (!outcome) return false;
      set({
        dayPhase: outcome.dayPhase,
        timeOfDay: dayPhaseToTimeOfDay(outcome.dayPhase),
        phaseElapsedSec: outcome.phaseElapsedSec,
        stamina: outcome.stamina,
        strength: outcome.strength,
      });
      get()._save();
      return true;
    },

    sleepAtShelter(comfort?: SleepComfort) {
      const s = get();
      const outcome = applySleep(s.day, s.strength, comfort, s.stamina);
      const weather = rollWeather(s.selectedMode);
      const water = morningWaterBonus(weather, s.unlockedUpgrades);
      /* Each weather shapes the rooftop overnight — rain greens it, wind blows in cartons (persisted before the scene reloads it) */
      const regrowth = s.chosenSite === 'terrace' ? regrowStoredTerrace(weather) : null;
      let floorResetNote = '';
      if (s.chosenSite === 'terrace') {
        const storedTerrace = regrowth?.state ?? readStoredTerraceState();
        if (storedTerrace) {
          /* Re-locked doors also forget their room interiors */
          const { state: nextState, resetIds } = applyFloorNightReset(storedTerrace, weather);
          if (nextState !== storedTerrace) {
            saveTerraceState(nextState);
            if (regrowth) regrowth.state = nextState;
          }
          const hadRainReset = resetIds.some((id) => floorSpotResetRule(id) === 'rain');
          const hadWindReset = resetIds.some((id) => floorSpotResetRule(id) === 'wind');
          const notes: string[] = [];
          if (hadRainReset) notes.push('Rain shorted out downstairs wiring.');
          if (hadWindReset) notes.push('Strong wind slammed downstairs doors shut.');
          floorResetNote = notes.join(' ');
        }
      }
      set({
        day: outcome.day,
        dayPhase: outcome.dayPhase,
        timeOfDay: 'morning',
        phaseElapsedSec: outcome.phaseElapsedSec,
        stamina: outcome.stamina,
        strength: outcome.strength,
        energy: MAX_ENERGY,
        weather,
        resources: water > 0 ? addResources(s.resources, { water }) : s.resources,
      });
      const info = WEATHER_INFO[weather];
      const rooftopLine = regrowth
        ? morningRooftopNote(
            weather,
            regrowth.regrownWeeds.length,
            regrowth.refreshedBoxes.length,
            regrowth.state.barrelTier >= 1,
          )
        : '';
      const tail =
        water > 0
          ? `Your cups caught +${water} ${RESOURCE_MAP.water.emoji}, too.`
          : `Stamina ${outcome.stamina}/100.`;
      const bodyParts = [rooftopLine || info.morning, floorResetNote, tail].filter(Boolean);
      commitStats(
        { ...s.stats, maxDaysSurvived: Math.max(s.stats.maxDaysSurvived, daysSurvivedOn(outcome.day)) },
        [
          {
            id: ++noticeSeq,
            icon: info.emoji,
            title: `Day ${outcome.day} · Morning`,
            body: bodyParts.join(' '),
            tone: 'morning',
          },
        ],
      );
      get()._save();
      return regrowth;
    },

    cookRecipe(recipe: Recipe) {
      const s = get();
      const outcome = applyRecipe(recipe, s.resources, s.stamina, s.strength);
      if (!outcome) return false;
      set({ resources: outcome.resources, stamina: outcome.stamina, strength: outcome.strength });
      get()._save();
      return true;
    },

    setStrengthDriftFactor(factor: number) {
      if (get().strengthDriftFactor !== factor) set({ strengthDriftFactor: factor });
    },

    setTimePaused(paused: boolean) {
      set({ timePaused: paused });
    },

    lightLantern() {
      if (get().lanternLit) return;
      set({ lanternLit: true });
      get()._save();
    },

    resetGame(opts) {
      clearSave();
      clearTerraceState();
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

    applyImportedBackup(save: SaveState, terrace: TerraceState | null) {
      if (terrace) saveTerraceState(terrace);
      else clearTerraceState();
      get().applyImportedSave(save);
      set({ sceneRevision: get().sceneRevision + 1 });
    },

    dismissNotice(id: number) {
      set({ notices: get().notices.filter((n) => n.id !== id) });
    },

    pushNotice(notice) {
      const { notices } = get();
      // Don't stack the same message while it's still on screen
      if (notices.some((n) => n.title === notice.title)) return;
      set({ notices: [...notices, { ...notice, id: ++noticeSeq }] });
    },

    _save() {
      saveToDisk(stateToSave(get()));
    },
  };
});
