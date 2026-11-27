import { useState, useCallback, useEffect, useRef } from 'react';
import './styles/theme.css';
import { useGameStore } from './game/store/useGameStore.ts';
import { unlock, startMenuMusic, fadeOutMenuMusic, fadeInMenuMusic } from './game/audio/soundEngine.ts';
import TitleScreen from './ui/TitleScreen.tsx';
import SiteSelector from './ui/SiteSelector.tsx';
import ArrivalCutscene from './ui/ArrivalCutscene.tsx';
import ShelterScreen from './ui/ShelterScreen.tsx';
import BuildingFloorScreen from './ui/BuildingFloorScreen.tsx';
import LiftRideScreen from './ui/LiftRideScreen.tsx';
import AudioToggle from './ui/AudioToggle.tsx';
import NoticeToasts from './ui/NoticeToasts.tsx';
import type { BuildingFloorId, DownstairsFloorId } from './game/data/floors.ts';
import { locationForScreen, readResumeLocation, writeResumeLocation } from './game/engine/resumeLocation.ts';

/** `shelter` is the rooftop (lift stop R); `floor` is one of the apartment floors 1–4 */
type Screen = 'title' | 'site-select' | 'arrival' | 'shelter' | 'ride' | 'floor';

export default function App() {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const reduceMotion = useGameStore((s) => s.reduceMotion);

  /* A refresh lands back where the player was (this tab only — a new visit starts at the Title) */
  const [resumed] = useState(() => readResumeLocation(useGameStore.getState().chosenSite));
  const [screen, setScreen] = useState<Screen>(resumed.screen);
  /* Where the traveler is in the building, and the lift ride in progress */
  const [floor, setFloor] = useState<DownstairsFloorId>(resumed.screen === 'floor' ? resumed.floor : 1);
  const [ride, setRide] = useState<{ from: BuildingFloorId; to: BuildingFloorId }>({ from: 'R', to: 1 });
  /* Everything past site selection needs a claimed site — fall back to the title otherwise */
  const activeScreen: Screen =
    (screen === 'arrival' || screen === 'shelter' || screen === 'ride' || screen === 'floor') && !chosenSite
      ? 'title'
      : screen;

  useEffect(() => {
    writeResumeLocation(locationForScreen(activeScreen, floor, ride.to));
  }, [activeScreen, floor, ride.to]);

  /* The menu music only belongs to the Title & shelter selector (a refresh may resume in-game) */
  const onMenuScreenRef = useRef(activeScreen === 'title' || activeScreen === 'site-select');
  useEffect(() => {
    onMenuScreenRef.current = activeScreen === 'title' || activeScreen === 'site-select';
  }, [activeScreen]);

  /* ── Sync reduceMotion preference to root document attribute ── */
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);

  /* ── Unlock audio on first user interaction ── */
  useEffect(() => {
    function handleFirstInteraction() {
      unlock();
      if (onMenuScreenRef.current) startMenuMusic();
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

  /* Ride the old lift from wherever the traveler is (the rooftop day clock rests while away) */
  const rideFrom = useCallback((from: BuildingFloorId, to: BuildingFloorId) => {
    if (from === to) return;
    setRide({ from, to });
    setScreen('ride');
  }, []);

  const arriveFromRide = useCallback(() => {
    if (ride.to === 'R') {
      setScreen('shelter');
    } else {
      setFloor(ride.to);
      setScreen('floor');
    }
  }, [ride.to]);

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
  } else if (activeScreen === 'ride') {
    content = (
      <LiftRideScreen
        key={`${ride.from}-${ride.to}`}
        fromFloor={ride.from}
        toFloor={ride.to}
        onArrive={arriveFromRide}
      />
    );
  } else if (activeScreen === 'floor') {
    content = <BuildingFloorScreen key={floor} floor={floor} onRide={(to) => rideFrom(floor, to)} />;
  } else {
    content = <ShelterScreen onBackToTitle={goToTitle} onRide={(to) => rideFrom('R', to)} />;
  }

  return (
    <>
      <AudioToggle />
      <NoticeToasts />
      {content}
    </>
  );
}