import { useEffect, useRef, useState } from 'react';
import ShelterCanvas from '../game/renderer/ShelterCanvas.tsx';
import { useGameStore } from '../game/store/useGameStore.ts';
import { SITES } from '../game/data/sites.ts';
import { RESOURCES } from '../game/data/resources.ts';
import { playClick, playHover, startSiteAmbience } from '../game/audio/soundEngine.ts';
import type { ResourceId } from '../game/types/game.ts';

export interface ShelterScreenProps {
  onBackToTitle: () => void;
  onResetConfirmed: (clearMilestones: boolean) => void;
}

/** Soft loudness for the in-shelter ambience bed */
const SHELTER_AMBIENCE_LEVEL = 0.55;

const POUCH_IDS: ResourceId[] = ['timber', 'scrap', 'cloth', 'seeds'];

export default function ShelterScreen({ onBackToTitle }: ShelterScreenProps) {
  const chosenSite = useGameStore((s) => s.chosenSite);
  const resources = useGameStore((s) => s.resources);

  const prevResourcesRef = useRef(resources);
  const [pulsing, setPulsing] = useState<Partial<Record<ResourceId, boolean>>>({});

  /* Soft shelter soundscape while on this screen */
  useEffect(() => {
    startSiteAmbience(chosenSite, false, SHELTER_AMBIENCE_LEVEL);
    return () => startSiteAmbience(null);
  }, [chosenSite]);

  /* Pulse newly found pouch materials */
  useEffect(() => {
    const prev = prevResourcesRef.current;
    const newlyIncreased: ResourceId[] = [];
    for (const id of POUCH_IDS) {
      if (resources[id] > prev[id]) {
        newlyIncreased.push(id);
      }
    }
    prevResourcesRef.current = resources;
    if (newlyIncreased.length === 0) return;

    setPulsing((curr) => {
      const next = { ...curr };
      for (const id of newlyIncreased) next[id] = true;
      return next;
    });

    const timer = setTimeout(() => {
      setPulsing((curr) => {
        const next = { ...curr };
        for (const id of newlyIncreased) next[id] = false;
        return next;
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [resources]);

  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';
  const pouchResources = RESOURCES.filter((r) => POUCH_IDS.includes(r.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Minimal floating top bar */}
      <header
        style={{
          position: 'absolute',
          top: 'var(--space-sm)',
          left: 'var(--space-sm)',
          right: '108px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-sm)',
          flexWrap: 'wrap',
          pointerEvents: 'none',
        }}
      >
        {/* Back + Title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => {
              playClick();
              onBackToTitle();
            }}
            onMouseEnter={playHover}
            className="ows-pill"
            title="Return to the title screen (progress is saved)"
          >
            ← Title
          </button>
          <span
            style={{
              fontFamily: 'var(--font-game-title)',
              fontSize: 'clamp(0.95rem, 2vw, 1.25rem)',
              color: '#fff',
              textShadow: '0 2px 10px rgba(48, 38, 30, 0.65)',
              whiteSpace: 'nowrap',
            }}
          >
            {siteName}
          </span>
        </div>

        {/* Compact Found Materials Pouch */}
        <div
          className="ows-hud-bar"
          style={{ pointerEvents: 'auto', padding: '6px 14px', gap: '12px' }}
          title="Found Materials Pouch"
          aria-label="Found Materials Pouch"
        >
          {pouchResources.map((r) => (
            <span
              key={r.id}
              title={r.name}
              className={pulsing[r.id] ? 'ows-pouch-item--pulse' : undefined}
              style={{
                fontSize: '0.88rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{r.emoji}</span>
              <span>{resources[r.id]}</span>
            </span>
          ))}
        </div>
      </header>

      {/* Interactive PixiJS canvas (full viewport) */}
      <main style={{ position: 'relative', flex: 1, minHeight: 0, background: 'var(--sky-100)' }}>
        <ShelterCanvas />
      </main>
    </div>
  );
}
