import { describe, expect, it } from 'vitest';
import { locationForScreen, parseResumeLocation } from '../resumeLocation.ts';

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
