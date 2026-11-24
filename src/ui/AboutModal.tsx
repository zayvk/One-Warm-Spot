import { useEffect, useCallback } from 'react';
import { playHover } from '../game/audio/soundEngine.ts';

export interface AboutModalProps {
  onClose: () => void;
}

export default function AboutModal({ onClose }: AboutModalProps) {
  /* Close on Escape */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(61, 56, 50, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 300ms ease',
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(250, 248, 245, 0.92)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1.5px solid var(--terra-200)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
          maxWidth: '520px',
          width: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(61, 56, 50, 0.25)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-game-title)',
            fontSize: '1.8rem',
            color: 'var(--charcoal)',
            marginBottom: 'var(--space-md)',
          }}
        >
          ☀️ About One Warm Spot
        </h2>

        <p style={{ marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>
          An asteroid shook the Earth, but the dust has settled. Skies are
          clearing, sunlight is returning, and somewhere in this quiet valley
          there's <strong>one warm spot</strong> waiting to become home again.
        </p>

        <p style={{ marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>
          You're a lone survivor — not a warrior, just someone who wants a safe
          place to sleep, a small garden, and a reason to keep going. The valley
          holds quiet traces of travelers who came before — half-broken camps
          waiting to be patched up into a lasting, cozy home.
        </p>

        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1rem',
            color: 'var(--terra-600)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          A cozy survival experience
        </h3>
        <ul
          style={{
            paddingLeft: 'var(--space-lg)',
            marginBottom: 'var(--space-lg)',
            lineHeight: 1.8,
            color: 'var(--charcoal)',
          }}
        >
          <li>No permadeath, no raids, no time pressure</li>
          <li>Macro upgrades at your own pace — strengthen, divide, expand</li>
          <li>Sunlit, painterly visuals designed to feel restful</li>
          <li>Autosaves to localStorage — pick up where you left off</li>
        </ul>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border)',
            paddingTop: 'var(--space-md)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v0.1.0 — Early Prototype</span>
          <button
            onClick={onClose}
            onMouseEnter={playHover}
            onFocus={playHover}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: 'var(--space-sm) var(--space-lg)',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Inline keyframe for the fade-in */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
