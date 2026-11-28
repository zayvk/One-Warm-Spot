import { RESOURCE_MAP } from '../data/resources.ts';
import type { ResourceId } from '../types/game.ts';

export const POUCH_RESOURCE_IDS: readonly ResourceId[] = [
  'timber',
  'cloth',
  'seeds',
  'water',
  'scrap',
  'stone',
  'food',
];

/** Format gained materials into a crisp callout string (e.g. `+2 🪵 Timber  +1 🧵 Cloth`). */
export function formatRewardCallout(gained: Partial<Record<ResourceId, number>>): string {
  return (Object.entries(gained) as [ResourceId, number | undefined][])
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .map(([id, count]) => {
      const def = RESOURCE_MAP[id];
      return def ? `+${count} ${def.emoji} ${def.name}` : `+${count}`;
    })
    .join('  ');
}
