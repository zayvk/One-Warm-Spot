/* Where the player was, so a page refresh lands them back there (per browser tab) */

import type { BuildingFloorId, DownstairsFloorId } from '../data/floors.ts';

/** `shelter` is the rooftop (lift stop R); `floor` is one of the apartment floors 1–4 */
export type ResumeLocation =
  | { screen: 'title' }
  | { screen: 'site-select' }
  | { screen: 'shelter' }
  | { screen: 'floor'; floor: DownstairsFloorId };

/*
 * sessionStorage survives a refresh but not a new visit: reloading resumes
 * the same place, while opening the game again later starts at the Title (Continue).
 */
const RESUME_KEY = 'ows_resume_location';
const TITLE: ResumeLocation = { screen: 'title' };

/**
 * The place to come back to for an app screen. Cutscenes aren't replayed:
 * mid-arrival resumes on the rooftop, mid-ride at the ride's destination.
 */
export function locationForScreen(
  screen: 'title' | 'site-select' | 'arrival' | 'shelter' | 'ride' | 'floor',
  floor: DownstairsFloorId,
  rideTo: BuildingFloorId,
): ResumeLocation {
  switch (screen) {
    case 'title':
      return TITLE;
    case 'site-select':
      return { screen: 'site-select' };
    case 'arrival':
    case 'shelter':
      return { screen: 'shelter' };
    case 'ride':
      return rideTo === 'R' ? { screen: 'shelter' } : { screen: 'floor', floor: rideTo };
    case 'floor':
      return { screen: 'floor', floor };
  }
}

/** Validate a stored location against the current run (no claimed shelter → Title) */
export function parseResumeLocation(raw: string | null, chosenSite: string | null): ResumeLocation {
  if (!raw) return TITLE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return TITLE;
  }
  if (typeof data !== 'object' || data === null) return TITLE;
  const { screen, floor } = data as { screen?: unknown; floor?: unknown };
  if (screen === 'site-select') return { screen: 'site-select' };
  if (screen === 'shelter') return chosenSite ? { screen: 'shelter' } : TITLE;
  if (screen === 'floor') {
    /* The apartment floors belong to the Terrace's building */
    if (chosenSite !== 'terrace') return TITLE;
    return floor === 1 || floor === 2 || floor === 3 || floor === 4 ? { screen: 'floor', floor } : TITLE;
  }
  return TITLE;
}

export function readResumeLocation(chosenSite: string | null): ResumeLocation {
  try {
    return parseResumeLocation(sessionStorage.getItem(RESUME_KEY), chosenSite);
  } catch {
    return TITLE;
  }
}

export function writeResumeLocation(location: ResumeLocation): void {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(location));
  } catch {
    /* Storage unavailable: a refresh simply starts at the Title */
  }
}
