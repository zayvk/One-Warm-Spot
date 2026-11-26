import type { BuildableConfig } from '../game/data/scenes/types.ts';
import type { ResourceId } from '../game/types/game.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { canAfford } from '../game/engine/progression.ts';
import { playClick, playHover, playLocked } from '../game/audio/soundEngine.ts';

export interface BuildBarProps {
  buildables: readonly BuildableConfig[];
  built: readonly string[];
  pending: string | null;
  resources: Record<ResourceId, number>;
  /** Returns false if the scene is busy right now */
  onBuild: (id: string) => boolean;
}

/** Tiny bottom-center row of frosted blueprint chips for unbuilt, unlocked in-scene upgrades */
export default function BuildBar({ buildables, built, pending, resources, onBuild }: BuildBarProps) {
  const remaining = buildables.filter(
    (b) => !built.includes(b.id) && (!b.requires || built.includes(b.requires)),
  );
  if (remaining.length === 0) return null;

  return (
    <nav className="ows-build-bar" aria-label="Build on the terrace">
      {remaining.map((b) => {
        const affordable = canAfford(b.cost, resources);
        const isPending = pending === b.id;
        const costEntries = Object.entries(b.cost) as [ResourceId, number][];
        const missing = costEntries
          .filter(([id, n]) => (resources[id] ?? 0) < n)
          .map(([id, n]) => `${n - (resources[id] ?? 0)} ${RESOURCE_MAP[id]?.emoji ?? id}`)
          .join(' ');
        return (
          <button
            key={b.id}
            type="button"
            className={`ows-build-chip ${isPending ? 'ows-build-chip--pending' : ''}`}
            disabled={!affordable || pending !== null}
            title={affordable ? `Build ${b.name}` : `Need ${missing} more`}
            onMouseEnter={affordable ? playHover : undefined}
            onClick={() => {
              if (onBuild(b.id)) playClick();
              else playLocked();
            }}
          >
            <span aria-hidden="true">{b.icon}</span>
            <span className="ows-build-chip__name">{isPending ? 'Building…' : b.name}</span>
            <span className="ows-build-chip__cost">
              {costEntries.map(([id, n]) => (
                <span key={id} className={(resources[id] ?? 0) < n ? 'ows-build-chip__short' : undefined}>
                  {n}
                  {RESOURCE_MAP[id]?.emoji}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
