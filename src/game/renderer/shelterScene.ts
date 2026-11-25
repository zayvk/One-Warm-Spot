import {
  Application,
  Assets,
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
import type { ResourceId, SiteId, TimeOfDay, TravelerGender } from '../types/game.ts';
import type {
  BuildableConfig,
  HotspotConfig,
  SceneObstacle,
  ShelterSceneConfig,
} from '../data/scenes/types.ts';
import { BG_SHELTERS, travelerSpriteSrc, SCENE_STAGES } from '../data/media.ts';
import type { TravelerPose } from '../data/media.ts';
import { SITES } from '../data/sites.ts';
import { RESOURCE_MAP } from '../data/resources.ts';
import { getSceneConfig } from '../data/scenes/index.ts';
import { loadTerraceState, saveTerraceState, type TerraceState } from '../engine/terraceState.ts';
import {
  playFireLight,
  playFireDouse,
  setCampfireAudio,
  playRummage,
  playWeedCut,
  playSleep as playSleepSfx,
  playFootstep,
  playBuild,
  playClaim,
  playWaterChime,
} from '../audio/soundEngine.ts';

/* ═══════════════════════════════════════════
   Public state contract
   ═══════════════════════════════════════════ */

export interface ShelterSceneState {
  siteId: SiteId | null;
  timeOfDay: TimeOfDay;
  built: readonly string[];
  lanternLit: boolean;
  cozyIndex: number;
  reduceMotion: boolean;
  gender: TravelerGender;
}

/** Callback when a hotspot interaction awards resources */
export type RewardCallback = (reward: Record<string, number>) => void;

/** Pays for an in-scene build; returns false if the materials ran short */
export type BuildCallback = (cost: Partial<Record<ResourceId, number>>) => boolean;

/** In-scene build progress, mirrored to the React build bar */
export interface SceneBuildState {
  built: string[];
  pending: string | null;
}
export type BuildStateCallback = (state: SceneBuildState) => void;

/** Gentle toast request (e.g. the stairwell door) */
export type NoticeCallback = (message: string) => void;

/* ═══════════════════════════════════════════
   Lighting presets
   ═══════════════════════════════════════════ */

type RGB = [number, number, number];

interface Lighting {
  mul: RGB; mulAlpha: number;
  scr: RGB; scrAlpha: number;
  sun: RGB; sunAlpha: number; sunX: number; sunY: number;
  lantern: number; markerGlow: number;
}

function hex(c: number): RGB {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

const LIGHTING: Record<TimeOfDay, Lighting> = {
  morning: {
    mul: hex(0xffe2b8), mulAlpha: 0.32,
    scr: hex(0xffc870), scrAlpha: 0.12,
    sun: hex(0xffd68a), sunAlpha: 0.55, sunX: 0.16, sunY: 0.1,
    lantern: 0, markerGlow: 0.8,
  },
  afternoon: {
    mul: hex(0xfff7ea), mulAlpha: 0.08,
    scr: hex(0xfffaf0), scrAlpha: 0.07,
    sun: hex(0xfff4d6), sunAlpha: 0.28, sunX: 0.78, sunY: 0.06,
    lantern: 0, markerGlow: 0.7,
  },
  dusk: {
    mul: hex(0xf0a078), mulAlpha: 0.52,
    scr: hex(0xff9a5c), scrAlpha: 0.1,
    sun: hex(0xffa860), sunAlpha: 0.5, sunX: 0.86, sunY: 0.46,
    lantern: 0.6, markerGlow: 1,
  },
  night: {
    mul: hex(0x3a4878), mulAlpha: 0.68,
    scr: hex(0x1a2240), scrAlpha: 0.04,
    sun: hex(0xdfe6ff), sunAlpha: 0.12, sunX: 0.8, sunY: 0.1,
    lantern: 1, markerGlow: 1.15,
  },
};

/* ═══════════════════════════════════════════
   Fallback Walkable Area (for non-custom sites)
   ═══════════════════════════════════════════ */

const FALLBACK_WALK_AREA = { xMin: 0.12, xMax: 0.88, yMin: 0.60, yMax: 0.88 };
const FALLBACK_ENTRY = { x: -0.05, y: 0.78 };
const FALLBACK_IDLE = { x: 0.42, y: 0.76 };

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
};

const POSE_SHADOW: Record<TravelerPose, { rx: number; ry: number; alpha: number }> = {
  idle: { rx: 0.23, ry: 0.052, alpha: 0.24 },
  walk: { rx: 0.23, ry: 0.052, alpha: 0.24 },
  search: { rx: 0.28, ry: 0.058, alpha: 0.22 },
  sit: { rx: 0.31, ry: 0.062, alpha: 0.20 },
  sleep: { rx: 0.44, ry: 0.068, alpha: 0.18 },
};

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

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
  hoverRing: Graphics;
  label: Text;
  labelPill: Graphics;
  hovered: boolean;
  interacted: boolean;
}

/** A placeable in-scene upgrade: floor blueprint until built, then a real prop */
interface BuildNode {
  config: BuildableConfig;
  root: Container;
  blueprint: Graphics;
  sprite: Sprite;
  label: Text;
  labelPill: Graphics;
  hovered: boolean;
  built: boolean;
}

