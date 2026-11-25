import type { SiteId, TravelerGender } from '../types/game.ts';

/* ───── Media Entry ───── */

export interface MediaEntry {
  /** URL path under public/ — e.g. "/source/backgrounds/bg-title.webp" */
  src: string;
  /** Cozy CSS gradient fallback when the image file isn't present yet */
  fallbackGradient: string;
}

/* ───── Background Map ───── */

/** Title screen background */
export const BG_TITLE: MediaEntry = {
  src: '/source/backgrounds/bg-title.webp',
  fallbackGradient:
    'linear-gradient(160deg, #e3edf7 0%, #c5d6bc 40%, #f5ebe0 75%, #e8cdb5 100%)',
};

/** Shelter-selector default valley panorama */
export const BG_VALLEY: MediaEntry = {
  src: '/source/backgrounds/bg-valley.webp',
  fallbackGradient:
    'linear-gradient(175deg, #b7cfe3 0%, #c5d6bc 35%, #e8efe4 65%, #f5ebe0 100%)',
};

/** Per-shelter hover backgrounds */
export const BG_SHELTERS: Record<SiteId, MediaEntry> = {
  terrace: {
    src: '/source/backgrounds/bg-terrace.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #e8cdb5 45%, #c8956c 100%)',
  },
  pipe: {
    src: '/source/backgrounds/bg-pipe.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #c5d6bc 50%, #8aad7a 100%)',
  },
  tree: {
    src: '/source/backgrounds/bg-tree.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e8efe4 0%, #8aad7a 50%, #5b7d4e 100%)',
  },
  countryhouse: {
    src: '/source/backgrounds/bg-countryhouse.webp',
    fallbackGradient:
      'linear-gradient(165deg, #f5ebe0 0%, #c5d6bc 45%, #b8a090 100%)',
  },
  farmhouse: {
    src: '/source/backgrounds/bg-farmhouse.webp',
    fallbackGradient:
      'linear-gradient(165deg, #f5ebe0 0%, #e8cdb5 45%, #c4a86c 100%)',
  },
  cave: {
    src: '/source/backgrounds/bg-cave.webp',
    fallbackGradient:
      'linear-gradient(165deg, #f5ebe0 0%, #c8956c 50%, #9e6b42 100%)',
  },
  bunker: {
    src: '/source/backgrounds/bg-bunker.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e8efe4 0%, #b0a89e 50%, #3d3832 100%)',
  },
  beachhouse: {
    src: '/source/backgrounds/bg-beachhouse.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #b7cfe3 45%, #8ab4c8 100%)',
  },
  island: {
    src: '/source/backgrounds/bg-island.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #c5d6bc 40%, #6a9e7e 100%)',
  },
};

/* ───── Traveler Sprites ───── */

export type TravelerPose = 'idle' | 'walk' | 'search' | 'sit' | 'sleep';

export function travelerSpriteSrc(gender: TravelerGender, pose: TravelerPose): string {
  return `/source/sprites/${gender}-${pose}.webp`;
}

/** All traveler sprite URLs for preloading */
export const ALL_TRAVELER_SPRITES: string[] = (
  ['female', 'male'] as TravelerGender[]
).flatMap((g) =>
  (['idle', 'walk', 'search', 'sit', 'sleep'] as TravelerPose[]).map((p) =>
    travelerSpriteSrc(g, p),
  ),
);

/* ───── Scene Stages ───── */

export const SCENE_STAGES: Partial<Record<SiteId, string>> = {
  terrace: '/source/scenes/terrace-stage.webp',
};

/* ───── Scene Props ───── */

export const SCENE_PROPS = {
  'prop-firepit': '/source/props/prop-firepit.webp',
  'prop-boxes-intact': '/source/props/prop-boxes-intact.webp',
  'prop-boxes-cleared': '/source/props/prop-boxes-cleared.webp',
  'prop-weeds-1': '/source/props/prop-weeds-1.webp',
  'prop-weeds-2': '/source/props/prop-weeds-2.webp',
} as const;

export type PropId = keyof typeof SCENE_PROPS;

/** All background URLs for preloading */
export const ALL_BG_URLS: string[] = [
  BG_TITLE.src,
  BG_VALLEY.src,
  ...Object.values(BG_SHELTERS).map((e) => e.src),
];
