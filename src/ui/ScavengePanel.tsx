import { useEffect, useState } from 'react';
import { SCAVENGE_ZONES, SCAVENGE_ZONE_MAP } from '../game/data/scavengeZones.ts';
import { MODE_RULES, WEATHER_INFO } from '../game/data/modes.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { UPGRADE_MAP } from '../game/data/upgrades.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { computeCozyIndex } from '../game/engine/progression.ts';
import { cozyBonus, getScavengeBlock, type ScavengeResult } from '../game/engine/scavenge.ts';
import { playClick, playHover, playLocked, playScavengeReturn } from '../game/audio/soundEngine.ts';
import type { ResourceId, ScavengeZone } from '../game/types/game.ts';

export interface ScavengePanelProps {
  onClose: () => void;
}

/** Expected per-trip range for a zone material under the current mode */
function yieldRange(y: ScavengeZone['yields'][number], k: number): string | null {
  const lo = y.primary ? Math.max(1, Math.floor(y.min * k)) : Math.floor(y.min * k);
  const hi = Math.max(lo, Math.floor(y.max * k));
  if (hi === 0) return null;
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

/** Right slide-out for daytime scavenging trips to the 4 nearby valley spots */
export default function ScavengePanel({ onClose }: ScavengePanelProps) {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const weather = useGameStore((s) => s.weather);
  const energy = useGameStore((s) => s.energy);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const mode = useGameStore((s) => s.selectedMode);
  const goScavenging = useGameStore((s) => s.goScavenging);

  const [lastTrip, setLastTrip] = useState<ScavengeResult | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rules = MODE_RULES[mode];
  const block = getScavengeBlock(timeOfDay, weather, built, energy, mode);
  const bonus = cozyBonus(computeCozyIndex(built));

  const handleGo = (zone: ScavengeZone) => {
    const attempt = goScavenging(zone.id);
    if (attempt.ok) {
      playScavengeReturn();
      setLastTrip(attempt.result);
    } else {
      playLocked();
    }
  };

  return (
    <aside className="ows-drawer ows-drawer--right" aria-label="Scavenge the valley">
      <div className="ows-drawer-header">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
            🧭 Scavenge the Valley
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Each trip costs ⚡{rules.scavengeEnergy} and one part of the day, and always brings
            home at least {rules.minTripTotal} materials · {rules.emoji} {rules.label} rules
            {bonus > 0 && ` · +${bonus} cozy bonus`}
          </p>
        </div>
        <button
          type="button"
          className="ows-close-btn"
          aria-label="Close scavenging"
          onClick={() => {
            playClick();
            onClose();
          }}
        >
          ✕
        </button>
      </div>

      <div className="ows-drawer-body">
        {lastTrip && <ExpeditionResult trip={lastTrip} onDismiss={() => setLastTrip(null)} />}

        {block && (
          <p className="ows-calm-note" role="status">
            {block === 'dark' && '🌙 The valley grows dim—rest by the lantern until morning.'}
            {block === 'storm' && (
              <>
                {WEATHER_INFO.storm.emoji} A dust squall is sweeping the valley this morning.
                Scavenging reopens in the afternoon — a cozy excuse to craft or rest indoors.
                <span style={{ display: 'block', marginTop: '4px', fontSize: '0.76rem' }}>
                  Tip: “{UPGRADE_MAP['shell-2'].name}” lets you brave stormy mornings.
                </span>
              </>
            )}
            {block === 'tired' &&
              `😴 Too tired for a trip — rest a while first (each trip needs ⚡${rules.scavengeEnergy}).`}
          </p>
        )}

        {SCAVENGE_ZONES.map((zone) => (
          <article
            key={zone.id}
            className={`ows-upgrade-card ${block ? '' : 'ows-upgrade-card--available'}`}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span aria-hidden="true" style={{ fontSize: '1.4rem', lineHeight: 1.2 }}>
                {zone.emoji}
              </span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.98rem' }}>
                  {zone.name}
                </strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {zone.blurb}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {zone.yields.map((y) => {
                const range = yieldRange(y, rules.yieldMultiplier);
                if (!range) return null;
                const res = RESOURCE_MAP[y.resource];
                return (
                  <span
                    key={y.resource}
                    className="ows-cost-chip"
                    title={`${res.name}${y.primary ? '' : ' (sometimes)'}`}
                    style={y.primary ? undefined : { opacity: 0.75 }}
                  >
                    {res.emoji} {range}
                  </span>
                );
              })}
            </div>

            <button
              type="button"
              className={block ? 'ows-btn-surface' : 'ows-btn-primary'}
              disabled={block !== null}
              onClick={() => handleGo(zone)}
              onMouseEnter={block ? undefined : playHover}
              style={{ fontSize: '0.84rem', fontWeight: 600, padding: '7px 12px' }}
            >
              🥾 Go Scavenging
            </button>
          </article>
        ))}
      </div>
    </aside>
  );
}

function ExpeditionResult({ trip, onDismiss }: { trip: ScavengeResult; onDismiss: () => void }) {
  const zone = SCAVENGE_ZONE_MAP[trip.zoneId];
  return (
    <section className="ows-expedition-card" aria-live="polite" aria-label="Expedition result">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <div className="ows-eyebrow">Expedition Result</div>
          <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            🎒 Back from {zone.name}
          </strong>
        </div>
        <button type="button" className="ows-close-btn" aria-label="Dismiss result" onClick={onDismiss}>
          ✕
        </button>
      </div>

      <p style={{ fontSize: '0.84rem', fontStyle: 'italic', lineHeight: 1.5, color: 'var(--charcoal)' }}>
        “{trip.story}”
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {(Object.entries(trip.gathered) as [ResourceId, number][]).map(([rid, amount]) => (
          <span
            key={rid}
            className="ows-cost-chip"
            style={{ background: 'var(--sage-100)', borderColor: 'var(--sage-200)', color: 'var(--sage-600)', fontWeight: 600 }}
          >
            +{amount} {RESOURCE_MAP[rid].emoji}
          </span>
        ))}
      </div>

      {trip.bonus > 0 && (
        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          🔥 Includes +{trip.bonus} found thanks to your cozy shelter (Cozy Index bonus).
        </p>
      )}

      {trip.relic && (
        <p className="ows-relic-find">
          <span aria-hidden="true" style={{ fontSize: '1.2rem' }}>
            {trip.relic.emoji}
          </span>
          <span>
            Found a Valley Relic: <strong>{trip.relic.name}</strong> — tucked into your Field
            Journal.
          </span>
        </p>
      )}
    </section>
  );
}
