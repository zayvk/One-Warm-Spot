import {
  Application,
  Assets,
  BlurFilter,
  Circle,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type Ticker,
} from 'pixi.js';
import type { DayPhase, ResourceId, SiteId, TimeOfDay, TravelerGender, Weather } from '../types/game.ts';
import type {
  AssignableStationId,
  BuildSlotConfig,
  HotspotConfig,
  SceneObstacle,
  ShelterSceneConfig,
  StationConfig,
  StationId,
  StationTierConfig,
} from '../data/scenes/types.ts';
import { BG_SHELTERS, travelerSpriteSrc, travelerWalkFrames, SCENE_STAGES, TRAVELER_POSES } from '../data/media.ts';
import type { TravelerPose } from '../data/media.ts';
import { RESOURCE_MAP } from '../data/resources.ts';
import { getSceneConfig } from '../data/scenes/index.ts';
import { DEFAULT_TERRACE_SPAWNS, withTerraceSpawns } from '../data/scenes/terrace.ts';
import { MENDING_PERKS, RECIPES, type Recipe } from '../data/recipes.ts';
import {
  loadTerraceState,
  saveTerraceState,
  stationTiersOf,
  STATION_TIER_KEY,
  type TerraceState,
} from '../engine/terraceState.ts';
import {
  barrelCollect,
  nextStationTier,
  planterHarvest,
  sleepComfort,
  stationRequirementHint,
  stationTierConfig,
  type StationTiers,
} from '../engine/stations.ts';
import type { SleepComfort } from '../engine/dayCycle.ts';
import type { RegrowOutcome } from '../engine/terraceSpawns.ts';
import { placeStationInSlot, type SlotAssignments } from '../engine/buildSlots.ts';
import { fitStage, stageLeavesGaps } from '../engine/stageFit.ts';
import { mergeMaterials, windBoxBonus } from '../engine/weather.ts';
import { WeatherLayer, type WeatherFrame } from './weatherLayer.ts';

/** Hotspot type a slot takes on once a station is placed in it */
const STATION_HOTSPOT_TYPE: Partial<Record<StationId, HotspotConfig['type']>> = {
  planter: 'planter',
  barrel: 'barrel',
  grill: 'grill',
  sewing: 'sewing',
};

const BUILD_HERE_LABEL = 'Build here';
import {
  playFireLight,
  playFireDouse,
  setCampfireAudio,
  playRummage,
  playWeedCut,
  playSleep as playSleepSfx,
  playRest as playRestSfx,
  playFootstep,
  playBuild,
  playClaim,
  playCook,
  playHarvest,
  playLogStack,
  playSew,
  playStoneSet,
  playWaterChime,
} from '../audio/soundEngine.ts';

/* ═══════════════════════════════════════════
   Public state contract
   ═══════════════════════════════════════════ */

export interface ShelterSceneState {
  siteId: SiteId | null;
  timeOfDay: TimeOfDay;
  dayPhase: DayPhase;
  built: readonly string[];
  lanternLit: boolean;
  cozyIndex: number;
  reduceMotion: boolean;
  gender: TravelerGender;
  /** Today's weather: live rain / wind visuals and the rooftop's weather perks */
  weather: Weather;
}

/** Where found materials came from (gathering costs Stamina; daily station yields don't) */
export type RewardSource = 'weeds' | 'searchable' | 'harvest';

/** Callback when a hotspot interaction awards resources */
export type RewardCallback = (reward: Record<string, number>, source?: RewardSource) => void;

/** Callback when the traveler rests by the shelter during day/dusk */
export type RestCallback = () => void;

/**
 * Callback when the traveler sleeps until morning during night (comfort from shelter
 * tier & perks). Returns the rooftop's overnight regrowth, if any, so it can pop in.
 */
export type SleepCallback = (comfort: SleepComfort) => RegrowOutcome<TerraceState> | null | void;

/** Pays for an in-scene build (materials + build stamina); returns false if the materials ran short */
export type BuildCallback = (cost: Partial<Record<ResourceId, number>>) => boolean;

/** Spends materials only (firewood, mending); returns false if short */
export type SpendCallback = (cost: Partial<Record<ResourceId, number>>) => boolean;

/** Eats a grill recipe; returns false if the ingredients ran short */
export type CookCallback = (recipe: Recipe) => boolean;

/** Station progress & daily readiness, mirrored to the React station menus and popovers */
export interface SceneStationState {
  tiers: StationTiers;
  pending: StationId | null;
  fireLit: boolean;
  perks: string[];
  planterReady: boolean;
  barrelReady: boolean;
  /** Which station stands in each flexible build slot */
  slots: SlotAssignments;
}
export type StationStateCallback = (state: SceneStationState) => void;

/** Open the Cooking / Mending popover anchored above a station (screen pixels) */
export type StationOpenCallback = (station: 'grill' | 'sewing', anchor: { x: number; y: number }) => void;

/** Callback when a station (or empty blueprint) opens its contextual action menu */
export type StationMenuCallback = (stationId: StationId, anchor: { x: number; y: number }) => void;

/** Callback when an empty build slot opens its "what to build here" menu */
export type SlotMenuCallback = (slotId: string, anchor: { x: number; y: number }) => void;

export type StationMenuAction = 'primary' | 'sit' | 'extinguish' | 'upgrade';

export type StationActionResult = { ok: true } | { ok: false; message: string };

/** Gentle toast request (firewood hints, doors without a destination) */
export type NoticeCallback = (message: string, icon?: string) => void;

/** The traveler reached a door hotspot; return true if it leads somewhere (e.g. `stairwell-door`) */
export type DoorCallback = (doorId: string) => boolean;

/* ═══════════════════════════════════════════
   Lighting presets
   ═══════════════════════════════════════════ */

type RGB = [number, number, number];

interface Lighting {
  mul: RGB; mulAlpha: number;
  scr: RGB; scrAlpha: number;
  sun: RGB; sunAlpha: number; sunX: number; sunY: number;
  lantern: number; markerGlow: number;
  nightFactor: number;
  fireIntensity: number;
}

