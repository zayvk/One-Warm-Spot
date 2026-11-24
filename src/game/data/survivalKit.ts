import type { KitItem } from '../types/game.ts';

/** The 5-item Day 1 survival kit every player receives */
export const SURVIVAL_KIT: KitItem[] = [
  {
    id: 'canvas-tarp',
    name: 'Canvas Tarp',
    emoji: '⛺',
    description: 'A weathered but functional tarp. Your first layer of overhead shelter.',
  },
  {
    id: 'bedroll',
    name: 'Bedroll',
    emoji: '🛏️',
    description: 'A compact roll of padded fabric. Keeps you off cold ground at night.',
  },
  {
    id: 'pocket-stove',
    name: 'Pocket Stove',
    emoji: '🔥',
    description: 'A tiny folding stove that burns scraps. Boils water and warms hands.',
  },
  {
    id: 'backpack',
    name: 'Backpack',
    emoji: '🎒',
    description: 'A sturdy rucksack for carrying scavenged materials back to shelter.',
  },
  {
    id: 'field-journal',
    name: 'Field Journal',
    emoji: '📓',
    description: 'A battered notebook. Tracks your discoveries, plans, and progress.',
  },
];
