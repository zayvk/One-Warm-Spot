import { useEffect, useState } from 'react';
import { RESOURCE_MAP } from '../game/data/resources.ts';
import { POUCH_RESOURCE_IDS } from '../game/engine/rewardCallouts.ts';
import { useGameStore } from '../game/store/useGameStore.ts';
import type { ResourceId } from '../game/types/game.ts';

export interface MaterialPouchProps {
  /** `rooftop` centers full-size above the canvas; `downstairs` uses a compact corner bar */
  variant?: 'rooftop' | 'downstairs';
}

/**
 * Found Materials Pouch shared across the rooftop shelter, Floors 1–4, and apartment rooms.
 * Pulses individual material counters briefly whenever new salvage arrives.
 */
export default function MaterialPouch({ variant = 'rooftop' }: MaterialPouchProps) {
  const resources = useGameStore((s) => s.resources);
  const [pulsing, setPulsing] = useState<Partial<Record<ResourceId, boolean>>>({});
  const [prevResources, setPrevResources] = useState(resources);

  if (resources !== prevResources) {
    setPrevResources(resources);
    const increased = POUCH_RESOURCE_IDS.filter((id) => resources[id] > prevResources[id]);
    if (increased.length > 0) {
      setPulsing((curr) => {
        const next = { ...curr };
        for (const id of increased) next[id] = true;
        return next;
      });
    }
  }

  useEffect(() => {
    const active = POUCH_RESOURCE_IDS.filter((id) => pulsing[id]);
    if (active.length === 0) return;
    const timer = setTimeout(() => {
      setPulsing((curr) => {
        const next = { ...curr };
        for (const id of active) next[id] = false;
        return next;
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [pulsing]);

  const items = POUCH_RESOURCE_IDS.map((id) => RESOURCE_MAP[id]).filter((r) => r !== undefined);

  return (
    <div
      className={`ows-hud-bar ows-pouch-bar ${variant === 'downstairs' ? 'ows-pouch-bar--compact' : ''}`}
      aria-label="Found Materials Pouch"
      data-hud-top=""
    >
      {items.map((r) => (
        <span
          key={r.id}
          tabIndex={0}
          aria-label={`${r.name}: ${resources[r.id]}`}
          className={`ows-pouch-item ${pulsing[r.id] ? 'ows-pouch-item--pulse' : ''}`}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span>{resources[r.id]}</span>
          <span className="ows-pouch-tooltip" role="tooltip">
            {r.name}
          </span>
        </span>
      ))}
    </div>
  );
}
