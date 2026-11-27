/* ───── Live rooftop weather: rain streaks & ripples, wind-blown dust & leaves ───── */

import { Container, Sprite, Texture } from 'pixi.js';
import type { Weather } from '../types/game.ts';

/** Where floor ripples may land (normalized stage coords) */
export interface FloorBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface WeatherFrame {
  dtMs: number;
  elapsedSec: number;
  /** Canvas size in px */
  width: number;
  height: number;
  /** Painted stage rect in screen px (floor ripples are placed on it; sizes scale with its height) */
  stage: { x: number; y: number; width: number; height: number };
  /** 0 by day … 1 at night */
  nightFactor: number;
  floor: FloorBounds;
}

const RAIN_DROPS = 56;
const RIPPLES = 7;
const DUST_MOTES = 26;
const LEAVES = 12;
const STILL_MOTES = 8;
/** Rain slants down-left: horizontal travel per unit of fall */
const RAIN_SLANT = 0.28;
/** Seconds between the peaks of two wind gusts */
const GUST_PERIOD = 9;

interface Drop {
  sprite: Sprite;
  nx: number;
  ny: number;
  /** Fall speed in screen heights per second */
  speed: number;
  alpha: number;
}

interface Ripple {
  sprite: Sprite;
  nx: number;
  ny: number;
  life: number;
  maxLife: number;
}

interface Drifter {
  sprite: Sprite;
  nx: number;
  ny: number;
  /** Screen widths per second at full gust */
  speed: number;
  bob: number;
  phase: number;
  alpha: number;
  /** Leaves: spin (rad/s) & tumble rate */
  spin: number;
  tumble: number;
  size: number;
  leaf: boolean;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g);
  return Texture.from(canvas);
}

/** A soft vertical streak (3px core), fading in from the top */
function streakTexture(): Texture {
  return canvasTexture(6, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = grad;
    g.fillRect(1.5, 0, 3, 64);
  });
}

/** A flat ellipse outline (a ripple seen at the rooftop's angle) */
function ringTexture(): Texture {
  return canvasTexture(64, 24, (g) => {
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(32, 12, 29, 9, 0, 0, Math.PI * 2);
    g.stroke();
  });
}

/** A small pointed leaf / petal, tinted per sprite */
function leafTexture(): Texture {
  return canvasTexture(24, 12, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(1, 6);
    g.quadraticCurveTo(10, -2, 23, 6);
    g.quadraticCurveTo(10, 14, 1, 6);
    g.fill();
  });
}

const MOTE_TINTS = [0xd9c27a, 0xc4c98a, 0xe0c272, 0xead7a0];
const LEAF_TINTS = [0x9bb06a, 0xb3c27a, 0xd6a35c, 0xc98f5a, 0xf1c6b6];

/**
 * Owns the weather particles (one pooled set per weather, allocated only when the
 * weather changes) plus the overcast "mist" amount and the current wind gust,
 * which the scene uses to tint its lighting and sway the weeds.
 */
export class WeatherLayer {
  readonly container = new Container();
  private readonly mist = new Sprite(Texture.WHITE);
  private readonly particles = new Container();
  private readonly streakTex = streakTexture();
  private readonly ringTex = ringTexture();
  private readonly leafTex = leafTexture();
  private readonly moteTex: Texture;

  private weather: Weather = 'clear';
  private reduceMotion = false;
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private drifters: Drifter[] = [];
  /** Fades a freshly built pool in */
  private presence = 1;
  private overcastAmount = 0;
  private gustAmount = 0;

  constructor(moteTexture: Texture) {
    this.moteTex = moteTexture;
    this.container.eventMode = 'none';
    this.mist.eventMode = 'none';
    this.mist.tint = 0xc6d2dc;
    this.mist.alpha = 0;
    this.container.addChild(this.mist, this.particles);
  }

  /** 0 (clear) … 1 (rain): how overcast the sky looks right now (eased) */
  get overcast(): number {
    return this.overcastAmount;
  }

  /** 0 … 1 wind gust strength right now (0 when calm or under Reduce Motion) */
  get gust(): number {
    return this.gustAmount;
  }

  setWeather(weather: Weather, reduceMotion: boolean): void {
    if (weather === this.weather && reduceMotion === this.reduceMotion) return;
    this.weather = weather;
    this.reduceMotion = reduceMotion;
    this.rebuild();
  }

  /** Swap the particle pool for the current weather (the only place sprites are created) */
  private rebuild(): void {
    for (const child of this.particles.removeChildren()) child.destroy();
    this.drops = [];
    this.ripples = [];
    this.drifters = [];
    this.presence = this.reduceMotion ? 1 : 0;

    if (this.weather === 'rain' && !this.reduceMotion) {
      for (let i = 0; i < RAIN_DROPS; i++) {
        const sprite = new Sprite(this.streakTex);
        sprite.anchor.set(0.5);
        sprite.rotation = Math.atan(RAIN_SLANT);
        /* A faint cool blue so streaks read over the pale sky as well as the concrete */
        sprite.tint = 0xe4eef8;
        this.particles.addChild(sprite);
        this.drops.push({
          sprite,
          nx: rand(0, 1.25),
          ny: rand(-0.1, 1),
          speed: rand(0.85, 1.3),
          alpha: rand(0.34, 0.58),
        });
      }
      for (let i = 0; i < RIPPLES; i++) {
        const sprite = new Sprite(this.ringTex);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        this.particles.addChild(sprite);
        this.ripples.push({ sprite, nx: 0, ny: 0, life: 0, maxLife: 0 });
      }
    }

    if (this.weather === 'wind') {
      const motes = this.reduceMotion ? STILL_MOTES : DUST_MOTES;
      for (let i = 0; i < motes; i++) this.addDrifter(false);
      if (!this.reduceMotion) for (let i = 0; i < LEAVES; i++) this.addDrifter(true);
    }
  }

