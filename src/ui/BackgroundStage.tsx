import { useState, useEffect, useCallback } from 'react';
import type { MediaEntry } from '../game/data/media.ts';
import { ALL_BG_URLS } from '../game/data/media.ts';

/* ───── Image preloader (runs once on first mount) ───── */

let preloaded = false;

function preloadAllBackgrounds() {
  if (preloaded) return;
  preloaded = true;
  for (const url of ALL_BG_URLS) {
    const img = new Image();
    img.src = url;
  }
}

/* ───── Helpers ───── */

function isVideo(src: string): boolean {
  return /\.(webm|mp4)$/i.test(src);
}

/* ───── Component ───── */

export interface BackgroundStageProps {
  media: MediaEntry;
  dimmed?: boolean;
}

/**
 * Full-viewport background renderer with smooth 400ms crossfade.
 * Renders images or muted looping video, with cozy gradient fallback.
 */
export default function BackgroundStage({ media, dimmed = false }: BackgroundStageProps) {
  /* Preload all background images on first mount */
  useEffect(preloadAllBackgrounds, []);

  /* Track previous + current layers for crossfade */
  const [layers, setLayers] = useState<{ prev: MediaEntry | null; current: MediaEntry }>({
    prev: null,
    current: media,
  });

  /* A new background: mount it on top, keep the old one underneath while it fades in */
  if (media.src !== layers.current.src) {
    setLayers({ prev: layers.current, current: media });
  }

  /* After the CSS transition completes, drop the old layer */
  useEffect(() => {
    if (!layers.prev) return;
    const timer = setTimeout(() => {
      setLayers((l) => ({ prev: null, current: l.current }));
    }, 420); // slightly longer than the 400ms transition
    return () => clearTimeout(timer);
  }, [layers.prev]);

  const dimFilter = dimmed
    ? 'brightness(0.55) saturate(0.45)'
    : 'brightness(1) saturate(1)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: media.fallbackGradient,
      }}
    >
      {/* Previous layer (fading out) */}
      {layers.prev && (
        <BgLayer
          key={`prev-${layers.prev.src}`}
          entry={layers.prev}
          opacity={0}
          filter={dimFilter}
        />
      )}

      {/* Current layer (fading in) */}
      <BgLayer
        key={`cur-${layers.current.src}`}
        entry={layers.current}
        opacity={1}
        filter={dimFilter}
      />

      {/* Warm readability scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: dimmed
            ? 'linear-gradient(180deg, rgba(61,56,50,0.45) 0%, rgba(61,56,50,0.35) 100%)'
            : 'linear-gradient(180deg, rgba(61,56,50,0.28) 0%, rgba(245,235,224,0.18) 60%, rgba(61,56,50,0.22) 100%)',
          transition: `background var(--fade-speed) ease`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/* ───── Single background layer ───── */

interface BgLayerProps {
  entry: MediaEntry;
  opacity: number;
  filter: string;
}

function BgLayer({ entry, opacity, filter }: BgLayerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const handleError = useCallback(() => setImgFailed(true), []);

  const sharedStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity,
    filter,
    transition: `opacity var(--fade-speed) ease, filter var(--fade-speed) ease`,
  };

  /* Fallback gradient if image fails or hasn't loaded */
  if (imgFailed) {
    return (
      <div
        style={{
          ...sharedStyle,
          objectFit: undefined,
          background: entry.fallbackGradient,
        }}
      />
    );
  }

  if (isVideo(entry.src)) {
    return (
      <video
        src={entry.src}
        playsInline
        muted
        loop
        autoPlay
        style={sharedStyle}
        onError={handleError}
      />
    );
  }

  return (
    <img
      src={entry.src}
      alt=""
      style={sharedStyle}
      onError={handleError}
      draggable={false}
    />
  );
}
