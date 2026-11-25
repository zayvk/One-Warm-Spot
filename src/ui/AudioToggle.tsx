import { useState, useCallback, useRef, useEffect } from 'react';
import { isMuted, toggleMute, playClick, playHover } from '../game/audio/soundEngine.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import SettingsPopover from './SettingsPopover.tsx';

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}

/**
 * AudioToggle — Cozy floating top-right utility cluster (Settings + Mute toggle).
 * Visible across all screens.
 */
export default function AudioToggle() {
  const [muted, setMuted] = useState(isMuted);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    const nowMuted = isMuted();
    setMuted(nowMuted);
    if (!nowMuted) {
      playClick();
    }
  }, []);

  const handleToggleSettings = useCallback(() => {
    playClick();
    setSettingsOpen((open) => !open);
  }, []);

  /* Pause the day timer while settings popover is open */
  useEffect(() => {
    useGameStore.getState().setTimePaused(settingsOpen);
    return () => useGameStore.getState().setTimePaused(false);
  }, [settingsOpen]);

  /* Close popover on click outside container */
  useEffect(() => {
    if (!settingsOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [settingsOpen]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 'var(--space-md)',
        right: 'var(--space-md)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
      }}
    >
      <button
        type="button"
        onClick={handleToggleSettings}
        onMouseEnter={playHover}
        aria-label="Open settings"
        aria-expanded={settingsOpen}
        aria-haspopup="dialog"
        title="Settings"
        className="ows-icon-btn"
      >
        <SettingsIcon />
      </button>

      <button
        type="button"
        onClick={handleToggleMute}
        onMouseEnter={playHover}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={muted}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        className="ows-icon-btn"
      >
        <SpeakerIcon muted={muted} />
      </button>

      {settingsOpen && <SettingsPopover onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
