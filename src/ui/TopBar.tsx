import { useGameStore } from '../game/store/useGameStore.ts';
import { RESOURCES } from '../game/data/resources.ts';
import { SITES } from '../game/data/sites.ts';
import { computeCozyIndex, MAX_ENERGY, TIME_OF_DAY_INFO } from '../game/engine/progression.ts';
import { playHover } from '../game/audio/soundEngine.ts';
import { WEATHER_INFO } from '../game/data/modes.ts';

export interface TopBarProps {
  onBackToTitle: () => void;
  onRequestReset: () => void;
}

export default function TopBar({ onBackToTitle, onRequestReset }: TopBarProps) {
  const day = useGameStore((s) => s.day);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const energy = useGameStore((s) => s.energy);
  const chosenSite = useGameStore((s) => s.chosenSite);
  const resources = useGameStore((s) => s.resources);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const weather = useGameStore((s) => s.weather);

  const weatherInfo = WEATHER_INFO[weather];
  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? '—';
  const tod = TIME_OF_DAY_INFO[timeOfDay];
  const cozy = computeCozyIndex(built);
  const energyPct = Math.round((energy / MAX_ENERGY) * 100);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: 'var(--space-sm) var(--space-md)',
        paddingRight: '108px',
        minHeight: '56px',
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border)',
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 30,
      }}
    >
      {/* Day, time, weather & site */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          Day {day} · {tod.emoji} {tod.label}
        </strong>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            marginTop: '2px',
          }}
        >
          {siteName}
          <span className="ows-weather-chip" title={weatherInfo.hint}>
            {weatherInfo.emoji} {weatherInfo.label}
          </span>
        </span>
      </div>

      {/* Energy & Cozy Index */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div title={`Energy ${energy} / ${MAX_ENERGY}`} style={{ minWidth: '128px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '3px',
            }}
          >
            <span>⚡ Energy</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {energy}/{MAX_ENERGY}
            </span>
          </div>
          <div
            className="ows-meter"
            role="meter"
            aria-label="Energy"
            aria-valuemin={0}
            aria-valuemax={MAX_ENERGY}
            aria-valuenow={energy}
          >
            <span
              style={{
                width: `${energyPct}%`,
                background: energyPct > 30 ? 'var(--sage-400)' : 'var(--terra-400)',
              }}
            />
          </div>
        </div>

        <div title="Cozy Index — grows with every upgrade you build" style={{ minWidth: '112px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '3px',
            }}
          >
            <span>🔥 Cozy</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cozy}/100</span>
          </div>
          <div
            className="ows-meter"
            role="meter"
            aria-label="Cozy Index"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={cozy}
          >
            <span style={{ width: `${cozy}%`, background: 'var(--terra-400)' }} />
          </div>
        </div>
      </div>

      {/* Resources */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-md)',
          marginLeft: 'auto',
          flexWrap: 'wrap',
        }}
      >
        {RESOURCES.map((r) => (
          <span
            key={r.id}
            title={r.name}
            style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
          >
            {r.emoji} {resources[r.id]}
          </span>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
        <button
          type="button"
          onClick={onBackToTitle}
          onMouseEnter={playHover}
          className="ows-btn-surface"
          title="Return to the title screen (progress is saved)"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          ⌂ Title
        </button>
        <button
          type="button"
          onClick={onRequestReset}
          onMouseEnter={playHover}
          className="ows-btn-terra"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Reset Save
        </button>
      </div>
    </header>
  );
}
