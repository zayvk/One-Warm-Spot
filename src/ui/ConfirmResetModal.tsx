import { useCallback, useEffect, useState } from 'react';
import { playClick, playHover } from '../game/audio/soundEngine.ts';
import { exportBackup } from '../game/engine/backup.ts';
import type { SaveState } from '../game/types/game.ts';

export interface ConfirmResetModalProps {
  siteName: string;
  day: number;
  saveState: SaveState;
  onCancel: () => void;
  onConfirm: (clearMilestones: boolean) => void;
}

/**
 * ConfirmResetModal — safety prompt behind the top-bar Reset Save button.
 * Unlocked shelters are kept unless the player explicitly opts to forget them.
 */
export default function ConfirmResetModal({
  siteName,
  day,
  saveState,
  onCancel,
  onConfirm,
}: ConfirmResetModalProps) {
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [clearMilestones, setClearMilestones] = useState(false);

  const handleCancel = useCallback(() => {
    playClick();
    onCancel();
  }, [onCancel]);

  const handleExportBackup = useCallback(() => {
    playClick();
    setBackupMsg(`Saved backup as ${exportBackup(saveState)}`);
  }, [saveState]);

  const handleConfirm = useCallback(() => {
    playClick();
    onConfirm(clearMilestones);
  }, [onConfirm, clearMilestones]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      onClick={handleCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-md)',
        background: 'rgba(61, 56, 50, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'owsModalFadeSoft 200ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(250, 248, 245, 0.94)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1.5px solid var(--terra-200)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 14px 42px rgba(61, 56, 50, 0.28)',
          color: 'var(--charcoal)',
        }}
      >
        <h2
          id="reset-modal-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.35rem',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Reset this shelter?
        </h2>

        <p
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-md)',
          }}
        >
          This clears your camp at{' '}
          <strong style={{ color: 'var(--charcoal)' }}>{siteName}</strong> (Day {day}) — resources,
          upgrades and time — and returns you to the title screen. Shelters you've already
          unlocked stay unlocked.
        </p>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            fontSize: '0.86rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-md)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={clearMilestones}
            onChange={(e) => setClearMilestones(e.target.checked)}
            style={{ accentColor: 'var(--terra-600)', width: 16, height: 16 }}
          />
          Also forget unlocked shelters &amp; milestones
        </label>

        {backupMsg && (
          <p
            role="status"
            style={{
              fontSize: '0.84rem',
              color: 'var(--sage-600)',
              background: 'var(--sage-100)',
              border: '1px solid var(--sage-200)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-xs) var(--space-sm)',
              marginBottom: 'var(--space-md)',
            }}
          >
            ✓ {backupMsg}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-md)',
          }}
        >
          <button
            type="button"
            className="ows-btn-surface"
            onClick={handleCancel}
            onMouseEnter={playHover}
            onFocus={playHover}
            style={{ fontSize: '0.88rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ows-btn-surface"
            onClick={handleExportBackup}
            onMouseEnter={playHover}
            onFocus={playHover}
            style={{ fontSize: '0.88rem' }}
          >
            Export Backup (.json)
          </button>
          <button
            type="button"
            className="ows-btn-terra"
            onClick={handleConfirm}
            onMouseEnter={playHover}
            onFocus={playHover}
            style={{ fontSize: '0.88rem', fontWeight: 600 }}
          >
            Reset &amp; Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}
