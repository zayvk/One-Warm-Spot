import { useEffect, useCallback } from 'react';
import { playHover } from '../game/audio/soundEngine.ts';
import { UI_ASSETS } from '../game/data/media.ts';

export interface AboutModalProps {
  onClose: () => void;
}

const HOW_TO_PLAY = [
  'Click anywhere on the floor to walk there.',
  'Click things left behind to search boxes, clear weeds, light the fire, or build.',
  'Rest by your shelter as Day turns to Dusk, then sleep through the Night.',
];

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
      className="ows-about-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        background: 'rgba(61, 56, 50, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ows-about-title"
        onClick={(e) => e.stopPropagation()}
        className="ows-modal-card ows-about"
        style={{
          background: 'rgba(250, 248, 245, 0.94)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1.5px solid var(--terra-200)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 12px 40px rgba(61, 56, 50, 0.25)',
        }}
      >
        {/* Crest header */}
        <div className="ows-about-crest">
          <img
            src={UI_ASSETS.logoEmblem}
            alt=""
            width={52}
            height={52}
            draggable={false}
            style={{ flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(48, 38, 30, 0.25))' }}
          />
          <h2
            id="ows-about-title"
            style={{
              fontFamily: 'var(--font-game-title)',
              color: 'var(--charcoal)',
              lineHeight: 1.15,
            }}
          >
            One Warm Spot
          </h2>
        </div>

        {/* Story and tips stack on tall screens, sit side by side on short landscape phones */}
        <div className="ows-about-story">
          <p>
            The sky went quiet after the fall, and everyone kept moving. You climbed an old
            apartment stairwell, found a sunlit rooftop with a cold fire ring and a sagging
            tarp—and decided to stay.
          </p>

          <p>
            <strong>One Warm Spot</strong> is a calm, solo shelter-restoration game. There are
            no timers to fear, no raids, and no wrong pace—just gather what's left behind,
            build a warmer shelter, and watch the sky turn.
          </p>
        </div>

        <div className="ows-about-tips">
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.05rem',
              color: 'var(--terra-600)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            How to play
          </h3>
          <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--charcoal)' }}>
            {HOW_TO_PLAY.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <div className="ows-about-footer">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>One Warm Spot · v0.1</span>
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
    </div>
  );
}
