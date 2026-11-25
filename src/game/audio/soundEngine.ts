/**
 * soundEngine.ts — Cozy, zero-dependency Web Audio sound system for One Warm Spot.
 *
 * Features:
 *   • Procedurally synthesized UI sounds (hover, click, claim, locked, footstep) — 0 KB
 *   • Per-shelter musical ambience (birdsong, chimes, drips, surf…) with 350ms crossfade (9 sites)
 *   • Shared menu music bed from file, with procedural warm-pad fallback
 *   • Independent Music & SFX+Ambience volume sliders + master mute in localStorage
 *   • Smooth gain ramping (linearRampToValueAtTime) to eliminate slider crackle
 */

import type { SiteId } from '../types/game.ts';

/* ═══════════════════════════════════════════
   Storage & Defaults
   ═══════════════════════════════════════════ */

const MUTE_KEY = 'ows_muted';
const MUSIC_VOL_KEY = 'ows_music_vol';
const SFX_VOL_KEY = 'ows_sfx_vol';

const DEFAULT_MUSIC_VOL = 0.55;
const DEFAULT_SFX_VOL = 0.70;
const MUSIC_BASE_GAIN = 0.48;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function readStoredVolume(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? clamp01(parsed) : fallback;
  } catch {
    return fallback;
  }
}

/* ═══════════════════════════════════════════
   Singleton State
   ═══════════════════════════════════════════ */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicChannelGain: GainNode | null = null;
let musicFadeGain: GainNode | null = null;
let sfxChannelGain: GainNode | null = null;
let ambienceGain: GainNode | null = null;

let unlocked = false;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
})();
let musicVolume = readStoredVolume(MUSIC_VOL_KEY, DEFAULT_MUSIC_VOL);
let sfxVolume = readStoredVolume(SFX_VOL_KEY, DEFAULT_SFX_VOL);

let musicElement: HTMLAudioElement | null = null;
let musicSourceNode: MediaElementAudioSourceNode | null = null;
let proceduralMusicInterval: ReturnType<typeof setInterval> | null = null;
let musicPlaying = false;
let musicSessionId = 0;

/* ═══════════════════════════════════════════
   Gain Ramp Helper
   ═══════════════════════════════════════════ */

function rampGain(param: AudioParam, target: number, duration = 0.06): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const safeTarget = clamp01(target);
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t);
  } else {
    const currentVal = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(currentVal, t);
  }
  param.linearRampToValueAtTime(safeTarget, t + duration);
}

/* ═══════════════════════════════════════════
   Init & Unlock
   ═══════════════════════════════════════════ */

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);

    musicChannelGain = ctx.createGain();
    musicChannelGain.gain.value = musicVolume;
    musicChannelGain.connect(masterGain);

    musicFadeGain = ctx.createGain();
    musicFadeGain.gain.value = 0;
    musicFadeGain.connect(musicChannelGain);

    sfxChannelGain = ctx.createGain();
    sfxChannelGain.gain.value = sfxVolume;
    sfxChannelGain.connect(masterGain);

    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0;
    ambienceGain.connect(sfxChannelGain);
  }
  return ctx;
}

export function unlock(): void {
  const c = getCtx();
  if (c.state === 'suspended') void c.resume();
  unlocked = true;
  applyAmbience();
  applyCampfire();
}

export function isUnlocked(): boolean {
  return unlocked;
}

/* ═══════════════════════════════════════════
   Mute & Independent Channel Volumes
   ═══════════════════════════════════════════ */

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, String(muted));
  } catch {
    /* ignore storage restrictions */
  }
  if (masterGain && ctx) rampGain(masterGain.gain, muted ? 0 : 1, 0.2);
  applyAmbience();
  applyCampfire();
}

export function getMusicVolume(): number {
  return musicVolume;
}

export function setMusicVolume(v: number): void {
  musicVolume = clamp01(v);
  try {
    localStorage.setItem(MUSIC_VOL_KEY, musicVolume.toFixed(2));
  } catch {
    /* ignore storage restrictions */
  }
  if (!musicChannelGain || !ctx) return;
  rampGain(musicChannelGain.gain, musicVolume, 0.05);
}

export function getSfxVolume(): number {
  return sfxVolume;
}

export function setSfxVolume(v: number): void {
  sfxVolume = clamp01(v);
  try {
    localStorage.setItem(SFX_VOL_KEY, sfxVolume.toFixed(2));
  } catch {
    /* ignore storage restrictions */
  }
  if (sfxChannelGain && ctx) rampGain(sfxChannelGain.gain, sfxVolume, 0.05);
  applyAmbience();
  applyCampfire();
}

