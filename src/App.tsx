import { useState, useCallback, useEffect } from 'react';
import './styles/theme.css';
import { useGameStore } from './game/store/useGameStore.ts';
import { unlock, startMenuMusic, fadeOutMenuMusic, fadeInMenuMusic } from './game/audio/soundEngine.ts';
import TitleScreen from './ui/TitleScreen.tsx';
import SiteSelector from './ui/SiteSelector.tsx';
import ArrivalCutscene from './ui/ArrivalCutscene.tsx';
import ShelterScreen from './ui/ShelterScreen.tsx';
import TerraceLobbyScreen from './ui/TerraceLobbyScreen.tsx';
import AudioToggle from './ui/AudioToggle.tsx';
import NoticeToasts from './ui/NoticeToasts.tsx';

type Screen = 'title' | 'site-select' | 'arrival' | 'shelter' | 'lobby';

export default function App() {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const reduceMotion = useGameStore((s) => s.reduceMotion);

  const [screen, setScreen] = useState<Screen>('title');
  /* Arrival, shelter & lobby need a claimed site — fall back to the title otherwise */
  const activeScreen: Screen =
    (screen === 'arrival' || screen === 'shelter' || screen === 'lobby') && !chosenSite ? 'title' : screen;

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

  /* Rooftop stairwell door → ride the lift down to the lobby (the day clock rests meanwhile) */
  const goToLobby = useCallback(() => {
    setScreen('lobby');
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

  let content: React.ReactNode;
  if (activeScreen === 'title') {
    content = <TitleScreen onStart={goToSiteSelect} onContinue={handleContinue} />;
  } else if (activeScreen === 'site-select') {
    content = <SiteSelector onBack={goToTitle} onChosen={goToArrival} />;
  } else if (activeScreen === 'arrival' && chosenSite) {
    content = (
      <ArrivalCutscene siteId={chosenSite} onComplete={goToShelter} />
    );
  } else if (activeScreen === 'lobby') {
    /* Riding back up replays the Terrace arrival (lobby → lift → rooftop) */
    content = <TerraceLobbyScreen onReturnToRooftop={goToArrival} />;
  } else {
    content = <ShelterScreen onBackToTitle={goToTitle} onDescend={goToLobby} />;
  }

  return (
    <>
      <AudioToggle />
      <NoticeToasts />
      {content}
    </>
  );
}