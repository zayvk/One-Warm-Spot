import { useState, useCallback, useEffect } from 'react';
import { SITES } from '../game/data/sites.ts';
import { BG_VALLEY, BG_SHELTERS, CUTSCENE_ASSETS, SCENE_STAGES, travelerSpriteSrc } from '../game/data/media.ts';
import type { MediaEntry } from '../game/data/media.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import type { SiteId, GameMode, TravelerGender, PlayerStats } from '../game/types/game.ts';
import { isSiteUnlocked } from '../game/engine/progression.ts';
import BackgroundStage from './BackgroundStage.tsx';
import ConfirmOverwriteModal from './ConfirmOverwriteModal.tsx';
import {
  playHover,
  playClick,
  playClaim,
  playLocked,
  startSiteAmbience,
} from '../game/audio/soundEngine.ts';

export interface SiteSelectorProps {
  onBack: () => void;
  onChosen: () => void;
}

/* ── Traveler sprite portrait ── */

function TravelerPortrait({ gender }: { gender: TravelerGender }) {
  return (
    <img
      src={travelerSpriteSrc(gender, 'idle')}
      alt=""
      aria-hidden="true"
      width={12}
      height={24}
      draggable={false}
      style={{
        width: '12px',
        height: '24px',
        objectFit: 'contain',
        objectPosition: 'center center',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}

/* ── Mode descriptions ── */

const MODE_INFO: Record<GameMode, { label: string; emoji: string; desc: string }> = {
  cozy: {
    label: 'Cozy',
    emoji: '☀️',
    desc: 'Cozy Mode — plentiful resources, gentle weather, build at your own pace.',
  },
  challenge: {
    label: 'Challenge',
    emoji: '⛰️',
    desc: 'Challenge Mode — leaner supplies, tougher trips and dust-squall mornings. Still zero permadeath.',
  },
};

/* ── Main component ── */

export default function SiteSelector({ onBack, onChosen }: SiteSelectorProps) {
  const chooseSite = useGameStore((s) => s.chooseSite);
  const chosenSite = useGameStore((s) => s.chosenSite);
  const day = useGameStore((s) => s.day);
  const selectedMode = useGameStore((s) => s.selectedMode);
  const setMode = useGameStore((s) => s.setMode);
  const travelerGender = useGameStore((s) => s.travelerGender);
  const setGender = useGameStore((s) => s.setGender);
  const resetGame = useGameStore((s) => s.resetGame);
  const getSaveSnapshot = useGameStore((s) => s.getSaveSnapshot);
  const stats = useGameStore((s) => s.stats);

  const [bgMedia, setBgMedia] = useState<MediaEntry>(BG_VALLEY);
  const [bgDimmed, setBgDimmed] = useState(false);
  const [pendingClaimId, setPendingClaimId] = useState<SiteId | null>(null);

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

  const commitClaim = useCallback(
    (siteId: SiteId) => {
      playClaim();
      startSiteAmbience(null);
      chooseSite(siteId);
      onChosen();
    },
    [chooseSite, onChosen],
  );

  const handleClaim = useCallback(
    (siteId: SiteId) => {
      if (chosenSite !== null) {
        playClick();
        startSiteAmbience(null);
        setPendingClaimId(siteId);
        return;
      }
      commitClaim(siteId);
    },
    [chosenSite, commitClaim],
  );

  const handleConfirmOverwrite = useCallback(() => {
    if (!pendingClaimId) return;
    const modeToKeep = selectedMode;
    const genderToKeep = travelerGender;
    const targetId = pendingClaimId;
    resetGame();
    setMode(modeToKeep);
    setGender(genderToKeep);
    setPendingClaimId(null);
    commitClaim(targetId);
  }, [pendingClaimId, selectedMode, travelerGender, resetGame, setMode, setGender, commitClaim]);

  const handleLockedClick = useCallback(() => {
    playLocked();
  }, []);

  const handleBack = useCallback(() => {
    playClick();
    startSiteAmbience(null);
    onBack();
  }, [onBack]);

  const handleModeSwitch = useCallback(
    (m: GameMode) => {
      playClick();
      setMode(m);
    },
    [setMode],
  );

  const handleGenderSwitch = useCallback(
    (g: TravelerGender) => {
      playClick();
      setGender(g);
    },
    [setGender],
  );

  const modeSites = SITES.filter((s) => s.mode === selectedMode);
  const unlockedSites = modeSites.filter((s) => isSiteUnlocked(s, stats));
  const lockedSites = modeSites.filter((s) => !isSiteUnlocked(s, stats));
  const modeInfo = MODE_INFO[selectedMode];
  const existingSiteName = SITES.find((s) => s.id === chosenSite)?.name ?? 'your shelter';

  /* Warm-decode arrival lift & stage art so "Restore this shelter" opens with zero dark flash */
  useEffect(() => {
    for (const src of [
      CUTSCENE_ASSETS.terraceLobby,
      CUTSCENE_ASSETS.terraceLiftFrame,
      CUTSCENE_ASSETS.terraceLiftDoor,
      SCENE_STAGES.terrace,
    ]) {
      if (!src) continue;
      const img = new Image();
      img.src = src;
    }
  }, []);

  return (
    <>
      <BackgroundStage media={bgMedia} dimmed={bgDimmed} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          padding:
            'max(var(--sp-md), env(safe-area-inset-top, 0px)) max(var(--sp-lg), env(safe-area-inset-right, 0px)) var(--sp-lg) max(var(--sp-lg), env(safe-area-inset-left, 0px))',
          overflowY: 'auto',
        }}
      >
        {/* Compact single-row header bar */}
        <header className="ows-site-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleBack}
              onMouseEnter={playHover}
              onFocus={playHover}
              className="ows-pill"
            >
              ← Back
            </button>
            <h2
              style={{
                fontFamily: 'var(--font-game-title)',
                fontSize: 'clamp(1.15rem, 2.4vw, calc(1.65rem * var(--ui-text-scale)))',
                color: '#fff',
                textShadow: '0 2px 12px rgba(48, 38, 30, 0.5)',
                lineHeight: 1.2,
              }}
            >
              Choose Your Shelter
            </h2>
          </div>

          {/* Compact Mode Tabs + Traveler Picker */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              flexWrap: 'wrap',
            }}
          >
            {/* Cozy / Challenge Mode Tabs */}
            <div
              role="tablist"
              aria-label="Game difficulty mode"
              style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
            >
              {(['cozy', 'challenge'] as GameMode[]).map((m) => {
                const active = selectedMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleModeSwitch(m)}
                    onMouseEnter={playHover}
                    className={`ows-pill ${active ? 'ows-pill--active' : ''}`}
                  >
                    <span>{MODE_INFO[m].emoji}</span>
                    <span>{MODE_INFO[m].label}</span>
                  </button>
                );
              })}
            </div>

            {/* Male / Female Traveler Picker */}
            <div
              role="group"
              aria-label="Traveler silhouette"
              style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
            >
              {(['female', 'male'] as TravelerGender[]).map((g) => {
                const active = travelerGender === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleGenderSwitch(g)}
                    onMouseEnter={playHover}
                    className={`ows-pill ${active ? 'ows-pill--active' : ''}`}
                  >
                    <TravelerPortrait gender={g} />
                    <span>{g === 'female' ? 'Female' : 'Male'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {/* Single compact mode flavor & worldbuilding cue */}
        <p
          style={{
            color: 'rgba(255, 252, 246, 0.92)',
            fontSize: 'calc(0.86rem * var(--ui-text-scale))',
            textShadow: '0 1px 6px rgba(48, 38, 30, 0.55)',
            marginBottom: 'calc(12px * var(--ui-text-scale))',
            textAlign: 'center',
            maxWidth: 'calc(720px * var(--ui-text-scale))',
          }}
        >
          {modeInfo.desc} Every spot holds weathered traces left by an earlier traveler.
        </p>

        {/* Unlocked cards */}
        {unlockedSites.length > 0 && (
          <div className="ows-site-grid" style={{ marginBottom: '14px' }}>
            {unlockedSites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onHover={() => handleHover(site.id, true)}
                onLeave={handleLeave}
                onClaim={() => handleClaim(site.id)}
              />
            ))}
          </div>
        )}

        {/* Locked cards */}
        {lockedSites.length > 0 && (
          <>
            <p
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 600,
                color: 'rgba(255, 252, 246, 0.84)',
                textShadow: '0 1px 6px rgba(48, 38, 30, 0.5)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Locked — coming soon, or earned through milestones
            </p>
            <div className="ows-site-grid">
              {lockedSites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  locked
                  stats={stats}
                  onHover={() => handleHover(site.id, false)}
                  onLeave={handleLeave}
                  onLockedClick={handleLockedClick}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {pendingClaimId && (
        <ConfirmOverwriteModal
          siteName={existingSiteName}
          day={day}
          saveState={getSaveSnapshot()}
          onCancel={() => setPendingClaimId(null)}
          onConfirm={handleConfirmOverwrite}
        />
      )}
    </>
  );
}

/* ───── Individual Site Card ───── */

interface SiteCardProps {
  site: (typeof SITES)[number];
  locked?: boolean;
  stats?: PlayerStats;
  onHover: () => void;
  onLeave: () => void;
  onClaim?: () => void;
  onLockedClick?: () => void;
}

function SiteCard({ site, locked, stats, onHover, onLeave, onClaim, onLockedClick }: SiteCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const bgImage = BG_SHELTERS[site.id];
  const colorHex = `#${site.silhouetteColor.toString(16).padStart(6, '0')}`;
  const req = site.unlockRequirement;
  const progress = req && stats ? `${Math.min(stats[req.stat], req.count)}/${req.count}` : null;

  return (
    <article
      className={`frosted-card ows-site-card ${
        locked ? 'ows-site-card--locked' : 'ows-site-card--unlocked'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={locked ? onLockedClick : undefined}
      tabIndex={0}
      style={{ cursor: locked ? 'not-allowed' : 'default' }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          height: 'calc(84px * var(--ui-text-scale))',
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          position: 'relative',
          background: colorHex,
        }}
      >
        {!imgFailed ? (
          <img
            src={bgImage.src}
            alt=""
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: locked ? 'saturate(0.35) brightness(0.78)' : 'none',
              transition: 'filter 300ms ease',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: bgImage.fallbackGradient,
              filter: locked ? 'saturate(0.4) brightness(0.8)' : 'none',
              transition: 'filter 300ms ease',
            }}
          />
        )}
      </div>

      {/* Site Heading & Tagline */}
      <div>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'calc(1.02rem * var(--ui-text-scale))',
            color: 'var(--charcoal)',
            lineHeight: 1.25,
          }}
        >
          {site.name}
        </h3>
        <p
          style={{
            fontSize: 'calc(0.8rem * var(--ui-text-scale))',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            marginTop: '2px',
          }}
        >
          {site.tagline}
        </p>
      </div>

      {/* Description */}
      <p style={{ fontSize: 'calc(0.8rem * var(--ui-text-scale))', color: 'var(--charcoal)', lineHeight: 1.48 }}>
        {site.description}
      </p>

      {/* Left-behind traces */}
      {!locked && site.leftBehind && (
        <p
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-secondary)',
            borderTop: '1px solid var(--border)',
            paddingTop: '6px',
            lineHeight: 1.45,
          }}
        >
          🧰 Found here: {site.leftBehind}
        </p>
      )}

      {/* Bottom footer pinned with margin-top: auto so all row buttons align horizontally */}
      <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
        {!locked && onClaim ? (
          <button
            type="button"
            onClick={onClaim}
            onMouseEnter={playHover}
            className="ows-btn-primary"
            style={{
              width: '100%',
              padding: '8px var(--space-md)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: 'calc(0.88rem * var(--ui-text-scale))',
            }}
          >
            Restore this shelter
          </button>
        ) : (
          <div
            style={{
              fontSize: 'calc(0.78rem * var(--ui-text-scale))',
              fontWeight: 500,
              color: 'var(--locked)',
              textAlign: 'center',
              padding: '7px var(--space-sm)',
              background: 'rgba(176, 168, 158, 0.16)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(176, 168, 158, 0.35)',
            }}
          >
            🔒 {site.unlockHint}
            {progress && (
              <span style={{ marginLeft: '6px', fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>
                ({progress})
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