/** Convenience helper if a caller adjusts both channels uniformly */
export function setVolume(v: number): void {
  const clamped = clamp01(v);
  setMusicVolume(clamped);
  setSfxVolume(clamped);
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function pitchVar(): number {
  return 1 + (Math.random() - 0.5) * 0.06;
}

function now(): number {
  return getCtx().currentTime;
}

function getSfxTarget(): GainNode {
  getCtx();
  return sfxChannelGain!;
}

/* ═══════════════════════════════════════════
   Synthesized UI Sounds (0 KB)
   ═══════════════════════════════════════════ */

export function playHover(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  const bufLen = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.11;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitchVar();

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 1.5;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.075, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

  src.connect(filter).connect(gain).connect(target);
  src.start(t);
  src.stop(t + 0.07);
}

export function playClick(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;

  osc.connect(filter).connect(gain).connect(target);
  osc.start(t);
  osc.stop(t + 0.1);
}

export function playClaim(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const pv = pitchVar();
  const target = getSfxTarget();

  [392 * pv, 587 * pv].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = c.createGain();
    const start = t + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.13, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    osc.connect(gain).connect(target);
    osc.start(start);
    osc.stop(start + 0.65);
  });
}

export function playLocked(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;

  osc.connect(filter).connect(gain).connect(target);
  osc.start(t);
  osc.stop(t + 0.15);
}

/** Soft earthy footstep for the arrival cutscene */
export function playFootstep(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  const bufLen = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.18;

  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.7 + Math.random() * 0.3;

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 600 + Math.random() * 400;
  bp.Q.value = 1;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.11, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(90 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

  const og = c.createGain();
  og.gain.setValueAtTime(0.09, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  src.connect(bp).connect(gain).connect(target);
  src.start(t);
  src.stop(t + 0.12);

  osc.connect(og).connect(target);
  osc.start(t);
  osc.stop(t + 0.12);
}

/** Scavenging trip: a few soft footsteps home, then a warm two-note chime */
export function playScavengeReturn(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  [0, 240, 480].forEach((ms) => setTimeout(playFootstep, ms));

  setTimeout(() => {
    if (muted || !unlocked || sfxVolume <= 0) return;
    const c = getCtx();
    const target = getSfxTarget();
    const t = now();
    const pv = pitchVar();
    [523.25 * pv, 783.99 * pv].forEach((freq, i) => {
      const start = t + i * 0.16;
      for (const [ratio, amp] of [[1, 0.11], [2.76, 0.025]] as const) {
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * ratio;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2 / ratio);
        osc.connect(gain).connect(target);
        osc.start(start);
        osc.stop(start + 1.25);
      }
    });
  }, 760);
}

/* ═══════════════════════════════════════════
   Menu Music Bed
   ═══════════════════════════════════════════ */

function clearProceduralMusic(): void {
  if (proceduralMusicInterval !== null) {
    clearInterval(proceduralMusicInterval);
    proceduralMusicInterval = null;
  }
}

export function startMenuMusic(): void {
  if (musicPlaying) return;
  musicPlaying = true;
  const session = ++musicSessionId;

  const c = getCtx();
  if (!musicFadeGain) return;

  if (musicElement && musicSourceNode) {
    void musicElement.play().catch(() => { /* ignore autoplay guard */ });
    rampGain(musicFadeGain.gain, MUSIC_BASE_GAIN, 0.5);
    return;
  }

  const audio = new Audio('/source/audio/music-menu.mp3');
  audio.loop = true;
  audio.volume = 1;
  audio.crossOrigin = 'anonymous';

  audio.addEventListener(
    'canplaythrough',
    () => {
      if (session !== musicSessionId || !musicPlaying || !ctx || !musicFadeGain) return;
      try {
        if (!musicSourceNode) {
          musicSourceNode = c.createMediaElementSource(audio);
          musicSourceNode.connect(musicFadeGain);
        }
        musicElement = audio;
        void audio.play();
        rampGain(musicFadeGain.gain, MUSIC_BASE_GAIN, 0.6);
      } catch {
        startProceduralMusic(session);
      }
    },
    { once: true },
  );

  audio.addEventListener(
    'error',
    () => {
      if (session !== musicSessionId || !musicPlaying) return;
      startProceduralMusic(session);
    },
    { once: true },
  );

  audio.load();
}

function startProceduralMusic(session: number): void {
  if (session !== musicSessionId || !ctx || !musicFadeGain) return;
  clearProceduralMusic();

  function playPadChord() {
    if (session !== musicSessionId || !ctx || !musicFadeGain || !musicPlaying) return;
    const t = ctx.currentTime;
    const freqs = [130.8, 164.8, 196.0, 246.9];
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.008);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 1.2);
      gain.gain.setValueAtTime(0.045, t + 2.0);
      gain.gain.linearRampToValueAtTime(0, t + 3.8);
      osc.connect(gain).connect(musicFadeGain);
      osc.start(t);
      osc.stop(t + 4.0);
    }
  }

  playPadChord();
  proceduralMusicInterval = setInterval(playPadChord, 4000);
  rampGain(musicFadeGain.gain, MUSIC_BASE_GAIN, 0.6);
}

