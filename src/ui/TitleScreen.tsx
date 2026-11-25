import { useState } from 'react';
import BackgroundStage from './BackgroundStage.tsx';
import AboutModal from './AboutModal.tsx';
import ConfirmOverwriteModal from './ConfirmOverwriteModal.tsx';
import { BG_TITLE } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { playHover, playClick } from '../game/audio/soundEngine.ts';

export interface TitleScreenProps {
  onStart: () => void;
  onContinue: () => void;
}

export default function TitleScreen({ onStart, onContinue }: TitleScreenProps) {
  const [showAbout, setShowAbout] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const chosenSite = useGameStore((s) => s.chosenSite);
  const day = useGameStore((s) => s.day);
  const resetGame = useGameStore((s) => s.resetGame);
  const getSaveSnapshot = useGameStore((s) => s.getSaveSnapshot);

  const hasSave = chosenSite !== null;
  const savedSiteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';

  const handleStart = () => {
    playClick();
    if (hasSave) {
      setShowOverwriteConfirm(true);
      return;
    }
    onStart();
  };

  const handleConfirmOverwrite = () => {
    resetGame();
    setShowOverwriteConfirm(false);
    onStart();
  };

  const handleContinue = () => {
    playClick();
    onContinue();
  };

  const handleAboutOpen = () => {
    playClick();
    setShowAbout(true);
  };

  return (
    <>
      <BackgroundStage media={BG_TITLE} />

      {/* Content layer positioned in the upper-center open sky area */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '100%',
          overflowY: 'auto',
          paddingTop: 'clamp(42px, 7vh, 84px)',
          paddingBottom: 'var(--space-lg)',
          paddingInline: 'var(--space-md)',
          textAlign: 'center',
        }}
      >
        <div className="ows-title-scrim">
          {/* Game title */}
          <h1
            style={{
              fontFamily: 'var(--font-game-title)',
              fontSize: 'clamp(2.8rem, 6.5vw, 5rem)',
              fontWeight: 700,
              color: '#fff',
              textShadow:
                '0 3px 22px rgba(48, 38, 30, 0.55), 0 1px 4px rgba(48, 38, 30, 0.4)',
              letterSpacing: '0.02em',
              marginBottom: 'var(--space-sm)',
              lineHeight: 1.12,
            }}
          >
            One Warm Spot
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(0.95rem, 1.8vw, 1.18rem)',
              color: 'rgba(255, 252, 246, 0.94)',
              textShadow: '0 2px 10px rgba(48, 38, 30, 0.52)',
              marginBottom: 'var(--space-lg)',
              maxWidth: '460px',
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
              width: '100%',
              maxWidth: '220px',
            }}
          >
            {hasSave ? (
              <>
                <button
                  type="button"
                  onClick={handleContinue}
                  onMouseEnter={playHover}
                  onFocus={playHover}
                  className="ows-btn-primary"
                  style={{
                    padding: '12px var(--space-lg)',
                    fontSize: '1.1rem',
                    borderRadius: 'var(--radius-md)',
                    width: '100%',
                    fontWeight: 600,
                  }}
                >
                  ☀️ Continue
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  onMouseEnter={playHover}
                  onFocus={playHover}
                  className="ows-btn-glass"
                  style={{
                    padding: '10px var(--space-lg)',
                    fontSize: '0.96rem',
                    borderRadius: 'var(--radius-md)',
                    width: '100%',
                    fontWeight: 500,
                  }}
                >
                  New Game
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                onMouseEnter={playHover}
                onFocus={playHover}
                className="ows-btn-primary"
                style={{
                  padding: '12px var(--space-lg)',
                  fontSize: '1.1rem',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  fontWeight: 600,
                }}
              >
                ☀️ Start
              </button>
            )}

            <button
              type="button"
              onClick={handleAboutOpen}
              onMouseEnter={playHover}
              onFocus={playHover}
              className="ows-btn-glass"
              style={{
                padding: '9px var(--space-lg)',
                fontSize: '0.9rem',
                borderRadius: 'var(--radius-md)',
                width: '100%',
              }}
            >
              About
            </button>
          </div>
        </div>
      </div>

      {showAbout && (
        <AboutModal
          onClose={() => {
            playClick();
            setShowAbout(false);
          }}
        />
      )}

      {showOverwriteConfirm && (
        <ConfirmOverwriteModal
          siteName={savedSiteName}
          day={day}
          saveState={getSaveSnapshot()}
          onCancel={() => setShowOverwriteConfirm(false)}
          onConfirm={handleConfirmOverwrite}
        />
      )}
    </>
  );
}
