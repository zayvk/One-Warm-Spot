import type { SiteId } from '../types/game.ts';

/* ───── Media Entry ───── */

export interface MediaEntry {
  /** URL path under public/ — e.g. "/source/bg-title.webp" */
  src: string;
  /** Cozy CSS gradient fallback when the image file isn't present yet */
  fallbackGradient: string;
}

/* ───── Background Map ───── */

/** Title screen background */
export const BG_TITLE: MediaEntry = {
  src: '/source/bg-title.webp',
  fallbackGradient:
    'linear-gradient(160deg, #e3edf7 0%, #c5d6bc 40%, #f5ebe0 75%, #e8cdb5 100%)',
};

/** Shelter-selector default valley panorama */
export const BG_VALLEY: MediaEntry = {
  src: '/source/bg-valley.webp',
  fallbackGradient:
    'linear-gradient(175deg, #b7cfe3 0%, #c5d6bc 35%, #e8efe4 65%, #f5ebe0 100%)',
};

/** Per-shelter hover backgrounds */
export const BG_SHELTERS: Record<SiteId, MediaEntry> = {
  terrace: {
    src: '/source/bg-terrace.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #e8cdb5 45%, #c8956c 100%)',
  },
  pipe: {
    src: '/source/bg-pipe.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #c5d6bc 50%, #8aad7a 100%)',
  },
  tree: {
    src: '/source/bg-tree.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e8efe4 0%, #8aad7a 50%, #5b7d4e 100%)',
  },
  countryhouse: {
    src: '/source/bg-countryhouse.webp',
    fallbackGradient:
      'linear-gradient(165deg, #f5ebe0 0%, #c5d6bc 45%, #b8a090 100%)',
  },
  farmhouse: {
    src: '/source/bg-farmhouse.webp',
    fallbackGradient:
      'linear-gradient(165deg, #f5ebe0 0%, #e8cdb5 45%, #c4a86c 100%)',
  },
  cave: {
    src: '/source/bg-cave.webp',
    fallbackGradient:
      'linear-gradient(165deg, #f5ebe0 0%, #c8956c 50%, #9e6b42 100%)',
  },
  bunker: {
    src: '/source/bg-bunker.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e8efe4 0%, #b0a89e 50%, #3d3832 100%)',
  },
  beachhouse: {
    src: '/source/bg-beachhouse.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #b7cfe3 45%, #8ab4c8 100%)',
  },
  island: {
    src: '/source/bg-island.webp',
    fallbackGradient:
      'linear-gradient(165deg, #e3edf7 0%, #c5d6bc 40%, #6a9e7e 100%)',
  },
};

/** All background URLs for preloading */
export const ALL_BG_URLS: string[] = [
  BG_TITLE.src,
  BG_VALLEY.src,
  ...Object.values(BG_SHELTERS).map((e) => e.src),
];
