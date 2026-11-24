/**
 * soundEngine.ts — Cozy, zero-dependency Web Audio sound system for One Warm Spot.
 *
 * Features:
 *   • Procedurally synthesized UI sounds (hover, click, claim, locked) — 0 KB
 *   • Per-shelter procedural hover ambience with smooth crossfade
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

/* Currently playing ambience nodes — cleaned up on crossfade */
let currentAmbienceNodes: AudioNode[] = [];
let currentAmbienceSiteId: SiteId | null = null;

/* Music state */
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
    musicGain.gain.value = 0.35; // music is quieter than SFX
    musicGain.connect(masterGain);

    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0;
    ambienceGain.connect(masterGain);
  }
  return ctx;
}

/** Call once on first user pointer/key event to unlock AudioContext */
export function unlock(): void {
  if (unlocked) return;
  const c = getCtx();
  if (c.state === 'suspended') {
    void c.resume();
  }
  unlocked = true;
}

export function isUnlocked(): boolean {
  return unlocked;
}

/* ═══════════════════════════════════════════
   Mute / Volume
   ═══════════════════════════════════════════ */

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): void {
  muted = !muted;
  localStorage.setItem('ows_muted', String(muted));
  if (!masterGain || !ctx) return;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setTargetAtTime(
    muted ? 0 : masterVolume,
    ctx.currentTime,
    0.15, // ~400ms effective ramp
  );
}

export function setVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  if (!masterGain || !ctx || muted) return;
  masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.15);
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

/** Random pitch variation factor: ±3% */
function pitchVar(): number {
  return 1 + (Math.random() - 0.5) * 0.06;
}

function now(): number {
  return getCtx().currentTime;
}

/* ═══════════════════════════════════════════
   Synthesized UI Sounds (0 KB)
   ═══════════════════════════════════════════ */

/** Ultra-soft filtered noise brush (~60ms) */
export function playHover(): void {
  if (muted || !unlocked) return;
  const c = getCtx();
  const t = now();

  // Short burst of filtered noise
  const bufLen = Math.floor(c.sampleRate * 0.06);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.12;
  }

  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitchVar();

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 1.5;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.08, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

  src.connect(filter).connect(gain).connect(masterGain!);
  src.start(t);
  src.stop(t + 0.07);
}

/** Warm hollow wood "tok" (~90ms) */
export function playClick(): void {
  if (muted || !unlocked) return;
  const c = getCtx();
  const t = now();

  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;

  osc.connect(filter).connect(gain).connect(masterGain!);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Gentle two-note warm chime (soft fifth interval) */
export function playClaim(): void {
  if (muted || !unlocked) return;
  const c = getCtx();
  const t = now();
  const pv = pitchVar();

  [392 * pv, 587 * pv].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = c.createGain();
    const start = t + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

    osc.connect(gain).connect(masterGain!);
    osc.start(start);
    osc.stop(start + 0.65);
  });
}

/** Soft low muted wood thud */
export function playLocked(): void {
  if (muted || !unlocked) return;
  const c = getCtx();
  const t = now();

  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140 * pitchVar(), t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;

  osc.connect(filter).connect(gain).connect(masterGain!);
  osc.start(t);
  osc.stop(t + 0.15);
}

/* ═══════════════════════════════════════════
   Menu Music Bed
   ═══════════════════════════════════════════ */

/** Start continuous menu music — tries file, falls back to procedural pad */
export function startMenuMusic(): void {
  if (musicPlaying) return;
  musicPlaying = true;

  const c = getCtx();
  if (!musicGain) return;

  // Try loading the mp3 file
  const audio = new Audio('/source/audio/music-menu.mp3');
  audio.loop = true;
  audio.volume = 1; // volume controlled via gain node
  audio.crossOrigin = 'anonymous';

  audio.addEventListener('canplaythrough', () => {
    if (!musicPlaying || !ctx || !musicGain) return;
    try {
      if (!musicSourceNode) {
        musicSourceNode = c.createMediaElementSource(audio);
        musicSourceNode.connect(musicGain);
      }
      musicElement = audio;
      void audio.play();
      // Fade in
      musicGain.gain.setTargetAtTime(0.35, c.currentTime, 0.3);
    } catch {
      // Fallback if connection fails
      startProceduralMusic();
    }
  }, { once: true });

  audio.addEventListener('error', () => {
    // File not found — start procedural fallback
    startProceduralMusic();
  }, { once: true });

  // Trigger load
  audio.load();
}

/** Super-soft warm procedural felt-pad chord loop */
function startProceduralMusic(): void {
  if (!ctx || !musicGain) return;

  // Play a gentle chord every ~4 seconds
  function playPadChord() {
    if (!ctx || !musicGain || !musicPlaying) return;
    const t = ctx.currentTime;

    // Warm major 7th chord: C3, E3, G3, B3
    const freqs = [130.8, 164.8, 196.0, 246.9];
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.008); // very subtle detune

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 1.2); // slow attack
      gain.gain.setValueAtTime(0.04, t + 2.0);
      gain.gain.linearRampToValueAtTime(0, t + 3.8); // slow release

      osc.connect(gain).connect(musicGain!);
      osc.start(t);
      osc.stop(t + 4.0);
    }
  }

  playPadChord();
  proceduralMusicInterval = setInterval(playPadChord, 4000);
  musicGain.gain.setTargetAtTime(0.35, ctx.currentTime, 0.3);
}

