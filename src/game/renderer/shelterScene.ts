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
import type { SiteId, TimeOfDay } from '../types/game.ts';
import { BG_SHELTERS } from '../data/media.ts';
import { SITES } from '../data/sites.ts';
import { UPGRADE_MAP } from '../data/upgrades.ts';

/* ───── Public state contract ───── */

export interface ShelterSceneState {
  siteId: SiteId | null;
  timeOfDay: TimeOfDay;
  built: readonly string[];
  lanternLit: boolean;
  cozyIndex: number;
  reduceMotion: boolean;
}

/* ───── Lighting presets ───── */

type RGB = [number, number, number];

interface Lighting {
  /** Multiply wash — tints the painting toward the phase colour */
  mul: RGB;
  mulAlpha: number;
  /** Screen wash — lifts highlights with warm light */
  scr: RGB;
  scrAlpha: number;
  sun: RGB;
  sunAlpha: number;
  sunX: number;
  sunY: number;
  /** Lantern halo strength when the lantern is lit */
  lantern: number;
  /** Multiplier applied to upgrade marker glows */
  markerGlow: number;
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

/* ───── Upgrade marker placement (relative to the scene) ───── */

const MARKERS: Record<string, { x: number; y: number; label: string; glow: number }> = {
  'shell-1': { x: 0.5, y: 0.2, label: 'Tarp roof', glow: 0xffe2b0 },
  'shell-2': { x: 0.64, y: 0.25, label: 'Fortified', glow: 0xffd9a0 },
  'divider-1': { x: 0.36, y: 0.48, label: 'Cosy nook', glow: 0xffe6c0 },
  'divider-2': { x: 0.5, y: 0.44, label: 'Frame wall', glow: 0xffdcb0 },
  'expand-1': { x: 0.13, y: 0.42, label: 'Lean-to', glow: 0xffe0b0 },
  'expand-2': { x: 0.87, y: 0.4, label: 'Extension', glow: 0xffe0b0 },
  'slot-workbench': { x: 0.24, y: 0.74, label: 'Workbench', glow: 0xffd8a0 },
  'slot-garden': { x: 0.75, y: 0.78, label: 'Garden', glow: 0xd8f0b0 },
  'slot-rain-collector': { x: 0.9, y: 0.62, label: 'Rain catch', glow: 0xc8e4ff },
  'slot-hearth': { x: 0.52, y: 0.8, label: 'Hearth', glow: 0xffa050 },
};

const LANTERN_POS = { x: 0.32, y: 0.66 };

/* ───── Helpers ───── */

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function toHex([r, g, b]: RGB): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function cloneLighting(l: Lighting): Lighting {
  return { ...l, mul: [...l.mul] as RGB, scr: [...l.scr] as RGB, sun: [...l.sun] as RGB };
}

/** Soft white radial falloff, tinted per use */
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

interface MarkerNode {
  id: string;
  root: Container;
  glow: Sprite;
  baseGlow: number;
  phase: number;
}

/**
 * ShelterScene — owns every Pixi display object for the shelter view.
 * Pure rendering: reads a plain state object, never touches React.
 *
 * Layers (back → front): painted background → multiply time-of-day wash →
 * screen highlight wash → sun glow → cozy warmth → upgrade markers → lantern.
 */
export class ShelterScene {
  private readonly app: Application;
  private readonly radial: Texture;

  private readonly bgLayer = new Container();
  private bgSprite: Sprite | null = null;
  private bgFallback: Graphics | null = null;
  private bgToken = 0;

  private readonly mulWash: Sprite;
  private readonly scrWash: Sprite;
  private readonly sunGlow: Sprite;
  private readonly warmth: Sprite;
  private readonly markerLayer = new Container();
  private markers = new Map<string, MarkerNode>();
  private readonly lantern = new Container();
  private readonly lanternHalo: Sprite;
  private readonly lanternBody = new Graphics();

  private state: ShelterSceneState;
  private current: Lighting;
  private target: Lighting;
  private warmthCurrent = 0;
  private elapsed = 0;
  private width: number;
  private height: number;

  constructor(app: Application, initial: ShelterSceneState) {
    this.app = app;
    this.radial = createRadialTexture();
    this.state = initial;
    this.current = cloneLighting(LIGHTING[initial.timeOfDay]);
    this.target = LIGHTING[initial.timeOfDay];
    this.warmthCurrent = this.warmthTarget();
    this.width = app.screen.width;
    this.height = app.screen.height;

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

    this.lanternHalo = new Sprite(this.radial);
    this.lanternHalo.anchor.set(0.5);
    this.lanternHalo.blendMode = 'add';
    this.lanternHalo.tint = 0xffb45a;
    this.lantern.addChild(this.lanternHalo, this.lanternBody);

    app.stage.addChild(
      this.bgLayer,
      this.mulWash,
      this.scrWash,
      this.sunGlow,
      this.warmth,
      this.markerLayer,
      this.lantern,
    );

    this.loadBackground(initial.siteId);
    this.syncMarkers();
    this.layout();
    this.applyLighting();
    app.ticker.add(this.update, this);
  }

  /* ── Public API ── */