interface SceneParticle {
  sprite: Graphics;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
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
  private poseToken = 0;
  private poseScaleMultiplier = 1;
  private targetX = 0.40;
  private targetY = 0.73;
  private travelerFlipped = false;
  private walkingTo: { x: number; y: number } | null = null;
  private breathPhase = 0;
  private footstepAccum = 0;

  /* Hotspots */
  private readonly labelLayer = new Container();
  private hotspots: HotspotNode[] = [];
  private sceneConfig: ShelterSceneConfig | null = null;

  /* In-scene builds */
  private buildNodes: BuildNode[] = [];
  private pendingBuildId: string | null = null;
  private shedLantern: Sprite | null = null;
  private onBuild: BuildCallback | null = null;
  private onBuildState: BuildStateCallback | null = null;
  private onNotice: NoticeCallback | null = null;

  /* Fire & Burst Particles */
  private readonly fxLayer = new Container();
  private fireLit = false;
  private fireFlames: Graphics | null = null;
  private fireGlow: Sprite | null = null;
  private particles: SceneParticle[] = [];

  /* Interaction & Sleep State */
  private interactionLock = false;
  private pendingCallback: (() => void) | null = null;
  private sleepMode = false;
  /** While asleep, sort just above the shelter so the traveler lies on its bedding */
  private sleepZ: number | null = null;

  /* State */
  private state: ShelterSceneState;
  private current: Lighting;
  private target: Lighting;
  private warmthCurrent = 0;
  private elapsed = 0;
  private width: number;
  private height: number;
  private entryDone = false;
  private terrace: TerraceState;
  private disposed = false;

  /* Reward callback */
  private onReward: RewardCallback | null = null;

  constructor(app: Application, initial: ShelterSceneState) {
    this.app = app;
    this.radial = createRadialTexture();
    this.state = initial;
    this.current = cloneLighting(LIGHTING[initial.timeOfDay]);
    this.target = LIGHTING[initial.timeOfDay];
    this.warmthCurrent = this.warmthTarget();
    this.width = app.screen.width;
    this.height = app.screen.height;
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

    /* Non-interactive FX & label overlays */
    this.fxLayer.eventMode = 'none';
    this.labelLayer.eventMode = 'none';

    /* Stage layer order */
    app.stage.addChild(
      this.bgLayer,
      this.mulWash,
      this.scrWash,
      this.sunGlow,
      this.worldLayer,
      this.warmth,
      this.fxLayer,
      this.labelLayer,
    );

    this.sceneConfig = getSceneConfig(initial.siteId);
    this.preloadTravelerPoses(initial.gender);
    this.loadBackground(initial.siteId);
    this.buildHotspots();
    this.buildBuildables();
    this.loadTraveler(initial.gender, 'idle');
    this.restoreTerraceState();
    this.layout();
    this.applyLighting();
    this.startEntryAnimation();

    app.ticker.add(this.update, this);
  }

  /* ── Public API ── */

  setState(next: ShelterSceneState): void {
    const prev = this.state;
    this.state = next;
    if (next.siteId !== prev.siteId) {
      this.sceneConfig = getSceneConfig(next.siteId);
      this.loadBackground(next.siteId);
      this.buildHotspots();
      this.buildBuildables();
      this.restoreTerraceState();
      this.emitBuildState();
    }
    if (next.gender !== prev.gender) {
      this.preloadTravelerPoses(next.gender);
      this.loadTraveler(next.gender, this.currentPose);
    }
    this.target = this.sleepMode ? LIGHTING.night : LIGHTING[next.timeOfDay];
    if (next.reduceMotion) {
      this.current = cloneLighting(this.target);
      this.warmthCurrent = this.warmthTarget();
    }
    this.layout();
    this.applyLighting();
  }

  setRewardCallback(cb: RewardCallback): void {
    this.onReward = cb;
  }

  setBuildCallback(cb: BuildCallback): void {
    this.onBuild = cb;
  }

  setBuildStateCallback(cb: BuildStateCallback): void {
    this.onBuildState = cb;
    this.emitBuildState();
  }

  setNoticeCallback(cb: NoticeCallback): void {
    this.onNotice = cb;
  }