/** Fade menu music out (when entering shelter) */
export function fadeOutMenuMusic(): void {
  if (!musicGain || !ctx) return;
  musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  setTimeout(() => {
    musicPlaying = false;
    if (musicElement) {
      musicElement.pause();
    }
    if (proceduralMusicInterval !== null) {
      clearInterval(proceduralMusicInterval);
      proceduralMusicInterval = null;
    }
  }, 1200);
}

/** Fade menu music back in (when returning to title/site-select) */
export function fadeInMenuMusic(): void {
  if (musicPlaying) return;
  startMenuMusic();
}

/* ═══════════════════════════════════════════
   Per-Shelter Hover Ambience (Procedural)
   ═══════════════════════════════════════════ */

/** Stop current ambience nodes with a smooth fade-out */
function stopCurrentAmbience(): void {
  if (!ctx || !ambienceGain) return;
  const t = ctx.currentTime;
  ambienceGain.gain.setTargetAtTime(0, t, 0.12); // ~350ms fade
  // Schedule cleanup
  const nodesToClean = [...currentAmbienceNodes];
  currentAmbienceNodes = [];
  currentAmbienceSiteId = null;
  setTimeout(() => {
    for (const n of nodesToClean) {
      try {
        if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) {
          n.stop();
        }
        n.disconnect();
      } catch { /* already stopped */ }
    }
  }, 500);
}

/** Create filtered noise buffer for wind/air textures */
function createNoiseBuffer(seconds: number): AudioBuffer {
  const c = getCtx();
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/**
 * Start or crossfade to a shelter's procedural ambience.
 * Pass `null` to fade out all ambience.
 */
export function startSiteAmbience(siteId: SiteId | null, dimmed = false): void {
  if (muted || !unlocked) return;
  if (siteId === currentAmbienceSiteId) return;

  stopCurrentAmbience();
  if (!siteId) return;

  const c = getCtx();
  if (!ambienceGain) return;
  const t = c.currentTime;
  const nodes: AudioNode[] = [];
  const baseGain = dimmed ? 0.06 : 0.12; // locked sites are quieter

  currentAmbienceSiteId = siteId;

  switch (siteId) {
    case 'terrace': {
      // Open rooftop breeze: band-passed wind + occasional chirp
      const noiseBuf = createNoiseBuffer(3);
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 800;
      bp.Q.value = 0.5;

      const lfo = c.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.3;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain).connect(bp.frequency);
      lfo.start(t);

      const g = c.createGain();
      g.gain.value = baseGain;

      noiseSrc.connect(bp).connect(g).connect(ambienceGain);
      noiseSrc.start(t);
      nodes.push(noiseSrc, bp, lfo, lfoGain, g);
      break;
    }

    case 'pipe': {
      // Hollow resonant breeze through concrete
      const noiseBuf = createNoiseBuffer(3);
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 320;
      bp.Q.value = 3; // resonant

      const g = c.createGain();
      g.gain.value = baseGain * 0.9;

      noiseSrc.connect(bp).connect(g).connect(ambienceGain);
      noiseSrc.start(t);
      nodes.push(noiseSrc, bp, g);
      break;
    }

    case 'tree': {
      // Rustling canopy: high-shelved flutter
      const noiseBuf = createNoiseBuffer(3);
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

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
      const lfoGain = c.createGain();
      lfoGain.gain.value = 1500;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start(t);

      const g = c.createGain();
      g.gain.value = baseGain * 0.8;

      noiseSrc.connect(hs).connect(lp).connect(g).connect(ambienceGain);
      noiseSrc.start(t);
      nodes.push(noiseSrc, hs, lp, lfo, lfoGain, g);
      break;
    }

    case 'cave': {
      // Subterranean hush + occasional water-drop resonance
      const noiseBuf = createNoiseBuffer(3);
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;

      const g = c.createGain();
      g.gain.value = baseGain * 0.7;

      noiseSrc.connect(lp).connect(g).connect(ambienceGain);
      noiseSrc.start(t);
      nodes.push(noiseSrc, lp, g);

      // Water drop every ~2s
      const dropInterval = setInterval(() => {
        if (!ctx || currentAmbienceSiteId !== 'cave') {
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

        osc.connect(dg).connect(ambienceGain!);
        osc.start(dt);
        osc.stop(dt + 0.16);
      }, 1800 + Math.random() * 1200);
      break;
    }

    case 'bunker': {
      // Muted breeze over steel + low room tone
      const noiseBuf = createNoiseBuffer(3);
      const noiseSrc = c.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;

      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 200;
      bp.Q.value = 1.5;

      const g = c.createGain();
      g.gain.value = baseGain * 0.6;

      noiseSrc.connect(bp).connect(g).connect(ambienceGain);
      noiseSrc.start(t);

      // Low room tone hum
      const hum = c.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 55;
      const humGain = c.createGain();
      humGain.gain.value = dimmed ? 0.015 : 0.03;
      hum.connect(humGain).connect(ambienceGain);
      hum.start(t);

      nodes.push(noiseSrc, bp, g, hum, humGain);
      break;
    }
  }

  currentAmbienceNodes = nodes;

  // Fade ambience in
  ambienceGain.gain.setTargetAtTime(1, t, 0.12); // ~350ms
}
