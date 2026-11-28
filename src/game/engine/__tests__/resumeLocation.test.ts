import { describe, expect, it } from 'vitest';
import { locationForScreen, parseResumeLocation, resolveScreen } from '../resumeLocation.ts';

const stored = (v: unknown) => JSON.stringify(v);

describe('resume location after a refresh', () => {
  it('maps each screen to where a refresh should land (cutscenes are not replayed)', () => {
    expect(locationForScreen('title', 1, 'R')).toEqual({ screen: 'title' });
    expect(locationForScreen('site-select', 1, 'R')).toEqual({ screen: 'site-select' });
    expect(locationForScreen('arrival', 1, 'R')).toEqual({ screen: 'shelter' });
    expect(locationForScreen('shelter', 3, 2)).toEqual({ screen: 'shelter' });
    expect(locationForScreen('floor', 3, 'R')).toEqual({ screen: 'floor', floor: 3 });
    expect(locationForScreen('ride', 2, 4)).toEqual({ screen: 'floor', floor: 4 });
    expect(locationForScreen('ride', 4, 'R')).toEqual({ screen: 'shelter' });
  });

  it('round-trips every place on a Terrace run', () => {
    for (const loc of [
      { screen: 'title' },
      { screen: 'site-select' },
      { screen: 'shelter' },
      { screen: 'floor', floor: 1 },
      { screen: 'floor', floor: 4 },
    ]) {
      expect(parseResumeLocation(stored(loc), 'terrace')).toEqual(loc);
    }
  });

  it('falls back to the Title without a claimed shelter, or for floors off the Terrace', () => {
    expect(parseResumeLocation(stored({ screen: 'shelter' }), null)).toEqual({ screen: 'title' });
    expect(parseResumeLocation(stored({ screen: 'floor', floor: 2 }), null)).toEqual({ screen: 'title' });
    expect(parseResumeLocation(stored({ screen: 'floor', floor: 2 }), 'pipe')).toEqual({ screen: 'title' });
    expect(parseResumeLocation(stored({ screen: 'shelter' }), 'pipe')).toEqual({ screen: 'shelter' });
    /* The shelter selector never needs a run */
    expect(parseResumeLocation(stored({ screen: 'site-select' }), null)).toEqual({ screen: 'site-select' });
  });

  it('ignores missing or damaged data', () => {
    for (const raw of [null, '', '{', 'null', '42', stored({}), stored({ screen: 'ride' }), stored({ screen: 'floor', floor: 5 }), stored({ screen: 'floor', floor: 'R' })]) {
      expect(parseResumeLocation(raw, 'terrace')).toEqual({ screen: 'title' });
    }
  });
});

describe('screen guard (backups loaded mid-session)', () => {
  it('sends anything past site selection to the Title without a claimed shelter', () => {
    expect(resolveScreen('title', null, false)).toBe('title');
    expect(resolveScreen('site-select', null, false)).toBe('site-select');
    expect(resolveScreen('shelter', null, true)).toBe('title');
    expect(resolveScreen('room', null, true)).toBe('title');
  });

  it('leaves the building for the shelter when the loaded run is on another site', () => {
    for (const s of ['ride', 'floor', 'room'] as const) expect(resolveScreen(s, 'valley', true)).toBe('shelter');
    expect(resolveScreen('shelter', 'valley', false)).toBe('shelter');
  });

  it('steps out of a room to its floor once the room is no longer valid', () => {
    expect(resolveScreen('room', 'terrace', true)).toBe('room');
    expect(resolveScreen('room', 'terrace', false)).toBe('floor');
    expect(resolveScreen('floor', 'terrace', false)).toBe('floor');
  });
});