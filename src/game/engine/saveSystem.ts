import type { SaveState } from '../types/game.ts';

const STORAGE_KEY = 'one-warm-spot-save';

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
    return JSON.parse(raw) as SaveState;
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
export function exportSave(state: SaveState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `one-warm-spot-day${state.day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import save from a JSON file — returns parsed state or null */
export async function importSave(file: File): Promise<SaveState | null> {
  try {
    const text = await file.text();
    return JSON.parse(text) as SaveState;
  } catch {
    console.warn('[SaveSystem] Invalid save file');
    return null;
  }
}