  /**
   * Walk over and build an in-scene upgrade. Returns false if the scene is busy
   * or the upgrade is unknown/already built; materials are paid on arrival.
   */
  requestBuild(id: string): boolean {
    if (this.disposed || this.interactionLock || !this.entryDone) return false;
    const cfg = this.sceneConfig?.buildables?.find((b) => b.id === id);
    if (!cfg || this.terrace.builtProps.includes(id)) return false;

    if (this.sleepMode || this.currentPose === 'sleep') this.wakeUp();
    for (const hs of this.hotspots) if (hs.hovered) this.onHotspotHover(hs, false);
    for (const bn of this.buildNodes) if (bn.hovered) this.onBuildHover(bn, false);

    this.interactionLock = true;
    this.pendingBuildId = id;
    this.emitBuildState();

    const stand = this.clampFloorTarget(
      cfg.position.x + (cfg.standOffset?.dx ?? 0),
      cfg.position.y + (cfg.standOffset?.dy ?? 0.04),
    );
    const arrive = () => {
      if (Math.abs(cfg.position.x - this.targetX) > 0.005) {
        this.travelerFlipped = cfg.position.x < this.targetX;
        this.layoutTraveler();
      }
      this.performBuild(cfg);
    };
    if (Math.hypot(stand.x - this.targetX, stand.y - this.targetY) < 0.015) {
      arrive();
    } else {
      this.walkTo(stand.x, stand.y, arrive);
    }
    return true;
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
    this.buildNodes = [];
    this.particles = [];
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

  /* ── Background ── */

  private loadBackground(siteId: SiteId | null): void {
    const token = ++this.bgToken;
    this.drawFallback(siteId);
    if (!siteId) return;

    const stageUrl = SCENE_STAGES[siteId];
    const src = stageUrl ?? BG_SHELTERS[siteId].src;

    Assets.load<Texture>(src)
      .then((texture) => {
        if (this.disposed || token !== this.bgToken || !texture) return;
        if (this.bgSprite) {
          this.bgSprite.destroy();
          this.bgSprite = null;
        }
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.alpha = this.state.reduceMotion ? 1 : 0;
        sprite.eventMode = 'none';
        this.bgSprite = sprite;
        this.bgLayer.addChildAt(sprite, this.bgFallback ? 1 : 0);
        this.layout();
      })
      .catch(() => { /* keep the gradient fallback */ });
  }

  private drawFallback(siteId: SiteId | null): void {
    const site = SITES.find((s) => s.id === siteId);
    if (!this.bgFallback) {
      this.bgFallback = new Graphics();
      this.bgFallback.eventMode = 'none';
      this.bgLayer.addChildAt(this.bgFallback, 0);
    }
    const g = this.bgFallback;
    const { width: W, height: H } = this;
    g.clear();
    g.rect(0, 0, W, H * 0.62).fill(0xe3edf7);
    g.rect(0, H * 0.62, W, H * 0.38).fill(0xc5d6bc);
    g.roundRect(W * 0.28, H * 0.36, W * 0.44, H * 0.3, 12).fill({
      color: site?.silhouetteColor ?? 0x9e6b42,
      alpha: 0.8,
    });
  }

  /* ── Traveler ── */

  private preloadTravelerPoses(gender: TravelerGender): void {
    const poses: TravelerPose[] = ['idle', 'walk', 'search', 'sit', 'sleep'];
    for (const p of poses) {
      void Assets.load<Texture>(travelerSpriteSrc(gender, p)).catch(() => {});
    }
  }

  private loadTraveler(gender: TravelerGender, pose: TravelerPose): void {
    const token = ++this.poseToken;
    const prevPose = this.currentPose;
    const src = travelerSpriteSrc(gender, pose);
    this.currentPose = pose;

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
    const { width: W, height: H } = this;
    const px = W * this.targetX;
    const py = H * this.targetY;
    this.travelerNode.position.set(px, py);
    this.travelerNode.zIndex =
      this.sleepMode && this.sleepZ !== null ? this.sleepZ : Math.round(py);

    const baseStandingHeight = H * BASE_STANDING_HEIGHT_RATIO;
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
      hs.root.destroy({ children: true });
    }
    this.labelLayer.removeChildren();
    this.hotspots = [];
    this.fireFlames = null;

    if (!this.sceneConfig) return;

    for (const cfg of this.sceneConfig.hotspots) {
      const root = new Container();
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.hitArea = new Circle(0, -20, 42);

      const hoverRing = new Graphics();
      hoverRing.visible = false;
      hoverRing.eventMode = 'none';
      root.addChild(hoverRing);

      let propSprite: Sprite | null = null;
      if (cfg.propSprite) {
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
        hoverRing,
        label,
        labelPill,
        hovered: false,
        interacted: false,
      };
      if (cfg.propSprite) this.setHotspotSprite(node, cfg.propSprite);

      root.on('pointerenter', () => this.onHotspotHover(node, true));
      root.on('pointerleave', () => this.onHotspotHover(node, false));
      root.on('pointerdown', (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        this.onHotspotClick(node);
      });

      this.worldLayer.addChild(root);
      this.hotspots.push(node);
    }
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

  private isHotspotInteractive(node: HotspotNode): boolean {
    const t = node.config.type;
    return !node.interacted || t === 'sleep' || t === 'firepit' || t === 'door';
  }

  private setHotspotLabel(node: HotspotNode, text: string): void {
    node.label.text = text;
    if (node.hovered) this.layoutHotspotLabel(node);
  }

  private onHotspotHover(node: HotspotNode, enter: boolean): void {
    if (!this.isHotspotInteractive(node)) {
      node.hovered = false;
      node.label.visible = false;
      node.labelPill.visible = false;
      node.hoverRing.visible = false;
      return;
    }
    node.hovered = enter;
    node.label.visible = enter;
    node.labelPill.visible = enter;
    node.hoverRing.visible = enter;
    if (node.propSprite && !this.state.reduceMotion) {
      node.propSprite.tint = enter ? 0xfff6e5 : 0xffffff;
    }
    if (enter) {
      this.drawHoverRing(node);
      this.layoutHotspotLabel(node);
    }
  }

  private drawHoverRing(node: HotspotNode): void {
    const g = node.hoverRing;
    g.clear();
    const hr = node.config.hitRect;
    if (hr) {
      /* Soft glow outline around backdrop features (e.g. the stairwell door) */
      const { width: W, height: H } = this;
      g.roundRect(hr.dx * W, hr.dy * H, hr.w * W, hr.h * H, 12)
        .fill({ color: 0xfff2cc, alpha: 0.07 })
        .stroke({ color: 0xfff2cc, width: 2, alpha: 0.55 });
      return;
    }
    const ry = node.config.type === 'sleep' ? 0 : -4;
    const rx = node.config.type === 'sleep' ? 46 : 30;
    g.ellipse(0, ry, rx, 11).stroke({ color: 0xfff2cc, width: 2.2, alpha: 0.9 });
  }

  private layoutHotspotLabel(node: HotspotNode): void {
    const { width: W, height: H } = this;
    const cfg = node.config;
    const rawX = W * cfg.position.x;
    let rawY: number;
    if (cfg.hitRect) {
      rawY = H * (cfg.position.y + cfg.hitRect.dy) + 30;
    } else {
      const propH = cfg.propScale ? H * cfg.propScale : 44;
      rawY = H * cfg.position.y - Math.max(44, propH + 10);
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

  private onHotspotClick(node: HotspotNode): void {
    if (this.interactionLock || !this.entryDone) return;
    if (!this.isHotspotInteractive(node)) return;

    if (this.sleepMode && node.config.type !== 'sleep') {
      this.wakeUp();
    }

    const cfg = node.config;
    const rawX = cfg.position.x + (cfg.standOffset?.dx ?? 0);
    const rawY = cfg.position.y + (cfg.standOffset?.dy ?? 0.04);
    /* The sleep spot lies inside its own shelter's footprint */
    const standPos = this.clampFloorTarget(rawX, rawY, cfg.type === 'sleep' ? node : undefined);

    this.onHotspotHover(node, false);
    this.interactionLock = true;

    const dx = standPos.x - this.targetX;
    const dy = standPos.y - this.targetY;
    if (Math.hypot(dx, dy) < 0.015) {
      if (Math.abs(cfg.position.x - this.targetX) > 0.005) {
        this.travelerFlipped = cfg.position.x < this.targetX;
        this.layoutTraveler();
      }
      this.executeInteraction(node);
      return;
    }

    this.walkTo(standPos.x, standPos.y, () => {
      /* Face toward the prop before interacting */
      if (Math.abs(cfg.position.x - this.targetX) > 0.005) {
        this.travelerFlipped = cfg.position.x < this.targetX;
        this.layoutTraveler();
      }
      this.executeInteraction(node);
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
    }
  }

  private disableHotspotInteraction(node: HotspotNode): void {
    node.interacted = true;
    node.hovered = false;
    node.label.visible = false;
    node.labelPill.visible = false;
    node.hoverRing.visible = false;
    node.root.cursor = 'default';
    node.root.eventMode = 'none';
    if (node.propSprite) node.propSprite.tint = 0xffffff;
  }

  private interactFirepit(node: HotspotNode): void {
    if (!this.fireLit) {
      playFireLight();
      this.fireLit = true;
      this.terrace.fireLit = true;
      saveTerraceState(this.terrace);
      setCampfireAudio(true);

      this.ensureFireEffects(node);
      if (this.fireFlames) this.fireFlames.alpha = 1;
      if (this.fireGlow) this.fireGlow.visible = true;
      this.setHotspotLabel(node, 'Extinguish fire');
      this.layout();

      this.after(600, () => {
        this.setPose('sit');
        this.interactionLock = false;
      });
      return;
    }

    /* Extinguish lit fire pit */
    playFireDouse();
    setCampfireAudio(false);
    this.fireLit = false;
    this.terrace.fireLit = false;
    saveTerraceState(this.terrace);
    this.setHotspotLabel(node, 'Light fire pit');
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
      this.disableHotspotInteraction(node);
      if (!this.terrace.searchedBoxes.includes(node.config.id)) {
        this.terrace.searchedBoxes.push(node.config.id);
      }
      saveTerraceState(this.terrace);
      this.showSearchedBox(node);

      if (node.config.reward && this.onReward) {
        this.onReward(node.config.reward);
      }
      if (node.config.reward) {
        this.showFloatingText(node.config.position, formatMaterials(node.config.reward, '+'));
      }
      this.setPose('idle');
      this.interactionLock = false;
    });
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

      if (node.propSprite) {
        const sprite = node.propSprite;
        if (this.state.reduceMotion) {
          sprite.alpha = 0;
        } else {
          const start = performance.now();
          const fade = () => {
            if (this.disposed || sprite.destroyed) return;
            const p = Math.min(1, (performance.now() - start) / 400);
            sprite.alpha = 1 - p;
            if (p < 1) requestAnimationFrame(fade);
          };
          requestAnimationFrame(fade);
        }
      }

      if (node.config.reward && this.onReward) {
        this.onReward(node.config.reward);
      }
      if (node.config.reward) {
        this.showFloatingText(node.config.position, formatMaterials(node.config.reward, '+'));
      }
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  private interactSleep(node: HotspotNode): void {
    this.sleepMode = true;
    this.sleepZ = node.root.zIndex + 1;
    this.target = LIGHTING.night;
    /* Tuck head/pack inside the shed frame, facing out toward the rooftop */
    this.travelerFlipped = true;
    this.layoutTraveler();
    this.setPose('sleep');
    playSleepSfx();

    this.after(900, () => {
      this.interactionLock = false;
    });
  }

  private wakeUp(): void {
    if (!this.sleepMode) return;
    this.sleepMode = false;
    this.sleepZ = null;
    this.target = LIGHTING.morning;
    this.layoutTraveler();
  }

  private interactDoor(node: HotspotNode): void {
    this.travelerFlipped = false;
    this.layoutTraveler();
    this.setPose('idle');
    if (node.config.message) this.onNotice?.(node.config.message);
    this.after(400, () => {
      this.interactionLock = false;
    });
  }

  /* ── In-Scene Builds ── */

  private emitBuildState(): void {
    this.onBuildState?.({ built: [...this.terrace.builtProps], pending: this.pendingBuildId });
  }

  private buildBuildables(): void {
    for (const bn of this.buildNodes) {
      bn.root.destroy({ children: true });
      bn.label.destroy();
      bn.labelPill.destroy();
    }
    this.buildNodes = [];
    this.pendingBuildId = null;
    if (this.shedLantern) {
      this.shedLantern.destroy();
      this.shedLantern = null;
    }

    for (const cfg of this.sceneConfig?.buildables ?? []) {
      if (cfg.upgradesHotspot) continue;

      const root = new Container();
      root.eventMode = 'static';
      root.cursor = 'pointer';
      const blueprint = new Graphics();
      blueprint.eventMode = 'none';
      const sprite = Sprite.from(Texture.EMPTY);
      sprite.anchor.set(0.5, 1);
      sprite.eventMode = 'none';
      sprite.visible = false;
      root.addChild(blueprint, sprite);

      const { label, pill: labelPill } = this.createLabel(
        `Build ${cfg.name}  ·  ${formatMaterials(cfg.cost)}`,
      );
      const node: BuildNode = { config: cfg, root, blueprint, sprite, label, labelPill, hovered: false, built: false };

      root.on('pointerenter', () => this.onBuildHover(node, true));
      root.on('pointerleave', () => this.onBuildHover(node, false));
      root.on('pointerdown', (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        this.requestBuild(cfg.id);
      });

      /* Preload so the finished prop can pop in instantly */
      Assets.load<Texture>(cfg.propSprite)
        .then((tex) => {
          if (this.disposed || !tex || sprite.destroyed) return;
          sprite.texture = tex;
          this.layout();
        })
        .catch(() => { /* keep blueprint */ });

      this.worldLayer.addChild(root);
      this.buildNodes.push(node);
    }
  }

  private onBuildHover(node: BuildNode, enter: boolean): void {
    const show = enter && !node.built && !this.interactionLock;
    node.hovered = show;
    node.label.visible = show;
    node.labelPill.visible = show;
    if (show) {
      const { width: W, height: H } = this;
      this.placeLabel(node.label, node.labelPill, W * node.config.position.x, H * node.config.position.y - 26);
    }
  }

  private performBuild(cfg: BuildableConfig): void {
    this.setPose('search');
    playBuild();

    this.after(950, () => {
      const paid = this.onBuild?.(cfg.cost) ?? false;
      const lift = { x: cfg.position.x, y: cfg.position.y - cfg.propScale * 0.55 };
      if (paid) {
        if (!this.terrace.builtProps.includes(cfg.id)) this.terrace.builtProps.push(cfg.id);
        saveTerraceState(this.terrace);
        this.applyBuilt(cfg, true);
        playClaim();
        this.showFloatingText(lift, formatMaterials(cfg.cost, '−'));
        if (cfg.effect === 'leaves') {
          this.spawnLeafParticles(cfg.position);
          this.spawnSparkles(lift, [0xfff1b0, 0xd8f0a8, 0xffffff]);
        } else if (cfg.effect === 'water') {
          playWaterChime();
          this.spawnSparkles(lift, [0x9fd3f0, 0xc8e8fa, 0xffffff]);
        } else {
          this.spawnSparkles(lift, [0xffd89a, 0xfff1c8, 0xffb860]);
        }
      } else {
        this.showFloatingText(lift, 'Need more materials');
      }
      this.pendingBuildId = null;
      this.setPose('idle');
      this.interactionLock = false;
      this.emitBuildState();
    });
  }

  /** Show a built upgrade — `animate` pops it in, otherwise it appears as restored */
  private applyBuilt(cfg: BuildableConfig, animate: boolean): void {
    if (cfg.upgradesHotspot) {
      const hs = this.hotspots.find((h) => h.config.id === cfg.upgradesHotspot);
      if (!hs) return;
      hs.config = { ...hs.config, ...cfg.hotspotOverrides, propSprite: cfg.propSprite };
      this.setHotspotLabel(hs, hs.config.label);
      this.setHotspotSprite(hs, cfg.propSprite, () => {
        if (animate) this.popIn(hs.root);
      });
      if (cfg.lanternAnchor) this.ensureShedLantern();
      return;
    }

    const bn = this.buildNodes.find((b) => b.config.id === cfg.id);
    if (!bn) return;
    bn.built = true;
    bn.hovered = false;
    bn.label.visible = false;
    bn.labelPill.visible = false;
    bn.blueprint.visible = false;
    bn.sprite.visible = true;
    bn.root.eventMode = 'none';
    bn.root.cursor = 'default';
    this.layout();
    if (animate) this.popIn(bn.root);
  }

  private ensureShedLantern(): void {
    if (this.shedLantern) return;
    const glow = new Sprite(this.radial);
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.tint = 0xffb860;
    glow.alpha = 0;
    glow.eventMode = 'none';
    this.fxLayer.addChild(glow);
    this.shedLantern = glow;
    this.layout();
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

  /* ── Collision Clamping ── */

  private isColliderActive(hs: HotspotNode): boolean {
    if (!hs.config.collider) return false;
    /* Cleared weed patches free up their floor space */
    if (hs.config.type === 'weeds' && hs.interacted) return false;
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
    for (const bn of this.buildNodes) {
      if (bn.built && bn.config.collider) ellipses.push({ ...bn.config.position, ...bn.config.collider });
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
    const { width: W, height: H } = this;
    const baseX = W * pos.x;
    const baseY = H * pos.y - 14;
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
    const { width: W, height: H } = this;
    for (let i = 0; i < 14; i++) {
      const dot = new Graphics();
      dot.circle(0, 0, 1.4 + Math.random() * 2.2).fill(colors[i % colors.length]);
      dot.position.set(W * pos.x + (Math.random() - 0.5) * 60, H * pos.y + (Math.random() - 0.5) * 34);
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
    const { width: W, height: H } = this;
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
    txt.position.set(W * pos.x, H * pos.y - 34);
    this.labelLayer.addChild(txt);

    const start = performance.now();
    const animate = () => {
      if (this.disposed || txt.destroyed) return;
      const p = (performance.now() - start) / 1300;
      txt.y = H * pos.y - 34 - p * 44;
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

  private walkTo(x: number, y: number, onArrive?: () => void): void {
    this.travelerFlipped = x < this.targetX;
    this.walkingTo = { x, y };
    this.pendingCallback = onArrive ?? null;
    this.footstepAccum = 0;
    this.setPose('walk');
  }

  private handleFloorPointerDown = (event: { global: { x: number; y: number } }): void => {
    if (this.interactionLock || !this.entryDone) return;
    const { width: W, height: H } = this;
    const nx = event.global.x / W;
    const ny = event.global.y / H;

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

    /* Fade in as the traveler steps out of the entry (doorway or screen edge) */
    this.travelerNode.alpha = 0;
    this.setPose('walk');
    this.interactionLock = true;

    const footstepTimes = [260, 620, 980, 1340];
    for (const ms of footstepTimes) {
      this.after(ms, playFootstep);
    }

    this.after(180, () => {
      this.walkTo(idle.x, idle.y, () => {
        this.setPose('idle');
        this.entryDone = true;
        this.interactionLock = false;
      });
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
      setCampfireAudio(true);
      const fp = this.hotspots.find((h) => h.config.id === 'firepit');
      if (fp) {
        this.ensureFireEffects(fp);
        this.setHotspotLabel(fp, 'Extinguish fire');
      }
    }

    for (const boxId of ts.searchedBoxes) {
      const box = this.hotspots.find((h) => h.config.id === boxId);
      if (box) {
        this.disableHotspotInteraction(box);
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

    for (const buildId of ts.builtProps) {
      const cfg = this.sceneConfig?.buildables?.find((b) => b.id === buildId);
      if (cfg) this.applyBuilt(cfg, false);
    }
  }

  /* ── Layout ── */

  private layout(): void {
    const { width: W, height: H } = this;

    this.floorHit.clear();
    this.floorHit.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.001 });
    this.floorHit.hitArea = new Rectangle(0, 0, W, H);

    if (this.bgSprite) {
      const tex = this.bgSprite.texture;
      const scale = Math.max(W / tex.width, H / tex.height);
      this.bgSprite.scale.set(scale);
      this.bgSprite.position.set(W / 2, H / 2);
    }
    this.drawFallback(this.state.siteId);

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
      const px = W * hs.config.position.x;
      const py = H * hs.config.position.y;
      hs.root.position.set(px, py);
      /* Sprite-less spots (e.g. the stairwell door) sit flat beneath everything */
      hs.root.zIndex = hs.propSprite ? Math.round(py) : 0;

      const hr = hs.config.hitRect;
      if (hr) {
        hs.root.hitArea = new Rectangle(hr.dx * W, hr.dy * H, hr.w * W, hr.h * H);
        if (hs.hovered) this.drawHoverRing(hs);
      } else if (hs.propSprite && hs.config.propScale && hs.propSprite.texture !== Texture.EMPTY) {
        const pH = H * hs.config.propScale;
        const pScale = pH / (hs.propSprite.texture.height || 100);
        const signX = hs.config.flipX ? -1 : 1;
        hs.propSprite.scale.set(pScale * signX, pScale);

        const pW = hs.propSprite.texture.width * pScale;
        const hitRadius = Math.max(30, Math.max(pW, pH) * 0.52);
        hs.root.hitArea = new Circle(0, -pH * 0.48, hitRadius);
      }
      if (hs.hovered) this.layoutHotspotLabel(hs);
    }

    for (const bn of this.buildNodes) {
      const cfg = bn.config;
      const px = W * cfg.position.x;
      const py = H * cfg.position.y;
      bn.root.position.set(px, py);
      /* Blueprints are floor decals; built props join the Y-sort */
      bn.root.zIndex = bn.built ? Math.round(py) : 1;

      const rx = Math.max(16, (cfg.collider?.rx ?? 0.03) * W * 1.15);
      const ry = Math.max(7, (cfg.collider?.ry ?? 0.02) * H * 1.35);
      bn.blueprint.clear();
      bn.blueprint
        .ellipse(0, 0, rx, ry)
        .fill({ color: 0xfff6e0, alpha: 0.16 })
        .stroke({ color: 0xfff2cc, width: 1.8, alpha: 0.75 });
      bn.blueprint.rect(-6, -1.2, 12, 2.4).fill({ color: 0xfffcf6, alpha: 0.9 });
      bn.blueprint.rect(-1.2, -6, 2.4, 12).fill({ color: 0xfffcf6, alpha: 0.9 });
      bn.root.hitArea = new Circle(0, 0, Math.max(24, rx));

      if (bn.sprite.texture !== Texture.EMPTY) {
        const pH = H * cfg.propScale;
        const pScale = pH / (bn.sprite.texture.height || 100);
        bn.sprite.scale.set(pScale * (cfg.flipX ? -1 : 1), pScale);
      }
      if (bn.hovered) this.onBuildHover(bn, true);
    }

    if (this.shedLantern) this.layoutShedLantern(this.shedLantern);

    if (this.fireGlow && this.sceneConfig) {
      const fp = this.sceneConfig.hotspots.find((h) => h.id === 'firepit');
      if (fp) {
        this.fireGlow.position.set(W * fp.position.x, H * fp.position.y - H * 0.03);
        const fgSize = Math.min(W, H) * 0.36;
        this.fireGlow.width = fgSize;
        this.fireGlow.height = fgSize;
      }
    }

    this.layoutTraveler();
  }

  private warmthTarget(): number {
    return 0.03 + (Math.min(100, this.state.cozyIndex) / 100) * 0.22;
  }

  /** Pin the glow onto the lantern painted in the upgraded shelter sprite */
  private layoutShedLantern(glow: Sprite): void {
    const cfg = this.sceneConfig?.buildables?.find((b) => b.lanternAnchor && b.upgradesHotspot);
    const hs = cfg && this.hotspots.find((h) => h.config.id === cfg.upgradesHotspot);
    const tex = hs?.propSprite?.texture;
    if (!cfg?.lanternAnchor || !hs || !tex || tex === Texture.EMPTY || hs.spriteSrc !== cfg.propSprite) {
      glow.visible = false;
      return;
    }
    const { width: W, height: H } = this;
    const pH = H * (hs.config.propScale ?? cfg.propScale);
    const pW = tex.width * (pH / (tex.height || 1));
    const sign = hs.config.flipX ? -1 : 1;
    glow.visible = true;
    glow.position.set(
      W * hs.config.position.x + (cfg.lanternAnchor.x - 0.5) * pW * sign,
      H * hs.config.position.y - (1 - cfg.lanternAnchor.y) * pH,
    );
    const size = Math.min(W, H) * 0.16;
    glow.width = size;
    glow.height = size;
  }

  /* ── Frame update ── */

  private update(ticker: Ticker): void {
    const dt = ticker.deltaMS;
    this.elapsed += dt / 1000;
    const k = this.state.reduceMotion ? 1 : 1 - Math.exp(-dt / 380);

    const c = this.current;
    const t = this.target;
    for (let i = 0; i < 3; i++) {
      c.mul[i] = lerp(c.mul[i], t.mul[i], k);
      c.scr[i] = lerp(c.scr[i], t.scr[i], k);
      c.sun[i] = lerp(c.sun[i], t.sun[i], k);
    }
    c.mulAlpha = lerp(c.mulAlpha, t.mulAlpha, k);
    c.scrAlpha = lerp(c.scrAlpha, t.scrAlpha, k);
    c.sunAlpha = lerp(c.sunAlpha, t.sunAlpha, k);
    c.sunX = lerp(c.sunX, t.sunX, k);
    c.sunY = lerp(c.sunY, t.sunY, k);
    c.lantern = lerp(c.lantern, t.lantern, k);
    c.markerGlow = lerp(c.markerGlow, t.markerGlow, k);
    this.warmthCurrent = lerp(this.warmthCurrent, this.warmthTarget(), k);

    if (this.bgSprite && this.bgSprite.alpha < 1) {
      this.bgSprite.alpha = this.state.reduceMotion ? 1 : Math.min(1, this.bgSprite.alpha + dt / 450);
    }

    if (this.travelerNode.alpha < 1) {
      this.travelerNode.alpha = this.state.reduceMotion ? 1 : Math.min(1, this.travelerNode.alpha + dt / 520);
    }

    for (const bn of this.buildNodes) {
      if (bn.built) continue;
      bn.blueprint.alpha = bn.hovered
        ? 1
        : this.state.reduceMotion
          ? 0.8
          : 0.62 + 0.25 * Math.sin(this.elapsed * 2.2);
    }

    if (this.shedLantern) {
      const flicker = this.state.reduceMotion
        ? 1
        : 0.88 + 0.08 * Math.sin(this.elapsed * 5.3) + 0.04 * Math.sin(this.elapsed * 11.1);
      this.shedLantern.alpha = 0.6 * this.current.lantern * flicker;
    }

    /* Walking */
    if (this.walkingTo) {
      const speed = (this.state.reduceMotion ? 0.0012 : 0.00055) * dt;
      const dx = this.walkingTo.x - this.targetX;
      const dy = this.walkingTo.y - this.targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.008) {
        this.targetX = this.walkingTo.x;
        this.targetY = this.walkingTo.y;
        this.walkingTo = null;
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
        this.footstepAccum += dt;
        if (this.footstepAccum >= 380) {
          this.footstepAccum = 0;
          if (this.entryDone) playFootstep();
        }
        this.layoutTraveler();
      }
    }

    /* Breathing idle */
    if (this.currentPose === 'idle' && this.travelerSprite && !this.state.reduceMotion) {
      this.breathPhase += dt / 1000;
      const breathScale = 1 + 0.015 * Math.sin(this.breathPhase * 1.7);
      const targetH = this.height * BASE_STANDING_HEIGHT_RATIO * POSE_HEIGHT_SCALE.idle;
      const tex = this.travelerSprite.texture;
      const baseScale = (targetH / (tex.height || 1)) * this.poseScaleMultiplier;
      this.travelerSprite.scale.y = baseScale * breathScale;
    }

    /* Walking bob (relative to travelerNode feet) */
    if (this.currentPose === 'walk' && this.travelerSprite && !this.state.reduceMotion) {
      this.travelerSprite.y = -3 * Math.abs(Math.sin(this.elapsed * 8.5));
    }

    /* Fire flames & particles */
    if (this.fireLit) {
      this.drawFlames();
      this.spawnFireEmbers();
    }
    this.updateParticles(dt);

    if (this.fireGlow && this.fireLit) {
      const flicker = this.state.reduceMotion
        ? 0.7
        : 0.65 + 0.18 * Math.sin(this.elapsed * 7.2) + 0.1 * Math.sin(this.elapsed * 13.7);
      this.fireGlow.alpha = 0.42 * flicker;
    }

    this.applyLighting();
  }

  private drawFlames(): void {
    if (!this.fireFlames || !this.sceneConfig) return;
    const fp = this.sceneConfig.hotspots.find((h) => h.id === 'firepit');
    if (!fp) return;
    const H = this.height;
    const propH = H * (fp.propScale ?? 0.085);
    /* Local to firepit root (bottom-center of firepit sprite) */
    const cy = -propH * 0.45;
    const unit = Math.max(0.7, propH / 58);
    const still = this.state.reduceMotion;
    const sway = still ? 0 : Math.sin(this.elapsed * 9) * 2.4 * unit;
    const hScale = still ? 1 : 0.9 + 0.18 * Math.sin(this.elapsed * 12.4);

    const g = this.fireFlames;
    g.clear();
    g.ellipse(sway * 0.5, cy - 9 * unit * hScale, 9 * unit, 13 * unit * hScale).fill({ color: 0xff6a1a, alpha: 0.78 });
    g.ellipse(-sway * 0.4, cy - 7 * unit * hScale, 6 * unit, 9.5 * unit * hScale).fill({ color: 0xffa832, alpha: 0.88 });
    g.ellipse(sway * 0.2, cy - 5 * unit * hScale, 3.2 * unit, 5.5 * unit * hScale).fill({ color: 0xffe488, alpha: 0.95 });
  }

  private spawnFireEmbers(): void {
    if (this.state.reduceMotion || !this.sceneConfig) return;
    const fp = this.sceneConfig.hotspots.find((h) => h.id === 'firepit');
    if (!fp) return;
    const { width: W, height: H } = this;
    const propH = H * (fp.propScale ?? 0.085);
    const baseX = W * fp.position.x;
    const baseY = H * fp.position.y - propH * 0.48;

    if (Math.random() < 0.28) {
      const ember = new Graphics();
      const size = 1.4 + Math.random() * 2.0;
      const isHot = Math.random() < 0.4;
      ember.circle(0, 0, size).fill(isHot ? 0xffd268 : 0xff6b24);
      ember.position.set(baseX + (Math.random() - 0.5) * 14, baseY);
      this.fxLayer.addChild(ember);
      this.particles.push({
        sprite: ember,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.55 + Math.random() * 0.8),
        gravity: -0.008,
        life: 0,
        maxLife: 650 + Math.random() * 750,
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
      p.sprite.alpha = Math.max(0, 1 - ratio);
      p.sprite.scale.set(Math.max(0.25, 1 - ratio * 0.65));
      if (p.life >= p.maxLife) {
        p.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  private applyLighting(): void {
    const c = this.current;
    const { width: W, height: H } = this;

    this.mulWash.tint = toHex(c.mul);
    this.mulWash.alpha = c.mulAlpha;
    this.scrWash.tint = toHex(c.scr);
    this.scrWash.alpha = c.scrAlpha;
    this.sunGlow.tint = toHex(c.sun);
    this.sunGlow.alpha = c.sunAlpha;
    this.sunGlow.position.set(W * c.sunX, H * c.sunY);
    this.warmth.alpha = this.warmthCurrent;
  }
}
