import type { ScavengeZone, ScavengeZoneId } from '../types/game.ts';

/** The 4 nearby valley spots reachable in a single part of the day */
export const SCAVENGE_ZONES: ScavengeZone[] = [
  {
    id: 'highway',
    name: 'Overgrown Highway',
    emoji: '🛣️',
    blurb: 'Stalled cars under ivy blankets — good for scrap and old fabric.',
    yields: [
      { resource: 'scrap', min: 2, max: 3, primary: true },
      { resource: 'cloth', min: 1, max: 2, primary: true },
      { resource: 'timber', min: 0, max: 1, primary: false },
    ],
    stories: [
      'Wildflowers have split the asphalt into a long, lazy garden. You pick through a rusted van for anything useful.',
      'A row of stalled cars wears blankets of ivy. You find a sun-faded tarp folded neatly in a trunk.',
      "Under an overpass, someone left a tidy stack of hubcaps and a note: 'Take what helps.'",
      'Dragonflies drift over the warm road while you pry loose a few sturdy panels.',
    ],
  },
  {
    id: 'pine-grove',
    name: 'Fallen Pine Grove',
    emoji: '🌲',
    blurb: 'Storm-felled pines soft with moss — timber and seeds aplenty.',
    yields: [
      { resource: 'timber', min: 2, max: 4, primary: true },
      { resource: 'seeds', min: 1, max: 2, primary: true },
    ],
    stories: [
      'Storm-felled pines lie soft with moss. The air smells of resin and morning dew.',
      'A woodpecker keeps you company as you split dry branches into neat bundles.',
      'Pinecones crunch underfoot; a few still hold plump seeds ready for planting.',
      'Sunlight slants through the needles in long golden ribbons while you gather timber.',
    ],
  },
  {
    id: 'stone-creek',
    name: 'Crumbling Stone Creek',
    emoji: '🏞️',
    blurb: 'A chattering creek by an old stone bridge — stone and clean water.',
    yields: [
      { resource: 'stone', min: 2, max: 3, primary: true },
      { resource: 'water', min: 2, max: 3, primary: true },
    ],
    stories: [
      'The creek chatters over smooth river stones, cool and clear enough to drink.',
      'You fill your canteen where a tiny waterfall spills over a broken stone wall.',
      'A heron watches, unbothered, as you pry loose flat stones from the old bridge footing.',
      'Minnows flicker in the shallows. You sit a while, then carry home what you can.',
    ],
  },
  {
    id: 'greenhouse',
    name: 'Shattered Greenhouse',
    emoji: '🪴',
    blurb: 'Glass panes like frost over runaway vines — seeds, cloth and scrap.',
    yields: [
      { resource: 'seeds', min: 1, max: 2, primary: true },
      { resource: 'cloth', min: 1, max: 2, primary: true },
      { resource: 'scrap', min: 1, max: 2, primary: true },
    ],
    stories: [
      'Shattered glass panes glitter like frost. Inside, tomato vines have run wild.',
      "Seed packets sit in a dry drawer, labels curled but legible: 'Sweet pea', 'Basil', 'Sunflower'.",
      'A shade cloth still hangs from the frame, soft and sun-warmed. It folds up nicely.',
      "Bees hum through the broken roof. Someone's garden gloves wait on a potting bench.",
    ],
  },
];

export const SCAVENGE_ZONE_MAP = Object.fromEntries(
  SCAVENGE_ZONES.map((z) => [z.id, z]),
) as Record<ScavengeZoneId, ScavengeZone>;
