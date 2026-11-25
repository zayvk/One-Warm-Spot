import { useCallback, useEffect, useState } from 'react';
import ShelterCanvas from '../game/renderer/ShelterCanvas.tsx';
import TopBar from './TopBar.tsx';
import UpgradePanel from './UpgradePanel.tsx';
import ScavengePanel from './ScavengePanel.tsx';
import SurvivalKitPanel from './SurvivalKitPanel.tsx';
import ConfirmResetModal from './ConfirmResetModal.tsx';
import { useGameStore } from '../game/store/useGameStore.ts';
import { UPGRADES } from '../game/data/upgrades.ts';
import { SITES } from '../game/data/sites.ts';
import {
  getUpgradeStatus,
  nextTimeOfDay,
  REST_ENERGY_GAIN,
  TIME_OF_DAY_INFO,
} from '../game/engine/progression.ts';
import { playClick, playHover, startSiteAmbience } from '../game/audio/soundEngine.ts';
import { getScavengeBlock } from '../game/engine/scavenge.ts';

export interface ShelterScreenProps {
  onBackToTitle: () => void;
  onResetConfirmed: (clearMilestones: boolean) => void;
}

/** Soft loudness for the in-shelter ambience bed */
const SHELTER_AMBIENCE_LEVEL = 0.55;

export default function ShelterScreen({ onBackToTitle, onResetConfirmed }: ShelterScreenProps) {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const day = useGameStore((s) => s.day);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const energy = useGameStore((s) => s.energy);
  const resources = useGameStore((s) => s.resources);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const lanternLit = useGameStore((s) => s.lanternLit);
  const weather = useGameStore((s) => s.weather);
  const selectedMode = useGameStore((s) => s.selectedMode);
  const advanceTime = useGameStore((s) => s.advanceTime);
  const lightLantern = useGameStore((s) => s.lightLantern);
  const getSaveSnapshot = useGameStore((s) => s.getSaveSnapshot);

  const [kitOpen, setKitOpen] = useState(false);
  /* Upgrades and Scavenge share the right-hand drawer slot */
  const [rightPanel, setRightPanel] = useState<'upgrades' | 'scavenge' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  /* Soft shelter soundscape while on this screen */
  useEffect(() => {
    startSiteAmbience(chosenSite, false, SHELTER_AMBIENCE_LEVEL);
    return () => startSiteAmbience(null);
  }, [chosenSite]);

  const closeKit = useCallback(() => setKitOpen(false), []);
  const closeRightPanel = useCallback(() => setRightPanel(null), []);
  const toggleRightPanel = (panel: 'upgrades' | 'scavenge') => {
    playClick();
    setRightPanel((open) => (open === panel ? null : panel));
  };

  const scavengeBlock = getScavengeBlock(timeOfDay, weather, built, energy, selectedMode);

  const availableCount = UPGRADES.filter(
    (u) => getUpgradeStatus(u, built, resources, energy) === 'available',
  ).length;
  const next = nextTimeOfDay(timeOfDay);
  const showLantern = !lanternLit && (timeOfDay === 'dusk' || timeOfDay === 'night');
  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar
        onBackToTitle={() => {
          playClick();
          onBackToTitle();
        }}
        onRequestReset={() => {
          playClick();
          setConfirmReset(true);
        }}
      />

      <main style={{ position: 'relative', flex: 1, minHeight: 0, background: 'var(--sky-100)' }}>
        <ShelterCanvas />

        {kitOpen && <SurvivalKitPanel onClose={closeKit} />}
        {rightPanel === 'upgrades' && <UpgradePanel onClose={closeRightPanel} />}
        {rightPanel === 'scavenge' && <ScavengePanel onClose={closeRightPanel} />}

        {/* Action bar */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'var(--space-md)',
            transform: 'translateX(-50%)',
            zIndex: 25,
            width: 'max-content',
            maxWidth: 'calc(100% - 32px)',
          }}
        >
          <div className="ows-hud-bar">
            <button
              type="button"
              className="ows-btn-surface ows-hud-btn"
              aria-pressed={kitOpen}
              onClick={() => {
                playClick();
                setKitOpen((o) => !o);
              }}
              onMouseEnter={playHover}
            >
              🎒 Survival Kit
            </button>

            <button
              type="button"
              className="ows-btn-surface ows-hud-btn"
              aria-pressed={rightPanel === 'scavenge'}
              onClick={() => toggleRightPanel('scavenge')}
              onMouseEnter={playHover}
              title={
                scavengeBlock === 'dark'
                  ? 'The valley is dim — scavenge again in the morning'
                  : scavengeBlock === 'storm'
                    ? 'A dust squall closes the valley this morning'
                    : 'Gather materials from nearby valley spots'
              }
            >
              🧭 Scavenge
              {!scavengeBlock && <span className="ows-ready-dot" aria-label="Ready to go" />}
            </button>

            <button
              type="button"
              className="ows-btn-surface ows-hud-btn"
              aria-pressed={rightPanel === 'upgrades'}
              onClick={() => toggleRightPanel('upgrades')}
              onMouseEnter={playHover}
            >
              🔨 Upgrades
              {availableCount > 0 && (
                <span className="ows-count-badge" aria-label={`${availableCount} available`}>
                  {availableCount}
                </span>
              )}
            </button>

            {showLantern && (
              <button
                type="button"
                className="ows-btn-terra ows-hud-btn"
                onClick={() => {
                  playClick();
                  lightLantern();
                }}
                onMouseEnter={playHover}
                title="Use the pocket stove to light the old lantern"
              >
                🏮 Light the lantern
              </button>
            )}

            <button
              type="button"
              className="ows-btn-primary ows-hud-btn"
              onClick={() => {
                playClick();
                advanceTime();
              }}
              onMouseEnter={playHover}
              title={
                next
                  ? `Rest until ${TIME_OF_DAY_INFO[next].label.toLowerCase()} (+${REST_ENERGY_GAIN} energy)`
                  : 'Sleep through the night — energy refills'
              }
            >
              {next
                ? `⏳ Rest until ${TIME_OF_DAY_INFO[next].label}`
                : `🌙 Sleep to Day ${day + 1}`}
            </button>
          </div>
        </div>
      </main>

      {confirmReset && (
        <ConfirmResetModal
          siteName={siteName}
          day={day}
          saveState={getSaveSnapshot()}
          onCancel={() => setConfirmReset(false)}
          onConfirm={(clearMilestones) => {
            setConfirmReset(false);
            onResetConfirmed(clearMilestones);
          }}
        />
      )}
    </div>
  );
}
