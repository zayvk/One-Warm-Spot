import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import {
  getMusicVolume,
  setMusicVolume,
  getSfxVolume,
  setSfxVolume,
  playClick,
  playHover,
  unlock,
} from '../game/audio/soundEngine.ts';
import { exportBackup } from '../game/engine/backup.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { restoreBackupFile } from './backupImport.ts';

export interface SettingsPopoverProps {
  onClose: () => void;
}

interface StatusToast {
  kind: 'success' | 'error';
  text: string;
}

/**
 * SettingsPopover — Compact frosted-glass settings panel for audio mix,
 * reduced motion preference, and JSON save export/import.
 */
export default function SettingsPopover({ onClose }: SettingsPopoverProps) {
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const setReduceMotion = useGameStore((s) => s.setReduceMotion);
  const getSaveSnapshot = useGameStore((s) => s.getSaveSnapshot);

  const [musicVol, setMusicVol] = useState(getMusicVolume);
  const [sfxVol, setSfxVol] = useState(getSfxVolume);
  const [status, setStatus] = useState<StatusToast | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showStatus = useCallback((kind: 'success' | 'error', text: string) => {
    clearTimeout(statusTimerRef.current);
    setStatus({ kind, text });
    statusTimerRef.current = setTimeout(() => setStatus(null), 4200);
  }, []);

  useEffect(() => {
    return () => clearTimeout(statusTimerRef.current);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        playClick();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleMusicChange = (e: ChangeEvent<HTMLInputElement>) => {
    unlock();
    const val = Number.parseFloat(e.target.value);
    setMusicVol(val);
    setMusicVolume(val);
  };

  const handleSfxChange = (e: ChangeEvent<HTMLInputElement>) => {
    unlock();
    const val = Number.parseFloat(e.target.value);
    setSfxVol(val);
    setSfxVolume(val);
  };

  const handleToggleReduceMotion = () => {
    playClick();
    setReduceMotion(!reduceMotion);
  };

  const handleExport = () => {
    playClick();
    const filename = exportBackup(getSaveSnapshot());
    showStatus('success', `Exported ${filename}`);
  };

  const handleImportClick = () => {
    playClick();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const result = await restoreBackupFile(file);
    showStatus(result.ok ? 'success' : 'error', result.message);
  };

  return (
    <div
      role="dialog"
      aria-label="Game settings"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 'min(320px, calc(100vw - 32px))',
        background: 'rgba(250, 248, 245, 0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1.5px solid var(--terra-200)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        boxShadow: '0 12px 34px rgba(61, 56, 50, 0.24)',
        color: 'var(--charcoal)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        zIndex: 70,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 'var(--space-xs)',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1rem',
            color: 'var(--charcoal)',
          }}
        >
          Preferences
        </h3>
        <button
          type="button"
          onClick={() => {
            playClick();
            onClose();
          }}
          aria-label="Close settings"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            padding: '2px 6px',
            fontSize: '1rem',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Music Volume */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
          <span style={{ fontWeight: 500 }}>Music Volume</span>
          <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(musicVol * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={musicVol}
          onChange={handleMusicChange}
          className="ows-slider"
          aria-label="Music Volume"
        />
      </label>

      {/* SFX & Ambience Volume */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
          <span style={{ fontWeight: 500 }}>SFX &amp; Ambience Volume</span>
          <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(sfxVol * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sfxVol}
          onChange={handleSfxChange}
          onPointerUp={playClick}
          className="ows-slider"
          aria-label="SFX & Ambience Volume"
        />
      </label>

      {/* Reduce Motion */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-sm)',
          paddingTop: '2px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ paddingTop: '6px' }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 500 }}>Reduce Motion</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
            Calms camera zoom, elevator shake, particles, fire flicker, and UI animations.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reduceMotion}
          aria-label="Reduce Motion"
          onClick={handleToggleReduceMotion}
          onMouseEnter={playHover}
          className="ows-switch"
          style={{ marginTop: '6px' }}
        >
          <span className="ows-switch-knob" />
        </button>
      </div>

      {/* Save Data Quick Row */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Save Data
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            className="ows-btn-surface"
            onClick={handleExport}
            onMouseEnter={playHover}
            style={{ flex: 1, fontSize: '0.78rem', padding: '6px 8px' }}
          >
            Export Backup (.json)
          </button>
          <button
            type="button"
            className="ows-btn-surface"
            onClick={handleImportClick}
            onMouseEnter={playHover}
            style={{ flex: 1, fontSize: '0.78rem', padding: '6px 8px' }}
          >
            Load Backup (.json)
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void handleFileChange(e);
          }}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {status && (
          <p
            role="status"
            style={{
              fontSize: '0.78rem',
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              background: status.kind === 'success' ? 'var(--sage-100)' : 'var(--terra-100)',
              border: `1px solid ${status.kind === 'success' ? 'var(--sage-200)' : 'var(--terra-400)'}`,
              color: status.kind === 'success' ? 'var(--sage-600)' : 'var(--terra-600)',
            }}
          >
            {status.kind === 'success' ? '✓ ' : '⚠ '}
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
