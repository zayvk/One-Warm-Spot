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

/** Rooftop poses + the downstairs action poses (`reach` high shelves, `peek` low/under things, `fix` hands-on repairs) */
export type TravelerPose = 'idle' | 'walk' | 'search' | 'sit' | 'sleep' | 'reach' | 'peek' | 'fix';

export const TRAVELER_POSES: readonly TravelerPose[] = ['idle', 'walk', 'search', 'sit', 'sleep', 'reach', 'peek', 'fix'];

/** Single-image pose (`walk` is the still stride used when motion is reduced) */
export function travelerSpriteSrc(gender: TravelerGender, pose: TravelerPose): string {
  return `/source/sprites/${gender}-${pose}.webp`;
}

/** The 4-frame walk cycle (frames 1 & 3 are the foot-contact strides) */
export function travelerWalkFrames(gender: TravelerGender): string[] {
  return [1, 2, 3, 4].map((n) => `/source/sprites/${gender}-walk-${n}.webp`);
}

/** All traveler sprite URLs (poses + walk frames) for preloading */
export const ALL_TRAVELER_SPRITES: string[] = (['female', 'male'] as TravelerGender[]).flatMap((g) => [
  ...TRAVELER_POSES.map((p) => travelerSpriteSrc(g, p)),
  ...travelerWalkFrames(g),
]);

/* ───── Scene Stages ───── */

export const SCENE_STAGES: Partial<Record<SiteId, string>> = {
  terrace: '/source/scenes/terrace-stage.webp',
};

/* ───── Scene Props ───── */

export const SCENE_PROPS = {
  /* Fire pit: T1 makeshift twigs → T2 stacked logs → T3 stone-ring hearth */
  firepitT1: '/source/props/prop-firepit-t1.webp',
  firepitT2: '/source/props/prop-firepit-t2.webp',
  firepit: '/source/props/prop-firepit.webp',
  'prop-boxes-intact': '/source/props/prop-boxes-intact.webp',
  'prop-boxes-cleared': '/source/props/prop-boxes-cleared.webp',
  'prop-weeds-1': '/source/props/prop-weeds-1.webp',
  'prop-weeds-2': '/source/props/prop-weeds-2.webp',
  /* Shelter: T1 cloth lean-to → T2 timber shelter → T3 insulated hut */
  clothShed: '/source/props/prop-cloth-shed.webp',
  shedUpgraded: '/source/props/prop-shed-upgraded.webp',
  shelterT3: '/source/props/prop-shelter-t3.webp',
  boxSingle: '/source/props/prop-box-single.webp',
  boxDouble: '/source/props/prop-box-double.webp',
  /* Light cardboard cartons the wind blows onto the roof */
  cardboard1: '/source/props/prop-cardboard-1.webp',
  cardboard2: '/source/props/prop-cardboard-2.webp',
  cardboard3: '/source/props/prop-cardboard-3.webp',
  weeds3: '/source/props/prop-weeds-3.webp',
  /* Farm planter: T1 seedling crate → T2 herb planter → T3 trellised garden bed */
  planterT1: '/source/props/prop-planter-t1.webp',
  planter: '/source/props/prop-planter.webp',
  planterT3: '/source/props/prop-planter-t3.webp',
  /* Rainwater: T1 bucket barrel → T2 rain barrel → T3 guttered barrel rig */
  barrelT1: '/source/props/prop-barrel-t1.webp',
  rainBarrel: '/source/props/prop-rain-barrel.webp',
  barrelT3: '/source/props/prop-barrel-t3.webp',
  /* Cooking: T1 grill rack → T2 camp grill → T3 grill counter → T4 hearth kitchen */
  grillT1: '/source/props/prop-grill-rack.webp',
  grillT2: '/source/props/prop-grill-t1.webp',
  grillT3: '/source/props/prop-grill-t2.webp',
  grillT4: '/source/props/prop-grill-t3.webp',
  /* Sewing / knitting: needle → scraps → knitting basket → workbench → sewing table */
  sewT1: '/source/props/prop-sew-needle.webp',
  sewT2: '/source/props/prop-sew-scraps.webp',
  sewT3: '/source/props/prop-knit-t1.webp',
  sewT4: '/source/props/prop-knit-t2.webp',
  sewT5: '/source/props/prop-knit-t3.webp',
} as const;

export type PropId = keyof typeof SCENE_PROPS;

/* ───── Brand / UI Art ───── */

