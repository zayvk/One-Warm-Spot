import { useEffect } from 'react';
import { UPGRADES, UPGRADE_CATEGORIES, UPGRADE_MAP } from '../game/data/upgrades.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { computeCozyIndex, getUpgradeStatus, type UpgradeStatus } from '../game/engine/progression.ts';
import { playClaim, playClick, playHover, playLocked } from '../game/audio/soundEngine.ts';
import type { ResourceId, Upgrade } from '../game/types/game.ts';

export interface UpgradePanelProps {
  onClose: () => void;
}

const STATUS_LABEL: Record<UpgradeStatus, string> = {
  built: 'Built',
  available: 'Available',
  'need-materials': 'Need Materials',
  'too-tired': 'Too Tired',
  locked: 'Locked',
};

/** Slide-out panel wiring all 10 macro upgrades, grouped by category */
export default function UpgradePanel({ onClose }: UpgradePanelProps) {
  const resources = useGameStore((s) => s.resources);
  const built = useGameStore((s) => s.unlockedUpgrades);
  const energy = useGameStore((s) => s.energy);
  const buildUpgrade = useGameStore((s) => s.buildUpgrade);

  const cozy = computeCozyIndex(built);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBuild = (upgrade: Upgrade) => {
    const result = buildUpgrade(upgrade.id);
    if (result === 'built') playClaim();
    else playLocked();
  };

  return (
    <aside className="ows-drawer ows-drawer--right" aria-label="Shelter upgrades">
      <div className="ows-drawer-header">
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
            🔨 Shelter Upgrades
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            {built.length} of {UPGRADES.length} built · Cozy Index {cozy}/100
          </p>
          <div className="ows-meter" aria-hidden="true">
            <span style={{ width: `${cozy}%`, background: 'var(--terra-400)' }} />
          </div>
        </div>
        <button
          type="button"
          className="ows-close-btn"
          aria-label="Close upgrades"
          onClick={() => {
            playClick();
            onClose();
          }}
        >
          ✕
        </button>
      </div>

      <div className="ows-drawer-body">
        {UPGRADE_CATEGORIES.map((cat) => (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ marginTop: '4px' }}>
              <h3
                id={`cat-${cat.id}`}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--terra-600)',
                }}
              >
                {cat.emoji} {cat.label}
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{cat.blurb}</p>
            </div>

            {UPGRADES.filter((u) => u.category === cat.id).map((u) => {
              const status = getUpgradeStatus(u, built, resources, energy);
              return (
                <article key={u.id} className={`ows-upgrade-card ows-upgrade-card--${status}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span aria-hidden="true" style={{ fontSize: '1.3rem', lineHeight: 1.2 }}>
                      {u.emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>
                        {u.name}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Tier {u.tier}
                      </div>
                    </div>
                    <span className={`ows-status ows-status--${status}`}>{STATUS_LABEL[status]}</span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', lineHeight: 1.45 }}>
                    {u.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                    {(Object.entries(u.cost) as [ResourceId, number][]).map(([rid, amount]) => {
                      const short = status !== 'built' && (resources[rid] ?? 0) < amount;
                      const res = RESOURCE_MAP[rid];
                      return (
                        <span
                          key={rid}
                          className={`ows-cost-chip ${short ? 'ows-cost-chip--short' : ''}`}
                          title={`${res.name}: need ${amount}, have ${resources[rid] ?? 0}`}
                        >
                          {res.emoji} {amount}
                        </span>
                      );
                    })}
                    <span className="ows-cost-chip" title="Energy spent">⚡ {u.energy}</span>
                    <span
                      className="ows-cost-chip"
                      title="Cozy Index boost"
                      style={{ background: 'var(--sage-100)', borderColor: 'var(--sage-200)', color: 'var(--sage-600)' }}
                    >
                      +{u.cozy} Cozy
                    </span>
                  </div>

                  {status !== 'built' && (
                    <button
                      type="button"
                      className={status === 'available' ? 'ows-btn-primary' : 'ows-btn-surface'}
                      disabled={status !== 'available'}
                      onClick={() => handleBuild(u)}
                      onMouseEnter={status === 'available' ? playHover : undefined}
                      style={{ fontSize: '0.84rem', fontWeight: 600, padding: '7px 12px' }}
                    >
                      {status === 'available' && (u.tier === 1 ? '🔧 Repair' : '🔨 Build')}
                      {status === 'need-materials' && 'Gather more materials'}
                      {status === 'too-tired' && 'Too tired — rest first'}
                      {status === 'locked' && u.requires && `Needs “${UPGRADE_MAP[u.requires]?.name}”`}
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}