export function fadeOutMenuMusic(): void {
  const session = ++musicSessionId;
  if (!musicFadeGain || !ctx) {
    musicPlaying = false;
    clearProceduralMusic();
    return;
  }
  rampGain(musicFadeGain.gain, 0, 0.65);
  setTimeout(() => {
    if (session !== musicSessionId) return;
    musicPlaying = false;
    if (musicElement) musicElement.pause();
    clearProceduralMusic();
  }, 750);
}

export function fadeInMenuMusic(): void {
  if (musicPlaying) return;
  startMenuMusic();
}

/* ═══════════════════════════════════════════
   Per-Shelter Ambience (Procedural, musical)
   ─ Soft pitched voices, pink/brown-noise swells and spaced organic
     micro-events instead of steady white-noise hiss. Each soundscape
     lives on its own bus so changes crossfade over 350ms.
   ═══════════════════════════════════════════ */

const AMBIENCE_FADE = 0.35;
const AMBIENCE_MASTER = 1.6;
const DIMMED_LEVEL = 0.55;

type Timer = ReturnType<typeof setTimeout>;

interface AmbienceInstance {
  key: string;
  bus: GainNode;
  nodes: AudioNode[];
  timers: Set<Timer>;
  alive: boolean;
}

interface AmbienceRequest {
  siteId: SiteId;
  dimmed: boolean;
  level: number;
}

let currentAmbience: AmbienceInstance | null = null;
let desiredAmbience: AmbienceRequest | null = null;
const noiseCache = new Map<'pink' | 'brown', AudioBuffer>();

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Seamlessly looping pink or brown noise (tail crossfaded into head) */
function getNoise(color: 'pink' | 'brown'): AudioBuffer {
  const c = getCtx();
  const cached = noiseCache.get(color);
  if (cached && cached.sampleRate === c.sampleRate) return cached;

  const len = Math.floor(c.sampleRate * 4);
  const fade = Math.floor(c.sampleRate * 0.25);
  const raw = new Float32Array(len + fade);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < raw.length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      raw[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else {
      last = (last + 0.02 * white) / 1.02;
      raw[i] = last * 3.5;
    }
  }
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    if (i < fade) {
      const a = i / fade;
      data[i] = raw[i] * a + raw[len + i] * (1 - a);
    } else {
      data[i] = raw[i];
    }
  }
  noiseCache.set(color, buf);
  return buf;
}

/* ── Building blocks ── */

function addLfo(
  inst: AmbienceInstance,
  c: AudioContext,
  rate: number,
  depth: number,
  targets: AudioParam[],
): void {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = rate;
  const g = c.createGain();
  g.gain.value = depth;
  osc.connect(g);
  for (const t of targets) g.connect(t);
  osc.start();
  inst.nodes.push(osc, g);
}

interface BedOptions {
  color: 'pink' | 'brown';
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  vol: number;
  /** Gain swell (breathing) */
  swellRate?: number;
  swellDepth?: number;
  /** Filter sweep */
  sweepRate?: number;
  sweepDepth?: number;
}

/** Very quiet filtered pink/brown noise bed that breathes slowly */
function addBed(inst: AmbienceInstance, c: AudioContext, o: BedOptions): { filter: BiquadFilterNode; gain: GainNode } {
  const src = c.createBufferSource();
  src.buffer = getNoise(o.color);
  src.loop = true;
  src.loopStart = 0;
  src.playbackRate.value = rand(0.96, 1.04);
  const filter = c.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.value = o.freq;
  filter.Q.value = o.q ?? 0.7;
  const gain = c.createGain();
  gain.gain.value = o.vol;
  src.connect(filter).connect(gain).connect(inst.bus);
  src.start(c.currentTime, rand(0, 3));
  inst.nodes.push(src, filter, gain);
  if (o.swellRate && o.swellDepth) addLfo(inst, c, o.swellRate, o.swellDepth, [gain.gain]);
  if (o.sweepRate && o.sweepDepth) addLfo(inst, c, o.sweepRate, o.sweepDepth, [filter.frequency]);
  return { filter, gain };
}

/** Soft sustained sine pad with slow tremolo */
function addDrone(
  inst: AmbienceInstance,
  c: AudioContext,
  freqs: number[],
  vol: number,
  lowpass = 900,
  tremRate = 0.08,
): void {
  const g = c.createGain();
  g.gain.value = vol;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lowpass;
  g.connect(lp).connect(inst.bus);
  inst.nodes.push(g, lp);
  for (const f of freqs) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    osc.detune.value = rand(-4, 4);
    const v = c.createGain();
    v.gain.value = 1 / freqs.length;
    osc.connect(v).connect(g);
    osc.start();
    inst.nodes.push(osc, v);
  }
  addLfo(inst, c, tremRate, vol * 0.35, [g.gain]);
}

