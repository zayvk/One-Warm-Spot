import { useState, useCallback } from 'react';
import { SITES } from '../game/data/sites.ts';
import { BG_VALLEY, BG_SHELTERS } from '../game/data/media.ts';
import type { MediaEntry } from '../game/data/media.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import type { SiteId } from '../game/types/game.ts';
import BackgroundStage from './BackgroundStage.tsx';
import { playHover, playClick, playClaim, playLocked, startSiteAmbience } from '../game/audio/soundEngine.ts';

export interface SiteSelectorProps {
  onBack: () => void;
  onChosen: () => void;
}

export default function SiteSelector({ onBack, onChosen }: SiteSelectorProps) {
  const chooseSite = useGameStore((s) => s.chooseSite);

  /* Background state: default valley, switches on hover */
  const [bgMedia, setBgMedia] = useState<MediaEntry>(BG_VALLEY);
  const [bgDimmed, setBgDimmed] = useState(false);

  const handleHover = useCallback((siteId: SiteId, unlocked: boolean) => {
    setBgMedia(BG_SHELTERS[siteId]);
    setBgDimmed(!unlocked);
    playHover();
    startSiteAmbience(siteId, !unlocked);
  }, []);

  const handleLeave = useCallback(() => {
    setBgMedia(BG_VALLEY);
    setBgDimmed(false);
    startSiteAmbience(null);
  }, []);

  const handleClaim = useCallback(
    (siteId: SiteId) => {
      playClaim();
      startSiteAmbience(null);
      chooseSite(siteId);
      onChosen();
    },
    [chooseSite, onChosen],
  );

  const handleLockedClick = useCallback(() => {
    playLocked();
  }, []);

  const handleBack = useCallback(() => {
    playClick();
    startSiteAmbience(null);
    onBack();
  }, [onBack]);

  /* Split sites into unlocked / locked */
  const unlocked = SITES.filter((s) => s.unlocked);
  const locked = SITES.filter((s) => !s.unlocked);

  return (
    <>
      <BackgroundStage media={bgMedia} dimmed={bgDimmed} />

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          padding: 'var(--space-lg) var(--space-lg) var(--space-xl)',
          overflowY: 'auto',
        }}
      >
        {/* Top bar: Back button + heading */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            maxWidth: '960px',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <button
            onClick={handleBack}
            onMouseEnter={playHover}
            onFocus={playHover}
            style={{
              background: 'rgba(255,252,246,0.3)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: '#fff',
              border: '1.5px solid rgba(255,255,255,0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-xs) var(--space-md)',
              fontSize: '0.9rem',
              marginRight: 'var(--space-md)',
            }}
          >
            ← Back
          </button>

          <h2
            style={{
              fontFamily: 'var(--font-game-title)',
              fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
              color: '#fff',
              textShadow: '0 2px 12px rgba(61,56,50,0.4)',
            }}
          >
            Choose Your Shelter
          </h2>
        </div>

        <p
          style={{
            color: 'rgba(255,255,255,0.8)',
            textShadow: '0 1px 6px rgba(61,56,50,0.3)',
            marginBottom: 'var(--space-lg)',
            textAlign: 'center',
            maxWidth: '500px',
            fontSize: '0.95rem',
          }}
        >
          Others passed through before you and left half-built camps behind. Pick one weathered spot to repair and make your own.
        </p>

        {/* Unlocked shelter cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-md)',
            width: '100%',
            maxWidth: '960px',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {unlocked.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onHover={() => handleHover(site.id, true)}
              onLeave={handleLeave}
              onClaim={() => handleClaim(site.id)}
            />
          ))}
        </div>

        {/* Locked shelter cards */}
        {locked.length > 0 && (
          <>
            <p
              style={{
                fontSize: '0.82rem',
                color: 'rgba(255,255,255,0.6)',
                textShadow: '0 1px 4px rgba(61,56,50,0.3)',
                marginBottom: 'var(--space-sm)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Locked — earn milestones to unlock
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 'var(--space-md)',
                width: '100%',
                maxWidth: '640px',
              }}
            >
              {locked.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  locked
                  onHover={() => handleHover(site.id, false)}
                  onLeave={handleLeave}
                  onLockedClick={handleLockedClick}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ───── Individual Site Card ───── */

interface SiteCardProps {
  site: (typeof SITES)[number];
  locked?: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClaim?: () => void;
  onLockedClick?: () => void;
}

function SiteCard({ site, locked, onHover, onLeave, onClaim, onLockedClick }: SiteCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const bgImage = BG_SHELTERS[site.id];

  const colorHex = `#${site.silhouetteColor.toString(16).padStart(6, '0')}`;

  return (
    <div
      className="frosted-card"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={locked ? onLockedClick : undefined}
      tabIndex={0}
      style={{
        padding: 'var(--space-md)',
        opacity: locked ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        transition: 'opacity 300ms ease, transform 200ms ease, box-shadow 200ms ease',
        cursor: locked ? 'default' : 'pointer',
      }}
      onMouseOver={(e) => {
        if (!locked) {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(61,56,50,0.18)';
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Preview banner — shelter image or color block */}
      <div
        style={{
          width: '100%',
          height: '90px',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          position: 'relative',
          background: colorHex,
        }}
      >
        {!imgFailed && (
          <img
            src={bgImage.src}
            alt=""
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: locked ? 'saturate(0.3) brightness(0.7)' : 'none',
              transition: 'filter 300ms ease',
            }}
          />
        )}
        {imgFailed && (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: bgImage.fallbackGradient,
              filter: locked ? 'saturate(0.4) brightness(0.75)' : 'none',
              transition: 'filter 300ms ease',
            }}
          />
        )}
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--charcoal)' }}>
        {site.name}
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        {site.tagline}
      </p>
      <p style={{ fontSize: '0.82rem', color: 'var(--charcoal)', flex: 1 }}>{site.description}</p>

      {/* "Found here" note for unlocked tiles */}
      {!locked && site.leftBehind && (
        <p style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          paddingTop: 'var(--space-xs)',
          marginTop: 'var(--space-xs)',
          lineHeight: 1.5,
        }}>
          🧰 Found here: {site.leftBehind}
        </p>
      )}

      {!locked && onClaim ? (
        <button
          onClick={onClaim}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            padding: 'var(--space-sm) var(--space-md)',
            alignSelf: 'stretch',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
          }}
        >
          Restore this shelter
        </button>
      ) : (
        <span
          style={{
            fontSize: '0.78rem',
            color: 'var(--locked)',
            textAlign: 'center',
            padding: 'var(--space-sm)',
          }}
        >
          🔒 {site.unlockHint}
        </span>
      )}
    </div>
  );
}
