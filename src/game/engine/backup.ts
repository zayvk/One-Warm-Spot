/* ───── Backup files (.json): run save + milestone stats + Terrace rooftop ───── */

import type { SaveState } from '../types/game.ts';
import { validateSave } from './saveSystem.ts';
import { readStoredTerraceState, validateTerraceState, type TerraceState } from './terraceState.ts';

const MAX_IMPORT_BYTES = 512 * 1024;

/**
 * A backup is the regular `SaveState` (which already carries `stats`) plus the
 * Terrace's in-scene state — including `repairedSpots` and `failedTodaySpots`
 * for downstairs scavenging spots. Older backups are plain `SaveState` files,
 * or rooftops without those fields.
 */
export type BackupFile = SaveState & { terraceState?: TerraceState };

export type BackupCheck =
  | { ok: true; save: SaveState; terrace: TerraceState | null; warnings: string[] }
  | { ok: false; error: string };

export function buildBackup(save: SaveState, terrace: TerraceState | null): BackupFile {
  return terrace ? { ...save, terraceState: terrace } : { ...save };
}

/** Validate any parsed backup JSON (strict for the save and for rooftop details when present) */
export function validateBackup(data: unknown): BackupCheck {
  const result = validateSave(data);
  if (!result.ok) return result;

  const warnings = [...result.warnings];
  const raw = (data as Record<string, unknown>).terraceState;
  let terrace: TerraceState | null = null;
  if (raw !== undefined) {
    terrace = validateTerraceState(raw);
    if (!terrace) return { ok: false, error: 'The rooftop details in this backup are damaged.' };
  } else if (result.save.chosenSite === 'terrace') {
    warnings.push('This older backup has no rooftop details, so the Terrace starts fresh.');
  }
  return { ok: true, save: result.save, terrace, warnings };
}

export function parseBackupText(text: string): BackupCheck {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't readable — expected a One Warm Spot backup (.json)." };
  }
  return validateBackup(parsed);
}

/** Download the current run (with the stored rooftop state) as a .json backup */
export function exportBackup(save: SaveState): string {
  const filename = `one-warm-spot-day${save.day}.json`;
  const backup = buildBackup(save, readStoredTerraceState());
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

/** Read & validate a backup file chosen by the player */
export async function importBackup(file: File): Promise<BackupCheck> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'That file is too large to be a One Warm Spot backup.' };
  }
  try {
    return parseBackupText(await file.text());
  } catch {
    return { ok: false, error: "That file couldn't be read." };
  }
}