/** Feedback echo; returns the input node (dry + wet both reach the bus) */
function addEcho(
  inst: AmbienceInstance,
  c: AudioContext,
  time: number,
  feedback: number,
  tone: number,
  wet = 0.5,
): GainNode {
  const input = c.createGain();
  const delay = c.createDelay(2);
  delay.delayTime.value = time;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = tone;
  const fb = c.createGain();
  fb.gain.value = feedback;
  const wetGain = c.createGain();
  wetGain.gain.value = wet;
  input.connect(inst.bus);
  input.connect(delay);
  delay.connect(lp).connect(fb).connect(delay);
  lp.connect(wetGain).connect(inst.bus);
  inst.nodes.push(input, delay, lp, fb, wetGain);
  return input;
}

/** Repeatedly fire `fn` at organic, randomly spaced intervals */
function every(
  inst: AmbienceInstance,
  minMs: number,
  maxMs: number,
  fn: (t: number) => void,
  first: [number, number] = [minMs * 0.25, minMs * 0.6],
): void {
  const schedule = (delay: number) => {
    const id = setTimeout(() => {
      inst.timers.delete(id);
      if (!inst.alive || !ctx) return;
      fn(ctx.currentTime + 0.02);
      schedule(rand(minMs, maxMs));
    }, delay);
    inst.timers.add(id);
  };
  schedule(rand(first[0], first[1]));
}

/* ── Event voices (self-stopping, connect to a bus or echo input) ── */

interface ToneOptions {
  freq: number;
  vol: number;
  decay: number;
  type?: OscillatorType;
  attack?: number;
  glideTo?: number;
  glideTime?: number;
}

function tone(c: AudioContext, dest: AudioNode, t: number, o: ToneOptions): void {
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + (o.glideTime ?? o.decay * 0.6));
  const g = c.createGain();
  const attack = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + o.decay);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + attack + o.decay + 0.05);
}

/** Struck bell / bamboo voice built from inharmonic partials */
function bell(
  c: AudioContext,
  dest: AudioNode,
  t: number,
  freq: number,
  vol: number,
  decay: number,
  partials: [number, number][] = [[1, 1], [2.76, 0.28], [5.4, 0.09]],
): void {
  for (const [ratio, amp] of partials) {
    tone(c, dest, t, { freq: freq * ratio, vol: vol * amp, decay: decay / Math.sqrt(ratio), attack: 0.004 });
  }
}

/** Woody marimba-like mallet tone */
function mallet(c: AudioContext, dest: AudioNode, t: number, freq: number, vol: number): void {
  tone(c, dest, t, { freq, vol, decay: 0.75, attack: 0.004 });
  tone(c, dest, t, { freq: freq * 4, vol: vol * 0.22, decay: 0.12, attack: 0.002 });
  tone(c, dest, t, { freq: freq * 2.01, vol: vol * 0.1, decay: 0.3, type: 'triangle', attack: 0.003 });
}

/** Two-note morning birdsong with gentle pitch glides */
function birdsong(c: AudioContext, dest: AudioNode, t: number, vol: number): void {
  const base = pick([2300, 2550, 2800, 3050]);
  tone(c, dest, t, { freq: base, glideTo: base * 1.14, glideTime: 0.09, vol, decay: 0.12, attack: 0.012 });
  tone(c, dest, t + 0.16, {
    freq: base * 1.22,
    glideTo: base * 0.94,
    glideTime: 0.13,
    vol: vol * 0.85,
    decay: 0.16,
    attack: 0.012,
  });
}

