import { useEffect, useState, useCallback } from 'react';
import { playClick, playHover } from '../game/audio/soundEngine.ts';
import { exportBackup } from '../game/engine/backup.ts';
import type { SaveState } from '../game/types/game.ts';

export interface ConfirmOverwriteModalProps {
  siteName: string;
  day: number;
  saveState: SaveState;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * ConfirmOverwriteModal — Warm frosted-glass safety prompt shown before
 * replacing an existing saved shelter.
 */
export default function ConfirmOverwriteModal({
  siteName,
  day,
  saveState,
  onCancel,
  onConfirm,
}: ConfirmOverwriteModalProps) {
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const handleCancel = useCallback(() => {
    playClick();
    onCancel();
  }, [onCancel]);

  const handleExportBackup = useCallback(() => {
    playClick();
    const filename = exportBackup(saveState);
    setBackupMsg(`Saved backup as ${filename}`);
  }, [saveState]);

  const handleStartFresh = useCallback(() => {
    playClick();
    onConfirm();
  }, [onConfirm]);

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
      aria-labelledby="overwrite-modal-title"
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
        animation: 'owsModalFade 200ms ease',
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
          id="overwrite-modal-title"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.35rem',
            color: 'var(--charcoal)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          Replace existing shelter?
        </h2>

        <p
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-md)',
          }}
        >
          You already have a shelter at{' '}
          <strong style={{ color: 'var(--charcoal)' }}>{siteName}</strong> (Day{' '}
          {day}). Starting a new shelter will replace this save.
        </p>

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
            onClick={handleStartFresh}
            onMouseEnter={playHover}
            onFocus={playHover}
            style={{ fontSize: '0.88rem', fontWeight: 600 }}
          >
            Start Fresh
          </button>
        </div>
      </div>

      <style>{`
        @keyframes owsModalFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
