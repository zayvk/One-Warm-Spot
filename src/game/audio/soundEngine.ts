/**
 * soundEngine.ts — Cozy, zero-dependency Web Audio sound system for One Warm Spot.
 *
 * Features:
 *   • Procedurally synthesized UI sounds (hover, click, claim, locked, footstep) — 0 KB
 *   • Per-shelter procedural hover ambience with smooth crossfade (9 sites)
 *   • Shared menu music bed from file, with procedural warm-pad fallback
 *   • Master mute persisted in localStorage
 *   • AudioContext auto-unlocked on first user interaction
 */

import type { SiteId } from '../types/game.ts';

/* ═══════════════════════════════════════════
   Singleton State
   ═══════════════════════════════════════════ */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let ambienceGain: GainNode | null = null;
let unlocked = false;
let muted = localStorage.getItem('ows_muted') === 'true';
let masterVolume = 0.6;

let currentAmbienceNodes: AudioNode[] = [];
let currentAmbienceSiteId: SiteId | null = null;

let musicElement: HTMLAudioElement | null = null;
let musicSourceNode: MediaElementAudioSourceNode | null = null;
let proceduralMusicInterval: ReturnType<typeof setInterval> | null = null;
let musicPlaying = false;

/* ═══════════════════════════════════════════
   Init & Unlock
   ═══════════════════════════════════════════ */

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : masterVolume;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);

    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0;
    ambienceGain.connect(masterGain);
  }
  return ctx;
}

export function unlock(): void {
  if (unlocked) return;
  const c = getCtx();
  if (c.state === 'suspended') void c.resume();
  unlocked = true;
}

export function isUnlocked(): boolean {
  return unlocked;
}

/* ═══════════════════════════════════════════
   Mute / Volume
   ═══════════════════════════════════════════ */

export function isMuted(): boolean { return muted; }

export function toggleMute(): void {
  muted = !muted;
  localStorage.setItem('ows_muted', String(muted));
  if (!masterGain || !ctx) return;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setTargetAtTime(muted ? 0 : masterVolume, ctx.currentTime, 0.15);
}

export function setVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  if (!masterGain || !ctx || muted) return;
  masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.15);
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function pitchVar(): number { return 1 + (Math.random() - 0.5) * 0.06; }
function now(): number { return getCtx().currentTime; }

/* ═══════════════════════════════════════════
   Synthesized UI Sounds (0 KB)
   ═══════════════════════════════════════════ */

export function playHover(): void {
  if (muted || !unlocked) return;
  const c = getCtx(); const t = now();
  const bufLen = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
  const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = pitchVar();
  const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = 1.5;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.08, t + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(filter).connect(gain).connect(masterGain!); src.start(t); src.stop(t + 0.07);
}

export function playClick(): void {
  if (muted || !unlocked) return;
  const c = getCtx(); const t = now();
  const osc = c.createOscillator(); osc.type = 'triangle';
  osc.frequency.setValueAtTime(420 * pitchVar(), t); osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
  const gain = c.createGain(); gain.gain.setValueAtTime(0.18, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
  osc.connect(filter).connect(gain).connect(masterGain!); osc.start(t); osc.stop(t + 0.1);
}

export function playClaim(): void {
  if (muted || !unlocked) return;
  const c = getCtx(); const t = now(); const pv = pitchVar();
  [392 * pv, 587 * pv].forEach((freq, i) => {
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const gain = c.createGain(); const start = t + i * 0.12;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.14, start + 0.04); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
    osc.connect(gain).connect(masterGain!); osc.start(start); osc.stop(start + 0.65);
  });
}

