import type { Relic } from '../types/game.ts';

/** Small keepsakes that turn up while scavenging — kept in the Field Journal */
export const RELICS: Relic[] = [
  {
    id: 'faded-postcard',
    name: 'Faded Postcard',
    emoji: '💌',
    note: "A seaside pier at sunset. On the back, in looping ink: 'The light is gold again. Wish you were here. —M.'",
  },
  {
    id: 'weather-log',
    name: 'Weather Station Log',
    emoji: '📋',
    note: 'Day 212: Dust thinning. Saw a whole hour of blue sky. The birds are back on the wire.',
  },
  {
    id: 'cracked-cassette',
    name: 'Cracked Cassette',
    emoji: '📼',
    note: "Hand-labelled 'Road Trip Mix — the good one'. The tape is snapped, but someone clearly loved it.",
  },
  {
    id: 'seed-tin',
    name: 'Rusty Seed Tin',
    emoji: '🥫',
    note: "A tin lid scratched with 'Grandma's tomatoes — always save the best ones.' A few seeds still rattle inside.",
  },
  {
    id: 'childs-drawing',
    name: "Child's Drawing",
    emoji: '🖍️',
    note: 'A crayon house, a crayon sun, and four stick figures holding hands under a very big tree.',
  },
  {
    id: 'brass-compass',
    name: 'Brass Compass',
    emoji: '🧭',
    note: "The needle still swings north. Engraved on the lid: 'So you always find your way home.'",
  },
  {
    id: 'trail-map',
    name: 'Hand-drawn Trail Map',
    emoji: '🗺️',
    note: "Someone sketched a creek, a pine grove and a tiny star labelled 'good spot for tea'.",
  },
  {
    id: 'glass-chime',
    name: 'Glass Wind Chime',
    emoji: '🎐',
    note: 'Three little blue glass fish on a string. They still ring whenever the breeze comes through.',
  },
];

export const RELIC_MAP: Record<string, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
