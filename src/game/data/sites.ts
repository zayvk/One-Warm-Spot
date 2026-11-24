import type { Site } from '../types/game.ts';

export const SITES: Site[] = [
  {
    id: 'terrace',
    name: 'Old Apartment Terrace',
    tagline: 'Rooftop refuge with a view',
    description:
      'A crumbling but sturdy terrace atop an abandoned apartment block. Morning sunlight floods through broken skylights, and planter beds still hold soil.',
    unlocked: true,
    silhouetteColor: 0xc8956c,
  },
  {
    id: 'pipe',
    name: 'Giant Storm Pipe',
    tagline: 'Round walls, natural shelter',
    description:
      'A massive concrete storm pipe, half-buried in a hillside. The curved walls keep rain out and warmth in. Moss and ferns soften the entry.',
    unlocked: true,
    silhouetteColor: 0x8aad7a,
  },
  {
    id: 'tree',
    name: 'Ancient Oak Tree',
    tagline: 'A living canopy home',
    description:
      'An enormous oak that survived the impact. Thick branches form natural platforms, and the dense canopy filters golden light.',
    unlocked: true,
    silhouetteColor: 0x5b7d4e,
  },
  {
    id: 'cave',
    name: 'Hillside Cave',
    tagline: 'Deep stone, steady warmth',
    description:
      'A dry limestone cave set into a south-facing hillside. Sheltered from wind and naturally insulated.',
    unlocked: false,
    unlockHint: 'Survive 10 days to unlock',
    silhouetteColor: 0x9e6b42,
  },
  {
    id: 'bunker',
    name: 'Sunken Service Bunker',
    tagline: 'Pre-impact engineering',
    description:
      'A forgotten utility bunker beneath a cracked parking lot. Reinforced concrete walls and intact wiring offer a head start on upgrades.',
    unlocked: false,
    unlockHint: 'Complete your first expansion to unlock',
    silhouetteColor: 0xb0a89e,
  },
];