export const UI_ASSETS = {
  /** Full "One Warm Spot" wordmark with ivy & lantern (Title Screen) */
  logoTitle: '/source/ui/logo-title.webp',
  /** Round lantern crest (About header, HUD badge, loading emblem) */
  logoEmblem: '/source/ui/logo-emblem.webp',
} as const;

/* ───── Arrival Cutscene Art ───── */

/** Terrace elevator arrival: lobby → riding up → doors open onto the roof */
export const CUTSCENE_ASSETS = {
  /** Floor 1 · Ground Lobby (also the arrival cutscene's opening plate) */
  terraceLobby: '/source/cutscenes/terrace-lobby.webp',
  /** Floor 2 · Residential Hallway */
  terraceFloor2: '/source/cutscenes/terrace-floor-2.webp',
  /** Floor 3 · Utility Corridor */
  terraceFloor3: '/source/cutscenes/terrace-floor-3.webp',
  /** Floor 4 · Skylight Landing */
  terraceFloor4: '/source/cutscenes/terrace-floor-4.webp',
  /** Lift interior with a transparent doorway cutout */
  terraceLiftFrame: '/source/cutscenes/terrace-lift-frame.webp',
  /** One lift door panel (mirrored for the right half) */
  terraceLiftDoor: '/source/cutscenes/terrace-lift-door.webp',
} as const;

/* ───── Jigsaw Paintings ───── */

export interface JigsawImage {
  id: string;
  /** Short cozy caption shown under the finished puzzle */
  title: string;
  src: string;
  /** false = a wide shelter backdrop; the puzzle centre-crops it to a square */
  square: boolean;
}

/**
 * The Jigsaw mini-game's painting pool: 15 dedicated 640×640 illustrations plus a few
 * centre-cropped shelter scenes for variety. Deliberately absent from every preload
 * list — the puzzle loads only the one painting it picks.
 */
export const JIGSAW_IMAGES: readonly JigsawImage[] = [
  { id: 'crater', title: 'Overgrown Craters', src: '/source/jigsaw/jigsaw-01-crater.webp', square: true },
  { id: 'letter', title: 'Faded Letter', src: '/source/jigsaw/jigsaw-02-letter.webp', square: true },
  { id: 'campfire', title: 'Twilight Campfire', src: '/source/jigsaw/jigsaw-03-campfire.webp', square: true },
  { id: 'couple', title: 'Hand in Hand', src: '/source/jigsaw/jigsaw-04-couple.webp', square: true },
  { id: 'bed', title: 'Sunlit Bedroom', src: '/source/jigsaw/jigsaw-05-bed.webp', square: true },
  { id: 'clock', title: 'Stopped Clock', src: '/source/jigsaw/jigsaw-06-clock.webp', square: true },
  { id: 'map', title: 'Old Road Map', src: '/source/jigsaw/jigsaw-07-map.webp', square: true },
  { id: 'radio', title: 'Quiet Radio', src: '/source/jigsaw/jigsaw-08-radio.webp', square: true },
  { id: 'windowsill', title: 'Windowsill Garden', src: '/source/jigsaw/jigsaw-09-windowsill.webp', square: true },
  { id: 'telescope', title: 'Stargazing Rooftop', src: '/source/jigsaw/jigsaw-10-telescope.webp', square: true },
  { id: 'bicycle', title: 'Rusted Bicycle', src: '/source/jigsaw/jigsaw-11-bicycle.webp', square: true },
  { id: 'bookshelf', title: 'Mossy Bookshelf', src: '/source/jigsaw/jigsaw-12-bookshelf.webp', square: true },
  { id: 'bridge', title: 'Willow Bridge', src: '/source/jigsaw/jigsaw-13-bridge.webp', square: true },
  { id: 'tea', title: 'Afternoon Tea', src: '/source/jigsaw/jigsaw-14-tea.webp', square: true },
  { id: 'conservatory', title: 'Glass Conservatory', src: '/source/jigsaw/jigsaw-15-conservatory.webp', square: true },
  { id: 'scene-terrace', title: 'Old Apartment Terrace', src: BG_SHELTERS.terrace.src, square: false },
  { id: 'scene-valley', title: 'Quiet Valley', src: BG_VALLEY.src, square: false },
  { id: 'scene-tree', title: 'Abandoned Treehouse', src: BG_SHELTERS.tree.src, square: false },
  { id: 'scene-pipe', title: 'Giant Storm Pipe', src: BG_SHELTERS.pipe.src, square: false },
];

/** All background URLs for preloading */
export const ALL_BG_URLS: string[] = [
  BG_TITLE.src,
  BG_VALLEY.src,
  ...Object.values(BG_SHELTERS).map((e) => e.src),
];