export function playLocked(): void {
  if (muted || !unlocked) return;
  const c = getCtx(); const t = now();
  const osc = c.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(140 * pitchVar(), t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
  const gain = c.createGain(); gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 600;
  osc.connect(filter).connect(gain).connect(masterGain!); osc.start(t); osc.stop(t + 0.15);
}

/** Soft earthy footstep for the arrival cutscene */
export function playFootstep(): void {
  if (muted || !unlocked) return;
  const c = getCtx(); const t = now();
  // Noise crunch
  const bufLen = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.2;
  const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = 0.7 + Math.random() * 0.3;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600 + Math.random() * 400; bp.Q.value = 1;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.12, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  // Low thud
  const osc = c.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(90 * pitchVar(), t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  const og = c.createGain(); og.gain.setValueAtTime(0.1, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  src.connect(bp).connect(gain).connect(masterGain!); src.start(t); src.stop(t + 0.12);
  osc.connect(og).connect(masterGain!); osc.start(t); osc.stop(t + 0.12);
}

/* ═══════════════════════════════════════════
   Menu Music Bed
   ═══════════════════════════════════════════ */

export function startMenuMusic(): void {
  if (musicPlaying) return;
  musicPlaying = true;
  const c = getCtx();
  if (!musicGain) return;
  const audio = new Audio('/source/audio/music-menu.mp3');
  audio.loop = true; audio.volume = 1; audio.crossOrigin = 'anonymous';
  audio.addEventListener('canplaythrough', () => {
    if (!musicPlaying || !ctx || !musicGain) return;
    try {
      if (!musicSourceNode) { musicSourceNode = c.createMediaElementSource(audio); musicSourceNode.connect(musicGain); }
      musicElement = audio; void audio.play();
      musicGain.gain.setTargetAtTime(0.35, c.currentTime, 0.3);
    } catch { startProceduralMusic(); }
  }, { once: true });
  audio.addEventListener('error', () => { startProceduralMusic(); }, { once: true });
  audio.load();
}

function startProceduralMusic(): void {
  if (!ctx || !musicGain) return;
  function playPadChord() {
    if (!ctx || !musicGain || !musicPlaying) return;
    const t = ctx.currentTime;
    const freqs = [130.8, 164.8, 196.0, 246.9];
    for (const freq of freqs) {
      const osc = ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.008);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.04, t + 1.2);
      gain.gain.setValueAtTime(0.04, t + 2.0); gain.gain.linearRampToValueAtTime(0, t + 3.8);
      osc.connect(gain).connect(musicGain!); osc.start(t); osc.stop(t + 4.0);
    }
  }
  playPadChord();
  proceduralMusicInterval = setInterval(playPadChord, 4000);
  musicGain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.3);
}

export function fadeOutMenuMusic(): void {
  if (!musicGain || !ctx) return;
  musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  setTimeout(() => {
    musicPlaying = false;
    if (musicElement) musicElement.pause();
    if (proceduralMusicInterval !== null) { clearInterval(proceduralMusicInterval); proceduralMusicInterval = null; }
  }, 1200);
}

export function fadeInMenuMusic(): void {
  if (musicPlaying) return;
  startMenuMusic();
}

/* ═══════════════════════════════════════════
   Per-Shelter Hover Ambience (Procedural)
   ═══════════════════════════════════════════ */

function stopCurrentAmbience(): void {
  if (!ctx || !ambienceGain) return;
  ambienceGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
  const nodesToClean = [...currentAmbienceNodes];
  currentAmbienceNodes = [];
  currentAmbienceSiteId = null;
  setTimeout(() => {
    for (const n of nodesToClean) {
      try {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) n.stop();
        n.disconnect();
      } catch { /* already stopped */ }
    }
  }, 500);
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
  c: AudioContext, target: GainNode,
  filterType: BiquadFilterType, freq: number, q: number, vol: number,
): AudioNode[] {
  const noiseBuf = createNoiseBuffer(3);
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = filterType; bp.frequency.value = freq; bp.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(bp).connect(g).connect(target);
  src.start(c.currentTime);
  return [src, bp, g];
}

