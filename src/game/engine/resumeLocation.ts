/* Where the player was, so a page refresh lands them back there (per browser tab) */

import { findEnterableDoor, type BuildingFloorId, type DownstairsFloorId } from '../data/floors.ts';

/** `shelter` is the rooftop (lift stop R); `floor` is one of the apartment floors 1–4; `room` is inside an opened door on a floor */
export type ResumeLocation =
  | { screen: 'title' }
  | { screen: 'site-select' }
  | { screen: 'shelter' }
  | { screen: 'floor'; floor: DownstairsFloorId }
  | { screen: 'room'; floor: DownstairsFloorId; doorId: string };

/*
 * sessionStorage survives a refresh but not a new visit: reloading resumes
 * the same place, while opening the game again later starts at the Title (Continue).
 */
const RESUME_KEY = 'ows_resume_location';
const TITLE: ResumeLocation = { screen: 'title' };

export type AppScreen = 'title' | 'site-select' | 'arrival' | 'shelter' | 'ride' | 'floor' | 'room';

/**
 * The screen to actually show. Everything past site selection needs a claimed shelter (→ Title);
 * the lift, floors and rooms belong to the Terrace's building (→ the shelter, e.g. right after a
 * backup for another site is loaded); a room needs its door (and an unchanged run — a backup
 * loaded while inside sends you out to the floor).
 */
export function resolveScreen(screen: AppScreen, chosenSite: string | null, roomValid: boolean): AppScreen {
  if (screen === 'title' || screen === 'site-select') return screen;
  if (!chosenSite) return 'title';
  const inBuilding = screen === 'ride' || screen === 'floor' || screen === 'room';
  if (inBuilding && chosenSite !== 'terrace') return 'shelter';
  if (screen === 'room' && !roomValid) return 'floor';
  return screen;
}

/**
 * The place to come back to for an app screen. Cutscenes aren't replayed:
 * mid-arrival resumes on the rooftop, mid-ride at the ride's destination.
 */
export function locationForScreen(
  screen: AppScreen,
  floor: DownstairsFloorId,
  rideTo: BuildingFloorId,
  roomDoor: string | null = null,
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
    case 'room':
      return roomDoor ? { screen: 'room', floor, doorId: roomDoor } : { screen: 'floor', floor };
  }
}

const isFloor = (v: unknown): v is DownstairsFloorId => v === 1 || v === 2 || v === 3 || v === 4;

/**
 * Validate a stored location against the current run (no claimed shelter → Title). A room
 * resumes only if it's an enterable door on that floor that `isDoorOpen` still reports
 * open; otherwise the player lands on the floor outside it.
 */
export function parseResumeLocation(
  raw: string | null,
  chosenSite: string | null,
  isDoorOpen: (doorId: string) => boolean = () => true,
): ResumeLocation {
  if (!raw) return TITLE;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return TITLE;
  }
  if (typeof data !== 'object' || data === null) return TITLE;
  const { screen, floor, doorId } = data as { screen?: unknown; floor?: unknown; doorId?: unknown };
  if (screen === 'site-select') return { screen: 'site-select' };
  if (screen === 'shelter') return chosenSite ? { screen: 'shelter' } : TITLE;
  if (screen === 'floor' || screen === 'room') {
    /* The apartment floors belong to the Terrace's building */
    if (chosenSite !== 'terrace' || !isFloor(floor)) return TITLE;
    if (screen === 'room' && typeof doorId === 'string' && findEnterableDoor(floor, doorId) && isDoorOpen(doorId)) {
      return { screen: 'room', floor, doorId };
    }
    return { screen: 'floor', floor };
  }
  return TITLE;
}

export function readResumeLocation(chosenSite: string | null, isDoorOpen?: (doorId: string) => boolean): ResumeLocation {
  try {
    return parseResumeLocation(sessionStorage.getItem(RESUME_KEY), chosenSite, isDoorOpen);
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