function hex(c: number): RGB {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

const LIGHTING_TWEEN_MS = 1400;

/* Rain: a cool, misty overcast blended into whatever the day phase is doing */
const OVERCAST_MUL: RGB = [180, 194, 207];
const OVERCAST_TINT_MIX = 0.45;
/** Weeds sway gently in the wind (rad), a touch more in each gust */
const WEED_SWAY = 0.045;

const PHASE_LIGHTING: Record<DayPhase, Lighting> = {
  day: {
    mul: hex(0xfff0d6), mulAlpha: 0.16,
    scr: hex(0xffd690), scrAlpha: 0.10,
    sun: hex(0xffe2a6), sunAlpha: 0.44, sunX: 0.22, sunY: 0.08,
    lantern: 0, markerGlow: 0.75,
    nightFactor: 0,
    fireIntensity: 0.36,
  },
  dusk: {
    mul: hex(0xf0a078), mulAlpha: 0.52,
    scr: hex(0xff9a5c), scrAlpha: 0.12,
    sun: hex(0xffa860), sunAlpha: 0.52, sunX: 0.84, sunY: 0.42,
    lantern: 0.72, markerGlow: 1.0,
    nightFactor: 0,
    fireIntensity: 0.58,
  },
  night: {
    mul: hex(0x3a4878), mulAlpha: 0.68,
    scr: hex(0x1a2240), scrAlpha: 0.05,
    sun: hex(0xdbe6ff), sunAlpha: 0.16, sunX: 0.78, sunY: 0.10,
    lantern: 1.0, markerGlow: 1.15,
    nightFactor: 1,
    fireIntensity: 0.76,
  },
};

/* ═══════════════════════════════════════════
   Fallback Walkable Area (for non-custom sites)
   ═══════════════════════════════════════════ */

const FALLBACK_WALK_AREA = { xMin: 0.12, xMax: 0.88, yMin: 0.60, yMax: 0.88 };
const FALLBACK_ENTRY = { x: -0.05, y: 0.78 };
const FALLBACK_IDLE = { x: 0.42, y: 0.76 };

/** Assumed backdrop aspect until the stage texture has loaded (painted stages are 1376×768) */
const DEFAULT_STAGE_ASPECT = 1376 / 768;

/** Warm neutral base shown only if a stage backdrop fails to load */
const NEUTRAL_BACKDROP = 0xf5efe4;
/** Soft fade of the whole scene once the backdrop is decoded */
const STAGE_REVEAL_MS = 220;

/** The painted stage for a shelter, or its selector background as a fallback */
export function sceneBackdropSrc(siteId: SiteId): string {
  return SCENE_STAGES[siteId] ?? BG_SHELTERS[siteId].src;
}

/** Warm the Pixi asset cache (e.g. during the arrival cutscene) so the scene reveals instantly */
export function preloadSceneBackdrop(siteId: SiteId): void {
  void Assets.load<Texture>(sceneBackdropSrc(siteId)).catch(() => {});
}

/** On-screen rectangle of the cover-fitted backdrop; all scene coords are normalized to it */
interface StageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* ═══════════════════════════════════════════
   Anatomical Per-Pose Proportions & Shadows
   ═══════════════════════════════════════════ */

const BASE_STANDING_HEIGHT_RATIO = 0.22;

const POSE_HEIGHT_SCALE: Record<TravelerPose, number> = {
  idle: 1.00,
  walk: 1.00,
  search: 0.72,
  sit: 0.68,
  sleep: 0.36,
  /* Downstairs action poses (ready for the scavenging rooms) */
  reach: 1.00,
  fix: 1.00,
  peek: 0.60,
};

const POSE_SHADOW: Record<TravelerPose, { rx: number; ry: number; alpha: number }> = {
  idle: { rx: 0.23, ry: 0.052, alpha: 0.24 },
  walk: { rx: 0.23, ry: 0.052, alpha: 0.24 },
  search: { rx: 0.28, ry: 0.058, alpha: 0.22 },
  sit: { rx: 0.31, ry: 0.062, alpha: 0.20 },
  sleep: { rx: 0.44, ry: 0.068, alpha: 0.18 },
  reach: { rx: 0.24, ry: 0.052, alpha: 0.24 },
  fix: { rx: 0.26, ry: 0.056, alpha: 0.23 },
  peek: { rx: 0.36, ry: 0.064, alpha: 0.2 },
};

/* 4-frame walk cycle: frames 1 & 3 (indices 0 & 2) are foot contacts */
const WALK_FRAME_MS = 160;
/** The calm stairwell entry stroll steps more slowly */
const STROLL_FRAME_MS = 240;
const WALK_BOB_PX = 3;

/* ═══════════════════════════════════════════
   Fire Pit Tiers — flame, embers, smoke & glow
   ═══════════════════════════════════════════ */

interface FireProfile {
  /** Flame height multiplier (Tier 1 = the original modest flame) */
  flame: number;
  /** Extra side flame tongues around the main flame */
  tongues: number;
  /** Ember spawn chance per frame */
  emberChance: number;
  /** Glow pool size & brightness multipliers */
  glowScale: number;
  glowBoost: number;
  /** Extra glow growth at night */
  nightGlow: number;
  glowTint: number;
  /** Pulsing coal bed at the base */
  coals: boolean;
  /** Translucent smoke wisp spawn chance per frame */
  smokeChance: number;
  /** Campfire crackle level (0–1) */
  crackle: number;
}

type FirepitTier = 1 | 2 | 3;

const FIRE_TIERS: Record<FirepitTier, FireProfile> = {
  1: { flame: 1, tongues: 0, emberChance: 0.16, glowScale: 1, glowBoost: 1, nightGlow: 0.1, glowTint: 0xff8030, coals: false, smokeChance: 0, crackle: 0.72 },
  2: { flame: 1.4, tongues: 2, emberChance: 0.32, glowScale: 1.35, glowBoost: 1.18, nightGlow: 0.12, glowTint: 0xff8a36, coals: false, smokeChance: 0, crackle: 0.86 },
  3: { flame: 1.65, tongues: 4, emberChance: 0.5, glowScale: 1.75, glowBoost: 1.36, nightGlow: 0.16, glowTint: 0xffa042, coals: true, smokeChance: 0.045, crackle: 1 },
};

/** Gentle stroll pace for the arrival walk out of the stairwell */
const ENTRY_STROLL_MS = 2000;
const ENTRY_PAUSE_MS = 280;

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface StarNode {
  sprite: Graphics;
  nx: number;
  ny: number;
  phase: number;
  speed: number;
  baseAlpha: number;
}

interface FireflyNode {
  sprite: Graphics;
  nx: number;
  ny: number;
  vx: number;
  vy: number;
  phase: number;
  speed: number;
}

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function toHex([r, g, b]: RGB): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function cloneLighting(l: Lighting): Lighting {
  return { ...l, mul: [...l.mul] as RGB, scr: [...l.scr] as RGB, sun: [...l.sun] as RGB };
}

function createRadialTexture(): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(0.65, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return Texture.from(canvas);
}

/** "+2 🪵  +1 🧵" style material line */
function formatMaterials(materials: Record<string, number | undefined>, sign = ''): string {
  return Object.entries(materials)
    .filter(([, v]) => v)
    .map(([k, v]) => `${sign}${v} ${RESOURCE_MAP[k]?.emoji ?? k}`)
    .join('  ');
}

/** Rummaged boxes without a dedicated "cleared" sprite get a soft, dusty tint */
const SEARCHED_TINT = 0xcfc5b8;

/* ═══════════════════════════════════════════
   Hotspot & Particle Types
   ═══════════════════════════════════════════ */

interface HotspotNode {
  config: HotspotConfig;
  root: Container;
  propSprite: Sprite | null;
  /** The sprite URL this node should currently show (guards late texture loads) */
  spriteSrc: string;
  label: Text;
  labelPill: Graphics;
  hovered: boolean;
  interacted: boolean;
  /** Station hotspots: floor blueprint shown while the station is still unbuilt (tier 0) */
  blueprint: Graphics | null;
  /** Station hotspots: warm window / lantern glows for the current tier */
  glows: { sprite: Sprite; anchor: { x: number; y: number; size: number } }[];
  /** Flexible build slots: the slot this hotspot is (empty, or hosting a placed station) */
  slot?: BuildSlotConfig;
}

interface SceneParticle {
  sprite: Graphics;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  /** Smoke: soft fade in/out at this peak alpha and expand as it rises */
  smoke?: { peakAlpha: number; grow: number };
}

/* ═══════════════════════════════════════════
   ShelterScene — Interactive point-and-click
   ═══════════════════════════════════════════ */

export class ShelterScene {
  private readonly app: Application;
  private readonly radial: Texture;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  /* Layers: bg (+ floorHit) → lighting → worldLayer (Y-sorted props & traveler) → warmth/fx → labels */
  private readonly bgLayer = new Container();
  private readonly floorHit = new Graphics();
  private bgSprite: Sprite | null = null;
  private bgFill: Sprite | null = null;
  private bgFallback: Graphics | null = null;
  private bgToken = 0;

  private readonly mulWash: Sprite;
  private readonly scrWash: Sprite;
  private readonly sunGlow: Sprite;
  private readonly warmth: Sprite;

  /* Y-sorted world layer (props + traveler share this container) */
  private readonly worldLayer = new Container();

  /* Traveler */
  private readonly travelerNode = new Container();
  private travelerSprite: Sprite | null = null;
  private travelerShadow: Graphics;
  private currentPose: TravelerPose = 'idle';
  /* Walk-cycle textures for the current traveler (empty until loaded) */
  private walkFrames: Texture[] = [];
  private walkFramesGender: TravelerGender | null = null;
  private walkFrameIndex = 0;
  private walkFrameElapsed = 0;
  private poseToken = 0;
  private poseScaleMultiplier = 1;
  private targetX = 0.40;
  private targetY = 0.73;
  private travelerFlipped = false;
  private walkingTo: { x: number; y: number } | null = null;
  /** Normalized units per ms for the current walk (null = normal pace) */
  private walkSpeed: number | null = null;
  private breathPhase = 0;
  private footstepAccum = 0;

  /* Hotspots */
  private readonly labelLayer = new Container();
  private hotspots: HotspotNode[] = [];
  private sceneConfig: ShelterSceneConfig | null = null;

  /* Multi-tier stations */
  private pendingStation: StationId | null = null;
  private onBuild: BuildCallback | null = null;
  private onSpend: SpendCallback | null = null;
  private onCook: CookCallback | null = null;
  private onStationState: StationStateCallback | null = null;
  private onStationOpen: StationOpenCallback | null = null;
  private onStationMenu: StationMenuCallback | null = null;
  private onSlotMenu: SlotMenuCallback | null = null;
  private onCanAfford: ((cost: Partial<Record<ResourceId, number>>) => boolean) | null = null;
  private onNotice: NoticeCallback | null = null;
  private onDoor: DoorCallback | null = null;
  private onReady: (() => void) | null = null;

  /* Fire, Stars, Fireflies & Burst Particles */
  private readonly starLayer = new Container();
  private readonly fireflyLayer = new Container();
  private readonly fxLayer = new Container();
  private stars: StarNode[] = [];
  private fireflies: FireflyNode[] = [];
  private fireLit = false;
  private fireFlames: Graphics | null = null;
  private fireGlow: Sprite | null = null;
  private particles: SceneParticle[] = [];
  /* Live rain / wind (above the props & traveler, below the labels) */
  private readonly weatherLayer: WeatherLayer;
  /** Reused every frame (no per-frame allocation) */
  private readonly weatherFrame: WeatherFrame = {
    dtMs: 0,
    elapsedSec: 0,
    width: 1,
    height: 1,
    stage: { x: 0, y: 0, width: 1, height: 1 },
    nightFactor: 0,
    floor: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
  };

  /* Interaction & Sleep State */
  private interactionLock = false;
  private pendingCallback: (() => void) | null = null;
  private sleepMode = false;
  /** While asleep, sort just above the shelter so the traveler lies on its bedding */
  private sleepZ: number | null = null;
  private onRest: RestCallback | null = null;
  private onSleep: SleepCallback | null = null;

  /* State */
  private state: ShelterSceneState;
  private current: Lighting;
  private lightFrom: Lighting;
  private target: Lighting;
  private lightTweenMS = LIGHTING_TWEEN_MS;
  private warmthCurrent = 0;
  private elapsed = 0;
  private width: number;
  private height: number;
  private entryDone = false;
  private entryStarted = false;
  /** Backdrop texture resolved (or failed) — the stage veil may lift */
  private backdropReady = false;
  private terrace: TerraceState;
  private disposed = false;
  /** Cover-fitted backdrop rect — props, colliders and walk bounds are anchored to it */
  private stage: StageRect = { x: 0, y: 0, width: 1, height: 1 };

  /* Reward callback */
  private onReward: RewardCallback | null = null;

  constructor(app: Application, initial: ShelterSceneState) {
    this.app = app;
    this.radial = createRadialTexture();
    this.state = initial;
    const initLighting = PHASE_LIGHTING[initial.dayPhase];
    this.current = cloneLighting(initLighting);
    this.lightFrom = cloneLighting(initLighting);
    this.target = initLighting;
    this.warmthCurrent = this.warmthTarget();
    this.width = app.screen.width;
    this.height = app.screen.height;
    this.updateStageRect();
    this.terrace = loadTerraceState();

    /* Floor click catcher at base of bgLayer (no stage.hitArea so child hotspots receive hits) */
    this.floorHit.eventMode = 'static';
    this.floorHit.cursor = 'crosshair';
    this.floorHit.on('pointerdown', this.handleFloorPointerDown, this);
    this.bgLayer.addChild(this.floorHit);

    /* Lighting washes (non-interactive) */
    this.mulWash = new Sprite(Texture.WHITE);
    this.mulWash.blendMode = 'multiply';
    this.mulWash.eventMode = 'none';
    this.scrWash = new Sprite(Texture.WHITE);
    this.scrWash.blendMode = 'screen';
    this.scrWash.eventMode = 'none';
    this.sunGlow = new Sprite(this.radial);
    this.sunGlow.anchor.set(0.5);
    this.sunGlow.blendMode = 'screen';
    this.sunGlow.eventMode = 'none';
    this.warmth = new Sprite(this.radial);
    this.warmth.anchor.set(0.5);
    this.warmth.blendMode = 'add';
    this.warmth.tint = 0xffb060;
    this.warmth.eventMode = 'none';

    /* Y-sorted world layer */
    this.worldLayer.sortableChildren = true;

    /* Traveler container & shadow (passive/none so props underneath stay clickable) */
    this.travelerNode.eventMode = 'none';
    this.travelerShadow = new Graphics();
    this.travelerNode.addChild(this.travelerShadow);
    this.worldLayer.addChild(this.travelerNode);

    /* Non-interactive FX, night sky & label overlays */
    this.starLayer.eventMode = 'none';
    this.fireflyLayer.eventMode = 'none';
    this.fxLayer.eventMode = 'none';
    this.labelLayer.eventMode = 'none';
    this.weatherLayer = new WeatherLayer(this.radial);
    this.weatherLayer.setWeather(this.sceneWeather(initial), initial.reduceMotion);

    /* Stage layer order */
    app.stage.addChild(
      this.bgLayer,
      this.mulWash,
      this.scrWash,
      this.sunGlow,
      this.starLayer,
      this.worldLayer,
      this.warmth,
      this.fxLayer,
      this.weatherLayer.container,
      this.fireflyLayer,
      this.labelLayer,
    );

    this.sceneConfig = this.resolveSceneConfig(initial.siteId);
    this.preloadTravelerPoses(initial.gender);
    this.buildNightEffects();
    this.buildHotspots();
    this.loadTraveler(initial.gender, 'idle');
    this.restoreTerraceState();
    this.layout();
    this.applyLighting();
    /* Stage stays veiled until the backdrop is ready; the reveal then starts the entry walk */
    app.stage.alpha = 0;
    this.loadBackground(initial.siteId);

    app.ticker.add(this.update, this);
  }

  /* ── Public API ── */

  setState(next: ShelterSceneState): void {
    const prev = this.state;
    this.state = next;
    if (next.siteId !== prev.siteId) {
      this.sceneConfig = this.resolveSceneConfig(next.siteId);
      this.loadBackground(next.siteId);
      this.buildHotspots();
      this.restoreTerraceState();
      this.emitStationState();
    }
    if (next.gender !== prev.gender) {
      this.preloadTravelerPoses(next.gender);
      this.loadTraveler(next.gender, this.currentPose);
    }
    if (next.dayPhase !== prev.dayPhase || next.siteId !== prev.siteId || next.weather !== prev.weather) {
      this.refreshStationLabels();
    }
    this.weatherLayer.setWeather(this.sceneWeather(next), next.reduceMotion);
    const desired = this.sleepMode ? PHASE_LIGHTING.night : PHASE_LIGHTING[next.dayPhase];
    if (desired !== this.target || next.reduceMotion !== prev.reduceMotion) {
      this.startLightingTween(desired);
    }
    if (next.reduceMotion) {
      this.current = cloneLighting(this.target);
      this.lightFrom = cloneLighting(this.target);
      this.lightTweenMS = LIGHTING_TWEEN_MS;
      this.warmthCurrent = this.warmthTarget();
    }
    this.layout();
    this.applyLighting();
  }

  private startLightingTween(nextTarget: Lighting): void {
    this.lightFrom = cloneLighting(this.current);
    this.target = nextTarget;
    this.lightTweenMS = this.state.reduceMotion ? LIGHTING_TWEEN_MS : 0;
  }

  /** Live weather plays on the open-air Terrace only */
  private sceneWeather(state: ShelterSceneState): Weather {
    return state.siteId === 'terrace' ? state.weather : 'clear';
  }

  setRewardCallback(cb: RewardCallback): void {
    this.onReward = cb;
  }

  setRestCallback(cb: RestCallback): void {
    this.onRest = cb;
  }

  setSleepCallback(cb: SleepCallback): void {
    this.onSleep = cb;
  }

  setBuildCallback(cb: BuildCallback): void {
    this.onBuild = cb;
  }

  setSpendCallback(cb: SpendCallback): void {
    this.onSpend = cb;
  }

  setCookCallback(cb: CookCallback): void {
    this.onCook = cb;
  }

  setStationOpenCallback(cb: StationOpenCallback): void {
    this.onStationOpen = cb;
  }

  setStationMenuCallback(cb: StationMenuCallback): void {
    this.onStationMenu = cb;
  }

  setSlotMenuCallback(cb: SlotMenuCallback): void {
    this.onSlotMenu = cb;
  }

  setCanAffordCallback(cb: (cost: Partial<Record<ResourceId, number>>) => boolean): void {
    this.onCanAfford = cb;
  }

  setStationStateCallback(cb: StationStateCallback): void {
    this.onStationState = cb;
    this.emitStationState();
  }

  setNoticeCallback(cb: NoticeCallback): void {
    this.onNotice = cb;
  }

  setDoorCallback(cb: DoorCallback | null): void {
    this.onDoor = cb;
  }

  /** Fires once the stage backdrop is decoded and the scene starts fading in */
  setReadyCallback(cb: () => void): void {
    this.onReady = cb;
    if (this.backdropReady) cb();
  }

  /**
   * Walk over and build a station's next tier. Returns false if the scene is busy
   * or the station is unknown/maxed; materials are paid on arrival.
   */
  requestBuild(stationId: string): boolean {
    if (this.disposed || this.interactionLock || !this.entryDone) return false;
    const station = this.sceneConfig?.stations?.find((s) => s.id === stationId);
    const hs = station && this.stationHotspot(station);
    if (!station || !hs) return false;
    const next = nextStationTier(station, this.tierOf(station.id));
    if (!next) return false;
    this.walkAndBuild(station, hs, next, station.buildStandOffset ?? hs.config.standOffset ?? { dx: 0, dy: 0.045 });
    return true;
  }

  /**
   * Walk to an empty build slot and place a not-yet-built station there (Tier 1).
   * Returns false if the scene is busy, the slot is taken or the station is already placed.
   */
  requestBuildInSlot(slotId: string, stationId: AssignableStationId): boolean {
    if (this.disposed || this.interactionLock || !this.entryDone) return false;
    const hs = this.hotspots.find((h) => h.slot?.id === slotId);
    const station = this.sceneConfig?.stations?.find((s) => s.assignableId === stationId);
    if (!hs?.slot || !station || hs.config.type !== 'slot' || this.tierOf(station.id) !== 0) return false;
    if (!placeStationInSlot(this.terrace.slotAssignments, slotId, stationId)) return false;
    const next = nextStationTier(station, 0);
    if (!next) return false;
    this.walkAndBuild(station, hs, next, hs.slot.standOffset, slotId);
    return true;
  }

  private walkAndBuild(
    station: StationConfig,
    hs: HotspotNode,
    next: StationTierConfig,
    standOffset: { dx: number; dy: number },
    slotId?: string,
  ): void {
    if (this.sleepMode || this.currentPose === 'sleep') this.wakeUp();
    for (const h of this.hotspots) if (h.hovered) this.onHotspotHover(h, false);

    this.interactionLock = true;
    this.pendingStation = station.id;
    this.emitStationState();

    const pos = hs.config.position;
    const stand = this.clampFloorTarget(pos.x + standOffset.dx, pos.y + standOffset.dy);
    const arrive = () => {
      if (Math.abs(pos.x - this.targetX) > 0.005) {
        this.travelerFlipped = pos.x < this.targetX;
        this.layoutTraveler();
      }
      this.performBuild(station, hs, next, slotId);
    };
    if (Math.hypot(stand.x - this.targetX, stand.y - this.targetY) < 0.015) {
      arrive();
    } else {
      this.walkTo(stand.x, stand.y, arrive);
    }
  }

  /** Run a station action chosen from the in-world PropActionMenu */
  performStationAction(stationId: string, action: StationMenuAction): boolean {
    if (this.disposed || this.interactionLock || !this.entryDone) return false;
    if (action === 'upgrade') return this.requestBuild(stationId);

    const station = this.sceneConfig?.stations?.find((s) => s.id === stationId);
    const hs = station && this.stationHotspot(station);
    if (!station || !hs || this.tierOf(station.id) === 0) return false;

    if (hs.config.type === 'planter' && !this.terrace.planterReady) {
      this.showFloatingText(this.stationTop(hs, 0.6), 'Growing — ready tomorrow');
      return false;
    }
    if (hs.config.type === 'barrel' && !this.terrace.barrelReady) {
      this.showFloatingText(this.stationTop(hs, 0.6), 'Filling — ready tomorrow');
      return false;
    }

    if (action === 'sit' && hs.config.type === 'firepit') {
      if (!this.fireLit) return false;
      this.walkToHotspotAndRun(hs, false, () => {
        this.setPose('sit');
        this.after(200, () => {
          this.interactionLock = false;
        });
      });
      return true;
    }

    if (action === 'extinguish' && hs.config.type === 'firepit') {
      if (!this.fireLit) return false;
      this.walkToHotspotAndRun(hs, false, () => this.interactFirepit(hs));
      return true;
    }

    const isRestTurn = hs.config.type === 'sleep' && this.state.dayPhase !== 'night';
    this.walkToHotspotAndRun(hs, isRestTurn, () => {
      if (isRestTurn) this.interactRest();
      else this.executeInteraction(hs);
    });
    return true;
  }

  /** Cook a grill recipe (called from the Cooking popover while standing at the grill) */
  cook(recipeId: string): StationActionResult {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe || this.disposed) return { ok: false, message: 'Unknown recipe' };
    if (this.terrace.grillTier < recipe.minTier) return { ok: false, message: stationRequirementHint('grill', recipe.minTier) };
    if (recipe.needsFire && !this.fireLit) return { ok: false, message: 'Light the fire pit first' };
    if (!(this.onCook?.(recipe) ?? false)) return { ok: false, message: 'Not enough ingredients' };

    playCook();
    const hs = this.hotspots.find((h) => h.config.type === 'grill');
    if (hs) {
      const lift = this.stationTop(hs, 0.85);
      this.spawnSteam(lift);
      const gains = [recipe.stamina ? `+${recipe.stamina} ⚡` : '', recipe.strength ? `+${recipe.strength} ❤️` : '']
        .filter(Boolean)
        .join('  ');
      this.showFloatingText(lift, `${recipe.icon} ${gains}`);
    }
    return { ok: true };
  }

  /** Craft a permanent mending perk (called from the Mending popover) */
  craftPerk(perkId: string): StationActionResult {
    const perk = MENDING_PERKS.find((p) => p.id === perkId);
    if (!perk || this.disposed) return { ok: false, message: 'Unknown craft' };
    if (this.terrace.craftedPerks.includes(perk.id)) return { ok: false, message: 'Already crafted' };
    if (this.terrace.sewingTier < perk.minTier) return { ok: false, message: stationRequirementHint('sewing', perk.minTier) };
    if (!(this.onSpend?.(perk.cost) ?? false)) return { ok: false, message: 'Not enough materials' };

    this.terrace.craftedPerks.push(perk.id);
    saveTerraceState(this.terrace);
    playSew();
    const hs = this.hotspots.find((h) => h.config.type === 'sewing');
    if (hs) {
      const lift = this.stationTop(hs, 0.8);
      this.spawnSparkles(lift, [0xf3c7a8, 0xfff1dc, 0xd99a7a]);
      this.showFloatingText(lift, `${perk.icon} ${perk.name}`);
    }
    this.emitStationState();
    return { ok: true };
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.app.renderer.resize(w, h);
    this.layout();
    this.applyLighting();
  }

  destroy(): void {
    this.disposed = true;
    this.bgToken++;
    this.poseToken++;
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();
    setCampfireAudio(false);
    this.app.ticker.remove(this.update, this);
    this.floorHit.off('pointerdown', this.handleFloorPointerDown, this);
    this.hotspots = [];
    this.particles = [];
    this.weatherLayer.destroy();
    this.app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    this.radial.destroy(true);
  }

  private after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      this.timers.delete(id);
      if (!this.disposed) fn();
    }, ms);
    this.timers.add(id);
  }

  /* ── Stage space (cover-fitted backdrop) ── */

  /** Recompute where the backdrop is drawn: cover framing that always keeps the scene's safe area on screen */
  private updateStageRect(): void {
    const { width: W, height: H } = this;
    const tex = this.bgSprite?.texture;
    const texW = tex?.width || DEFAULT_STAGE_ASPECT;
    const texH = tex?.height || 1;
    this.stage = fitStage(W, H, texW, texH, this.sceneConfig?.safeArea);
  }

  /** Normalized stage coords → screen pixels */
  private toPx(nx: number, ny: number): { x: number; y: number } {
    const s = this.stage;
    return { x: s.x + nx * s.width, y: s.y + ny * s.height };
  }

  /** Screen pixels → normalized stage coords */
  private toNorm(px: number, py: number): { x: number; y: number } {
    const s = this.stage;
    return { x: (px - s.x) / s.width, y: (py - s.y) / s.height };
  }

  /* ── Background ── */

  private loadBackground(siteId: SiteId | null): void {
    const token = ++this.bgToken;
    this.drawFallback();
    if (!siteId) {
      this.revealStage();
      return;
    }

    Assets.load<Texture>(sceneBackdropSrc(siteId))
      .then((texture) => {
        if (this.disposed || token !== this.bgToken || !texture) return;
        if (this.bgSprite) {
          this.bgSprite.destroy();
          this.bgSprite = null;
        }
        this.bgFill?.destroy();
        /* Soft, dimmed copy of the painting behind it — only seen on extreme window shapes */
        const fill = new Sprite(texture);
        fill.anchor.set(0.5);
        fill.eventMode = 'none';
        fill.tint = 0xb8aea3;
        fill.filters = [new BlurFilter({ strength: 28, quality: 3, resolution: 0.5 })];
        fill.visible = false;
        this.bgFill = fill;
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.eventMode = 'none';
        this.bgSprite = sprite;
        const base = this.bgFallback ? 1 : 0;
        this.bgLayer.addChildAt(fill, base);
        this.bgLayer.addChildAt(sprite, base + 1);
        this.layout();
        this.revealStage();
      })
      .catch(() => {
        /* Keep the neutral backdrop rather than veiling the scene forever */
        if (!this.disposed && token === this.bgToken) this.revealStage();
      });
  }

  /** Soft neutral base under the backdrop (only visible if the stage art fails to load) */
  private drawFallback(): void {
    if (!this.bgFallback) {
      this.bgFallback = new Graphics();
      this.bgFallback.eventMode = 'none';
      this.bgLayer.addChildAt(this.bgFallback, 0);
    }
    this.bgFallback.clear();
    this.bgFallback.rect(0, 0, this.width, this.height).fill(NEUTRAL_BACKDROP);
  }

  /** Lift the veil once the backdrop is ready, and only then let the traveler arrive */
  private revealStage(): void {
    this.backdropReady = true;
    if (this.state.reduceMotion) this.app.stage.alpha = 1;
    this.onReady?.();
    if (!this.entryStarted) {
      this.entryStarted = true;
      this.startEntryAnimation();
    }
  }

  /* ── Traveler ── */

  private preloadTravelerPoses(gender: TravelerGender): void {
    for (const p of TRAVELER_POSES) {
      void Assets.load<Texture>(travelerSpriteSrc(gender, p)).catch(() => {});
    }
    Promise.all(travelerWalkFrames(gender).map((src) => Assets.load<Texture>(src)))
      .then((frames) => {
        /* Ignore a late load for a traveler who has since been swapped */
        if (this.disposed || this.state.gender !== gender || frames.some((f) => !f)) return;
        this.walkFrames = frames;
        this.walkFramesGender = gender;
      })
      .catch(() => { /* fall back to the single walk pose */ });
  }

  /** Animate the 4-frame walk cycle (otherwise the single still stride is used) */
  private walkCycleReady(): boolean {
    return !this.state.reduceMotion && this.walkFrames.length === 4 && this.walkFramesGender === this.state.gender;
  }

  private loadTraveler(gender: TravelerGender, pose: TravelerPose): void {
    const token = ++this.poseToken;
    const prevPose = this.currentPose;
    const animatedWalk = pose === 'walk' && this.walkCycleReady();
    const src = animatedWalk ? travelerWalkFrames(gender)[0] : travelerSpriteSrc(gender, pose);
    this.currentPose = pose;
    if (pose === 'walk') {
      this.walkFrameIndex = 0;
      this.walkFrameElapsed = 0;
    }

    Assets.load<Texture>(src)
      .then((texture) => {
        if (this.disposed || token !== this.poseToken || !texture) return;
        const old = this.travelerSprite;
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5, 1);
        sprite.alpha = old ? 0 : 1;
        this.travelerSprite = sprite;
        this.travelerNode.addChild(sprite);

        if (old && !this.state.reduceMotion) {
          this.poseScaleMultiplier = 0.96;
          this.layoutTraveler(0, prevPose);
          const fadeDuration = 210;
          const start = performance.now();
          const crossfade = () => {
            if (this.disposed || this.travelerSprite !== sprite) {
              if (!old.destroyed) old.destroy();
              return;
            }
            const progress = Math.min(1, (performance.now() - start) / fadeDuration);
            sprite.alpha = progress;
            old.alpha = 1 - progress;
            this.poseScaleMultiplier = 0.96 + 0.04 * progress;
            this.layoutTraveler(progress, prevPose);
            if (progress < 1) {
              requestAnimationFrame(crossfade);
            } else {
              this.poseScaleMultiplier = 1;
              if (!old.destroyed) old.destroy();
              this.layoutTraveler(1, pose);
            }
          };
          requestAnimationFrame(crossfade);
        } else {
          this.poseScaleMultiplier = 1;
          sprite.alpha = 1;
          if (old && !old.destroyed) old.destroy();
          this.layoutTraveler(1, pose);
        }
      })
      .catch(() => { /* keep current sprite */ });
  }

  private layoutTraveler(shadowBlend = 1, fromPose: TravelerPose = this.currentPose): void {
    const { x: px, y: py } = this.toPx(this.targetX, this.targetY);
    this.travelerNode.position.set(px, py);
    this.travelerNode.zIndex =
      this.sleepMode && this.sleepZ !== null ? this.sleepZ : Math.round(py);

    const baseStandingHeight = this.stage.height * BASE_STANDING_HEIGHT_RATIO;
    const targetHeight = baseStandingHeight * POSE_HEIGHT_SCALE[this.currentPose];
    if (this.travelerSprite) {
      const tex = this.travelerSprite.texture;
      const scale = (targetHeight / (tex.height || 1)) * this.poseScaleMultiplier;
      this.travelerSprite.scale.set(
        scale * (this.travelerFlipped ? -1 : 1),
        scale,
      );
      this.travelerSprite.position.set(0, 0);
    }

    /* Ground contact shadow smoothly sized & aligned per pose */
    const fromSh = POSE_SHADOW[fromPose];
    const toSh = POSE_SHADOW[this.currentPose];
    const rx = baseStandingHeight * lerp(fromSh.rx, toSh.rx, shadowBlend);
    const ry = baseStandingHeight * lerp(fromSh.ry, toSh.ry, shadowBlend);
    const alpha = lerp(fromSh.alpha, toSh.alpha, shadowBlend);
    this.travelerShadow.clear();
    this.travelerShadow.ellipse(0, 0, rx, ry).fill({ color: 0x1e1812, alpha });
    this.travelerShadow.position.set(0, 0);
  }

  private setPose(pose: TravelerPose): void {
    if (pose === this.currentPose) return;
    this.loadTraveler(this.state.gender, pose);
  }

  /* ── Hotspots ── */

  private buildHotspots(): void {
    for (const hs of this.hotspots) {
      for (const g of hs.glows) g.sprite.destroy();
      hs.root.destroy({ children: true });
    }
    this.labelLayer.removeChildren();
    this.hotspots = [];
    this.fireFlames = null;

    if (!this.sceneConfig) return;

    for (const cfg of this.sceneConfig.hotspots) {
      this.hotspots.push(this.createHotspotNode(cfg));
    }
  }

  private createHotspotNode(cfg: HotspotConfig, onSpriteReady?: () => void): HotspotNode {
    const root = new Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = new Circle(0, -20, 42);

    const slot = cfg.type === 'slot' ? this.sceneConfig?.buildSlots?.find((s) => s.id === cfg.id) : undefined;

    /* Stations & build slots get a floor blueprint (shown while empty) beneath their sprite */
    let blueprint: Graphics | null = null;
    if (cfg.station || slot) {
      blueprint = new Graphics();
      blueprint.eventMode = 'none';
      blueprint.visible = false;
      root.addChild(blueprint);
    }

    let propSprite: Sprite | null = null;
    if (cfg.propSprite || cfg.station || slot) {
      propSprite = Sprite.from(Texture.EMPTY);
      propSprite.anchor.set(0.5, 1);
      propSprite.eventMode = 'none';
      root.addChild(propSprite);
    }

    const { label, pill: labelPill } = this.createLabel(cfg.label);

    const node: HotspotNode = {
      config: cfg,
      root,
      propSprite,
      spriteSrc: cfg.propSprite,
      label,
      labelPill,
      hovered: false,
      interacted: false,
      blueprint,
      glows: [],
      slot,
    };
    if (cfg.propSprite) this.setHotspotSprite(node, cfg.propSprite, onSpriteReady);

    root.on('pointerenter', () => this.onHotspotHover(node, true));
    root.on('pointerleave', () => this.onHotspotHover(node, false));
    root.on('pointerdown', (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      this.onHotspotClick(node);
    });

    this.worldLayer.addChild(root);
    return node;
  }

  private destroyHotspotNode(hs: HotspotNode): void {
    for (const g of hs.glows) g.sprite.destroy();
    hs.label.destroy();
    hs.labelPill.destroy();
    hs.root.destroy({ children: true });
  }

  /**
   * Morning after sleep: adopt the store's overnight rooftop & downstairs resets,
   * and swap in any weeds / cartons that sprouted or blew in overnight.
   */
  private applyOvernightRegrowth(outcome: RegrowOutcome<TerraceState>): void {
    if (this.state.siteId !== 'terrace') return;
    /* Keep floor puzzle resets & cleared failures in sync before interactSleep saves `this.terrace` */
    this.terrace.repairedSpots = [...outcome.state.repairedSpots];
    this.terrace.failedTodaySpots = [...outcome.state.failedTodaySpots];

    const ids = [...outcome.regrownWeeds, ...outcome.refreshedBoxes];
    if (ids.length === 0) return;
    this.terrace.spawns = outcome.state.spawns;
    this.terrace.clearedWeeds = [...outcome.state.clearedWeeds];
    this.terrace.searchedBoxes = [...outcome.state.searchedBoxes];
    this.sceneConfig = this.resolveSceneConfig(this.state.siteId);

    for (const id of ids) {
      const cfg = this.sceneConfig?.hotspots.find((h) => h.id === id);
      if (!cfg) continue;
      const index = this.hotspots.findIndex((h) => h.config.id === id);
      /* Weeds reuse their node; a wind-blown carton may land in an id with no node yet */
      if (index >= 0) this.destroyHotspotNode(this.hotspots[index]);
      let node: HotspotNode | null = null;
      node = this.createHotspotNode(cfg, () => {
        if (node && !node.root.destroyed) this.popIn(node.root);
      });
      node.root.alpha = 0;
      if (index >= 0) this.hotspots[index] = node;
      else this.hotspots.push(node);
    }
    this.layout();
  }

  private createLabel(text: string): { label: Text; pill: Graphics } {
    const label = new Text({
      text,
      style: new TextStyle({
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 12,
        fontWeight: '600',
        fill: 0x3d3832,
      }),
    });
    label.anchor.set(0.5, 1);
    label.visible = false;
    const pill = new Graphics();
    pill.visible = false;
    this.labelLayer.addChild(pill, label);
    return { label, pill };
  }

  /** Swap a hotspot's prop art; late loads for a superseded sprite are ignored */
  private setHotspotSprite(node: HotspotNode, src: string, onReady?: () => void): void {
    node.spriteSrc = src;
    Assets.load<Texture>(src)
      .then((tex) => {
        const sprite = node.propSprite;
        if (this.disposed || !tex || !sprite || sprite.destroyed || node.spriteSrc !== src) return;
        sprite.texture = tex;
        this.layout();
        onReady?.();
      })
      .catch(() => { /* keep current art */ });
  }

  /** Context-aware hover text for every station (tier, phase, fire & daily readiness) */
  private refreshStationLabels(): void {
    for (const hs of this.hotspots) {
      const station = this.stationOf(hs);
      if (station) this.setHotspotLabel(hs, this.stationLabel(station, hs));
      else if (hs.config.type === 'slot') this.setHotspotLabel(hs, BUILD_HERE_LABEL);
    }
  }

  private stationLabel(station: StationConfig, hs: HotspotNode): string {
    const tier = this.tierOf(station.id);
    const cfg = stationTierConfig(station, tier);
    if (!cfg) {
      const first = nextStationTier(station, 0);
      return first ? `Craft ${first.name} (${formatMaterials(first.cost)})` : hs.config.label;
    }
    switch (station.id) {
      case 'shelter':
        return this.state.dayPhase === 'night' ? 'Sleep until morning' : 'Rest by shelter';
      case 'firepit':
        /* Opens a menu (light / sit / extinguish / upgrade), so just name the spot */
        return 'Fire pit';
      case 'planter':
        return this.terrace.planterReady
          ? `Harvest ${cfg.name} · ${formatMaterials(planterHarvest(tier), '+')}`
          : 'Growing — ready tomorrow';
      case 'barrel': {
        if (!this.terrace.barrelReady) return 'Filling — ready tomorrow';
        const water = formatMaterials(barrelCollect(tier, this.state.weather), '+');
        return this.state.weather === 'rain' ? `Rain-filled — Collect · ${water}` : `Collect rainwater · ${water}`;
      }
      case 'grill':
        return `Cook at the ${cfg.name}`;
      case 'sewing':
        return `Mend at the ${cfg.name}`;
    }
  }

  private buildNightEffects(): void {
    this.starLayer.removeChildren();
    this.fireflyLayer.removeChildren();
    this.stars = [];
    this.fireflies = [];

    /* Softly twinkling upper-sky stars */
    for (let i = 0; i < 34; i++) {
      const star = new Graphics();
      const r = 0.8 + (i % 4) * 0.45;
      star.circle(0, 0, r).fill({ color: i % 5 === 0 ? 0xfff3c8 : 0xf4f7ff });
      this.starLayer.addChild(star);
      this.stars.push({
        sprite: star,
        nx: 0.04 + ((i * 0.6180339) % 1) * 0.92,
        ny: 0.03 + ((i * 0.381966 + 0.17) % 1) * 0.34,
        phase: i * 1.37,
        speed: 1.4 + (i % 5) * 0.45,
        baseAlpha: 0.45 + (i % 3) * 0.22,
      });
    }

    /* Warm drifting rooftop fireflies */
    for (let i = 0; i < 14; i++) {
      const fly = new Graphics();
      fly.circle(0, 0, 5.2).fill({ color: 0xffd870, alpha: 0.22 });
      fly.circle(0, 0, 1.9).fill({ color: 0xfff5b8, alpha: 0.95 });
      this.fireflyLayer.addChild(fly);
      this.fireflies.push({
        sprite: fly,
        nx: 0.16 + ((i * 0.754877) % 1) * 0.66,
        ny: 0.46 + ((i * 0.56984 + 0.2) % 1) * 0.34,
        vx: (i % 2 === 0 ? 1 : -1) * (0.004 + (i % 3) * 0.002),
        vy: (i % 3 === 0 ? 1 : -1) * 0.003,
        phase: i * 1.9,
        speed: 1.8 + (i % 4) * 0.5,
      });
    }
  }

  private isHotspotInteractive(node: HotspotNode): boolean {
    const t = node.config.type;
    return !node.interacted || !!node.config.station || t === 'slot' || t === 'sleep' || t === 'firepit' || t === 'door';
  }

  private setHotspotLabel(node: HotspotNode, text: string): void {
    node.label.text = text;
    if (node.hovered) this.layoutHotspotLabel(node);
  }

  private onHotspotHover(node: HotspotNode, enter: boolean): void {
    /* Opened crates are informational: their label, no warm tint or lift */
    if (this.isEmptiedCrate(node)) {
      node.hovered = enter;
      node.label.visible = enter;
      node.labelPill.visible = enter;
      if (enter) this.layoutHotspotLabel(node);
      return;
    }
    if (!this.isHotspotInteractive(node)) {
      node.hovered = false;
      node.label.visible = false;
      node.labelPill.visible = false;
      if (node.propSprite) {
        node.propSprite.tint = 0xffffff;
        this.applyHotspotSpriteScale(node);
      }
      return;
    }
    node.hovered = enter;
    node.label.visible = enter;
    node.labelPill.visible = enter;
    if (node.propSprite) {
      node.propSprite.tint = enter ? 0xfff6e5 : 0xffffff;
      this.applyHotspotSpriteScale(node);
    }
    if (node.blueprint?.visible) {
      this.drawBlueprint(node);
    }
    if (enter) {
      this.layoutHotspotLabel(node);
    }
  }

  private applyHotspotSpriteScale(node: HotspotNode): void {
    const sprite = node.propSprite;
    if (!sprite || !node.config.propScale || sprite.texture === Texture.EMPTY) return;
    const pH = this.stage.height * node.config.propScale;
    const baseScale = pH / (sprite.texture.height || 100);
    const hoverScale = node.hovered && !this.state.reduceMotion ? 1.03 : 1;
    const signX = node.config.flipX ? -1 : 1;
    sprite.scale.set(baseScale * hoverScale * signX, baseScale * hoverScale);
  }

  private drawBlueprint(node: HotspotNode): number {
    if (!node.blueprint) return 24;
    const { width: SW, height: SH } = this.stage;
    const footprint = this.stationOf(node)?.tiers[0]?.collider ?? node.slot?.collider;
    const rx = Math.max(16, (footprint?.rx ?? 0.03) * SW * 1.15);
    const ry = Math.max(7, (footprint?.ry ?? 0.02) * SH * 1.35);
    node.blueprint.clear();
    node.blueprint
      .ellipse(0, 0, rx, ry)
      .fill({ color: 0xfff6e0, alpha: node.hovered ? 0.24 : 0.16 })
      .stroke({ color: 0xfff2cc, width: node.hovered ? 2.1 : 1.8, alpha: node.hovered ? 0.98 : 0.68 });
    node.blueprint.rect(-6, -1.2, 12, 2.4).fill({ color: 0xfffcf6, alpha: node.hovered ? 1 : 0.9 });
    node.blueprint.rect(-1.2, -6, 2.4, 12).fill({ color: 0xfffcf6, alpha: node.hovered ? 1 : 0.9 });
    return rx;
  }

  private layoutHotspotLabel(node: HotspotNode): void {
    const SH = this.stage.height;
    const cfg = node.config;
    const { x: rawX, y: anchorY } = this.toPx(cfg.position.x, cfg.position.y);
    let rawY: number;
    if (cfg.hitRect) {
      rawY = anchorY + SH * cfg.hitRect.dy + 30;
    } else {
      const propH = cfg.propScale ? SH * cfg.propScale : 44;
      rawY = anchorY - Math.max(44, propH + 10);
    }
    this.placeLabel(node.label, node.labelPill, rawX, rawY);
  }

  private placeLabel(label: Text, pill: Graphics, rawX: number, rawY: number): void {
    const W = this.width;
    const pw = label.width + 18;
    const ph = label.height + 10;
    const px = Math.max(pw / 2 + 12, Math.min(W - pw / 2 - 12, rawX));
    const py = Math.max(ph + 64, rawY);

    label.position.set(px, py);
    pill.clear();
    pill
      .roundRect(px - pw / 2, py - ph + 4, pw, ph, 10)
      .fill({ color: 0xfffcf6, alpha: 0.94 })
      .stroke({ color: 0xe8cdb5, width: 1.5 });
  }

  private emitStationMenu(stationId: StationId, hs: HotspotNode): void {
    this.onHotspotHover(hs, false);
    const tier = this.tierOf(stationId);
    const top = tier === 0
      ? { x: hs.config.position.x, y: hs.config.position.y - 0.04 }
      : this.stationTop(hs, 1);
    const anchor = this.toPx(top.x, top.y);
    this.onStationMenu?.(stationId, anchor);
  }

  private emitSlotMenu(hs: HotspotNode): void {
    if (!hs.slot) return;
    this.onHotspotHover(hs, false);
    this.onSlotMenu?.(hs.slot.id, this.toPx(hs.config.position.x, hs.config.position.y - 0.04));
  }

  private walkToHotspotAndRun(
    node: HotspotNode,
    useRestSpot: boolean,
    onArrive: () => void,
  ): void {
    if (this.sleepMode && node.config.type !== 'sleep') {
      this.wakeUp();
    }

    const cfg = node.config;
    const isSleepTurn = cfg.type === 'sleep' && !useRestSpot;
    const offset = useRestSpot ? (cfg.restOffset ?? { dx: 0.085, dy: 0.035 }) : cfg.standOffset;
    const rawX = cfg.position.x + (offset?.dx ?? 0);
    const rawY = cfg.position.y + (offset?.dy ?? 0.04);
    /* Only actual sleeping enters the shelter's collider; resting sits beside it */
    const standPos = this.clampFloorTarget(rawX, rawY, isSleepTurn ? node : undefined);

    this.onHotspotHover(node, false);
    this.interactionLock = true;

    const finishArrival = () => {
      if (useRestSpot) {
        this.travelerFlipped = false;
        this.layoutTraveler();
      } else if (Math.abs(cfg.position.x - this.targetX) > 0.005) {
        this.travelerFlipped = cfg.position.x < this.targetX;
        this.layoutTraveler();
      }
      onArrive();
    };

    const dx = standPos.x - this.targetX;
    const dy = standPos.y - this.targetY;
    if (Math.hypot(dx, dy) < 0.015) {
      finishArrival();
      return;
    }

    this.walkTo(standPos.x, standPos.y, finishArrival);
  }

  private onHotspotClick(node: HotspotNode): void {
    if (this.interactionLock || !this.entryDone) return;
    /* An opened wooden crate just reminds you what it's waiting for */
    if (this.isEmptiedCrate(node)) {
      this.showFloatingText(node.config.position, 'Needs an axe — coming soon');
      return;
    }
    if (!this.isHotspotInteractive(node)) return;

    /* Empty build slot: choose which station goes here */
    if (node.config.type === 'slot') {
      this.emitSlotMenu(node);
      return;
    }

    const station = this.stationOf(node);
    if (station) {
      const tier = this.tierOf(station.id);
      if (tier === 0) {
        const first = nextStationTier(station, 0);
        if (first && !(this.onCanAfford?.(first.cost) ?? true)) {
          this.emitStationMenu(station.id, node);
          return;
        }
        this.requestBuild(station.id);
        return;
      }

      const hasUpgrade = nextStationTier(station, tier) !== null;
      const hasMultipleFireActions = station.id === 'firepit' && this.fireLit;
      if (hasUpgrade || hasMultipleFireActions) {
        this.emitStationMenu(station.id, node);
        return;
      }
    }

    /* Already harvested / collected today: a calm note instead of a walk */
    if (
      (node.config.type === 'planter' && !this.terrace.planterReady) ||
      (node.config.type === 'barrel' && !this.terrace.barrelReady)
    ) {
      this.showFloatingText(
        this.stationTop(node, 0.6),
        node.config.type === 'planter' ? 'Growing — ready tomorrow' : 'Filling — ready tomorrow',
      );
      return;
    }

    const isRestTurn = node.config.type === 'sleep' && this.state.dayPhase !== 'night';
    this.walkToHotspotAndRun(node, isRestTurn, () => {
      if (isRestTurn) this.interactRest();
      else this.executeInteraction(node);
    });
  }

  private executeInteraction(node: HotspotNode): void {
    const cfg = node.config;
    switch (cfg.type) {
      case 'firepit':
        this.interactFirepit(node);
        break;
      case 'searchable':
        this.interactSearch(node);
        break;
      case 'weeds':
        this.interactWeeds(node);
        break;
      case 'sleep':
        this.interactSleep(node);
        break;
      case 'door':
        this.interactDoor(node);
        break;
      case 'planter':
        this.interactHarvest(node);
        break;
      case 'barrel':
        this.interactCollect(node);
        break;
      case 'grill':
      case 'sewing':
        this.interactOpenStation(node);
        break;
    }
  }

  /* ── Daily station yields & station popovers ── */

  private interactHarvest(node: HotspotNode): void {
    this.setPose('search');
    playHarvest();
    this.after(800, () => {
      const gains = planterHarvest(this.terrace.planterTier);
      this.terrace.planterReady = false;
      saveTerraceState(this.terrace);
      this.onReward?.(gains, 'harvest');
      this.spawnLeafParticles(node.config.position);
      this.showFloatingText(this.stationTop(node, 0.55), formatMaterials(gains, '+'));
      this.refreshStationLabels();
      this.emitStationState();
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  private interactCollect(node: HotspotNode): void {
    this.setPose('search');
    playWaterChime();
    this.after(800, () => {
      const gains = barrelCollect(this.terrace.barrelTier, this.state.weather);
      this.terrace.barrelReady = false;
      saveTerraceState(this.terrace);
      this.onReward?.(gains, 'harvest');
      const lift = this.stationTop(node, 0.55);
      this.spawnSparkles(lift, [0x9fd3f0, 0xc8e8fa, 0xffffff]);
      this.showFloatingText(lift, formatMaterials(gains, '+'));
      this.refreshStationLabels();
      this.emitStationState();
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  /** Grill & sewing kit open their cozy popover once the traveler arrives */
  private interactOpenStation(node: HotspotNode): void {
    this.setPose('idle');
    this.interactionLock = false;
    const top = this.stationTop(node, 1);
    const anchor = this.toPx(top.x, top.y);
    this.onStationOpen?.(node.config.type === 'grill' ? 'grill' : 'sewing', anchor);
  }

  private disableHotspotInteraction(node: HotspotNode): void {
    node.interacted = true;
    node.hovered = false;
    node.label.visible = false;
    node.labelPill.visible = false;
    node.root.cursor = 'default';
    node.root.eventMode = 'none';
    if (node.propSprite) {
      node.propSprite.tint = 0xffffff;
      this.applyHotspotSpriteScale(node);
    }
  }

  private interactFirepit(node: HotspotNode): void {
    if (!this.fireLit) {
      /* Lighting the fire burns a piece of firewood */
      if (!(this.onSpend?.({ timber: 1 }) ?? true)) {
        this.onNotice?.('Need 1 Timber to light the fire', '🪵');
        this.setPose('idle');
        this.after(250, () => {
          this.interactionLock = false;
        });
        return;
      }
      playFireLight();
      this.fireLit = true;
      this.terrace.fireLit = true;
      saveTerraceState(this.terrace);
      setCampfireAudio(true, this.fireProfile().crackle);

      this.ensureFireEffects(node);
      if (this.fireFlames) this.fireFlames.alpha = 1;
      if (this.fireGlow) this.fireGlow.visible = true;
      this.refreshStationLabels();
      this.emitStationState();
      this.showFloatingText(this.stationTop(node, 0.6), '−1 🪵');
      this.layout();

      this.after(600, () => {
        this.setPose('sit');
        this.interactionLock = false;
      });
      return;
    }

    /* Extinguish lit fire pit (saves fuel) */
    playFireDouse();
    setCampfireAudio(false);
    this.fireLit = false;
    this.terrace.fireLit = false;
    saveTerraceState(this.terrace);
    this.refreshStationLabels();
    this.emitStationState();
    this.setPose('idle');

    const flames = this.fireFlames;
    const glow = this.fireGlow;
    if (this.state.reduceMotion) {
      if (flames) {
        flames.alpha = 0;
        flames.clear();
      }
      if (glow) {
        glow.alpha = 0;
        glow.visible = false;
      }
    } else {
      const startGlowAlpha = glow ? glow.alpha : 0;
      const start = performance.now();
      const fadeOut = () => {
        if (this.disposed || this.fireLit) return;
        const p = Math.min(1, (performance.now() - start) / 360);
        if (flames && !flames.destroyed) flames.alpha = 1 - p;
        if (glow && !glow.destroyed) glow.alpha = startGlowAlpha * (1 - p);
        if (p < 1) {
          requestAnimationFrame(fadeOut);
        } else {
          if (flames && !flames.destroyed) flames.clear();
          if (glow && !glow.destroyed) glow.visible = false;
        }
      };
      requestAnimationFrame(fadeOut);
    }

    this.after(360, () => {
      this.interactionLock = false;
    });
  }

  private ensureFireEffects(fireNode?: HotspotNode): void {
    if (!this.fireGlow) {
      this.fireGlow = new Sprite(this.radial);
      this.fireGlow.anchor.set(0.5);
      this.fireGlow.blendMode = 'add';
      this.fireGlow.tint = 0xff8030;
      this.fireGlow.eventMode = 'none';
      this.fxLayer.addChild(this.fireGlow);
    }
    this.fireGlow.visible = true;
    const targetNode = fireNode ?? this.hotspots.find((h) => h.config.id === 'firepit');
    if (!this.fireFlames && targetNode) {
      this.fireFlames = new Graphics();
      this.fireFlames.eventMode = 'none';
      targetNode.root.addChild(this.fireFlames);
    }
    if (this.fireFlames) this.fireFlames.alpha = 1;
  }

  private interactSearch(node: HotspotNode): void {
    this.setPose('search');
    playRummage();

    this.after(1000, () => {
      const id = node.config.id;
      if (node.config.clearsWhenSearched) {
        /* A light carton is emptied and carried off by the breeze: gone, its floor free for the next one */
        this.disableHotspotInteraction(node);
        this.fadeOutProp(node);
        const spawns = this.terrace.spawns ?? structuredClone(DEFAULT_TERRACE_SPAWNS);
        delete spawns[id];
        this.terrace.spawns = spawns;
        this.terrace.searchedBoxes = this.terrace.searchedBoxes.filter((b) => b !== id);
      } else {
        /* A heavy wooden crate stays on the roof, opened and empty */
        this.markCrateEmptied(node);
        this.showSearchedBox(node);
        if (!this.terrace.searchedBoxes.includes(id)) this.terrace.searchedBoxes.push(id);
      }
      saveTerraceState(this.terrace);

      const reward = node.config.reward;
      if (reward) {
        /* Windy days blow a little extra into every box */
        const bonus = windBoxBonus(reward, this.state.weather);
        this.onReward?.(mergeMaterials(reward, bonus), 'searchable');
        const bonusText = formatMaterials(bonus, '+');
        const base = formatMaterials(reward, '+');
        this.showFloatingText(node.config.position, bonusText ? `${base}  🍃 ${bonusText}` : base);
      }
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  /** An opened wooden crate: still solid scenery, hover shows what it's waiting for */
  private markCrateEmptied(node: HotspotNode): void {
    node.interacted = true;
    node.hovered = false;
    node.label.visible = false;
    node.labelPill.visible = false;
    node.root.cursor = 'default';
    if (node.config.searchedLabel) node.label.text = node.config.searchedLabel;
    if (node.propSprite) {
      node.propSprite.tint = 0xffffff;
      this.applyHotspotSpriteScale(node);
    }
  }

  private isEmptiedCrate(node: HotspotNode): boolean {
    return node.config.type === 'searchable' && node.interacted && !node.config.clearsWhenSearched;
  }

  /** Fade a prop's art away (instant under Reduce Motion) */
  private fadeOutProp(node: HotspotNode): void {
    const sprite = node.propSprite;
    if (!sprite) return;
    if (this.state.reduceMotion) {
      sprite.alpha = 0;
      return;
    }
    const start = performance.now();
    const fade = () => {
      if (this.disposed || sprite.destroyed) return;
      const p = Math.min(1, (performance.now() - start) / 400);
      sprite.alpha = 1 - p;
      if (p < 1) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  }

  private showSearchedBox(node: HotspotNode): void {
    if (node.config.propSpriteAfter) {
      this.setHotspotSprite(node, node.config.propSpriteAfter);
    } else if (node.propSprite) {
      node.propSprite.tint = SEARCHED_TINT;
    }
  }

  private interactWeeds(node: HotspotNode): void {
    this.setPose('search');
    playWeedCut();

    this.after(350, () => {
      this.spawnLeafParticles(node.config.position);
    });

    this.after(800, () => {
      this.disableHotspotInteraction(node);
      if (!this.terrace.clearedWeeds.includes(node.config.id)) {
        this.terrace.clearedWeeds.push(node.config.id);
      }
      saveTerraceState(this.terrace);
      this.fadeOutProp(node);

      if (node.config.reward && this.onReward) {
        this.onReward(node.config.reward, 'weeds');
      }
      if (node.config.reward) {
        this.showFloatingText(node.config.position, formatMaterials(node.config.reward, '+'));
      }
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  private interactRest(): void {
    this.travelerFlipped = false;
    this.layoutTraveler();
    this.setPose('sit');
    playRestSfx();
    this.onRest?.();

    this.after(450, () => {
      this.interactionLock = false;
    });
  }

  private interactSleep(node: HotspotNode): void {
    this.sleepMode = true;
    this.sleepZ = node.root.zIndex + 1;
    this.startLightingTween(PHASE_LIGHTING.night);
    /* Tuck head/pack inside the shed frame, facing out toward the rooftop */
    this.travelerFlipped = true;
    this.layoutTraveler();
    this.setPose('sleep');
    playSleepSfx();

    /* Hold briefly in starry twilight, then roll into Day N+1 morning */
    this.after(1600, () => {
      const regrowth = this.onSleep?.(sleepComfort(this.terrace.shelterTier, this.terrace.craftedPerks));
      if (regrowth) this.applyOvernightRegrowth(regrowth);
      /* A new morning: the farm has grown and the barrel has filled */
      this.terrace.planterReady = this.terrace.planterTier >= 1;
      this.terrace.barrelReady = this.terrace.barrelTier >= 1;
      saveTerraceState(this.terrace);
      this.refreshStationLabels();
      this.emitStationState();
      this.sleepMode = false;
      this.sleepZ = null;
      this.startLightingTween(PHASE_LIGHTING.day);
      const rest = node.config.restOffset ?? { dx: 0.085, dy: 0.035 };
      const wakePos = this.clampFloorTarget(node.config.position.x + rest.dx, node.config.position.y + rest.dy);
      this.targetX = wakePos.x;
      this.targetY = wakePos.y;
      this.travelerFlipped = false;
      this.setPose('idle');
      this.layoutTraveler();
      this.interactionLock = false;
    });
  }

  private wakeUp(): void {
    if (!this.sleepMode) return;
    this.sleepMode = false;
    this.sleepZ = null;
    this.startLightingTween(PHASE_LIGHTING[this.state.dayPhase]);
    this.layoutTraveler();
  }

  private interactDoor(node: HotspotNode): void {
    this.travelerFlipped = false;
    this.layoutTraveler();
    this.setPose('idle');
    playFootstep();
    this.after(350, () => {
      /* Doors with a destination hand off to the app (e.g. the stairwell → ride down) */
      if (this.onDoor?.(node.config.id)) return;
      if (node.config.message) this.onNotice?.(node.config.message, '🚪');
      this.interactionLock = false;
    });
  }

  /* ── Multi-tier Stations ── */

  /** Base config for a site, with the Terrace's per-run box & weed layout applied */
  private resolveSceneConfig(siteId: SiteId | null): ShelterSceneConfig | null {
    const base = getSceneConfig(siteId);
    if (base && siteId === 'terrace' && this.terrace.spawns) {
      return withTerraceSpawns(base, this.terrace.spawns);
    }
    return base;
  }

  private stationOf(hs: HotspotNode): StationConfig | undefined {
    return hs.config.station ? this.sceneConfig?.stations?.find((s) => s.id === hs.config.station) : undefined;
  }

  /** The hotspot a station currently lives on (fixed hotspot, or the build slot it was placed in) */
  private stationHotspot(station: StationConfig): HotspotNode | undefined {
    return this.hotspots.find((h) => h.config.station === station.id);
  }

  private tierOf(id: StationId): number {
    return this.terrace[STATION_TIER_KEY[id]] as number;
  }

  /** Normalized point above a station's sprite (fraction 0–1 of its height) */
  private stationTop(hs: HotspotNode, fraction: number): { x: number; y: number } {
    const scale = hs.config.propScale ?? 0.05;
    return { x: hs.config.position.x, y: hs.config.position.y - scale * fraction };
  }

  private emitStationState(): void {
    this.onStationState?.({
      tiers: stationTiersOf(this.terrace),
      pending: this.pendingStation,
      fireLit: this.fireLit,
      perks: [...this.terrace.craftedPerks],
      planterReady: this.terrace.planterReady,
      barrelReady: this.terrace.barrelReady,
      slots: { ...this.terrace.slotAssignments },
    });
  }

  /**
   * Show a station at its current tier: sprite, collider, stand spot & glows
   * (or a floor blueprint while unbuilt). `animate` pops freshly built art in.
   */
  private applyStationTier(hs: HotspotNode, station: StationConfig, animate: boolean): void {
    const cfg = stationTierConfig(station, this.tierOf(station.id));
    for (const g of hs.glows) g.sprite.destroy();
    hs.glows = [];

    if (!cfg) {
      hs.config = {
        ...hs.config,
        propSprite: '',
        propScale: undefined,
        collider: undefined,
        standOffset: station.buildStandOffset ?? hs.config.standOffset,
      };
      hs.spriteSrc = '';
      if (hs.propSprite) hs.propSprite.visible = false;
      if (hs.blueprint) hs.blueprint.visible = true;
    } else {
      hs.config = {
        ...hs.config,
        propSprite: cfg.sprite,
        propScale: cfg.propScale,
        collider: cfg.collider,
        /* A build slot keeps its own stand spot whatever station stands there */
        standOffset: hs.slot ? hs.slot.standOffset : (cfg.standOffset ?? hs.config.standOffset),
        restOffset: cfg.restOffset ?? hs.config.restOffset,
      };
      if (hs.blueprint) hs.blueprint.visible = false;
      if (hs.propSprite) hs.propSprite.visible = true;
      this.setHotspotSprite(hs, cfg.sprite, () => {
        if (animate) this.popIn(hs.root);
      });
      for (const anchor of cfg.glows ?? []) {
        const sprite = new Sprite(this.radial);
        sprite.anchor.set(0.5);
        sprite.blendMode = 'add';
        sprite.tint = 0xffb860;
        sprite.alpha = 0;
        sprite.eventMode = 'none';
        this.fxLayer.addChild(sprite);
        hs.glows.push({ sprite, anchor });
      }
    }

    /* A bigger fire pit crackles fuller right away if it's already lit */
    if (station.id === 'firepit' && this.fireLit) {
      setCampfireAudio(true, this.fireProfile().crackle);
    }
    this.layout();
  }

  /**
   * Show a build slot as whatever stands there: the placed station at its tier
   * (taking on that station's type, art, collider & interactions), or an empty,
   * walkable "Build here" blueprint.
   */
  private applySlot(hs: HotspotNode, animate: boolean): void {
    const slot = hs.slot;
    if (!slot) return;
    const placed = this.terrace.slotAssignments[slot.id] ?? null;
    const station = placed ? this.sceneConfig?.stations?.find((s) => s.assignableId === placed) : undefined;
    const type = station && STATION_HOTSPOT_TYPE[station.id];

    if (station && type && this.tierOf(station.id) > 0) {
      hs.config = { ...hs.config, type, station: station.id };
      this.applyStationTier(hs, station, animate);
      return;
    }

    for (const g of hs.glows) g.sprite.destroy();
    hs.glows = [];
    hs.config = {
      id: slot.id,
      type: 'slot',
      position: slot.position,
      propSprite: '',
      label: BUILD_HERE_LABEL,
      standOffset: slot.standOffset,
    };
    hs.spriteSrc = '';
    if (hs.propSprite) hs.propSprite.visible = false;
    if (hs.blueprint) hs.blueprint.visible = true;
    this.setHotspotLabel(hs, BUILD_HERE_LABEL);
    this.layout();
  }

  private performBuild(station: StationConfig, hs: HotspotNode, next: StationTierConfig, slotId?: string): void {
    this.setPose('search');
    playBuild();

    this.after(950, () => {
      const slots = slotId ? placeStationInSlot(this.terrace.slotAssignments, slotId, station.assignableId!) : null;
      /* The slot (or station) may have been claimed meanwhile — never pay for a build that can't land */
      const placeable = !slotId || slots !== null;
      const paid = placeable && (this.onBuild?.(next.cost) ?? false);
      const lift = { x: hs.config.position.x, y: hs.config.position.y - next.propScale * 0.55 };
      if (paid) {
        if (slots) this.terrace.slotAssignments = slots;
        (this.terrace[STATION_TIER_KEY[station.id]] as number) = next.tier;
        /* A brand-new farm or barrel starts ready to use */
        if (next.tier === 1 && station.id === 'planter') this.terrace.planterReady = true;
        if (next.tier === 1 && station.id === 'barrel') this.terrace.barrelReady = true;
        saveTerraceState(this.terrace);
        if (slotId) this.applySlot(hs, true);
        else this.applyStationTier(hs, station, true);
        this.refreshStationLabels();
        playClaim();
        this.showFloatingText(lift, formatMaterials(next.cost, '−'));
        this.playBuildFlourish(next, hs, lift);
      } else {
        this.showFloatingText(lift, placeable ? 'Need more materials' : 'This spot is taken');
      }
      this.pendingStation = null;
      this.setPose('idle');
      this.interactionLock = false;
      this.emitStationState();
    });
  }

  private playBuildFlourish(cfg: StationTierConfig, hs: HotspotNode, lift: { x: number; y: number }): void {
    switch (cfg.effect) {
      case 'leaves':
        this.spawnLeafParticles(hs.config.position);
        this.spawnSparkles(lift, [0xfff1b0, 0xd8f0a8, 0xffffff]);
        break;
      case 'water':
        playWaterChime();
        this.spawnSparkles(lift, [0x9fd3f0, 0xc8e8fa, 0xffffff]);
        break;
      case 'logs':
        playLogStack();
        this.spawnSparkles(lift, [0xffb35c, 0xffd38a, 0xc98a52]);
        break;
      case 'stones':
        playStoneSet();
        this.spawnSparkles(lift, [0xffc56a, 0xfff0c8, 0xd9cfc2]);
        break;
      case 'fabric':
        playSew();
        this.spawnSparkles(lift, [0xf3c7a8, 0xfff1dc, 0xd99a7a]);
        break;
      default:
        this.spawnSparkles(lift, [0xffd89a, 0xfff1c8, 0xffb860]);
    }
  }

  /** Gentle overshoot scale-in for freshly built props */
  private popIn(target: Container): void {
    if (this.state.reduceMotion) {
      target.scale.set(1);
      target.alpha = 1;
      return;
    }
    const start = performance.now();
    const duration = 520;
    target.scale.set(0.55);
    target.alpha = 0;
    const step = () => {
      if (this.disposed || target.destroyed) return;
      const p = Math.min(1, (performance.now() - start) / duration);
      const c1 = 1.70158;
      const eased = 1 + (c1 + 1) * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
      target.scale.set(0.55 + 0.45 * eased);
      target.alpha = Math.min(1, p * 2.5);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        target.scale.set(1);
      }
    };
    requestAnimationFrame(step);
  }

  /** Soft rising steam wisps above the grill after cooking */
  private spawnSteam(pos: { x: number; y: number }): void {
    if (this.state.reduceMotion) return;
    const base = this.toPx(pos.x, pos.y);
    for (let i = 0; i < 6; i++) {
      const wisp = new Graphics();
      wisp.circle(0, 0, 4 + Math.random() * 3).fill({ color: 0xf6f2ec });
      wisp.position.set(base.x + (Math.random() - 0.5) * 18, base.y + Math.random() * 6);
      this.fxLayer.addChild(wisp);
      this.particles.push({
        sprite: wisp,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.35 + Math.random() * 0.3),
        gravity: -0.002,
        life: -i * 90,
        maxLife: 1500 + Math.random() * 600,
        smoke: { peakAlpha: 0.3, grow: 1.8 },
      });
    }
  }

  /* ── Collision Clamping ── */

  private isColliderActive(hs: HotspotNode): boolean {
    if (!hs.config.collider) return false;
    /* Cleared weed patches and carried-off cartons free up their floor space */
    if ((hs.config.type === 'weeds' || hs.config.clearsWhenSearched) && hs.interacted) return false;
    return true;
  }

  /**
   * Clamps a normalized (x, y) point into the walkable floor area and pushes it
   * outside prop colliders, built upgrades and painted obstacles so the traveler
   * never stands inside scenery. `ignore` exempts one hotspot (e.g. the sleep spot).
   */
  private clampFloorTarget(nx: number, ny: number, ignore?: HotspotNode): { x: number; y: number } {
    const area = this.sceneConfig?.walkableArea ?? FALLBACK_WALK_AREA;
    const inArea = (px: number, py: number) =>
      px >= area.xMin && px <= area.xMax && py >= area.yMin && py <= area.yMax;
    let x = Math.max(area.xMin, Math.min(area.xMax, nx));
    let y = Math.max(area.yMin, Math.min(area.yMax, ny));

    const ellipses: { x: number; y: number; rx: number; ry: number }[] = [];
    const rects: Extract<SceneObstacle, { shape: 'rect' }>[] = [];
    for (const hs of this.hotspots) {
      if (hs === ignore || !this.isColliderActive(hs)) continue;
      ellipses.push({ ...hs.config.position, ...hs.config.collider! });
    }
    for (const ob of this.sceneConfig?.obstacles ?? []) {
      if (ob.shape === 'ellipse') ellipses.push(ob);
      else rects.push(ob);
    }

    for (let pass = 0; pass < 3; pass++) {
      for (const col of ellipses) {
        const dx = (x - col.x) / col.rx;
        const dy = (y - col.y) / col.ry;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          if (distSq < 1e-6) {
            y = col.y + col.ry * 1.06;
          } else {
            const dist = Math.sqrt(distSq);
            x = col.x + (dx / dist) * col.rx * 1.06;
            y = col.y + (dy / dist) * col.ry * 1.06;
          }
          x = Math.max(area.xMin, Math.min(area.xMax, x));
          y = Math.max(area.yMin, Math.min(area.yMax, y));
        }
      }
      for (const r of rects) {
        if (x <= r.xMin || x >= r.xMax || y <= r.yMin || y >= r.yMax) continue;
        const eps = 0.006;
        const exits = [
          { x: r.xMin - eps, y },
          { x: r.xMax + eps, y },
          { x, y: r.yMin - eps },
          { x, y: r.yMax + eps },
        ].filter((p) => inArea(p.x, p.y));
        if (exits.length === 0) continue;
        const best = exits.reduce((a, b) =>
          Math.hypot(a.x - x, a.y - y) <= Math.hypot(b.x - x, b.y - y) ? a : b,
        );
        x = best.x;
        y = best.y;
      }
    }

    return { x, y };
  }

  /* ── Particles & Floating Reward Text ── */

  private spawnLeafParticles(pos: { x: number; y: number }): void {
    if (this.state.reduceMotion) return;
    const base = this.toPx(pos.x, pos.y);
    const baseX = base.x;
    const baseY = base.y - 14;
    const colors = [0x6e9458, 0x8aad7a, 0xa8c698, 0x5b7d4e];

    for (let i = 0; i < 10; i++) {
      const leaf = new Graphics();
      const color = colors[i % colors.length];
      leaf.ellipse(0, 0, 4.5, 2.2).fill(color);
      leaf.rotation = Math.random() * Math.PI;
      leaf.position.set(baseX + (Math.random() - 0.5) * 26, baseY + (Math.random() - 0.5) * 14);
      this.fxLayer.addChild(leaf);
      this.particles.push({
        sprite: leaf,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -(0.7 + Math.random() * 1.1),
        gravity: 0.035,
        life: 0,
        maxLife: 650 + Math.random() * 450,
      });
    }
  }

  private spawnSparkles(pos: { x: number; y: number }, colors: number[]): void {
    if (this.state.reduceMotion) return;
    const base = this.toPx(pos.x, pos.y);
    for (let i = 0; i < 14; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, 1.4 + Math.random() * 2.2).fill(colors[i % colors.length]);
      dot.position.set(base.x + (Math.random() - 0.5) * 60, base.y + (Math.random() - 0.5) * 34);
      this.fxLayer.addChild(dot);
      this.particles.push({
        sprite: dot,
        vx: (Math.random() - 0.5) * 0.9,
        vy: -(0.4 + Math.random() * 0.9),
        gravity: 0.012,
        life: 0,
        maxLife: 700 + Math.random() * 600,
      });
    }
  }

  private showFloatingText(pos: { x: number; y: number }, text: string): void {
    if (!text) return;
    const anchor = this.toPx(pos.x, pos.y);
    const txt = new Text({
      text,
      style: new TextStyle({
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: 15,
        fontWeight: '700',
        fill: 0xfffcf6,
        stroke: { color: 0x3d3832, width: 3 },
        dropShadow: { alpha: 0.35, blur: 4, distance: 1 },
      }),
    });
    txt.anchor.set(0.5, 1);
    txt.position.set(anchor.x, anchor.y - 34);
    this.labelLayer.addChild(txt);

    const start = performance.now();
    /* Reduce Motion: the reward line fades in place instead of drifting upward */
    const rise = this.state.reduceMotion ? 0 : 44;
    const animate = () => {
      if (this.disposed || txt.destroyed) return;
      const p = (performance.now() - start) / 1300;
      txt.y = anchor.y - 34 - p * rise;
      txt.alpha = Math.max(0, 1 - Math.max(0, p - 0.25) / 0.75);
      if (p < 1) {
        requestAnimationFrame(animate);
      } else {
        txt.destroy();
      }
    };
    requestAnimationFrame(animate);
  }

  /* ── Walking ── */

  /** `durationMs` walks at a calm fixed pace that covers the distance in that time */
  private walkTo(x: number, y: number, onArrive?: () => void, durationMs?: number): void {
    this.travelerFlipped = x < this.targetX;
    this.walkingTo = { x, y };
    this.walkSpeed = durationMs ? Math.hypot(x - this.targetX, y - this.targetY) / durationMs : null;
    this.pendingCallback = onArrive ?? null;
    this.footstepAccum = 0;
    this.setPose('walk');
  }

  /**
   * Advance the 4-frame walk cycle (0 → 1 → 2 → 3 → 0) and play a footstep on each
   * foot-contact frame. Returns false when the still single-pose walk is in use.
   */
  private stepWalkCycle(dt: number): boolean {
    const sprite = this.travelerSprite;
    if (!this.walkCycleReady() || this.currentPose !== 'walk' || !sprite) return false;
    /* Wait until the walk sprite itself has loaded (never retexture the outgoing pose) */
    if (!this.walkFrames.includes(sprite.texture)) return true;

    const frameMs = this.walkSpeed ? STROLL_FRAME_MS : WALK_FRAME_MS;
    this.walkFrameElapsed += dt;
    while (this.walkFrameElapsed >= frameMs) {
      this.walkFrameElapsed -= frameMs;
      this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkFrames.length;
      if (this.walkFrameIndex % 2 === 0) playFootstep();
    }
    sprite.texture = this.walkFrames[this.walkFrameIndex];
    return true;
  }

  private handleFloorPointerDown = (event: { global: { x: number; y: number } }): void => {
    if (this.interactionLock || !this.entryDone) return;
    const { x: nx, y: ny } = this.toNorm(event.global.x, event.global.y);

    const area = this.sceneConfig?.walkableArea ?? FALLBACK_WALK_AREA;
    if (nx < area.xMin || nx > area.xMax || ny < area.yMin || ny > area.yMax) return;

    if (this.sleepMode || this.currentPose === 'sleep') {
      this.wakeUp();
      this.setPose('idle');
    }

    const clamped = this.clampFloorTarget(nx, ny);
    playFootstep();
    this.walkTo(clamped.x, clamped.y, () => {
      this.setPose('idle');
    });
  };

  /* ── Entry animation ── */

  private startEntryAnimation(): void {
    const entry = this.sceneConfig?.entryPoint ?? FALLBACK_ENTRY;
    const idle = this.sceneConfig?.idlePoint ?? FALLBACK_IDLE;

    this.targetX = entry.x;
    this.targetY = entry.y;

    if (this.state.reduceMotion) {
      this.targetX = idle.x;
      this.targetY = idle.y;
      this.setPose('idle');
      this.entryDone = true;
      return;
    }

    /* Appear at the threshold, pause a breath as the scene fades in, then stroll onto the roof */
    this.travelerNode.alpha = 0;
    this.travelerFlipped = idle.x < entry.x;
    this.setPose('idle');
    this.layoutTraveler();
    this.interactionLock = true;

    const startAt = STAGE_REVEAL_MS + ENTRY_PAUSE_MS;
    /* Footsteps come from the walk cycle's foot-contact frames (at the slower stroll pace) */
    this.after(startAt, () => {
      this.walkTo(
        idle.x,
        idle.y,
        () => {
          this.setPose('idle');
          this.entryDone = true;
          this.interactionLock = false;
        },
        ENTRY_STROLL_MS,
      );
    });
  }

  /* ── Restore terrace state on Continue ── */

  private restoreTerraceState(): void {
    if (this.state.siteId !== 'terrace') {
      this.fireLit = false;
      setCampfireAudio(false);
      return;
    }
    const ts = this.terrace;

    if (ts.fireLit) {
      this.fireLit = true;
      setCampfireAudio(true, this.fireProfile().crackle);
      const fp = this.hotspots.find((h) => h.config.id === 'firepit');
      if (fp) this.ensureFireEffects(fp);
    }

    for (const boxId of ts.searchedBoxes) {
      const box = this.hotspots.find((h) => h.config.id === boxId);
      if (box) {
        this.markCrateEmptied(box);
        this.showSearchedBox(box);
      }
    }

    for (const weedId of ts.clearedWeeds) {
      const weed = this.hotspots.find((h) => h.config.id === weedId);
      if (weed) {
        this.disableHotspotInteraction(weed);
        if (weed.propSprite) weed.propSprite.alpha = 0;
      }
    }

    /* Build slots show whatever the player placed there (or an empty "Build here" spot) */
    for (const hs of this.hotspots) {
      if (hs.slot) this.applySlot(hs, false);
    }
    /* Fixed stations at their saved tier */
    for (const station of this.sceneConfig?.stations ?? []) {
      if (station.assignableId) continue;
      const hs = this.stationHotspot(station);
      if (hs) this.applyStationTier(hs, station, false);
    }
    this.refreshStationLabels();
  }

  /* ── Layout ── */

  private layout(): void {
    const { width: W, height: H } = this;
    this.updateStageRect();
    const { width: SW, height: SH } = this.stage;

    this.floorHit.clear();
    this.floorHit.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.001 });
    this.floorHit.hitArea = new Rectangle(0, 0, W, H);

    if (this.bgSprite) {
      this.bgSprite.scale.set(SW / (this.bgSprite.texture.width || 1));
      this.bgSprite.position.set(this.stage.x + SW / 2, this.stage.y + SH / 2);
    }
    if (this.bgFill) {
      const tex = this.bgFill.texture;
      this.bgFill.visible = stageLeavesGaps(this.stage, W, H);
      this.bgFill.scale.set(Math.max(W / (tex.width || 1), H / (tex.height || 1)) * 1.08);
      this.bgFill.position.set(W / 2, H / 2);
    }
    this.drawFallback();

    this.mulWash.width = W;
    this.mulWash.height = H;
    this.scrWash.width = W;
    this.scrWash.height = H;
    const glowSize = Math.max(W, H) * 0.7;
    this.sunGlow.width = glowSize;
    this.sunGlow.height = glowSize;
    this.warmth.position.set(W * 0.5, H * 0.82);
    this.warmth.width = W * 1.1;
    this.warmth.height = H * 0.9;

    for (const hs of this.hotspots) {
      const { x: px, y: py } = this.toPx(hs.config.position.x, hs.config.position.y);
      hs.root.position.set(px, py);
      /* Sprite-less spots (stairwell door) sit flat beneath everything; unbuilt station blueprints are floor decals */
      const isBlueprint = !!hs.blueprint?.visible;
      hs.root.zIndex = isBlueprint ? 1 : hs.propSprite ? Math.round(py) : 0;

      const hr = hs.config.hitRect;
      if (hr) {
        hs.root.hitArea = new Rectangle(hr.dx * SW, hr.dy * SH, hr.w * SW, hr.h * SH);
      } else if (isBlueprint && hs.blueprint) {
        const rx = this.drawBlueprint(hs);
        hs.root.hitArea = new Circle(0, 0, Math.max(24, rx));
      } else if (hs.propSprite && hs.config.propScale && hs.propSprite.texture !== Texture.EMPTY) {
        const pH = SH * hs.config.propScale;
        const pScale = pH / (hs.propSprite.texture.height || 100);
        this.applyHotspotSpriteScale(hs);

        const pW = hs.propSprite.texture.width * pScale;
        const hitRadius = Math.max(30, Math.max(pW, pH) * 0.52);
        hs.root.hitArea = new Circle(0, -pH * 0.48, hitRadius);
      }
      if (hs.glows.length) this.layoutStationGlows(hs);
      if (hs.hovered) this.layoutHotspotLabel(hs);
    }

    if (this.fireGlow && this.sceneConfig) {
      const fp = this.sceneConfig.hotspots.find((h) => h.id === 'firepit');
      if (fp) {
        const p = this.toPx(fp.position.x, fp.position.y);
        this.fireGlow.position.set(p.x, p.y - SH * 0.03);
        const fgSize = this.fireGlowSize();
        this.fireGlow.width = fgSize;
        this.fireGlow.height = fgSize;
      }
    }

    for (const s of this.stars) {
      s.sprite.position.set(W * s.nx, H * s.ny);
    }

    this.layoutTraveler();
  }

  private warmthTarget(): number {
    return 0.03 + (Math.min(100, this.state.cozyIndex) / 100) * 0.22;
  }

  /** Place each station glow on the window/lantern painted in its current tier sprite */
  private layoutStationGlows(hs: HotspotNode): void {
    const tex = hs.propSprite?.texture;
    const ready = !!tex && tex !== Texture.EMPTY && hs.spriteSrc === hs.config.propSprite;
    for (const g of hs.glows) {
      g.sprite.visible = ready;
      if (!ready || !tex) continue;
      const SH = this.stage.height;
      const pH = SH * (hs.config.propScale ?? 0.1);
      const pW = tex.width * (pH / (tex.height || 1));
      const sign = hs.config.flipX ? -1 : 1;
      const base = this.toPx(hs.config.position.x, hs.config.position.y);
      g.sprite.position.set(base.x + (g.anchor.x - 0.5) * pW * sign, base.y - (1 - g.anchor.y) * pH);
      g.sprite.width = SH * g.anchor.size;
      g.sprite.height = SH * g.anchor.size;
    }
  }

  /* ── Frame update ── */

  private update(ticker: Ticker): void {
    const dt = ticker.deltaMS;
    this.elapsed += dt / 1000;

    if (this.lightTweenMS < LIGHTING_TWEEN_MS) {
      this.lightTweenMS = Math.min(LIGHTING_TWEEN_MS, this.lightTweenMS + dt);
    }
    const rawT = this.state.reduceMotion ? 1 : this.lightTweenMS / LIGHTING_TWEEN_MS;
    const ease = easeInOutCubic(rawT);

    const from = this.lightFrom;
    const c = this.current;
    const t = this.target;
    for (let i = 0; i < 3; i++) {
      c.mul[i] = lerp(from.mul[i], t.mul[i], ease);
      c.scr[i] = lerp(from.scr[i], t.scr[i], ease);
      c.sun[i] = lerp(from.sun[i], t.sun[i], ease);
    }
    c.mulAlpha = lerp(from.mulAlpha, t.mulAlpha, ease);
    c.scrAlpha = lerp(from.scrAlpha, t.scrAlpha, ease);
    c.sunAlpha = lerp(from.sunAlpha, t.sunAlpha, ease);
    c.sunX = lerp(from.sunX, t.sunX, ease);
    c.sunY = lerp(from.sunY, t.sunY, ease);
    c.lantern = lerp(from.lantern, t.lantern, ease);
    c.markerGlow = lerp(from.markerGlow, t.markerGlow, ease);
    c.nightFactor = lerp(from.nightFactor, t.nightFactor, ease);
    c.fireIntensity = lerp(from.fireIntensity, t.fireIntensity, ease);
    const k = this.state.reduceMotion ? 1 : 1 - Math.exp(-dt / 380);
    this.warmthCurrent = lerp(this.warmthCurrent, this.warmthTarget(), k);

    if (this.backdropReady && this.app.stage.alpha < 1) {
      this.app.stage.alpha = this.state.reduceMotion ? 1 : Math.min(1, this.app.stage.alpha + dt / STAGE_REVEAL_MS);
    }

    if (this.travelerNode.alpha < 1) {
      this.travelerNode.alpha = this.state.reduceMotion ? 1 : Math.min(1, this.travelerNode.alpha + dt / 520);
    }

    for (const hs of this.hotspots) {
      if (!hs.blueprint?.visible) continue;
      hs.blueprint.alpha = hs.hovered
        ? 1
        : this.state.reduceMotion
          ? 0.8
          : 0.62 + 0.25 * Math.sin(this.elapsed * 2.2);
    }

    /* Station window & lantern glows warm up at dusk and night */
    const flicker = this.state.reduceMotion
      ? 1
      : 0.88 + 0.08 * Math.sin(this.elapsed * 5.3) + 0.04 * Math.sin(this.elapsed * 11.1);
    for (const hs of this.hotspots) {
      for (const g of hs.glows) g.sprite.alpha = 0.78 * this.current.lantern * flicker;
    }

    /* Night stars & rooftop fireflies */
    const nf = this.current.nightFactor;
    this.starLayer.visible = nf > 0.01;
    this.fireflyLayer.visible = nf > 0.01;
    if (nf > 0.01) {
      for (const s of this.stars) {
        const twinkle = this.state.reduceMotion
          ? 1
          : 0.55 + 0.45 * Math.sin(this.elapsed * s.speed + s.phase);
        s.sprite.alpha = nf * s.baseAlpha * twinkle;
      }
      const stepSec = dt / 1000;
      for (const f of this.fireflies) {
        if (!this.state.reduceMotion) {
          f.nx += (f.vx + Math.sin(this.elapsed * 0.9 + f.phase) * 0.004) * stepSec;
          f.ny += (f.vy + Math.cos(this.elapsed * 1.1 + f.phase) * 0.003) * stepSec;
          if (f.nx < 0.14 || f.nx > 0.84) f.vx *= -1;
          if (f.ny < 0.44 || f.ny > 0.82) f.vy *= -1;
        }
        const fp = this.toPx(f.nx, f.ny);
        f.sprite.position.set(fp.x, fp.y);
        const pulse = this.state.reduceMotion
          ? 0.8
          : 0.35 + 0.65 * Math.max(0, Math.sin(this.elapsed * f.speed + f.phase));
        f.sprite.alpha = nf * pulse;
      }
    }

    /* Walking */
    if (this.walkingTo) {
      const pace = this.walkSpeed ?? (this.state.reduceMotion ? 0.0012 : 0.00055);
      const speed = pace * dt;
      const dx = this.walkingTo.x - this.targetX;
      const dy = this.walkingTo.y - this.targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.008) {
        this.targetX = this.walkingTo.x;
        this.targetY = this.walkingTo.y;
        this.walkingTo = null;
        this.walkSpeed = null;
        this.layoutTraveler();
        if (this.pendingCallback) {
          const cb = this.pendingCallback;
          this.pendingCallback = null;
          cb();
        }
      } else {
        this.targetX += (dx / dist) * Math.min(speed, dist);
        this.targetY += (dy / dist) * Math.min(speed, dist);
        this.travelerFlipped = dx < 0;
        if (!this.stepWalkCycle(dt)) {
          /* Single still stride (Reduce Motion / frames not loaded): steady footsteps */
          this.footstepAccum += dt;
          if (this.footstepAccum >= 380) {
            this.footstepAccum = 0;
            playFootstep();
          }
        }
        this.layoutTraveler();
      }
    }

    /* Breathing idle */
    if (this.currentPose === 'idle' && this.travelerSprite && !this.state.reduceMotion) {
      this.breathPhase += dt / 1000;
      const breathScale = 1 + 0.015 * Math.sin(this.breathPhase * 1.7);
      const targetH = this.stage.height * BASE_STANDING_HEIGHT_RATIO * POSE_HEIGHT_SCALE.idle;
      const tex = this.travelerSprite.texture;
      const baseScale = (targetH / (tex.height || 1)) * this.poseScaleMultiplier;
      this.travelerSprite.scale.y = baseScale * breathScale;
    }

    /* Walking bob (relative to travelerNode feet): lowest at each foot contact, highest mid-stride */
    if (this.currentPose === 'walk' && this.travelerSprite && !this.state.reduceMotion) {
      if (this.walkFrames.includes(this.travelerSprite.texture)) {
        const frameMs = this.walkSpeed ? STROLL_FRAME_MS : WALK_FRAME_MS;
        const stride = ((this.walkFrameIndex % 2) + Math.min(1, this.walkFrameElapsed / frameMs)) / 2;
        const amplitude = this.walkSpeed ? WALK_BOB_PX * 0.8 : WALK_BOB_PX;
        this.travelerSprite.y = this.walkingTo ? -amplitude * Math.sin(Math.PI * stride) : 0;
      } else {
        const cadence = this.walkSpeed ? 0.55 : 1;
        this.travelerSprite.y = -WALK_BOB_PX * Math.abs(Math.sin(this.elapsed * 8.5 * cadence));
      }
    }

    /* Fire flames & particles */
    if (this.fireLit) {
      this.drawFlames();
      this.spawnFireEmbers();
    }
    this.updateParticles(dt);
    this.updateWeather(dt);

    if (this.fireGlow && this.fireLit) {
      const prof = this.fireProfile();
      const flicker = this.state.reduceMotion
        ? 0.78
        : 0.72 + 0.18 * Math.sin(this.elapsed * 7.2) + 0.1 * Math.sin(this.elapsed * 13.7);
      this.fireGlow.alpha = Math.min(1, this.current.fireIntensity * flicker * prof.glowBoost);
      this.fireGlow.tint = prof.glowTint;
      const fgSize = this.fireGlowSize();
      this.fireGlow.width = fgSize;
      this.fireGlow.height = fgSize;
    }

    this.applyLighting();
  }

  private fireTier(): FirepitTier {
    if (this.state.siteId !== 'terrace') return 3;
    return Math.max(1, Math.min(3, this.terrace.firepitTier)) as FirepitTier;
  }

  private fireProfile(): FireProfile {
    return FIRE_TIERS[this.fireTier()];
  }

  /** Warm radial pool size: wider per tier, and wider still at dusk/night */
  private fireGlowSize(): number {
    const prof = this.fireProfile();
    return this.stage.height * (0.34 + this.current.nightFactor * prof.nightGlow) * prof.glowScale;
  }

  private firepitNode(): HotspotNode | undefined {
    return this.hotspots.find((h) => h.config.id === 'firepit');
  }

  private drawFlames(): void {
    const node = this.firepitNode();
    if (!this.fireFlames || !node) return;
    const prof = this.fireProfile();
    const SH = this.stage.height;
    const propH = SH * (node.config.propScale ?? 0.085);
    /* Local to firepit root (bottom-center of the fire pit sprite) */
    const cy = -propH * 0.45;
    /* Sized against the original ring so Tier 1 keeps the familiar modest flame */
    const base = Math.max(0.7, (SH * 0.085) / 58);
    const unit = base * prof.flame;
    const wide = base * (1 + (prof.flame - 1) * 0.6);
    const still = this.state.reduceMotion;
    const t = this.elapsed;
    const sway = still ? 0 : Math.sin(t * 9) * 2.4 * unit;
    const hScale = still ? 1 : 0.9 + 0.18 * Math.sin(t * 12.4);

    const g = this.fireFlames;
    g.clear();

    /* Tier 3: warm glowing coal bed pulsing beneath the flames */
    if (prof.coals) {
      const pulse = still ? 0.6 : 0.5 + 0.22 * Math.sin(t * 2.3) + 0.08 * Math.sin(t * 5.1);
      g.ellipse(0, cy + 3 * base, 15 * wide, 4.2 * base).fill({ color: 0xc2410c, alpha: 0.55 * pulse + 0.2 });
      g.ellipse(0, cy + 2.6 * base, 9.5 * wide, 2.8 * base).fill({ color: 0xff7a24, alpha: 0.7 * pulse + 0.15 });
      g.ellipse(0, cy + 2.2 * base, 5 * wide, 1.6 * base).fill({ color: 0xffc860, alpha: 0.8 * pulse + 0.1 });
    }

    /* Side tongues (Tier 2+): smaller licks swaying on their own rhythm */
    for (let i = 1; i <= prof.tongues; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const ring = Math.ceil(i / 2);
      const phase = i * 1.7;
      const lick = still ? 1 : 0.82 + 0.26 * Math.sin(t * (10 + i * 1.3) + phase);
      const tSway = still ? 0 : Math.sin(t * (7.5 + i) + phase) * 1.8 * unit;
      const ox = side * (4.5 + 3.2 * ring) * wide + tSway * 0.6;
      const h = (0.72 - ring * 0.1) * lick;
      g.ellipse(ox, cy - 7 * unit * h, 5.2 * wide, 10 * unit * h).fill({ color: 0xe8551a, alpha: 0.72 });
      g.ellipse(ox * 0.95, cy - 5.6 * unit * h, 3.1 * wide, 6.6 * unit * h).fill({ color: 0xffb53a, alpha: 0.85 });
    }

    /* Main flame: deep amber outer, golden middle, bright core */
    g.ellipse(sway * 0.5, cy - 9 * unit * hScale, 9 * wide, 13 * unit * hScale).fill({ color: 0xff6a1a, alpha: 0.78 });
    g.ellipse(-sway * 0.4, cy - 7 * unit * hScale, 6 * wide, 9.5 * unit * hScale).fill({ color: 0xffa832, alpha: 0.88 });
    g.ellipse(sway * 0.2, cy - 5 * unit * hScale, 3.2 * wide, 5.5 * unit * hScale).fill({ color: 0xffe488, alpha: 0.95 });

    /* Tier 3: an extra flickering tip licking above the main flame */
    if (prof.tongues >= 4 && !still) {
      const tip = 0.6 + 0.4 * Math.max(0, Math.sin(t * 6.7));
      g.ellipse(sway * 0.8, cy - 21 * unit * hScale, 3.4 * wide, 6 * unit * tip).fill({ color: 0xff8a2a, alpha: 0.55 * tip });
    }
  }

  private spawnFireEmbers(): void {
    const node = this.firepitNode();
    if (this.state.reduceMotion || !node) return;
    const prof = this.fireProfile();
    const SH = this.stage.height;
    const propH = SH * (node.config.propScale ?? 0.085);
    const base = this.toPx(node.config.position.x, node.config.position.y);
    const baseX = base.x;
    const baseY = base.y - propH * 0.48;
    const spread = 14 * (1 + (prof.flame - 1) * 0.8);

    if (Math.random() < prof.emberChance) {
      const ember = new Graphics();
      const size = 1.4 + Math.random() * 2.0;
      const isHot = Math.random() < 0.4;
      ember.circle(0, 0, size).fill(isHot ? 0xffd268 : 0xff6b24);
      ember.position.set(baseX + (Math.random() - 0.5) * spread, baseY);
      this.fxLayer.addChild(ember);
      /* Bigger fires loft their embers higher and steadier */
      const lift = 0.85 + (prof.flame - 1) * 0.6;
      this.particles.push({
        sprite: ember,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.55 + Math.random() * 0.8) * lift,
        gravity: -0.008,
        life: 0,
        maxLife: (650 + Math.random() * 750) * lift,
      });
    }

    /* Tier 3: soft, curling translucent smoke wisps */
    if (prof.smokeChance > 0 && Math.random() < prof.smokeChance) {
      const wisp = new Graphics();
      wisp.circle(0, 0, 5 + Math.random() * 3).fill({ color: 0xd9d0c6 });
      wisp.position.set(baseX + (Math.random() - 0.5) * 8, baseY - 26 * Math.max(0.7, (SH * 0.085) / 58) * prof.flame);
      this.fxLayer.addChild(wisp);
      this.particles.push({
        sprite: wisp,
        vx: (Math.random() - 0.5) * 0.35 + 0.12,
        vy: -(0.32 + Math.random() * 0.2),
        gravity: -0.002,
        life: 0,
        maxLife: 2000 + Math.random() * 900,
        smoke: { peakAlpha: 0.16 + Math.random() * 0.08, grow: 2.2 },
      });
    }
  }

  private updateParticles(dt: number): void {
    const step = dt / 16.67;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy += p.gravity * step;
      p.sprite.x += p.vx * step;
      p.sprite.y += p.vy * step;
      const ratio = p.life / p.maxLife;
        if (p.smoke) {
          p.sprite.alpha = Math.max(0, p.smoke.peakAlpha * Math.sin(Math.PI * Math.min(1, ratio)));
          p.sprite.scale.set(1 + ratio * p.smoke.grow);
        } else {
          p.sprite.alpha = Math.max(0, 1 - ratio);
          p.sprite.scale.set(Math.max(0.25, 1 - ratio * 0.65));
        }
      if (p.life >= p.maxLife) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private updateWeather(dt: number): void {
    const walk = this.sceneConfig?.walkableArea ?? FALLBACK_WALK_AREA;
    const f = this.weatherFrame;
    f.dtMs = dt;
    f.elapsedSec = this.elapsed;
    f.width = this.width;
    f.height = this.height;
    f.stage = this.stage;
    f.nightFactor = this.current.nightFactor;
    f.floor.xMin = walk.xMin + 0.04;
    f.floor.xMax = walk.xMax - 0.06;
    f.floor.yMin = walk.yMin + 0.03;
    f.floor.yMax = walk.yMax;
    this.weatherLayer.update(f);

    /* Uncut weeds lean with the wind (rooted at their base), a little more in each gust */
    const gust = this.weatherLayer.gust;
    const swaying = this.sceneWeather(this.state) === 'wind' && !this.state.reduceMotion;
    for (const hs of this.hotspots) {
      if (hs.config.type !== 'weeds' || !hs.propSprite) continue;
      hs.propSprite.rotation =
        swaying && !hs.interacted
          ? WEED_SWAY * (0.3 + gust) * Math.sin(this.elapsed * (1.8 + gust * 1.6) + hs.config.position.x * 9)
          : 0;
    }
  }

  private applyLighting(): void {
    const c = this.current;
    const { width: W, height: H } = this;

    /* Rain: cool misty overcast over the phase lighting (softer at night so it stays dark & cozy) */
    const overcast = this.weatherLayer.overcast;
    const mix = overcast * OVERCAST_TINT_MIX * (1 - 0.6 * c.nightFactor);
    this.mulWash.tint =
      (Math.round(lerp(c.mul[0], OVERCAST_MUL[0], mix)) << 16) |
      (Math.round(lerp(c.mul[1], OVERCAST_MUL[1], mix)) << 8) |
      Math.round(lerp(c.mul[2], OVERCAST_MUL[2], mix));
    this.mulWash.alpha = Math.min(0.85, c.mulAlpha + 0.1 * overcast * (1 - 0.5 * c.nightFactor));
    this.scrWash.tint = toHex(c.scr);
    this.scrWash.alpha = c.scrAlpha * (1 - 0.5 * overcast);
    this.sunGlow.tint = toHex(c.sun);
    this.sunGlow.alpha = c.sunAlpha * (1 - 0.6 * overcast);
    this.sunGlow.position.set(W * c.sunX, H * c.sunY);
    this.warmth.alpha = this.warmthCurrent;
  }
}