export function startSiteAmbience(siteId: SiteId | null, dimmed = false): void {
  if (muted || !unlocked) return;
  if (siteId === currentAmbienceSiteId) return;
  stopCurrentAmbience();
  if (!siteId) return;

  const c = getCtx();
  if (!ambienceGain) return;
  const t = c.currentTime;
  const nodes: AudioNode[] = [];
  const bg = dimmed ? 0.06 : 0.12;
  currentAmbienceSiteId = siteId;

  switch (siteId) {
    case 'terrace': {
      const wind = makeWindLayer(c, ambienceGain, 'bandpass', 800, 0.5, bg);
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.3;
      const lg = c.createGain(); lg.gain.value = 200;
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
      const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const hs = c.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 3000; hs.gain.value = 6;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.2;
      const lg = c.createGain(); lg.gain.value = 1500;
      lfo.connect(lg).connect(lp.frequency); lfo.start(t);
      const g = c.createGain(); g.gain.value = bg * 0.8;
      src.connect(hs).connect(lp).connect(g).connect(ambienceGain);
      src.start(t);
      nodes.push(src, hs, lp, lfo, lg, g);
      break;
    }
    case 'cave': {
      nodes.push(...makeWindLayer(c, ambienceGain, 'lowpass', 400, 1, bg * 0.7));
      const dropInterval = setInterval(() => {
        if (!ctx || currentAmbienceSiteId !== 'cave') { clearInterval(dropInterval); return; }
        const dt = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'sine';
        osc.frequency.setValueAtTime(2200 + Math.random() * 600, dt);
        osc.frequency.exponentialRampToValueAtTime(800, dt + 0.08);
        const dg = ctx.createGain();
        dg.gain.setValueAtTime(dimmed ? 0.03 : 0.06, dt); dg.gain.exponentialRampToValueAtTime(0.001, dt + 0.15);
        osc.connect(dg).connect(ambienceGain!); osc.start(dt); osc.stop(dt + 0.16);
      }, 1800 + Math.random() * 1200);
      break;
    }
    case 'bunker': {
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 200, 1.5, bg * 0.6));
      const hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 55;
      const hg = c.createGain(); hg.gain.value = dimmed ? 0.015 : 0.03;
      hum.connect(hg).connect(ambienceGain); hum.start(t);
      nodes.push(hum, hg);
      break;
    }
    case 'beachhouse': {
      // Soft coastal surf: low-passed noise + gentle wash LFO
      const surf = makeWindLayer(c, ambienceGain, 'lowpass', 600, 0.8, bg);
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.15;
      const lg = c.createGain(); lg.gain.value = 250;
      lfo.connect(lg).connect((surf[1] as BiquadFilterNode).frequency);
      lfo.start(t);
      nodes.push(...surf, lfo, lg);
      break;
    }
    case 'countryhouse': {
      // Warm meadow wind: gentle mid-band breeze
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 650, 0.6, bg * 0.9));
      break;
    }
    case 'farmhouse': {
      // Gentle breeze + subtle barn creak
      nodes.push(...makeWindLayer(c, ambienceGain, 'bandpass', 500, 0.5, bg * 0.8));
      const creakInterval = setInterval(() => {
        if (!ctx || currentAmbienceSiteId !== 'farmhouse') { clearInterval(creakInterval); return; }
        const dt = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 + Math.random() * 80, dt);
        osc.frequency.linearRampToValueAtTime(180, dt + 0.2);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0, dt); cg.gain.linearRampToValueAtTime(dimmed ? 0.02 : 0.04, dt + 0.05);
        cg.gain.exponentialRampToValueAtTime(0.001, dt + 0.25);
        osc.connect(cg).connect(ambienceGain!); osc.start(dt); osc.stop(dt + 0.3);
      }, 2500 + Math.random() * 2000);
      break;
    }
    case 'island': {
      // Lapping water + pine wind
      const water = makeWindLayer(c, ambienceGain, 'lowpass', 500, 0.7, bg * 0.8);
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.25;
      const lg = c.createGain(); lg.gain.value = 180;
      lfo.connect(lg).connect((water[1] as BiquadFilterNode).frequency);
      lfo.start(t);
      // Pine rustle
      const pine = makeWindLayer(c, ambienceGain, 'highshelf', 2500, 1, bg * 0.4);
      nodes.push(...water, lfo, lg, ...pine);
      break;
    }
  }

  currentAmbienceNodes = nodes;
  ambienceGain.gain.setTargetAtTime(1, t, 0.12);
}