/** Water-drop plink: quick downward then upward sine blip */
function drip(c: AudioContext, dest: AudioNode, t: number, freq: number, vol: number): void {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.025);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.18, t + 0.075);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Wooden creak: slow stick-slip pulse train through a resonant band */
function creak(
  c: AudioContext,
  dest: AudioNode,
  t: number,
  pulseHz: number,
  resonance: number,
  vol: number,
  dur: number,
): void {
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(pulseHz, t);
  osc.frequency.linearRampToValueAtTime(pulseHz * 1.3, t + dur * 0.45);
  osc.frequency.linearRampToValueAtTime(pulseHz * 1.1, t + dur);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = resonance;
  bp.Q.value = 7;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(bp).connect(lp).connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Short filtered noise puff (leaf rustle, ripple, splash) */
function puff(
  c: AudioContext,
  dest: AudioNode,
  t: number,
  vol: number,
  dur: number,
  hp: number,
  lpFrom: number,
  lpTo = lpFrom,
): void {
  const src = c.createBufferSource();
  src.buffer = getNoise('pink');
  const high = c.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = hp;
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(lpFrom, t);
  low.frequency.exponentialRampToValueAtTime(lpTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(high).connect(low).connect(g).connect(dest);
  src.start(t, rand(0, 3));
  src.stop(t + dur + 0.05);
}

/** Faint metallic relay tick */
function relayTick(c: AudioContext, dest: AudioNode, t: number, vol: number): void {
  for (const [f, v] of [[3200, 1], [4750, 0.5]] as const) {
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f * rand(0.97, 1.03);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 9;
    const g = c.createGain();
    g.gain.setValueAtTime(vol * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    osc.connect(bp).connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.04);
  }
}

/* ── Per-site soundscapes ── */

const G_PENTA = [392, 440, 494, 587.3, 659.3, 784];
const C_PENTA_HIGH = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];

function buildSoundscape(inst: AmbienceInstance, c: AudioContext, siteId: SiteId): void {
  const bus = inst.bus;

  switch (siteId) {
    case 'terrace': {
      addBed(inst, c, { color: 'pink', filter: 'bandpass', freq: 1400, q: 0.6, vol: 0.012, swellRate: 0.09, swellDepth: 0.008 });
      every(inst, 2200, 5200, (t) => {
        birdsong(c, bus, t, 0.034);
        if (Math.random() < 0.45) birdsong(c, bus, t + rand(0.45, 0.8), 0.02);
      }, [150, 550]);
      every(inst, 3200, 6800, (t) => {
        const notes = [587.3, 659.3, 784, 880, 987.8];
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          bell(c, bus, t + i * rand(0.12, 0.26), pick(notes), 0.026, 1.1, [[1, 1], [2.7, 0.3], [5.1, 0.06]]);
        }
      }, [700, 1400]);
      break;
    }

    case 'pipe': {
      addDrone(inst, c, [73.4, 110, 146.8], 0.011, 380, 0.07);
      addBed(inst, c, { color: 'brown', filter: 'lowpass', freq: 170, vol: 0.014, swellRate: 0.05, swellDepth: 0.005 });
      const echo = addEcho(inst, c, 0.13, 0.42, 1800, 0.55);
      every(inst, 1400, 3600, (t) => {
        drip(c, echo, t, pick([880, 987.8, 1174.7, 1318.5]), 0.05);
      }, [120, 450]);
      break;
    }

    case 'tree': {
      addDrone(inst, c, [196, 293.7], 0.006, 700, 0.06);
      every(inst, 2000, 4500, (t) => {
        const i = Math.floor(Math.random() * (G_PENTA.length - 2));
        mallet(c, bus, t, G_PENTA[i], 0.04);
        if (Math.random() < 0.4) mallet(c, bus, t + 0.18, G_PENTA[i + 2], 0.03);
      }, [150, 500]);
      every(inst, 5500, 10000, (t) => {
        creak(c, bus, t, rand(26, 32), 520, 0.03, 0.9);
      }, [1200, 2400]);
      every(inst, 2600, 5000, (t) => {
        const n = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) puff(c, bus, t + i * 0.11, 0.018, 0.09, 2500, 8000);
      }, [500, 1100]);
      break;
    }

    case 'countryhouse': {
      addDrone(inst, c, [261.6, 392], 0.005, 800, 0.05);
      addBed(inst, c, {
        color: 'pink', filter: 'bandpass', freq: 520, q: 0.7, vol: 0.022,
        swellRate: 0.08, swellDepth: 0.016, sweepRate: 0.05, sweepDepth: 120,
      });
      every(inst, 3200, 6500, (t) => {
        const n = 2 + Math.floor(Math.random() * 3);
        let at = t;
        for (let i = 0; i < n; i++) {
          bell(c, bus, at, pick(C_PENTA_HIGH), 0.02, 2.2);
          at += rand(0.14, 0.32);
        }
      }, [150, 500]);
      break;
    }

    case 'farmhouse': {
      addDrone(inst, c, [98, 147], 0.008, 500, 0.06);
      addBed(inst, c, { color: 'brown', filter: 'lowpass', freq: 650, vol: 0.03, swellRate: 0.12, swellDepth: 0.02 });
      every(inst, 5000, 9000, (t) => {
        creak(c, bus, t, rand(17, 22), 360, 0.035, 1.3);
      }, [350, 900]);
      every(inst, 4000, 8000, (t) => {
        const f = rand(1750, 2050);
        tone(c, bus, t, { freq: f, glideTo: f * 0.84, glideTime: 0.2, vol: 0.015, decay: 0.24, attack: 0.02 });
      }, [1000, 2000]);
      break;
    }

    case 'cave': {
      addBed(inst, c, { color: 'brown', filter: 'lowpass', freq: 200, vol: 0.035, swellRate: 0.04, swellDepth: 0.01 });
      addDrone(inst, c, [55, 82.4], 0.012, 220, 0.03);
      const echo = addEcho(inst, c, 0.31, 0.5, 2600, 0.6);
      every(inst, 2200, 4800, (t) => {
        const f = pick([1760, 2093, 2349.3, 2637]);
        drip(c, echo, t, f, 0.03);
        bell(c, echo, t + 0.01, f, 0.014, 0.9, [[1, 1], [2.4, 0.2]]);
      }, [150, 550]);
      break;
    }

    case 'bunker': {
      addDrone(inst, c, [60, 120.4, 180.2], 0.016, 500, 0.03);
      addBed(inst, c, { color: 'brown', filter: 'lowpass', freq: 140, vol: 0.02 });
      every(inst, 3000, 7000, (t) => {
        relayTick(c, bus, t, 0.02);
        if (Math.random() < 0.4) relayTick(c, bus, t + 0.07, 0.014);
      }, [250, 700]);
      break;
    }

    case 'beachhouse': {
      // Rolling surf: one slow 0.14 Hz LFO drives both loudness and brightness
      const surf = addBed(inst, c, { color: 'pink', filter: 'lowpass', freq: 650, q: 0.5, vol: 0.03 });
      const foam = addBed(inst, c, { color: 'pink', filter: 'highpass', freq: 2500, vol: 0.006 });
      addLfo(inst, c, 0.14, 0.026, [surf.gain.gain]);
      addLfo(inst, c, 0.14, 420, [surf.filter.frequency]);
      addLfo(inst, c, 0.14, 0.005, [foam.gain.gain]);
      every(inst, 5000, 9000, (t) => {
        bell(c, bus, t, pick([659.3, 880, 987.8]), 0.014, 2.5);
      }, [800, 1600]);
      break;
    }

    case 'island': {
      addBed(inst, c, { color: 'pink', filter: 'lowpass', freq: 450, vol: 0.012, swellRate: 0.22, swellDepth: 0.008 });
      addDrone(inst, c, [293.7, 440, 587.3], 0.008, 900, 0.09);
      addBed(inst, c, {
        color: 'pink', filter: 'bandpass', freq: 950, q: 1.2, vol: 0.012,
        swellRate: 0.07, swellDepth: 0.009, sweepRate: 0.05, sweepDepth: 200,
      });
      every(inst, 1400, 3000, (t) => {
        puff(c, bus, t, 0.035, 0.38, 120, 900, 380);
        puff(c, bus, t + 0.28, 0.022, 0.32, 120, 800, 350);
      }, [150, 450]);
      break;
    }
  }
}