  private addDrifter(leaf: boolean): void {
    const sprite = new Sprite(leaf ? this.leafTex : this.moteTex);
    sprite.anchor.set(0.5);
    sprite.tint = leaf
      ? LEAF_TINTS[Math.floor(Math.random() * LEAF_TINTS.length)]
      : MOTE_TINTS[Math.floor(Math.random() * MOTE_TINTS.length)];
    this.particles.addChild(sprite);
    this.drifters.push({
      sprite,
      nx: rand(-0.05, 1.05),
      ny: rand(0.12, 0.92),
      speed: leaf ? rand(0.09, 0.15) : rand(0.05, 0.11),
      bob: rand(0.006, 0.02),
      phase: rand(0, Math.PI * 2),
      alpha: leaf ? rand(0.8, 0.95) : rand(0.4, 0.7),
      spin: rand(-3, 3),
      tumble: rand(2, 5),
      size: leaf ? rand(0.022, 0.034) : rand(0.006, 0.012),
      leaf,
    });
  }

  update(f: WeatherFrame): void {
    const { dtMs, width: W, height: H, stage } = f;
    const SH = stage.height;
    const dt = dtMs / 1000;
    const still = this.reduceMotion;
    const ease = still ? 1 : 1 - Math.exp(-dtMs / 600);

    this.presence = Math.min(1, this.presence + dtMs / 900);
    this.overcastAmount += ((this.weather === 'rain' ? 1 : 0) - this.overcastAmount) * ease;
    const gustTarget =
      this.weather === 'wind' && !still ? Math.pow(Math.max(0, Math.sin((f.elapsedSec * Math.PI * 2) / GUST_PERIOD)), 2) : 0;
    this.gustAmount += (gustTarget - this.gustAmount) * (still ? 1 : 1 - Math.exp(-dtMs / 300));

    /* Cool misty haze over the whole scene, gentler at night */
    this.mist.width = W;
    this.mist.height = H;
    this.mist.alpha = 0.11 * this.overcastAmount * (1 - 0.45 * f.nightFactor);

    /* Rain: slanted streaks recycle to the top once they fall past the floor */
    const streakLen = Math.max(20, SH * 0.06);
    const streakScale = streakLen / 64;
    const dim = 1 - 0.3 * f.nightFactor;
    for (const d of this.drops) {
      const fall = d.speed * dt;
      d.ny += fall;
      d.nx -= (fall * RAIN_SLANT * H) / Math.max(1, W);
      if (d.ny > 1.05 || d.nx < -0.05) {
        d.ny = rand(-0.15, -0.02);
        d.nx = rand(0.05, 1.3);
      }
      d.sprite.position.set(d.nx * W, d.ny * H);
      d.sprite.scale.set(1, streakScale);
      d.sprite.alpha = d.alpha * this.presence * dim;
    }

    /* Rain: tiny rings spreading on the open concrete */
    for (const r of this.ripples) {
      if (r.maxLife === 0) {
        if (Math.random() < dtMs / 260) {
          r.nx = rand(f.floor.xMin, f.floor.xMax);
          r.ny = rand(f.floor.yMin, f.floor.yMax);
          r.life = 0;
          r.maxLife = rand(650, 1000);
          r.sprite.visible = true;
        }
        continue;
      }
      r.life += dtMs;
      const k = r.life / r.maxLife;
      if (k >= 1) {
        r.maxLife = 0;
        r.sprite.visible = false;
        continue;
      }
      r.sprite.position.set(stage.x + r.nx * stage.width, stage.y + r.ny * stage.height);
      r.sprite.scale.set(((0.25 + 0.75 * k) * SH * 0.03) / 29);
      r.sprite.alpha = 0.6 * (1 - k) * this.presence * dim;
    }

    /* Wind: dust motes & tumbling leaves sweep across in gusts */
    const push = 0.3 + 1.4 * this.gustAmount;
    for (const m of this.drifters) {
      if (!still) {
        m.nx += m.speed * push * dt;
        m.ny += (0.012 + m.bob * Math.sin(f.elapsedSec * 1.6 + m.phase)) * dt * (m.leaf ? 1.6 : 1);
        if (m.nx > 1.06 || m.ny > 0.96) {
          m.nx = rand(-0.12, -0.03);
          m.ny = rand(0.12, 0.85);
        }
      }
      const size = m.size * SH;
      m.sprite.position.set(m.nx * W, m.ny * H);
      if (m.leaf) {
        m.sprite.rotation += m.spin * dt * (0.5 + this.gustAmount);
        const tumble = Math.cos(f.elapsedSec * m.tumble + m.phase);
        m.sprite.scale.set(size / 24, (size / 24) * (0.35 + 0.65 * Math.abs(tumble)));
      } else {
        m.sprite.scale.set(size / 256 * 4);
      }
      const gustGlow = m.leaf ? 1 : 0.55 + 0.45 * this.gustAmount;
      m.sprite.alpha = m.alpha * gustGlow * this.presence * (still ? 0.6 : 1);
    }
  }

  destroy(): void {
    if (this.container.destroyed) return;
    this.container.destroy({ children: true });
    this.streakTex.destroy(true);
    this.ringTex.destroy(true);
    this.leafTex.destroy(true);
  }
}
