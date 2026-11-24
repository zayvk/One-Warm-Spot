import { useGameStore } from '../game/store/useGameStore.ts';
import { RESOURCES } from '../game/data/resources.ts';
import { SITES } from '../game/data/sites.ts';

export default function TopBar() {
  const day = useGameStore((s) => s.day);
  const chosenSite = useGameStore((s) => s.chosenSite);
  const resources = useGameStore((s) => s.resources);
  const resetGame = useGameStore((s) => s.resetGame);

  const siteName = SITES.find((s) => s.id === chosenSite)?.name ?? '—';

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: 'var(--space-sm) var(--space-md)',
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border)',
        flexWrap: 'wrap',
      }}
    >
      {/* Day & Site */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'baseline' }}>
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          ☀️ Day {day}
        </strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{siteName}</span>
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
            style={{ fontSize: '0.9rem', whiteSpace: 'nowrap' }}
          >
            {r.emoji} {resources[r.id]}
          </span>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={resetGame}
        style={{
          marginLeft: 'var(--space-sm)',
          background: 'var(--terra-400)',
          color: '#fff',
          fontSize: '0.8rem',
        }}
      >
        Reset Save
      </button>
    </header>
  );
}
