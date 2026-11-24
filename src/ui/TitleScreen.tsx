import { useState } from 'react';
import BackgroundStage from './BackgroundStage.tsx';
import AboutModal from './AboutModal.tsx';
import { BG_TITLE } from '../game/data/media.ts';
import { useGameStore } from '../game/store/useGameStore.ts';

export interface TitleScreenProps {
  onStart: () => void;
  onContinue: () => void;
}

export default function TitleScreen({ onStart, onContinue }: TitleScreenProps) {
  const [showAbout, setShowAbout] = useState(false);
  const hasSave = useGameStore((s) => s.chosenSite) !== null;

  return (
    <>
      <BackgroundStage media={BG_TITLE} />

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 'var(--space-xl)',
          textAlign: 'center',
        }}
      >
        {/* Game title */}
        <h1
          style={{
            fontFamily: 'var(--font-game-title)',
            fontSize: 'clamp(3rem, 7vw, 5.5rem)',
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 20px rgba(61,56,50,0.45), 0 1px 4px rgba(61,56,50,0.3)',
            letterSpacing: '0.02em',
            marginBottom: 'var(--space-sm)',
            lineHeight: 1.15,
          }}
        >
          One Warm Spot
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(0.95rem, 2vw, 1.2rem)',
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 8px rgba(61,56,50,0.35)',
            marginBottom: 'var(--space-xl)',
            maxWidth: '480px',
          }}
        >
          The dust has settled. The sun returns. Find your shelter.
        </p>

        {/* Button group */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            alignItems: 'center',
            minWidth: '200px',
          }}
        >
          {hasSave ? (
            <>
              <button
                onClick={onContinue}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  padding: 'var(--space-md) var(--space-xl)',
                  fontSize: '1.15rem',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  fontWeight: 600,
                }}
              >
                ☀️ Continue
              </button>
              <button
                onClick={onStart}
                style={{
                  background: 'rgba(255,252,246,0.25)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: '#fff',
                  padding: 'var(--space-sm) var(--space-xl)',
                  fontSize: '1rem',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  border: '1.5px solid rgba(255,255,255,0.3)',
                }}
              >
                New Game
              </button>
            </>
          ) : (
            <button
              onClick={onStart}
              style={{
                background: 'var(--accent)',
                color: '#fff',
                padding: 'var(--space-md) var(--space-xl)',
                fontSize: '1.15rem',
                borderRadius: 'var(--radius-md)',
                width: '100%',
                fontWeight: 600,
              }}
            >
              ☀️ Start
            </button>
          )}

          <button
            onClick={() => setShowAbout(true)}
            style={{
              background: 'rgba(255,252,246,0.2)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.85)',
              padding: 'var(--space-sm) var(--space-xl)',
              fontSize: '0.9rem',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              border: '1.5px solid rgba(255,255,255,0.2)',
            }}
          >
            About
          </button>
        </div>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}
