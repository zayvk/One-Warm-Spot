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

      {/* Content layer in the upper-centre open sky (logo beside the buttons on short landscape phones) */}
      <div className="ows-title-screen">
        <div className="ows-title-stack">
          {/* Game title: painted wordmark, with a hidden heading for screen readers */}
          <h1 className="ows-sr-only">One Warm Spot</h1>
          <img
            src={UI_ASSETS.logoTitle}
            alt="One Warm Spot"
            draggable={false}
            className="ows-title-logo"
          />

          <div className="ows-title-copy">
            <p className="ows-title-tagline">The dust has settled. The sun returns. Find your shelter.</p>

            {/* Button group */}
            <div className="ows-title-actions">
              {hasSave ? (
                <>
                  <button
                    type="button"
                    onClick={handleContinue}
                    onMouseEnter={playHover}
                    onFocus={playHover}
                    className="ows-btn-primary ows-title-btn ows-title-btn--main"
                  >
                    ☀️ Continue
                  </button>
                  <button
                    type="button"
                    onClick={handleStart}
                    onMouseEnter={playHover}
                    onFocus={playHover}
                    className="ows-btn-glass ows-title-btn ows-title-btn--alt"
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
                  className="ows-btn-primary ows-title-btn ows-title-btn--main"
                >
                  ☀️ Start
                </button>
              )}

              <div className="ows-title-row">
                <button
                  type="button"
                  onClick={handleAboutOpen}
                  onMouseEnter={playHover}
                  onFocus={playHover}
                  className="ows-btn-glass ows-title-btn ows-title-btn--small"
                >
                  About
                </button>
                <button
                  type="button"
                  onClick={handleLoadBackupClick}
                  onMouseEnter={playHover}
                  onFocus={playHover}
                  className="ows-btn-glass ows-title-btn ows-title-btn--small"
                  title="Resume from a .json backup"
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
