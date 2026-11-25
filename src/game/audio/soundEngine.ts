/**
 * soundEngine.ts — Cozy, zero-dependency Web Audio sound system for One Warm Spot.
 *
 * Features:
 *   • Procedurally synthesized UI sounds (hover, click, claim, locked, footstep) — 0 KB
 *   • Per-shelter procedural hover ambience with smooth crossfade (9 sites)
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

let currentAmbienceNodes: AudioNode[] = [];
let currentAmbienceIntervals: ReturnType<typeof setInterval>[] = [];
let currentAmbienceSiteId: SiteId | null = null;

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
  if (!masterGain || !ctx) return;
  rampGain(masterGain.gain, muted ? 0 : 1, 0.2);
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
  if (!sfxChannelGain || !ctx) return;
  rampGain(sfxChannelGain.gain, sfxVolume, 0.05);
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
   Per-Shelter Hover Ambience (Procedural)
   ═══════════════════════════════════════════ */

function stopCurrentAmbience(): void {
  for (const id of currentAmbienceIntervals) clearInterval(id);
  currentAmbienceIntervals = [];

  if (!ctx || !ambienceGain) {
    currentAmbienceNodes = [];
    currentAmbienceSiteId = null;
    return;
  }

  rampGain(ambienceGain.gain, 0, 0.18);
  const nodesToClean = [...currentAmbienceNodes];
  currentAmbienceNodes = [];
  currentAmbienceSiteId = null;

  setTimeout(() => {
    for (const n of nodesToClean) {
      try {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) n.stop();
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
  }, 260);
}

function createNoiseBuffer(seconds: number): AudioBuffer {
  const c = getCtx();
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Helper: simple looping filtered noise layer */
function makeWindLayer(
  c: AudioContext,
  target: GainNode,
  filterType: BiquadFilterType,
  freq: number,
  q: number,
  vol: number,
): AudioNode[] {
  const noiseBuf = createNoiseBuffer(3);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = filterType;
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(bp).connect(g).connect(target);
  src.start(c.currentTime);
  return [src, bp, g];
}

export function startSiteAmbience(siteId: SiteId | null, dimmed = false): void {
  if (!siteId) {
    stopCurrentAmbience();
    return;
  }
  if (muted || !unlocked || sfxVolume <= 0) return;
  if (siteId === currentAmbienceSiteId) return;

  stopCurrentAmbience();

  const c = getCtx();
  if (!ambienceGain) return;
  const t = c.currentTime;
  const nodes: AudioNode[] = [];
  const bg = dimmed ? 0.06 : 0.12;
  currentAmbienceSiteId = siteId;

  switch (siteId) {
    case 'terrace': {
      const wind = makeWindLayer(c, ambienceGain, 'bandpass', 800, 0.5, bg);
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.3;
      const lg = c.createGain();
      lg.gain.value = 200;
      lfo.connect(lg).connect((wind[1] as BiquadFilterNode).frequency);
      lfo.start(t);
      nodes.push(...wind, lfo, lg);
      break;
    }
    case 'pipe':
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 320, 3, bg * 0.9));
      break;
    case 'tree': {
      const noiseBuf = createNoiseBuffer(3);
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const hs = c.createBiquadFilter();
      hs.type = 'highshelf';
      hs.frequency.value = 3000;
      hs.gain.value = 6;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5000;
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 1.2;
      const lg = c.createGain();
      lg.gain.value = 1500;
      lfo.connect(lg).connect(lp.frequency);
      lfo.start(t);
      const g = c.createGain();
      g.gain.value = bg * 0.8;
      src.connect(hs).connect(lp).connect(g).connect(ambienceGain);
      src.start(t);
      nodes.push(src, hs, lp, lfo, lg, g);
      break;
    }
    case 'cave': {
      nodes.push(...makeWindLayer(c, ambienceGain, 'lowpass', 400, 1, bg * 0.7));
      const dropInterval = setInterval(() => {
        if (!ctx || !ambienceGain || currentAmbienceSiteId !== 'cave') {
          clearInterval(dropInterval);
          return;
        }
        const dt = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200 + Math.random() * 600, dt);
        osc.frequency.exponentialRampToValueAtTime(800, dt + 0.08);
        const dg = ctx.createGain();
        dg.gain.setValueAtTime(dimmed ? 0.03 : 0.06, dt);
        dg.gain.exponentialRampToValueAtTime(0.001, dt + 0.15);
        osc.connect(dg).connect(ambienceGain);
        osc.start(dt);
        osc.stop(dt + 0.16);
      }, 1800 + Math.random() * 1200);
      currentAmbienceIntervals.push(dropInterval);
      break;
    }
    case 'bunker': {
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 200, 1.5, bg * 0.6));
      const hum = c.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 55;
      const hg = c.createGain();
      hg.gain.value = dimmed ? 0.015 : 0.03;
      hum.connect(hg).connect(ambienceGain);
      hum.start(t);
      nodes.push(hum, hg);
      break;
    }
    case 'beachhouse': {
      const surf = makeWindLayer(c, ambienceGain, 'lowpass', 600, 0.8, bg);
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.15;
      const lg = c.createGain();
      lg.gain.value = 250;
      lfo.connect(lg).connect((surf[1] as BiquadFilterNode).frequency);
      lfo.start(t);
      nodes.push(...surf, lfo, lg);
      break;
    }
    case 'countryhouse':
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 650, 0.6, bg * 0.9));
      break;
    case 'farmhouse': {
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 500, 0.5, bg * 0.8));
      const creakInterval = setInterval(() => {
        if (!ctx || !ambienceGain || currentAmbienceSiteId !== 'farmhouse') {
          clearInterval(creakInterval);
          return;
        }
        const dt = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 + Math.random() * 80, dt);
        osc.frequency.linearRampToValueAtTime(180, dt + 0.2);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0, dt);
        cg.gain.linearRampToValueAtTime(dimmed ? 0.02 : 0.04, dt + 0.05);
        cg.gain.exponentialRampToValueAtTime(0.001, dt + 0.25);
        osc.connect(cg).connect(ambienceGain);
        osc.start(dt);
        osc.stop(dt + 0.3);
      }, 2500 + Math.random() * 2000);
      currentAmbienceIntervals.push(creakInterval);
      break;
    }
    case 'island': {
      const water = makeWindLayer(c, ambienceGain, 'lowpass', 500, 0.7, bg * 0.8);
      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.25;
      const lg = c.createGain();
      lg.gain.value = 180;
      lfo.connect(lg).connect((water[1] as BiquadFilterNode).frequency);
      lfo.start(t);
      const pine = makeWindLayer(c, ambienceGain, 'highshelf', 2500, 1, bg * 0.4);
      nodes.push(...water, lfo, lg, ...pine);
      break;
    }
  }

  currentAmbienceNodes = nodes;
  rampGain(ambienceGain.gain, 1, 0.24);
}
