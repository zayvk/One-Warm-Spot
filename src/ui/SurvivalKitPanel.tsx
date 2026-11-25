import { useEffect } from 'react';
import { SURVIVAL_KIT } from '../game/data/survivalKit.ts';
import { RELICS, RELIC_MAP } from '../game/data/relics.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import { playClick } from '../game/audio/soundEngine.ts';

export interface SurvivalKitPanelProps {
  onClose: () => void;
}

/** Collapsible frosted drawer showing the 5-item Day 1 Survival Kit */
export default function SurvivalKitPanel({ onClose }: SurvivalKitPanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className="ows-drawer ows-drawer--left" aria-label="Survival Kit">
      <div className="ows-drawer-header">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
            🎒 Day 1 Survival Kit
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Everything you carried into the valley — and how it helps.
          </p>
        </div>
        <button
          type="button"
          className="ows-close-btn"
          aria-label="Close survival kit"
          onClick={() => {
            playClick();
            onClose();
          }}
        >
          ✕
        </button>
      </div>

      <ul className="ows-drawer-body" style={{ listStyle: 'none' }}>
        {SURVIVAL_KIT.map((item) => (
          <li
            key={item.id}
            className="ows-upgrade-card"
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '12px' }}
          >
            <span
              aria-hidden="true"
              style={{
                fontSize: '1.5rem',
                width: '42px',
                height: '42px',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'var(--terra-100)',
                border: '1.5px solid var(--border)',
              }}
            >
              {item.emoji}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '0.98rem' }}>
                {item.name}
              </strong>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {item.description}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--sage-600)', lineHeight: 1.45 }}>
                ✦ {item.helps}
              </span>
              {item.id === 'field-journal' && <RelicNotes />}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Valley Relics found while scavenging, re-readable from the Field Journal */
function RelicNotes() {
  const discovered = useGameStore((s) => s.discoveredRelics);
  const relics = discovered.map((id) => RELIC_MAP[id]).filter(Boolean);

  return (
    <div>
      <div className="ows-eyebrow" style={{ marginTop: '6px' }}>
        Valley Relics · {relics.length}/{RELICS.length}
      </div>
      {relics.length === 0 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          No keepsakes yet — scavenging sometimes turns up little treasures left behind.
        </p>
      ) : (
        <ul className="ows-relic-list">
          {relics.map((r) => (
            <li key={r.id}>
              <details>
                <summary>
                  {r.emoji} {r.name}
                </summary>
                <p style={{ fontSize: '0.8rem', fontStyle: 'italic', lineHeight: 1.5, marginTop: '4px' }}>
                  “{r.note}”
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
