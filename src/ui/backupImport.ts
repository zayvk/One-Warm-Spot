import { importBackup } from '../game/engine/backup.ts';
import { SITES } from '../game/data/sites.ts';
import { useGameStore } from '../game/store/useGameStore.ts';

export type BackupImportResult = { ok: true; message: string } | { ok: false; message: string };

/** Validate a chosen .json backup and, if it's sound, restore it into the game */
export async function restoreBackupFile(file: File): Promise<BackupImportResult> {
  const result = await importBackup(file);
  if (!result.ok) return { ok: false, message: `Could not load backup — ${result.error}` };

  useGameStore.getState().applyImportedBackup(result.save, result.terrace);
  const siteName = SITES.find((s) => s.id === result.save.chosenSite)?.name;
  const loaded = siteName
    ? `Restored Day ${result.save.day} · ${siteName}.`
    : `Restored Day ${result.save.day} save data.`;
  return { ok: true, message: [loaded, ...result.warnings].join(' ') };
}
