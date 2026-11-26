import { useRef, useState, type ChangeEvent } from 'react';
import BackgroundStage from './BackgroundStage.tsx';
import AboutModal from './AboutModal.tsx';
import ConfirmOverwriteModal from './ConfirmOverwriteModal.tsx';
import { BG_TITLE, UI_ASSETS } from '../game/data/media.ts';
import { SITES } from '../game/data/sites.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { playHover, playClick, playClaim, playLocked } from '../game/audio/soundEngine.ts';
import { restoreBackupFile } from './backupImport.ts';

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

  const backupInputRef = useRef<HTMLInputElement>(null);
  const pushNotice = useGameStore((s) => s.pushNotice);

  const handleLoadBackupClick = () => {
    playClick();
    backupInputRef.current?.click();
  };

  /* Restored runs show up right away as "Continue" */
  const handleBackupFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await restoreBackupFile(file);
    if (result.ok) {
      playClaim();
      pushNotice({ icon: '📦', title: 'Backup restored', body: result.message, tone: 'unlock' });
    } else {
      playLocked();
      pushNotice({ icon: '⚠️', title: "That backup couldn't be loaded", body: result.message, tone: 'build' });
    }
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
          {/* Game title: painted wordmark, with a hidden heading for screen readers */}
          <h1 className="ows-sr-only">One Warm Spot</h1>
          <img
            src={UI_ASSETS.logoTitle}
            alt="One Warm Spot"
            draggable={false}
            className="ows-title-logo"
          />

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
              maxWidth: '260px',
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

            <div style={{ display: 'flex', gap: 'var(--space-sm)', width: '100%' }}>
              <button
                type="button"
                onClick={handleAboutOpen}
                onMouseEnter={playHover}
                onFocus={playHover}
                className="ows-btn-glass"
                style={{
                  flex: 1,
                  padding: '9px var(--space-sm)',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                About
              </button>
              <button
                type="button"
                onClick={handleLoadBackupClick}
                onMouseEnter={playHover}
                onFocus={playHover}
                className="ows-btn-glass"
                title="Resume from a .json backup"
                style={{
                  flex: 1,
                  padding: '9px var(--space-sm)',
                  fontSize: '0.9rem',
                  borderRadius: 'var(--radius-md)',
                  whiteSpace: 'nowrap',
                }}
              >
                Load Backup
              </button>
            </div>
            <input
              ref={backupInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void handleBackupFile(e);
              }}
              style={{ display: 'none' }}
              aria-hidden="true"
              tabIndex={-1}
            />
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
