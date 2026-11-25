import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type Ticker,
} from 'pixi.js';
import type { SiteId, TimeOfDay, TravelerGender } from '../types/game.ts';
import type { ShelterSceneConfig, HotspotConfig } from '../data/scenes/types.ts';
import { BG_SHELTERS, travelerSpriteSrc, SCENE_STAGES } from '../data/media.ts';
import type { TravelerPose } from '../data/media.ts';
import { SITES } from '../data/sites.ts';
import { terraceScene } from '../data/scenes/terrace.ts';
import {
  playFireLight,
  setCampfireAudio,
  playRummage,
  playWeedCut,
  playSleep as playSleepSfx,
  playFootstep,
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

/** Get the scene config for a site (only terrace for now) */
function getSceneConfig(siteId: SiteId): ShelterSceneConfig | null {
  if (siteId === 'terrace') return terraceScene;
  return null;
}

/* ═══════════════════════════════════════════
   Terrace Prop State (localStorage)
   ═══════════════════════════════════════════ */

const TERRACE_STATE_KEY = 'ows_terrace_state';

interface TerraceState {
  fireLit: boolean;
  boxesSearched: boolean;
  clearedWeeds: string[];
}

function loadTerraceState(): TerraceState {
  try {
    const raw = localStorage.getItem(TERRACE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TerraceState>;
      return {
        fireLit: Boolean(parsed.fireLit),
        boxesSearched: Boolean(parsed.boxesSearched),
        clearedWeeds: Array.isArray(parsed.clearedWeeds) ? parsed.clearedWeeds : [],
      };
    }
  } catch { /* ignore */ }
  return { fireLit: false, boxesSearched: false, clearedWeeds: [] };
}

function saveTerraceState(s: TerraceState): void {
  try {
    localStorage.setItem(TERRACE_STATE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

/* ═══════════════════════════════════════════
   Hotspot & Particle Types
   ═══════════════════════════════════════════ */

interface HotspotNode {
  config: HotspotConfig;
  root: Container;
  propSprite: Sprite | null;
  hoverRing: Graphics;
  label: Text;
  labelPill: Graphics;
  hovered: boolean;
  interacted: boolean;
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

  /* Layers: bg → lighting → hotspots → warmth → traveler → fire/particles → labels */
  private readonly bgLayer = new Container();
  private bgSprite: Sprite | null = null;
  private bgFallback: Graphics | null = null;
  private bgToken = 0;

  private readonly mulWash: Sprite;
  private readonly scrWash: Sprite;
  private readonly sunGlow: Sprite;
  private readonly warmth: Sprite;

  /* Traveler */
  private readonly travelerLayer = new Container();
  private travelerSprite: Sprite | null = null;
  private travelerShadow: Graphics;
  private currentPose: TravelerPose = 'idle';
  private poseToken = 0;
  private poseScaleMultiplier = 1;
  private targetX = 0.38;
  private targetY = 0.72;
  private travelerFlipped = false;
  private walkingTo: { x: number; y: number } | null = null;
  private breathPhase = 0;
  private footstepAccum = 0;

  /* Hotspots */
  private readonly hotspotLayer = new Container();
  private readonly labelLayer = new Container();
  private hotspots: HotspotNode[] = [];
  private sceneConfig: ShelterSceneConfig | null = null;

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

    /* Lighting washes */
    this.mulWash = new Sprite(Texture.WHITE);
    this.mulWash.blendMode = 'multiply';
    this.scrWash = new Sprite(Texture.WHITE);
    this.scrWash.blendMode = 'screen';
    this.sunGlow = new Sprite(this.radial);
    this.sunGlow.anchor.set(0.5);
    this.sunGlow.blendMode = 'screen';
    this.warmth = new Sprite(this.radial);
    this.warmth.anchor.set(0.5);
    this.warmth.blendMode = 'add';
    this.warmth.tint = 0xffb060;

    /* Traveler shadow */
    this.travelerShadow = new Graphics();
    this.travelerLayer.addChild(this.travelerShadow);

    /* Build stage layer order */
    app.stage.addChild(
      this.bgLayer,
      this.mulWash,
      this.scrWash,
      this.sunGlow,
      this.hotspotLayer,
      this.warmth,
      this.travelerLayer,
      this.fxLayer,
      this.labelLayer,
    );

    this.sceneConfig = initial.siteId ? getSceneConfig(initial.siteId) : null;
    this.preloadTravelerPoses(initial.gender);
    this.loadBackground(initial.siteId);
    this.buildHotspots();
    this.loadTraveler(initial.gender, 'idle');
    this.restoreTerraceState();
    this.layout();
    this.applyLighting();
    this.startEntryAnimation();

    /* Pointer interaction */
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', this.handlePointerDown, this);

    app.ticker.add(this.update, this);
  }

  /* ── Public API ── */

  setState(next: ShelterSceneState): void {
    const prev = this.state;
    this.state = next;
    if (next.siteId !== prev.siteId) {
      this.sceneConfig = next.siteId ? getSceneConfig(next.siteId) : null;
      this.loadBackground(next.siteId);
      this.buildHotspots();
      this.restoreTerraceState();
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

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = this.app.screen;
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
    this.app.stage.off('pointerdown', this.handlePointerDown, this);
    this.hotspots = [];
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
        this.bgSprite = sprite;
        this.bgLayer.addChild(sprite);
        this.layout();
      })
      .catch(() => { /* keep the gradient fallback */ });
  }

  private drawFallback(siteId: SiteId | null): void {
    const site = SITES.find((s) => s.id === siteId);
    if (!this.bgFallback) {
      this.bgFallback = new Graphics();
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
        this.travelerLayer.addChild(sprite);

        if (old && !this.state.reduceMotion) {
          this.poseScaleMultiplier = 0.96;
          this.layoutTraveler();
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
            this.layoutTraveler();
            if (progress < 1) {
              requestAnimationFrame(crossfade);
            } else {
              this.poseScaleMultiplier = 1;
              if (!old.destroyed) old.destroy();
            }
          };
          requestAnimationFrame(crossfade);
        } else {
          this.poseScaleMultiplier = 1;
          sprite.alpha = 1;
          if (old && !old.destroyed) old.destroy();
          this.layoutTraveler();
        }
      })
      .catch(() => { /* keep current sprite */ });
  }

  private layoutTraveler(): void {
    if (!this.travelerSprite) return;
    const { width: W, height: H } = this;
    const tH = H * 0.22;
    const tex = this.travelerSprite.texture;
    const scale = (tH / (tex.height || 1)) * this.poseScaleMultiplier;
    this.travelerSprite.scale.set(
      scale * (this.travelerFlipped ? -1 : 1),
      scale,
    );
    this.travelerSprite.position.set(W * this.targetX, H * this.targetY);

    /* Ground contact shadow */
    const shadowW = this.currentPose === 'sleep' ? tH * 0.36 : tH * 0.24;
    this.travelerShadow.clear();
    this.travelerShadow.ellipse(0, 0, shadowW, tH * 0.055).fill({ color: 0x1e1812, alpha: 0.22 });
    this.travelerShadow.position.set(W * this.targetX, H * this.targetY);
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
    this.hotspotLayer.removeChildren();
    this.labelLayer.removeChildren();
    this.hotspots = [];

    if (!this.sceneConfig) return;

    for (const cfg of this.sceneConfig.hotspots) {
      const root = new Container();
      root.eventMode = 'static';
      root.cursor = 'pointer';

      const hoverRing = new Graphics();
      hoverRing.visible = false;
      root.addChild(hoverRing);

      let propSprite: Sprite | null = null;
      if (cfg.propSprite) {
        propSprite = Sprite.from(Texture.EMPTY);
        propSprite.anchor.set(0.5, 1);
        root.addChild(propSprite);

        Assets.load<Texture>(cfg.propSprite)
          .then((tex) => {
            if (!this.disposed && tex && propSprite && !propSprite.destroyed) {
              propSprite.texture = tex;
              this.layout();
            }
          })
          .catch(() => { /* keep empty */ });
      }

      /* Hit area */
      const hitRadius = cfg.type === 'sleep' ? 48 : 34;
      const hitY = cfg.propSprite ? -22 : 0;
      const hit = new Graphics();
      hit.circle(0, hitY, hitRadius).fill({ color: 0xffffff, alpha: 0.001 });
      root.addChild(hit);

      /* Hover label */
      const label = new Text({
        text: cfg.label,
        style: new TextStyle({
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: '600',
          fill: 0x3d3832,
        }),
      });
      label.anchor.set(0.5, 1);
      label.visible = false;

      const labelPill = new Graphics();
      labelPill.visible = false;
      this.labelLayer.addChild(labelPill, label);

      const node: HotspotNode = {
        config: cfg,
        root,
        propSprite,
        hoverRing,
        label,
        labelPill,
        hovered: false,
        interacted: false,
      };

      root.on('pointerenter', () => this.onHotspotHover(node, true));
      root.on('pointerleave', () => this.onHotspotHover(node, false));
      root.on('pointerdown', (e: { stopPropagation: () => void }) => {
        e.stopPropagation();
        this.onHotspotClick(node);
      });

      this.hotspotLayer.addChild(root);
      this.hotspots.push(node);
    }
  }

  private onHotspotHover(node: HotspotNode, enter: boolean): void {
    const canInteract = !node.interacted || node.config.type === 'sleep';
    if (!canInteract) {
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
    const ry = node.config.type === 'sleep' ? 0 : -4;
    g.ellipse(0, ry, 28, 10).stroke({ color: 0xfff2cc, width: 2, alpha: 0.85 });
  }

  private layoutHotspotLabel(node: HotspotNode): void {
    const { width: W, height: H } = this;
    const rawX = W * node.config.position.x;
    const rawY = H * node.config.position.y - 54;
    const pw = node.label.width + 18;
    const ph = node.label.height + 10;
    const px = Math.max(pw / 2 + 12, Math.min(W - pw / 2 - 12, rawX));
    const py = Math.max(ph + 64, rawY);

    node.label.position.set(px, py);
    node.labelPill.clear();
    node.labelPill
      .roundRect(px - pw / 2, py - ph + 4, pw, ph, 10)
      .fill({ color: 0xfffcf6, alpha: 0.92 })
      .stroke({ color: 0xe8cdb5, width: 1.5 });
  }

  private onHotspotClick(node: HotspotNode): void {
    if (this.interactionLock) return;
    if (node.interacted && node.config.type !== 'sleep') return;

    /* Wake from sleep if clicking a different hotspot */
    if (this.sleepMode && node.config.type !== 'sleep') {
      this.wakeUp();
    }

    const scene = this.sceneConfig;
    if (!scene) return;

    const tX = Math.max(
      scene.walkableArea.xMin,
      Math.min(scene.walkableArea.xMax, node.config.position.x),
    );
    const tY = Math.max(
      scene.walkableArea.yMin,
      Math.min(scene.walkableArea.yMax, node.config.position.y + 0.04),
    );

    this.onHotspotHover(node, false);
    this.interactionLock = true;
    this.walkTo(tX, tY, () => {
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
        this.interactSleep();
        break;
    }
  }

  private interactFirepit(node: HotspotNode): void {
    playFireLight();
    node.interacted = true;
    node.root.cursor = 'default';
    this.fireLit = true;
    this.terrace.fireLit = true;
    saveTerraceState(this.terrace);
    setCampfireAudio(true);

    this.ensureFireEffects();
    this.layout();

    this.after(600, () => {
      this.setPose('sit');
      this.interactionLock = false;
    });
  }

  private ensureFireEffects(): void {
    if (!this.fireGlow) {
      this.fireGlow = new Sprite(this.radial);
      this.fireGlow.anchor.set(0.5);
      this.fireGlow.blendMode = 'add';
      this.fireGlow.tint = 0xff8030;
      this.fxLayer.addChild(this.fireGlow);
    }
    if (!this.fireFlames) {
      this.fireFlames = new Graphics();
      this.fxLayer.addChild(this.fireFlames);
    }
  }

  private interactSearch(node: HotspotNode): void {
    this.setPose('search');
    playRummage();

    this.after(1000, () => {
      node.interacted = true;
      node.root.cursor = 'default';
      this.terrace.boxesSearched = true;
      saveTerraceState(this.terrace);

      if (node.config.propSpriteAfter && node.propSprite) {
        Assets.load<Texture>(node.config.propSpriteAfter)
          .then((tex) => {
            if (!this.disposed && tex && node.propSprite && !node.propSprite.destroyed) {
              node.propSprite.texture = tex;
              this.layout();
            }
          })
          .catch(() => { /* keep old */ });
      }

      if (node.config.reward && this.onReward) {
        this.onReward(node.config.reward);
      }
      this.showFloatingText(node.config.position, node.config.reward);
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  private interactWeeds(node: HotspotNode): void {
    this.setPose('search');
    playWeedCut();

    this.after(350, () => {
      this.spawnLeafParticles(node.config.position);
    });

    this.after(800, () => {
      node.interacted = true;
      node.root.cursor = 'default';
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
      this.showFloatingText(node.config.position, node.config.reward);
      this.setPose('idle');
      this.interactionLock = false;
    });
  }

  private interactSleep(): void {
    this.sleepMode = true;
    this.target = LIGHTING.night;
    this.setPose('sleep');
    playSleepSfx();

    this.after(900, () => {
      this.interactionLock = false;
    });
  }

  private wakeUp(): void {
    if (!this.sleepMode) return;
    this.sleepMode = false;
    this.target = LIGHTING.morning;
  }

  /* ── Particles & Floating Reward Text ── */

  private spawnLeafParticles(pos: { x: number; y: number }): void {
    if (this.state.reduceMotion) return;
    const { width: W, height: H } = this;
    const baseX = W * pos.x;
    const baseY = H * pos.y - 16;
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

  private showFloatingText(pos: { x: number; y: number }, reward?: Record<string, number>): void {
    if (!reward) return;
    const { width: W, height: H } = this;
    const emojiMap: Record<string, string> = {
      timber: '🪵', scrap: '🔩', cloth: '🧵', stone: '🪨', seeds: '🌱', water: '💧',
    };
    const lines = Object.entries(reward).map(([k, v]) => `+${v} ${emojiMap[k] ?? k}`).join('  ');
    const txt = new Text({
      text: lines,
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

  private handlePointerDown = (event: { global: { x: number; y: number } }): void => {
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

    playFootstep();
    this.walkTo(nx, ny, () => {
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
      this.ensureFireEffects();
      const fp = this.hotspots.find((h) => h.config.id === 'firepit');
      if (fp) {
        fp.interacted = true;
        fp.root.cursor = 'default';
      }
    }

    if (ts.boxesSearched) {
      const boxes = this.hotspots.find((h) => h.config.id === 'boxes');
      if (boxes) {
        boxes.interacted = true;
        boxes.root.cursor = 'default';
        if (boxes.config.propSpriteAfter && boxes.propSprite) {
          Assets.load<Texture>(boxes.config.propSpriteAfter)
            .then((tex) => {
              if (!this.disposed && tex && boxes.propSprite && !boxes.propSprite.destroyed) {
                boxes.propSprite.texture = tex;
                this.layout();
              }
            })
            .catch(() => {});
        }
      }
    }

    for (const weedId of ts.clearedWeeds) {
      const weed = this.hotspots.find((h) => h.config.id === weedId);
      if (weed) {
        weed.interacted = true;
        weed.root.cursor = 'default';
        if (weed.propSprite) weed.propSprite.alpha = 0;
      }
    }
  }

  /* ── Layout ── */

  private layout(): void {
    const { width: W, height: H } = this;

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
      if (hs.propSprite && hs.config.propScale && hs.propSprite.texture !== Texture.EMPTY) {
        const pScale = (H * hs.config.propScale) / (hs.propSprite.texture.height || 100);
        hs.propSprite.scale.set(pScale);
      }
      if (hs.hovered) this.layoutHotspotLabel(hs);
    }

    if (this.fireGlow && this.sceneConfig) {
      const fp = this.sceneConfig.hotspots.find((h) => h.id === 'firepit');
      if (fp) {
        this.fireGlow.position.set(W * fp.position.x, H * fp.position.y - 10);
        const fgSize = Math.min(W, H) * 0.44;
        this.fireGlow.width = fgSize;
        this.fireGlow.height = fgSize;
      }
    }

    this.layoutTraveler();
  }

  private warmthTarget(): number {
    return 0.03 + (Math.min(100, this.state.cozyIndex) / 100) * 0.22;
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
      }
      this.layoutTraveler();
    }

    /* Breathing idle */
    if (this.currentPose === 'idle' && this.travelerSprite && !this.state.reduceMotion) {
      this.breathPhase += dt / 1000;
      const breathScale = 1 + 0.015 * Math.sin(this.breathPhase * 1.7);
      const tH = this.height * 0.22;
      const tex = this.travelerSprite.texture;
      const baseScale = (tH / (tex.height || 1)) * this.poseScaleMultiplier;
      this.travelerSprite.scale.y = baseScale * breathScale;
    }

    /* Walking bob */
    if (this.currentPose === 'walk' && this.travelerSprite && !this.state.reduceMotion) {
      const bobY = -3 * Math.abs(Math.sin(this.elapsed * 8.5));
      this.travelerSprite.y = this.height * this.targetY + bobY;
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
    const { width: W, height: H } = this;
    const cx = W * fp.position.x;
    const cy = H * fp.position.y - 10;
    const still = this.state.reduceMotion;
    const sway = still ? 0 : Math.sin(this.elapsed * 9) * 3;
    const hScale = still ? 1 : 0.9 + 0.18 * Math.sin(this.elapsed * 12.4);

    const g = this.fireFlames;
    g.clear();
    // Outer orange flame tongue
    g.ellipse(cx + sway * 0.5, cy - 11 * hScale, 11, 16 * hScale).fill({ color: 0xff6a1a, alpha: 0.78 });
    // Mid amber flame tongue
    g.ellipse(cx - sway * 0.4, cy - 9 * hScale, 7.5, 12 * hScale).fill({ color: 0xffa832, alpha: 0.88 });
    // Bright gold core
    g.ellipse(cx + sway * 0.2, cy - 6 * hScale, 4, 7 * hScale).fill({ color: 0xffe488, alpha: 0.95 });
  }

  private spawnFireEmbers(): void {
    if (this.state.reduceMotion || !this.sceneConfig) return;
    const fp = this.sceneConfig.hotspots.find((h) => h.id === 'firepit');
    if (!fp) return;
    const { width: W, height: H } = this;
    const baseX = W * fp.position.x;
    const baseY = H * fp.position.y - 12;

    if (Math.random() < 0.28) {
      const ember = new Graphics();
      const size = 1.6 + Math.random() * 2.4;
      const isHot = Math.random() < 0.4;
      ember.circle(0, 0, size).fill(isHot ? 0xffd268 : 0xff6b24);
      ember.position.set(baseX + (Math.random() - 0.5) * 18, baseY);
      this.fxLayer.addChild(ember);
      this.particles.push({
        sprite: ember,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -(0.6 + Math.random() * 0.9),
        gravity: -0.008, // gently accelerates up like rising heat
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
