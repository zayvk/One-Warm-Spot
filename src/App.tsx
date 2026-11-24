import { useState, useCallback } from 'react';
import './styles/theme.css';
import { useGameStore } from './game/store/useGameStore.ts';
import TitleScreen from './ui/TitleScreen.tsx';
import SiteSelector from './ui/SiteSelector.tsx';
import TopBar from './ui/TopBar.tsx';
import ShelterCanvas from './game/renderer/ShelterCanvas.tsx';

type Screen = 'title' | 'site-select' | 'shelter';

export default function App() {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const tarpPitched = useGameStore((s) => s.tarpPitched);
  const pitchTarp = useGameStore((s) => s.pitchTarp);
  const resources = useGameStore((s) => s.resources);

  const [screen, setScreen] = useState<Screen>('title');

  /* Navigation callbacks */
  const goToSiteSelect = useCallback(() => setScreen('site-select'), []);
  const goToShelter = useCallback(() => setScreen('shelter'), []);
  const goToTitle = useCallback(() => setScreen('title'), []);

  const handleContinue = useCallback(() => {
    if (chosenSite) setScreen('shelter');
    else setScreen('site-select');
  }, [chosenSite]);

  /* ── Title Screen ── */
  if (screen === 'title') {
    return (
      <TitleScreen
        onStart={goToSiteSelect}
        onContinue={handleContinue}
      />
    );
  }

  /* ── Shelter Selection ── */
  if (screen === 'site-select') {
    return (
      <SiteSelector
        onBack={goToTitle}
        onChosen={goToShelter}
      />
    );
  }

  /* ── Main Shelter View ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-md)',
          padding: 'var(--space-lg)',
          background: 'linear-gradient(180deg, var(--sky-100) 0%, var(--warm-white) 100%)',
          overflow: 'auto',
        }}
      >
        <ShelterCanvas />

        {/* Action area */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-md)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {!tarpPitched && (
            <button
              onClick={pitchTarp}
              disabled={resources.cloth < 1}
              style={{
                background: resources.cloth >= 1 ? 'var(--terra-400)' : 'var(--warm-gray)',
                color: '#fff',
                padding: 'var(--space-sm) var(--space-lg)',
                fontSize: '1rem',
              }}
            >
              ⛺ Pitch Canvas Tarp (1 🧵)
            </button>
          )}

          {tarpPitched && (
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
              ⛺ Tarp pitched — your first upgrade!
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