/* ── Lifecycle ── */

function stopAmbienceInstance(inst: AmbienceInstance): void {
  inst.alive = false;
  for (const id of inst.timers) clearTimeout(id);
  inst.timers.clear();
  if (ctx) rampGain(inst.bus.gain, 0, AMBIENCE_FADE);
  setTimeout(() => {
    for (const n of inst.nodes) {
      try {
        if (n instanceof AudioScheduledSourceNode) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    try {
      inst.bus.disconnect();
    } catch {
      /* already disconnected */
    }
  }, AMBIENCE_FADE * 1000 + 150);
}

function createAmbience(req: AmbienceRequest, key: string): AmbienceInstance | null {
  const c = getCtx();
  if (!ambienceGain) return null;
  rampGain(ambienceGain.gain, 1, 0.05);

  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(ambienceGain);
  const inst: AmbienceInstance = { key, bus, nodes: [], timers: new Set(), alive: true };
  buildSoundscape(inst, c, req.siteId);

  const target = AMBIENCE_MASTER * req.level * (req.dimmed ? DIMMED_LEVEL : 1);
  rampGain(bus.gain, target, AMBIENCE_FADE);
  return inst;
}

/** (Re)apply the requested ambience given mute / unlock / volume state */
function applyAmbience(): void {
  const want = desiredAmbience;
  if (!want || muted || !unlocked || sfxVolume <= 0) {
    if (currentAmbience) {
      stopAmbienceInstance(currentAmbience);
      currentAmbience = null;
    }
    return;
  }

  const key = `${want.siteId}|${want.dimmed}|${want.level}`;
  if (currentAmbience?.key === key) return;
  if (currentAmbience) stopAmbienceInstance(currentAmbience);
  currentAmbience = createAmbience(want, key);
}

/**
 * Crossfade to a shelter's soundscape (or silence with `null`).
 * @param dimmed quieter preview used for locked shelters
 * @param level  overall loudness scale (shelter screen uses a softer bed)
 */
export function startSiteAmbience(siteId: SiteId | null, dimmed = false, level = 1): void {
  desiredAmbience = siteId ? { siteId, dimmed, level } : null;
  applyAmbience();
}

/* ═══════════════════════════════════════════
   In-Shelter Interactive Foley (0 KB)
   ═══════════════════════════════════════════ */

/** Crisp match strike + soft ignition whoosh when lighting the fire pit */
export function playFireLight(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  // 1. Match strike: quick high-pass filtered noise snap
  puff(c, target, t, 0.22, 0.08, 1800, 6200, 3200);
  // Soft ignition whoosh: warm rising then settling lowpass swell
  const whooshSrc = c.createBufferSource();
  whooshSrc.buffer = getNoise('pink');
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(180, t + 0.06);
  lp.frequency.exponentialRampToValueAtTime(950, t + 0.22);
  lp.frequency.exponentialRampToValueAtTime(260, t + 0.65);
  const wg = c.createGain();
  wg.gain.setValueAtTime(0.0001, t + 0.06);
  wg.gain.linearRampToValueAtTime(0.24, t + 0.2);
  wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  whooshSrc.connect(lp).connect(wg).connect(target);
  whooshSrc.start(t + 0.06, rand(0, 2));
  whooshSrc.stop(t + 0.75);
}

/** Soft gentle hiss & ember dampen when extinguishing the fire pit */
export function playFireDouse(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  // Gentle steam/ash hiss sweeping down
  puff(c, target, t, 0.16, 0.42, 650, 4200, 750);
  puff(c, target, t + 0.12, 0.09, 0.36, 400, 2400, 520);

  // Soft low thud/dampen
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(135 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  osc.connect(g).connect(target);
  osc.start(t);
  osc.stop(t + 0.22);
}

interface CampfireInstance {
  bus: GainNode;
  nodes: AudioNode[];
  timers: Set<Timer>;
  alive: boolean;
}

let campfireDesired = false;
let currentCampfire: CampfireInstance | null = null;

function stopCampfireInstance(inst: CampfireInstance): void {
  inst.alive = false;
  for (const id of inst.timers) clearTimeout(id);
  inst.timers.clear();
  if (ctx) rampGain(inst.bus.gain, 0, 0.35);
  setTimeout(() => {
    for (const n of inst.nodes) {
      try {
        if (n instanceof AudioScheduledSourceNode) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    try {
      inst.bus.disconnect();
    } catch {
      /* already disconnected */
    }
  }, 450);
}

function applyCampfire(): void {
  const shouldPlay = campfireDesired && !muted && unlocked && sfxVolume > 0;
  if (!shouldPlay) {
    if (currentCampfire) {
      stopCampfireInstance(currentCampfire);
      currentCampfire = null;
    }
    return;
  }
  if (currentCampfire) return;

  const c = getCtx();
  const target = getSfxTarget();
  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(target);

  const inst: CampfireInstance = { bus, nodes: [], timers: new Set(), alive: true };

  // Soft warm hearth rumble
  const bed = c.createBufferSource();
  bed.buffer = getNoise('brown');
  bed.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 260;
  const bedGain = c.createGain();
  bedGain.gain.value = 0.055;
  bed.connect(lp).connect(bedGain).connect(bus);
  bed.start(c.currentTime, rand(0, 2));
  inst.nodes.push(bed, lp, bedGain);

  // Subtle irregular wood crackles and tiny pops
  const scheduleCrackle = (delay: number) => {
    const id = setTimeout(() => {
      inst.timers.delete(id);
      if (!inst.alive || !ctx) return;
      const t = ctx.currentTime + 0.01;
      const bpFreq = rand(1400, 4400);
      const dur = rand(0.014, 0.042);
      const src = ctx.createBufferSource();
      src.buffer = getNoise('pink');
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = bpFreq;
      bp.Q.value = rand(2.5, 6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(rand(0.04, 0.13), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp).connect(g).connect(bus);
      src.start(t, rand(0, 3));
      src.stop(t + dur + 0.02);

      // Occasional warm double-pop
      if (Math.random() < 0.28) {
        scheduleCrackle(rand(45, 130));
      } else {
        scheduleCrackle(rand(180, 720));
      }
    }, delay);
    inst.timers.add(id);
  };
  scheduleCrackle(rand(120, 350));

  rampGain(bus.gain, 1, 0.45);
  currentCampfire = inst;
}

/** Start or stop the looping procedural campfire crackle */
export function setCampfireAudio(active: boolean): void {
  campfireDesired = active;
  applyCampfire();
}

/** Soft cardboard & timber rummaging taps when searching crates */
export function playRummage(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const base = now();
  const target = getSfxTarget();

  const offsets = [0, 0.16, 0.34, 0.56];
  offsets.forEach((off, i) => {
    const t = base + off;
    // Soft cardboard brush
    puff(c, target, t, 0.12 - i * 0.012, 0.09, 420, 2200 - i * 220, 900);
    // Woody crate tap
    const osc = c.createOscillator();
    osc.type = 'triangle';
    const startFreq = (170 + (i % 2) * 35) * pitchVar();
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(g).connect(target);
    osc.start(t);
    osc.stop(t + 0.08);
  });
}

/** Crisp foliage snip + soft leaf rustle when clearing overgrown weeds */
export function playWeedCut(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  // Snappy shears/clip snip
  puff(c, target, t, 0.18, 0.055, 2200, 7200, 2800);
  // Crisp metallic blade click
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1600 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.04);
  const g = c.createGain();
  g.gain.setValueAtTime(0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  osc.connect(g).connect(target);
  osc.start(t);
  osc.stop(t + 0.05);

  // Soft falling leaf rustle
  puff(c, target, t + 0.08, 0.11, 0.24, 900, 4200, 1400);
  puff(c, target, t + 0.20, 0.07, 0.22, 800, 3200, 1100);
}

/** Soft fabric rustle + gentle evening hush when resting under the shed */
export function playSleep(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  // Fabric bedroll rustle
  puff(c, target, t, 0.13, 0.36, 260, 1600, 620);
  // Gentle evening sigh/chime
  tone(c, target, t + 0.18, { freq: 293.66, vol: 0.05, decay: 1.1, attack: 0.08 });
  tone(c, target, t + 0.34, { freq: 220.0, vol: 0.045, decay: 1.3, attack: 0.1 });
}

/** Soft mallet taps on timber + a little sawdust brush while building in-scene */
export function playBuild(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const base = now();
  const target = getSfxTarget();

  [0, 0.22, 0.44, 0.74].forEach((off, i) => {
    const t = base + off;
    tone(c, target, t, {
      freq: (i === 3 ? 150 : 205) * pitchVar(),
      glideTo: 90,
      glideTime: 0.07,
      vol: 0.12,
      decay: 0.09,
      type: 'triangle',
      attack: 0.002,
    });
    puff(c, target, t + 0.01, 0.05, 0.12, 600, 2600, 900);
  });
}

/** Gentle water-drop plinks into the new rain barrel */
export function playWaterChime(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  [[880, 0], [1175, 0.16], [988, 0.34]].forEach(([freq, off]) => {
    const pv = pitchVar();
    tone(c, target, t + off, {
      freq: freq * pv,
      glideTo: freq * 1.45 * pv,
      glideTime: 0.05,
      vol: 0.07,
      decay: 0.35,
      attack: 0.003,
    });
  });
  puff(c, target, t + 0.05, 0.05, 0.3, 900, 3400, 1200);
}

/* ═══════════════════════════════════════════
   Terrace Lift Arrival Foley
   ═══════════════════════════════════════════ */

interface LiftHumInstance {
  bus: GainNode;
  nodes: AudioNode[];
}

let liftHum: LiftHumInstance | null = null;

/** Warm, low mechanical elevator hum (~82–110 Hz) that fades in softly */
export function startLiftHum(): void {
  if (liftHum || muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(getSfxTarget());

  const swell = c.createGain();
  swell.gain.value = 1;
  swell.connect(bus);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 320;
  lp.connect(swell);
  const nodes: AudioNode[] = [lp, swell];

  for (const [freq, type, vol] of [
    [82, 'sine', 0.07],
    [110.4, 'triangle', 0.035],
    [164.5, 'sine', 0.012],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    osc.connect(g).connect(lp);
    osc.start(t);
    nodes.push(osc, g);
  }

  // Faint motor rumble under the tone
  const rumble = c.createBufferSource();
  rumble.buffer = getNoise('brown');
  rumble.loop = true;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0.04;
  rumble.connect(rumbleGain).connect(lp);
  rumble.start(t, rand(0, 2));
  nodes.push(rumble, rumbleGain);

  // Slow gentle swell so the hum breathes (kept off the bus so fade-out is clean)
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.7;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.18;
  lfo.connect(lfoDepth).connect(swell.gain);
  lfo.start(t);
  nodes.push(lfo, lfoDepth);

  rampGain(bus.gain, 0.85, 0.4);
  liftHum = { bus, nodes };
}

export function stopLiftHum(): void {
  const inst = liftHum;
  if (!inst) return;
  liftHum = null;
  if (ctx) rampGain(inst.bus.gain, 0, 0.3);
  setTimeout(() => {
    for (const n of inst.nodes) {
      try {
        if (n instanceof AudioScheduledSourceNode) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    try {
      inst.bus.disconnect();
    } catch {
      /* already disconnected */
    }
  }, 420);
}

/** Soft metallic door slide (~450ms) ending in a gentle clunk */
export function playLiftDoorSlide(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  const t = now();
  const target = getSfxTarget();

  // Rolling track rumble + airy metal sheen
  puff(c, target, t, 0.09, 0.42, 160, 900, 420);
  puff(c, target, t + 0.03, 0.035, 0.38, 1800, 5200, 2600);
  // Clunk as the panels settle
  tone(c, target, t + 0.4, { freq: 96 * pitchVar(), glideTo: 52, glideTime: 0.08, vol: 0.12, decay: 0.12, type: 'triangle', attack: 0.002 });
  tone(c, target, t + 0.41, { freq: 1420 * pitchVar(), vol: 0.018, decay: 0.09, attack: 0.002 });
}

/** Tiny relay click as the floor indicator ticks up */
export function playLiftFloorTick(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  relayTick(c, getSfxTarget(), now() + 0.005, 0.045);
}

/** Warm vintage brass "ding!" on arriving at the roof */
export function playLiftDing(): void {
  if (muted || !unlocked || sfxVolume <= 0) return;
  const c = getCtx();
  bell(c, getSfxTarget(), now() + 0.01, 880, 0.12, 2.2, [
    [1, 1],
    [2.01, 0.32],
    [3.02, 0.12],
    [4.18, 0.05],
  ]);
}

