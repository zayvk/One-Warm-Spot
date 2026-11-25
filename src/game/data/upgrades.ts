import type { Upgrade, UpgradeCategory } from '../types/game.ts';

/** Legacy standalone tarp flag from v1/v2 saves — migrated to `shell-1` */
export const LEGACY_TARP_UPGRADE_ID = 'tarp-pitched';

/**
 * The 10 macro upgrades. Cozy values sum to 100 so the Cozy Index reads as
 * a percentage of a fully restored shelter.
 */
export const UPGRADES: Upgrade[] = [
  /* ── Shell Tiers ── */
  {
    id: 'shell-1',
    category: 'shell',
    name: 'Pitch & Patch the Canvas Tarp',
    tier: 1,
    emoji: '⛺',
    description: 'Re-pitch your canvas tarp over the old frame and patch the gaps the last camper left. Your first dry roof.',
    cost: { cloth: 1, scrap: 1 },
    energy: 15,
    cozy: 8,
  },
  {
    id: 'shell-2',
    category: 'shell',
    name: 'Reinforce & Fortify Walls',
    tier: 2,
    emoji: '🧱',
    description: 'Add timber bracing and stone anchors over the patched sections. Proper weather protection.',
    cost: { timber: 5, stone: 4 },
    energy: 30,
    cozy: 12,
    requires: 'shell-1',
  },

  /* ── Dividers ── */
  {
    id: 'divider-1',
    category: 'dividers',
    name: 'Clear & Organize Camp Space',
    tier: 1,
    emoji: '🧺',
    description: 'Sort through leftover crates and hang salvaged cloth to separate sleeping and working areas.',
    cost: { cloth: 3 },
    energy: 15,
    cozy: 6,
  },
  {
    id: 'divider-2',
    category: 'dividers',
    name: 'Timber Frame Wall',
    tier: 2,
    emoji: '🪟',
    description: 'Replace makeshift partitions with a proper interior wall built from fresh timber.',
    cost: { timber: 4, scrap: 2 },
    energy: 25,
    cozy: 10,
    requires: 'divider-1',
  },

  /* ── Expansions ── */
  {
    id: 'expand-1',
    category: 'expansion',
    name: 'Repair Lean-To Annex',
    tier: 1,
    emoji: '🛖',
    description: 'Fix the collapsed lean-to left behind and extend your shelter footprint.',
    cost: { timber: 4, cloth: 2 },
    energy: 25,
    cozy: 10,
  },
  {
    id: 'expand-2',
    category: 'expansion',
    name: 'Full Extension',
    tier: 2,
    emoji: '🏡',
    description: 'Double your usable area with a solid walled extension beyond the original camp.',
    cost: { timber: 8, stone: 5, scrap: 3 },
    energy: 40,
    cozy: 14,
    requires: 'expand-1',
  },

  /* ── Curated Slots ── */
  {
    id: 'slot-workbench',
    category: 'slots',
    name: 'Restore Workbench',
    tier: 1,
    emoji: '🪚',
    description: 'Salvage the old crate table into a sturdy surface for crafting and repairs.',
    cost: { timber: 3, scrap: 2 },
    energy: 20,
    cozy: 8,
  },
  {
    id: 'slot-garden',
    category: 'slots',
    name: 'Revive Garden Bed',
    tier: 1,
    emoji: '🌿',
    description: 'Clear weeds from the leftover planter and prepare it for growing food from seeds.',
    cost: { stone: 3, seeds: 2, water: 3 },
    energy: 20,
    cozy: 10,
  },
  {
    id: 'slot-rain-collector',
    category: 'slots',
    name: 'Rig Rain Collector',
    tier: 1,
    emoji: '🌧️',
    description: 'Repurpose torn tarp scraps into a funnel to catch and store rainwater.',
    cost: { scrap: 3, cloth: 1 },
    energy: 15,
    cozy: 8,
  },
  {
    id: 'slot-hearth',
    category: 'slots',
    name: 'Relight Stone Hearth',
    tier: 1,
    emoji: '🔥',
    description: 'Clean out the cold firepit stones and rebuild them into a proper hearth for cooking and warmth.',
    cost: { stone: 5, scrap: 1 },
    energy: 25,
    cozy: 14,
  },
];

export const UPGRADE_MAP: Record<string, Upgrade> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

export const UPGRADE_CATEGORIES: { id: UpgradeCategory; label: string; emoji: string; blurb: string }[] = [
  { id: 'shell', label: 'Shell', emoji: '⛺', blurb: 'Patch, reinforce, fortify the outer walls & roof.' },
  { id: 'dividers', label: 'Dividers', emoji: '🧺', blurb: 'Hang cloth, then raise timber frames.' },
  { id: 'expansion', label: 'Expansions', emoji: '🛖', blurb: 'Repair a lean-to, then add a full extension.' },
  { id: 'slots', label: 'Curated Slots', emoji: '🪚', blurb: 'Anchor stations that make the place a home.' },
];
