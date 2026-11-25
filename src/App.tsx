import { useState, useCallback, useEffect } from 'react';
import './styles/theme.css';
import { useGameStore } from './game/store/useGameStore.ts';
import { unlock, startMenuMusic, fadeOutMenuMusic, fadeInMenuMusic } from './game/audio/soundEngine.ts';
import TitleScreen from './ui/TitleScreen.tsx';
import SiteSelector from './ui/SiteSelector.tsx';
import ArrivalCutscene from './ui/ArrivalCutscene.tsx';
import ShelterScreen from './ui/ShelterScreen.tsx';
import AudioToggle from './ui/AudioToggle.tsx';
import NoticeToasts from './ui/NoticeToasts.tsx';

type Screen = 'title' | 'site-select' | 'arrival' | 'shelter';

export default function App() {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const reduceMotion = useGameStore((s) => s.reduceMotion);
  const resetGame = useGameStore((s) => s.resetGame);

  const [screen, setScreen] = useState<Screen>('title');
  /* Arrival & shelter need a claimed site — fall back to the title otherwise */
  const activeScreen: Screen =
    (screen === 'arrival' || screen === 'shelter') && !chosenSite ? 'title' : screen;

  /* ── Sync reduceMotion preference to root document attribute ── */
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  /* ── Unlock audio on first user interaction ── */
  useEffect(() => {
    function handleFirstInteraction() {
      unlock();
      startMenuMusic();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    }
    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  /* ── Navigation ── */
  const goToSiteSelect = useCallback(() => {
    fadeInMenuMusic();
    setScreen('site-select');
  }, []);

  const goToArrival = useCallback(() => {
    setScreen('arrival');
  }, []);

  const goToShelter = useCallback(() => {
    fadeOutMenuMusic();
    setScreen('shelter');
  }, []);

  const goToTitle = useCallback(() => {
    fadeInMenuMusic();
    setScreen('title');
  }, []);

  const handleContinue = useCallback(() => {
    if (chosenSite) {
      fadeOutMenuMusic();
      setScreen('shelter');
    } else {
      fadeInMenuMusic();
      setScreen('site-select');
    }
  }, [chosenSite]);

  const handleResetConfirmed = useCallback(
    (clearMilestones: boolean) => {
      resetGame({ clearMilestones });
      goToTitle();
    },
    [resetGame, goToTitle],
  );

  let content: React.ReactNode;
  if (activeScreen === 'title') {
    content = <TitleScreen onStart={goToSiteSelect} onContinue={handleContinue} />;
  } else if (activeScreen === 'site-select') {
    content = <SiteSelector onBack={goToTitle} onChosen={goToArrival} />;
  } else if (activeScreen === 'arrival' && chosenSite) {
    content = (
      <ArrivalCutscene siteId={chosenSite} onComplete={goToShelter} />
    );
  } else {
    content = <ShelterScreen onBackToTitle={goToTitle} onResetConfirmed={handleResetConfirmed} />;
  }

  return (
    <>
      <AudioToggle />
      <NoticeToasts />
      {content}
    </>
  );
}