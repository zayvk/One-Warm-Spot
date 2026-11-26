import type { Site } from '../types/game.ts';

export const SITES: Site[] = [
  /* ═══ Cozy Mode ═══ */
  {
    id: 'terrace',
    name: 'Old Apartment Terrace',
    tagline: 'Sunlit rooftop, half-pitched camp',
    description:
      'Someone rigged a sagging canvas tarp along the brick parapet and left behind a crate table, rolled mat, and stacked planks. Morning sun and soil-filled planters make it ready to restore.',
    leftBehind: 'Sagging tarp, crate table, salvaged planks',
    mode: 'cozy',
    silhouetteColor: 0xc8956c,
  },
  {
    id: 'pipe',
    name: 'Giant Storm Pipe',
    tagline: 'Curved walls, quiet roadside camp',
    description:
      'A past traveler tied a torn canvas flap over this mossy culvert and built a small stone fire ring outside. Its thick concrete arch already blocks the rain\u2014it just needs sturdy repairs.',
    leftBehind: 'Torn tarp flap, plank windbreak, stone fire ring',
    mode: 'cozy',
    comingSoon: true,
    unlockHint: 'Coming soon',
    silhouetteColor: 0x8aad7a,
  },
  {
    id: 'tree',
    name: 'Abandoned Treehouse',
    tagline: 'Half-broken canopy refuge',
    description:
      'Tucked high in an ancient oak sits a weathered, moss-draped treehouse with missing roof slats and a frayed rope ladder. With fresh timber and care, this crooked perch can become home.',
    leftBehind: 'Crooked plank platform, frayed rope ladder, hanging lantern',
    mode: 'cozy',
    comingSoon: true,
    unlockHint: 'Coming soon',
    silhouetteColor: 0x5b7d4e,
  },
  {
    id: 'countryhouse',
    name: 'Abandoned Country House',
    tagline: 'Ivy cottage, propped porch',
    description:
      'A vine-covered stone cottage with a sagging porch propped on a timber beam. Someone patched one window with tarp and left a crate table with a lantern still hanging from the eave.',
    leftBehind: 'Propped porch beam, patched window tarp, crate & lantern',
    mode: 'cozy',
    unlockRequirement: { stat: 'maxDaysSurvived', count: 7 },
    unlockHint: 'Survive 7 days to unlock',
    silhouetteColor: 0xb8a090,
  },
  {
    id: 'farmhouse',
    name: 'Abandoned Farmhouse',
    tagline: 'Fallow beds, timber barn',
    description:
      'A weather-beaten farmhouse with a collapsed porch tarp and fallow garden beds. Salvaged fence planks lean against the barn wall, and a rusted watering can sits by the door.',
    leftBehind: 'Porch tarp, salvaged fence planks, watering can & lantern',
    mode: 'cozy',
    unlockRequirement: { stat: 'totalUpgradesBuilt', count: 2 },
    unlockHint: 'Complete 2 shelter upgrades to unlock',
    silhouetteColor: 0xc4a86c,
  },

  /* ═══ Challenge Mode ═══ */
  {
    id: 'cave',
    name: 'Hillside Cave',
    tagline: 'Dry stone alcove, cold firepit',
    description:
      'A sheltered south-facing limestone cave holding a half-collapsed branch lean-to, cold hearth stones, and stacked crates. Deep rock keeps the temperature steady year-round.',
    leftBehind: 'Collapsed lean-to, stone firepit, wooden crates',
    mode: 'challenge',
    unlockRequirement: { stat: 'maxDaysSurvived', count: 10 },
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
    mode: 'challenge',
    unlockRequirement: { stat: 'totalExpansionsBuilt', count: 1 },
    unlockHint: 'Complete your first expansion to unlock',
    silhouetteColor: 0xb0a89e,
  },
  {
    id: 'beachhouse',
    name: 'Abandoned Beachhouse',
    tagline: 'Stilt cabin, salt breeze',
    description:
      'A weathered stilt cabin on the shoreline with a torn porch tarp flapping in the salt breeze. A driftwood fire ring and a wooden supply crate sit in the sand below.',
    leftBehind: 'Torn porch tarp, driftwood fire ring, wooden crate',
    mode: 'challenge',
    unlockRequirement: { stat: 'maxDaysSurvived', count: 14 },
    unlockHint: 'Survive 14 days to unlock',
    silhouetteColor: 0x8ab4c8,
  },
  {
    id: 'island',
    name: 'Abandoned Island Camp',
    tagline: 'Driftwood jetty, pine shore',
    description:
      'A tiny pine-ringed island reached by a creaking driftwood jetty. A collapsed branch tent, cold stone fire ring, and a battered supply crate mark where the last traveler camped.',
    leftBehind: 'Collapsed branch tent, stone fire ring, supply crate',
    mode: 'challenge',
    unlockRequirement: { stat: 'totalUpgradesBuilt', count: 4 },
    unlockHint: 'Complete 4 shelter upgrades to unlock',
    silhouetteColor: 0x6a9e7e,
  },
];
