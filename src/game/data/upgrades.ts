import type { Upgrade } from '../types/game.ts';

export const UPGRADES: Upgrade[] = [
  /* ── Shell Tiers ── */
  {
    id: 'shell-1',
    category: 'shell',
    name: 'Patch Holes',
    tier: 1,
    description: 'Seal the worst gaps with scrap and cloth. Keeps wind out.',
    cost: { scrap: 3, cloth: 2 },
  },
  {
    id: 'shell-2',
    category: 'shell',
    name: 'Reinforce Walls',
    tier: 2,
    description: 'Add timber bracing and stone anchors. Proper weather protection.',
    cost: { timber: 5, stone: 4 },
  },

  /* ── Dividers ── */
  {
    id: 'divider-1',
    category: 'dividers',
    name: 'Cloth Partition',
    tier: 1,
    description: 'Hang cloth to separate sleeping and working areas.',
    cost: { cloth: 3 },
  },
  {
    id: 'divider-2',
    category: 'dividers',
    name: 'Timber Frame Wall',
    tier: 2,
    description: 'Build a proper interior wall with a timber frame.',
    cost: { timber: 4, scrap: 2 },
  },

  /* ── Expansions ── */
  {
    id: 'expand-1',
    category: 'expansion',
    name: 'Side Lean-To',
    tier: 1,
    description: 'Extend your shelter footprint with a simple lean-to annex.',
    cost: { timber: 4, cloth: 2 },
  },
  {
    id: 'expand-2',
    category: 'expansion',
    name: 'Full Extension',
    tier: 2,
    description: 'Double your usable area with a solid walled extension.',
    cost: { timber: 8, stone: 5, scrap: 3 },
  },

  /* ── Curated Slots ── */
  {
    id: 'slot-workbench',
    category: 'slots',
    name: 'Workbench',
    tier: 1,
    description: 'A flat surface for crafting and repairs.',
    cost: { timber: 3, scrap: 2 },
  },
  {
    id: 'slot-garden',
    category: 'slots',
    name: 'Garden Bed',
    tier: 1,
    description: 'A raised planter for growing food from seeds.',
    cost: { stone: 3, seeds: 2, water: 3 },
  },
  {
    id: 'slot-rain-collector',
    category: 'slots',
    name: 'Rain Collector',
    tier: 1,
    description: 'Catch and store rainwater for drinking and gardening.',
    cost: { scrap: 3, cloth: 1 },
  },
  {
    id: 'slot-hearth',
    category: 'slots',
    name: 'Stone Hearth',
    tier: 1,
    description: 'A proper fire pit for cooking and warmth.',
    cost: { stone: 5, scrap: 1 },
  },
];
