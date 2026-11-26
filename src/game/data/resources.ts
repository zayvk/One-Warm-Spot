import type { Resource } from '../types/game.ts';

export const RESOURCES: Resource[] = [
  { id: 'timber',  name: 'Timber',  emoji: '🪵', startAmount: 4,  maxStack: 50 },
  { id: 'scrap',   name: 'Scrap',   emoji: '🔩', startAmount: 3,  maxStack: 50 },
  { id: 'cloth',   name: 'Cloth',   emoji: '🧵', startAmount: 2,  maxStack: 40 },
  { id: 'stone',   name: 'Stone',   emoji: '🪨', startAmount: 2,  maxStack: 60 },
  { id: 'seeds',   name: 'Seeds',   emoji: '🌱', startAmount: 1,  maxStack: 30 },
  { id: 'water',   name: 'Water',   emoji: '💧', startAmount: 5,  maxStack: 40 },
  { id: 'food',    name: 'Food',    emoji: '🍅', startAmount: 0,  maxStack: 30 },
];

/** Quick lookup map */
export const RESOURCE_MAP = Object.fromEntries(
  RESOURCES.map((r) => [r.id, r])
) as Record<string, Resource>;
