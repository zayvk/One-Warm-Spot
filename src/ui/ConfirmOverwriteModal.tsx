import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="overwrite-modal-title"
      onClick={handleCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        background: 'rgba(36, 28, 20, 0.66)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'owsModalFade 200ms ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ows-modal-card"
        style={{
          background: 'rgba(252, 248, 242, 0.98)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1.5px solid var(--terra-200)',
          borderRadius: 'var(--radius-lg)',
          padding: 'clamp(16px, 4dvh, 24px)',
          width: '480px',
          boxShadow: '0 14px 42px rgba(61, 56, 50, 0.34)',
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

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
