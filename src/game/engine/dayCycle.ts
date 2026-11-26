import type { DayPhase, TimeOfDay } from '../types/game.ts';

/* ───── 3-Phase Real-Time Day Cycle (12 minutes total = 4 min per phase) ───── */

/** Duration of each phase in real-time seconds (4 minutes) */
export const PHASE_DURATION_SEC = 240;

export const DAY_PHASE_ORDER: readonly DayPhase[] = ['day', 'dusk', 'night'];

export const MAX_VITALITY = 100;

/** Gentle stamina & strength rules (zero-stress, non-lethal) */
export const WEED_STAMINA_COST = 6;
export const BOX_STAMINA_COST = 10;
export const BUILD_STAMINA_COST = 12;
export const REST_STAMINA_GAIN = 25;
export const PHASE_STRENGTH_DECAY = 8;
export const SLEEP_STRENGTH_DECAY = 10;

export function clampVitality(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_VITALITY, Math.round(value)));
}

export function clampPhaseElapsed(sec: number): number {
  if (!Number.isFinite(sec)) return 0;
  return Math.max(0, Math.min(PHASE_DURATION_SEC, sec));
}

export function timeOfDayToDayPhase(t?: TimeOfDay): DayPhase {
  if (t === 'dusk') return 'dusk';
  if (t === 'night') return 'night';
  return 'day';
}

export function dayPhaseToTimeOfDay(p: DayPhase): TimeOfDay {
  if (p === 'dusk') return 'dusk';
  if (p === 'night') return 'night';
  return 'morning';
}

/** Next phase within the same day, or `null` once night is reached */
export function nextDayPhase(p: DayPhase): DayPhase | null {
  const idx = DAY_PHASE_ORDER.indexOf(p);
  return idx >= 0 && idx < DAY_PHASE_ORDER.length - 1 ? DAY_PHASE_ORDER[idx + 1] : null;
}

export interface PhaseTickResult {
  dayPhase: DayPhase;
  phaseElapsedSec: number;
  strength: number;
  phaseChanged: boolean;
}

/**
 * Pure real-time clock step.
 * - `'day'` → after 240s becomes `'dusk'` (-8 strength)
 * - `'dusk'` → after 240s becomes `'night'` (-8 strength)
 * - `'night'` → clamps gently at 240s and holds in quiet night until sleep
 */
export function advancePhaseClock(
  dayPhase: DayPhase,
  phaseElapsedSec: number,
  deltaSec: number,
  strength: number,
  strengthDecay: number = PHASE_STRENGTH_DECAY,
): PhaseTickResult {
  const step = Math.max(0, Number.isFinite(deltaSec) ? deltaSec : 0);
  let phase: DayPhase = dayPhase;
  let elapsed = clampPhaseElapsed(phaseElapsedSec) + step;
  let nextStrength = clampVitality(strength);
  let phaseChanged = false;

  while (phase !== 'night' && elapsed >= PHASE_DURATION_SEC) {
    const next = nextDayPhase(phase);
    if (!next) break;
    elapsed -= PHASE_DURATION_SEC;
    phase = next;
    nextStrength = clampVitality(nextStrength - strengthDecay);
    phaseChanged = true;
  }

  if (phase === 'night' && elapsed > PHASE_DURATION_SEC) {
    elapsed = PHASE_DURATION_SEC;
  }

  return {
    dayPhase: phase,
    phaseElapsedSec: elapsed,
    strength: nextStrength,
    phaseChanged,
  };
}

export interface RestOutcome {
  dayPhase: DayPhase;
  phaseElapsedSec: number;
  stamina: number;
  strength: number;
}

/**
 * Rest by the shelter during `'day'` or `'dusk'`:
 * restores +25 stamina and advances to the next phase (-8 strength).
 */
export function applyRest(
  dayPhase: DayPhase,
  stamina: number,
  strength: number,
  strengthDecay: number = PHASE_STRENGTH_DECAY,
): RestOutcome | null {
  const next = nextDayPhase(dayPhase);
  if (!next) return null;
  return {
    dayPhase: next,
    phaseElapsedSec: 0,
    stamina: clampVitality(stamina + REST_STAMINA_GAIN),
    strength: clampVitality(strength - strengthDecay),
  };
}

export interface SleepOutcome {
  day: number;
  dayPhase: DayPhase;
  phaseElapsedSec: number;
  stamina: number;
  strength: number;
}

/** How well the shelter lets you sleep (see `sleepComfort` in stations.ts) */
export interface SleepComfort {
  /** Stamina you wake up with at least (0–100) */
  staminaTarget: number;
  /** Strength eased overnight */
  strengthLoss: number;
}

/**
 * Sleep through the night into Day N+1 · Day. By default stamina refills to
 * 100 and strength eases by 10; a humbler shelter refills less, and sleeping
 * never lowers stamina you already have.
 */
export function applySleep(
  day: number,
  strength: number,
  comfort: SleepComfort = { staminaTarget: MAX_VITALITY, strengthLoss: SLEEP_STRENGTH_DECAY },
  stamina = 0,
): SleepOutcome {
  return {
    day: Math.max(1, Math.floor(day)) + 1,
    dayPhase: 'day',
    phaseElapsedSec: 0,
    stamina: clampVitality(Math.max(stamina, comfort.staminaTarget)),
    strength: clampVitality(strength - comfort.strengthLoss),
  };
}
