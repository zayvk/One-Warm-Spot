import { useState, useCallback } from 'react';
import { isMuted, toggleMute, playClick } from '../game/audio/soundEngine.ts';

/**
 * AudioToggle — Cozy floating speaker button, fixed top-right.
 * Visible across all screens.
 */
export default function AudioToggle() {
  const [muted, setMuted] = useState(isMuted());

  const handleToggle = useCallback(() => {
    toggleMute();
    const nowMuted = isMuted();
    setMuted(nowMuted);
    if (!nowMuted) {
      playClick();
    }
  }, []);

  return (
    <button
      onClick={handleToggle}
      aria-label={muted ? 'Unmute audio' : 'Mute audio'}
      title={muted ? 'Unmute' : 'Mute'}
      style={{
        position: 'fixed',
        top: 'var(--space-md)',
        right: 'var(--space-md)',
        zIndex: 50,
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        background: 'rgba(255,252,246,0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1.5px solid rgba(255,255,255,0.25)',
        color: '#fff',
        textShadow: '0 1px 4px rgba(61,56,50,0.3)',
        padding: 0,
        lineHeight: 1,
        cursor: 'pointer',
        transition: 'background 0.2s, transform 0.1s',
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
