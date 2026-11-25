import { describe, expect, it } from 'vitest';
import {
  advancePhaseClock,
  applyRest,
  applySleep,
  BOX_STAMINA_COST,
  BUILD_STAMINA_COST,
  clampVitality,
  dayPhaseToTimeOfDay,
  MAX_VITALITY,
  nextDayPhase,
  PHASE_DURATION_SEC,
  PHASE_STRENGTH_DECAY,
  REST_STAMINA_GAIN,
  SLEEP_STRENGTH_DECAY,
  timeOfDayToDayPhase,
  WEED_STAMINA_COST,
} from '../dayCycle.ts';

describe('3-phase day cycle (12-min day = 240s per phase)', () => {
  it('defines 240s per phase and clean next-phase progression', () => {
    expect(PHASE_DURATION_SEC).toBe(240);
    expect(nextDayPhase('day')).toBe('dusk');
    expect(nextDayPhase('dusk')).toBe('night');
    expect(nextDayPhase('night')).toBeNull();
  });

  it('maps legacy TimeOfDay values to 3-phase DayPhase and back cleanly', () => {
    expect(timeOfDayToDayPhase('morning')).toBe('day');
    expect(timeOfDayToDayPhase('afternoon')).toBe('day');
    expect(timeOfDayToDayPhase('dusk')).toBe('dusk');
    expect(timeOfDayToDayPhase('night')).toBe('night');
    expect(timeOfDayToDayPhase(undefined)).toBe('day');

    expect(dayPhaseToTimeOfDay('day')).toBe('morning');
    expect(dayPhaseToTimeOfDay('dusk')).toBe('dusk');
    expect(dayPhaseToTimeOfDay('night')).toBe('night');
  });

  it('transitions day -> dusk -> night every 240s and gently decays strength', () => {
    const midDay = advancePhaseClock('day', 120, 60, 100);
    expect(midDay).toEqual({
      dayPhase: 'day',
      phaseElapsedSec: 180,
      strength: 100,
      phaseChanged: false,
    });

    const toDusk = advancePhaseClock('day', 239, 1, 100);
    expect(toDusk).toEqual({
      dayPhase: 'dusk',
      phaseElapsedSec: 0,
      strength: 100 - PHASE_STRENGTH_DECAY,
      phaseChanged: true,
    });

    const toNight = advancePhaseClock('dusk', 235, 10, 92);
    expect(toNight).toEqual({
      dayPhase: 'night',
      phaseElapsedSec: 5,
      strength: 92 - PHASE_STRENGTH_DECAY,
      phaseChanged: true,
    });
  });

  it('holds gently at quiet night once 240s elapse without further strength drain', () => {
    const hold = advancePhaseClock('night', 230, 60, 74);
    expect(hold).toEqual({
      dayPhase: 'night',
      phaseElapsedSec: 240,
      strength: 74,
      phaseChanged: false,
    });
  });
});

describe('Stamina & Strength rest / sleep rules', () => {
  it('uses gentle non-lethal stamina costs and clamps vitality 0-100', () => {
    expect(WEED_STAMINA_COST).toBe(6);
    expect(BOX_STAMINA_COST).toBe(10);
    expect(BUILD_STAMINA_COST).toBe(12);
    expect(clampVitality(-15)).toBe(0);
    expect(clampVitality(140)).toBe(MAX_VITALITY);
  });

  it('restAtShelter works during day/dusk (+25 stamina, -8 strength, advances phase)', () => {
    expect(applyRest('day', 60, 100)).toEqual({
      dayPhase: 'dusk',
      phaseElapsedSec: 0,
      stamina: Math.min(100, 60 + REST_STAMINA_GAIN),
      strength: 100 - PHASE_STRENGTH_DECAY,
    });
    expect(applyRest('dusk', 90, 5)).toEqual({
      dayPhase: 'night',
      phaseElapsedSec: 0,
      stamina: 100,
      strength: 0,
    });
    expect(applyRest('night', 50, 80)).toBeNull();
  });

  it('sleepAtShelter advances day + 1, resets to Day phase, refills stamina, and reduces strength by 10', () => {
    expect(applySleep(1, 84)).toEqual({
      day: 2,
      dayPhase: 'day',
      phaseElapsedSec: 0,
      stamina: 100,
      strength: 84 - SLEEP_STRENGTH_DECAY,
    });
    expect(applySleep(4, 4)).toEqual({
      day: 5,
      dayPhase: 'day',
      phaseElapsedSec: 0,
      stamina: 100,
      strength: 0,
    });
  });
});
