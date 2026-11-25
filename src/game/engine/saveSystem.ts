import type { GameMode, ResourceId, SaveState, SiteId, TravelerGender } from '../types/game.ts';

const STORAGE_KEY = 'one-warm-spot-save';

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
];

const VALID_MODES: ReadonlySet<string> = new Set<GameMode>(['cozy', 'challenge']);
const VALID_GENDERS: ReadonlySet<string> = new Set<TravelerGender>(['female', 'male']);

/** Runtime check that an unknown parsed JSON value matches SaveState */
export function isValidSaveState(data: unknown): data is SaveState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;

  if (typeof obj.day !== 'number' || !Number.isFinite(obj.day) || obj.day < 1) {
    return false;
  }

  if (
    obj.chosenSite !== null &&
    (typeof obj.chosenSite !== 'string' || !VALID_SITE_IDS.has(obj.chosenSite))
  ) {
    return false;
  }

  if (
    obj.selectedMode !== undefined &&
    (typeof obj.selectedMode !== 'string' || !VALID_MODES.has(obj.selectedMode))
  ) {
    return false;
  }

  if (
    obj.travelerGender !== undefined &&
    (typeof obj.travelerGender !== 'string' || !VALID_GENDERS.has(obj.travelerGender))
  ) {
    return false;
  }

  if (!obj.resources || typeof obj.resources !== 'object' || Array.isArray(obj.resources)) {
    return false;
  }
  const res = obj.resources as Record<string, unknown>;
  for (const key of VALID_RESOURCE_IDS) {
    if (typeof res[key] !== 'number' || !Number.isFinite(res[key]) || res[key] < 0) {
      return false;
    }
  }

  if (
    !Array.isArray(obj.unlockedUpgrades) ||
    obj.unlockedUpgrades.some((u) => typeof u !== 'string')
  ) {
    return false;
  }

  return true;
}

/** Save state to localStorage */
export function saveToDisk(state: SaveState): void {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    console.warn('[SaveSystem] Could not write to localStorage');
  }
}

/** Load state from localStorage, returns null if nothing saved */
export function loadFromDisk(): SaveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSaveState(parsed) ? parsed : null;
  } catch {
    console.warn('[SaveSystem] Could not read from localStorage');
    return null;
  }
}

/** Clear saved state */
export function clearSave(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Export save as a downloadable JSON file */
export function exportSave(state: SaveState): string {
  const filename = `one-warm-spot-day${state.day}.json`;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

/** Import save from a JSON file — returns validated state or null */
export async function importSave(file: File): Promise<SaveState | null> {
  try {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    if (!isValidSaveState(parsed)) {
      console.warn('[SaveSystem] Save file failed schema validation');
      return null;
    }
    return parsed;
  } catch {
    console.warn('[SaveSystem] Invalid save file');
    return null;
  }
}
