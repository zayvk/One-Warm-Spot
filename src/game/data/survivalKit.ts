import type { KitItem } from '../types/game.ts';

/** The 5-item Day 1 survival kit every player receives */
export const SURVIVAL_KIT: KitItem[] = [
  {
    id: 'canvas-tarp',
    name: 'Canvas Tarp',
    emoji: '⛺',
    description: 'A weathered but sturdy waxed canvas sheet with brass grommets.',
    helps: 'Pitch it over the old frame for your first dry roof (Shell · Tier 1).',
  },
  {
    id: 'bedroll-pack',
    name: 'Bedroll & Pack',
    emoji: '🎒',
    description: 'A padded bedroll strapped to a roomy canvas rucksack.',
    helps: 'Sleep off the ground to wake fully rested, and haul materials home.',
  },
  {
    id: 'pocket-stove',
    name: 'Pocket Stove',
    emoji: '🔥',
    description: 'A tiny folding stove that burns twigs and scraps.',
    helps: 'Boils water, warms hands, and lights the old lantern at dusk.',
  },
  {
    id: 'multi-tool',
    name: 'Multi-Tool',
    emoji: '🛠️',
    description: 'Pliers, a small saw, a driver and a blade folded into one grip.',
    helps: 'Lets you strip scrap, cut timber and repair what earlier travelers left.',
  },
  {
    id: 'field-journal',
    name: 'Field Journal',
    emoji: '📓',
    description: 'A battered notebook with a pencil tucked in the spine.',
    helps: 'Tracks your days, discoveries and the shelters still waiting out there.',
  },
];
