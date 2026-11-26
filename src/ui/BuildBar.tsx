import type { StationConfig, StationId } from '../game/data/scenes/types.ts';
import type { ResourceId } from '../game/types/game.ts';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { canAfford } from '../game/engine/progression.ts';
import { nextStationTier, type StationTiers } from '../game/engine/stations.ts';
import { playClick, playHover, playLocked } from '../game/audio/soundEngine.ts';

export interface BuildBarProps {
  stations: readonly StationConfig[];
  tiers: StationTiers;
  pending: StationId | null;
  resources: Record<ResourceId, number>;
  /** Returns false if the scene is busy right now */
  onBuild: (stationId: StationId) => boolean;
}

/** Compact bottom-center row: at most one next-tier chip per station, hidden once maxed */
export default function BuildBar({ stations, tiers, pending, resources, onBuild }: BuildBarProps) {
  const chips = stations
    .map((station) => ({ station, next: nextStationTier(station, tiers[station.id] ?? station.baseTier) }))
    .filter((c): c is { station: StationConfig; next: NonNullable<typeof c.next> } => c.next !== null);
  if (chips.length === 0) return null;

  return (
    <nav className="ows-build-bar" aria-label="Build on the terrace">
      {chips.map(({ station, next }) => {
        const affordable = canAfford(next.cost, resources);
        const isPending = pending === station.id;
        const costEntries = Object.entries(next.cost) as [ResourceId, number][];
        const missing = costEntries
          .filter(([id, n]) => (resources[id] ?? 0) < n)
          .map(([id, n]) => `${n - (resources[id] ?? 0)} ${RESOURCE_MAP[id]?.emoji ?? id}`)
          .join(' ');
        return (
          <button
            key={station.id}
            type="button"
            className={`ows-build-chip ${isPending ? 'ows-build-chip--pending' : ''}`}
            disabled={!affordable || pending !== null}
            title={affordable ? `Build ${next.name} (Tier ${next.tier})` : `${next.name} — need ${missing} more`}
            onMouseEnter={affordable ? playHover : undefined}
            onClick={() => {
              if (onBuild(station.id)) playClick();
              else playLocked();
            }}
          >
            <span className="ows-build-chip__tier">T{next.tier}</span>
            <span aria-hidden="true">{station.icon}</span>
            <span className="ows-build-chip__name">{isPending ? 'Building…' : next.name}</span>
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