  setState(next: ShelterSceneState): void {
    const prev = this.state;
    this.state = next;
    if (next.siteId !== prev.siteId) this.loadBackground(next.siteId);
    if (next.built.join('|') !== prev.built.join('|')) this.syncMarkers();
    this.target = LIGHTING[next.timeOfDay];
    if (next.reduceMotion) {
      this.current = cloneLighting(this.target);
      this.warmthCurrent = this.warmthTarget();
    }
    this.layout();
    this.applyLighting();
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
    this.bgToken++;
    this.app.ticker.remove(this.update, this);
    this.markers.clear();
    this.app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
    this.radial.destroy(true);
  }

  /* ── Background ── */

  private loadBackground(siteId: SiteId | null): void {
    const token = ++this.bgToken;
    this.drawFallback(siteId);
    if (!siteId) return;

    const src = BG_SHELTERS[siteId].src;
    Assets.load<Texture>(src)
      .then((texture) => {
        if (token !== this.bgToken || !texture) return;
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
      .catch(() => {
        /* keep the gradient fallback */
      });
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

  /* ── Upgrade markers ── */

  private syncMarkers(): void {
    const built = new Set(this.state.built);

    for (const [id, node] of this.markers) {
      if (!built.has(id)) {
        this.markerLayer.removeChild(node.root);
        node.root.destroy({ children: true });
        this.markers.delete(id);
      }
    }

    for (const id of built) {
      if (this.markers.has(id)) continue;
      const spec = MARKERS[id];
      const upgrade = UPGRADE_MAP[id];
      if (!spec || !upgrade) continue;

      const root = new Container();
      const glow = new Sprite(this.radial);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      glow.tint = spec.glow;
      glow.width = 120;
      glow.height = 120;

      const chip = new Graphics();
      chip.circle(0, 0, 17).fill({ color: 0xfffcf6, alpha: 0.88 }).stroke({ color: 0xe8cdb5, width: 2 });

      const icon = new Text({
        text: upgrade.emoji,
        style: new TextStyle({ fontSize: 17, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' }),
      });
      icon.anchor.set(0.5);

      const label = new Text({
        text: spec.label,
        style: new TextStyle({
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: 11,
          fontWeight: '600',
          fill: 0x3d3832,
        }),
      });
      label.anchor.set(0.5, 0);
      label.y = 22;
      const pill = new Graphics();
      const pw = label.width + 12;
      pill.roundRect(-pw / 2, 20, pw, 17, 8.5).fill({ color: 0xfffcf6, alpha: 0.82 });

      root.addChild(glow, chip, icon, pill, label);
      this.markerLayer.addChild(root);
      this.markers.set(id, { id, root, glow, baseGlow: 0.55, phase: Math.random() * Math.PI * 2 });
    }
  }

  /* ── Layout & lighting ── */

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

    const ui = Math.min(1.25, Math.max(0.75, Math.min(W, H) / 520));
    for (const [id, node] of this.markers) {
      const spec = MARKERS[id];
      node.root.position.set(W * spec.x, H * spec.y);
      node.root.scale.set(ui);
    }

    this.lantern.position.set(W * LANTERN_POS.x, H * LANTERN_POS.y);
    const haloSize = Math.min(W, H) * 0.9;
    this.lanternHalo.width = haloSize / ui;
    this.lanternHalo.height = haloSize / ui;
    this.lantern.scale.set(ui);
    this.drawLanternBody();
  }

  private drawLanternBody(): void {
    const g = this.lanternBody;
    g.clear();
    g.moveTo(0, -26).lineTo(0, -18).stroke({ color: 0x3d3832, width: 2 });
    g.roundRect(-8, -18, 16, 4, 2).fill(0x5a4a3a);
    g.roundRect(-7, -14, 14, 20, 4).fill({ color: 0xffd58a, alpha: 0.95 }).stroke({ color: 0x5a4a3a, width: 2 });
    g.roundRect(-9, 6, 18, 4, 2).fill(0x5a4a3a);
    g.circle(0, -4, 3.5).fill(0xfff2c8);
  }

  private warmthTarget(): number {
    return 0.03 + (Math.min(100, this.state.cozyIndex) / 100) * 0.22;
  }

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

    this.applyLighting();
  }

  private applyLighting(): void {
    const c = this.current;
    const { width: W, height: H } = this;
    const still = this.state.reduceMotion;

    this.mulWash.tint = toHex(c.mul);
    this.mulWash.alpha = c.mulAlpha;
    this.scrWash.tint = toHex(c.scr);
    this.scrWash.alpha = c.scrAlpha;
    this.sunGlow.tint = toHex(c.sun);
    this.sunGlow.alpha = c.sunAlpha;
    this.sunGlow.position.set(W * c.sunX, H * c.sunY);
    this.warmth.alpha = this.warmthCurrent;

    for (const node of this.markers.values()) {
      const pulse = still ? 1 : 0.85 + 0.15 * Math.sin(this.elapsed * 1.6 + node.phase);
      node.glow.alpha = Math.min(1, node.baseGlow * c.markerGlow * pulse);
    }

    const lit = this.state.lanternLit;
    this.lantern.visible = lit;
    if (lit) {
      const flicker = still ? 1 : 0.92 + 0.05 * Math.sin(this.elapsed * 7.3) + 0.03 * Math.sin(this.elapsed * 13.1);
      this.lanternHalo.alpha = Math.min(1, (0.12 + c.lantern * 0.78) * flicker);
    }
  }
}
