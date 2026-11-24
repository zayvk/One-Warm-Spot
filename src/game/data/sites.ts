import type { Site } from '../types/game.ts';

export const SITES: Site[] = [
  {
    id: 'terrace',
    name: 'Old Apartment Terrace',
    tagline: 'Sunlit rooftop, half-pitched camp',
    description:
      'Someone rigged a sagging canvas tarp along the brick parapet and left behind a crate table, rolled mat, and stacked planks. Morning sun and soil-filled planters make it ready to restore.',
    leftBehind: 'Sagging tarp, crate table, salvaged planks',
    unlocked: true,
    silhouetteColor: 0xc8956c,
  },
  {
    id: 'pipe',
    name: 'Giant Storm Pipe',
    tagline: 'Curved walls, quiet roadside camp',
    description:
      'A past traveler tied a torn canvas flap over this mossy culvert and built a small stone fire ring outside. Its thick concrete arch already blocks the rain\u2014it just needs sturdy repairs.',
    leftBehind: 'Torn tarp flap, plank windbreak, stone fire ring',
    unlocked: true,
    silhouetteColor: 0x8aad7a,
  },
  {
    id: 'tree',
    name: 'Abandoned Treehouse',
    tagline: 'Half-broken canopy refuge',
    description:
      'Tucked high in an ancient oak sits a weathered, moss-draped treehouse with missing roof slats and a frayed rope ladder. With fresh timber and care, this crooked perch can become home.',
    leftBehind: 'Crooked plank platform, frayed rope ladder, hanging lantern',
    unlocked: true,
    silhouetteColor: 0x5b7d4e,
  },
  {
    id: 'cave',
    name: 'Hillside Cave',
    tagline: 'Dry stone alcove, cold firepit',
    description:
      'A sheltered south-facing limestone cave holding a half-collapsed branch lean-to, cold hearth stones, and stacked crates. Deep rock keeps the temperature steady year-round.',
    leftBehind: 'Collapsed lean-to, stone firepit, wooden crates',
    unlocked: false,
    unlockHint: 'Survive 10 days to unlock',
    silhouetteColor: 0x9e6b42,
  },
  {
    id: 'bunker',
    name: 'Sunken Service Bunker',
    tagline: 'Wedged steel door, buried shelter',
    description:
      'Someone pried this utility bunker ajar with a wooden wedge and stretched a patched tarp over the steps before moving on. Intact concrete walls offer a head start once unlocked.',
    leftBehind: 'Wedged steel door, stairwell tarp, rusted toolbox',
    unlocked: false,
    unlockHint: 'Complete your first expansion to unlock',
    silhouetteColor: 0xb0a89e,
  },
];
