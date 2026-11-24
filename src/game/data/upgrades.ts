import type { Upgrade } from '../types/game.ts';

export const UPGRADES: Upgrade[] = [
  /* ── Shell Tiers ── */
  {
    id: 'shell-1',
    category: 'shell',
    name: 'Patch & Reinforce Shell',
    tier: 1,
    description: 'Mend the sagging tarps and seal gaps left by the last camper. Keeps wind and rain out.',
    cost: { scrap: 3, cloth: 2 },
  },
  {
    id: 'shell-2',
    category: 'shell',
    name: 'Fortify Walls',
    tier: 2,
    description: 'Add timber bracing and stone anchors over repaired sections. Proper weather protection.',
    cost: { timber: 5, stone: 4 },
  },

  /* ── Dividers ── */
  {
    id: 'divider-1',
    category: 'dividers',
    name: 'Clear & Organize Camp Space',
    tier: 1,
    description: 'Sort through leftover crates and hang salvaged cloth to separate sleeping and working areas.',
    cost: { cloth: 3 },
  },
  {
    id: 'divider-2',
    category: 'dividers',
    name: 'Timber Frame Wall',
    tier: 2,
    description: 'Replace makeshift partitions with a proper interior wall built from fresh timber.',
    cost: { timber: 4, scrap: 2 },
  },

  /* ── Expansions ── */
  {
    id: 'expand-1',
    category: 'expansion',
    name: 'Repair Lean-To Annex',
    tier: 1,
    description: 'Fix the collapsed lean-to left behind and extend your shelter footprint.',
    cost: { timber: 4, cloth: 2 },
  },
  {
    id: 'expand-2',
    category: 'expansion',
    name: 'Full Extension',
    tier: 2,
    description: 'Double your usable area with a solid walled extension beyond the original camp.',
    cost: { timber: 8, stone: 5, scrap: 3 },
  },

  /* ── Curated Slots ── */
  {
    id: 'slot-workbench',
    category: 'slots',
    name: 'Restore Workbench',
    tier: 1,
    description: 'Salvage the old crate table into a sturdy surface for crafting and repairs.',
    cost: { timber: 3, scrap: 2 },
  },
  {
    id: 'slot-garden',
    category: 'slots',
    name: 'Revive Garden Bed',
    tier: 1,
    description: 'Clear weeds from the leftover planter and prepare it for growing food from seeds.',
    cost: { stone: 3, seeds: 2, water: 3 },
  },
  {
    id: 'slot-rain-collector',
    category: 'slots',
    name: 'Rig Rain Collector',
    tier: 1,
    description: 'Repurpose torn tarp scraps into a funnel to catch and store rainwater.',
    cost: { scrap: 3, cloth: 1 },
  },
  {
    id: 'slot-hearth',
    category: 'slots',
    name: 'Relight Stone Hearth',
    tier: 1,
    description: 'Clean out the cold firepit stones and rebuild them into a proper hearth for cooking and warmth.',
    cost: { stone: 5, scrap: 1 },
  },
];
