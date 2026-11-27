/* ───── Old Apartment building: floors, hotspots & lift-ride timing (pure data) ───── */

import { CUTSCENE_ASSETS, SCENE_STAGES } from './media.ts';
import type { StageSafeArea } from '../engine/stageFit.ts';
import type { ResourceId } from '../types/game.ts';

/** Every lift stop: the four apartment floors and the Rooftop Terrace */
export type BuildingFloorId = 1 | 2 | 3 | 4 | 'R';
export type DownstairsFloorId = Exclude<BuildingFloorId, 'R'>;

/** Rect in % of the 1376×768 painting (same aspect-locked stage as the lift) */
export interface FloorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FloorHotspot {
  id: string;
  label: string;
  rect: FloorRect;
  /** `lift` opens the elevator panel; `scavenge` opens its puzzle (or says one is coming soon) */
  kind: 'lift' | 'scavenge';
  /** Live electric arcs & embers (e.g. a fuse box) — they settle once the spot is repaired */
  hasSparks?: boolean;
  /** A live scavenging puzzle: solving it repairs the spot once per run */
  puzzle?: FloorPuzzle;
}

export interface FloorPuzzle {
  game: 'connect-wires';
  /** Mini-game heading */
  title: string;
  /** Materials awarded on the first repair */
  reward: Partial<Record<ResourceId, number>>;
  /** Hover label once repaired */
  repairedLabel: string;
  /** Toast on solving */
  doneNotice: string;
  /** Toast when clicked again after repair */
  repairedNotice: string;
}

export interface BuildingFloor {
  id: DownstairsFloorId;
  /** Caption & header title, e.g. "Floor 3 · Utility Corridor" */
  name: string;
  backdrop: string;
  hotspots: FloorHotspot[];
}

/* Every floor is painted from the same spot, so the lift sits in the same place on each */
const LIFT: FloorHotspot = {
  id: 'lift',
  label: 'Elevator',
  rect: { left: 42.2, top: 23.8, width: 16.4, height: 40 },
  kind: 'lift',
};

export const BUILDING_FLOORS: Record<DownstairsFloorId, BuildingFloor> = {
  1: {
    id: 1,
    name: 'Ground Floor · Lobby',
    backdrop: CUTSCENE_ASSETS.terraceLobby,
    hotspots: [
      { id: 'apartment-1a', label: 'Apartment 1A', rect: { left: 25.4, top: 21.5, width: 5.6, height: 49 }, kind: 'scavenge' },
      LIFT,
      { id: 'apartment-1b', label: 'Apartment 1B', rect: { left: 69.2, top: 21.2, width: 5.5, height: 51.7 }, kind: 'scavenge' },
      { id: 'side-doorway', label: 'Open Doorway', rect: { left: 82.3, top: 7.5, width: 10.8, height: 85.5 }, kind: 'scavenge' },
    ],
  },
  2: {
    id: 2,
    name: 'Floor 2 · Residential Hallway',
    backdrop: CUTSCENE_ASSETS.terraceFloor2,
    hotspots: [
      { id: 'f2-cupboard', label: 'Hallway Cupboard', rect: { left: 1.3, top: 8.5, width: 21.2, height: 89 }, kind: 'scavenge' },
      { id: 'f2-boarded', label: 'Boarded Doorway & Debris', rect: { left: 25.1, top: 21.5, width: 7.3, height: 50 }, kind: 'scavenge' },
      LIFT,
      { id: 'f2-room-2a', label: 'Sunlit Room 2A', rect: { left: 69.2, top: 21.5, width: 5.5, height: 50 }, kind: 'scavenge' },
      { id: 'f2-door-2b', label: 'Cracked Door 2B', rect: { left: 82.5, top: 7.8, width: 10.4, height: 83 }, kind: 'scavenge' },
    ],
  },
  3: {
    id: 3,
    name: 'Floor 3 · Utility Corridor',
    backdrop: CUTSCENE_ASSETS.terraceFloor3,
    hotspots: [
      { id: 'f3-broken-door', label: 'Unhinged Door', rect: { left: 10.9, top: 22, width: 13.1, height: 66.5 }, kind: 'scavenge' },
      { id: 'f3-room-3a', label: 'Utility Door 3A', rect: { left: 25.6, top: 21.5, width: 5.3, height: 49.5 }, kind: 'scavenge' },
      LIFT,
      {
        id: 'f3-fusebox',
        label: 'Sparking Fuse Box',
        rect: { left: 71.6, top: 26, width: 9.4, height: 24 },
        kind: 'scavenge',
        hasSparks: true,
        puzzle: {
          game: 'connect-wires',
          title: 'Floor 3 · Fuse Box',
          reward: { scrap: 3 },
          repairedLabel: 'Repaired Fuse Box',
          doneNotice: 'Fuse box repaired! Salvaged +3 Metal Scrap.',
          repairedNotice: 'The wiring hums quietly—already repaired.',
        },
      },
      { id: 'f3-locker', label: 'Metal Utility Locker', rect: { left: 87.1, top: 18.9, width: 12.9, height: 81 }, kind: 'scavenge' },
    ],
  },
  4: {
    id: 4,
    name: 'Floor 4 · Skylight Landing',
    backdrop: CUTSCENE_ASSETS.terraceFloor4,
    hotspots: [
      { id: 'f4-broken-door', label: 'Splintered Doorway', rect: { left: 11.3, top: 8.5, width: 10.5, height: 80 }, kind: 'scavenge' },
      { id: 'f4-room-4a', label: 'Dark Hallway 4A', rect: { left: 25.8, top: 22.8, width: 5.1, height: 45 }, kind: 'scavenge' },
      LIFT,
      { id: 'f4-boarded', label: 'Boarded Studio Doors', rect: { left: 68.3, top: 9.1, width: 25.4, height: 55 }, kind: 'scavenge' },
      /* Listed after the boarded doors so the trunk & bookshelf sit on top where they overlap */
      { id: 'f4-trunk', label: 'Dusty Steamer Trunk', rect: { left: 74.1, top: 77.5, width: 12.7, height: 16.3 }, kind: 'scavenge' },
      { id: 'f4-bookshelf', label: 'Hallway Bookshelf', rect: { left: 86.1, top: 53.4, width: 13.9, height: 46.6 }, kind: 'scavenge' },
    ],
  },
};

export interface ElevatorStop {
  id: BuildingFloorId;
  /** Text on the round brass button */
  button: string;
  label: string;
}

/** Elevator panel buttons, top to bottom */
export const ELEVATOR_STOPS: readonly ElevatorStop[] = [
  { id: 'R', button: 'R', label: 'Rooftop Terrace' },
  { id: 4, button: '4', label: 'Floor 4 · Skylight Landing' },
  { id: 3, button: '3', label: 'Floor 3 · Utility Corridor' },
  { id: 2, button: '2', label: 'Floor 2 · Hallway' },
  { id: 1, button: '1', label: 'Floor 1 · Ground Lobby' },
];

/** Bottom to top */
export const BUILDING_FLOOR_ORDER: readonly BuildingFloorId[] = [1, 2, 3, 4, 'R'];

const ROOFTOP_STAGE = SCENE_STAGES.terrace ?? '/source/scenes/terrace-stage.webp';

export function floorLevel(floor: BuildingFloorId): number {
  return BUILDING_FLOOR_ORDER.indexOf(floor);
}

/** What the lift's amber indicator shows at a floor */
export function floorIndicator(floor: BuildingFloorId): string {
  return String(floor);
}

/** The painting seen through the lift doors at a floor */
export function floorBackdrop(floor: BuildingFloorId): string {
  return floor === 'R' ? ROOFTOP_STAGE : BUILDING_FLOORS[floor].backdrop;
}

/**
 * Region of a floor's painting kept on screen at any window shape: every hotspot's
 * middle half, so each spot stays visible and clickable (stage fractions, 0–1).
 */
export function floorSafeArea(floor: DownstairsFloorId): StageSafeArea {
  const rects = BUILDING_FLOORS[floor].hotspots.map((h) => h.rect);
  return {
    xMin: Math.min(...rects.map((r) => r.left + r.width * 0.25)) / 100,
    xMax: Math.max(...rects.map((r) => r.left + r.width * 0.75)) / 100,
    yMin: Math.min(...rects.map((r) => r.top + r.height * 0.25)) / 100,
    yMax: Math.max(...rects.map((r) => r.top + r.height * 0.75)) / 100,
  };
}

/** Arrival caption for a floor */
export function floorCaption(floor: BuildingFloorId, rooftopName = 'Old Apartment Terrace'): string {
  return floor === 'R' ? rooftopName : BUILDING_FLOORS[floor].name;
}

/** Every floor the indicator shows on the way, from `from` to `to` inclusive (e.g. R → 4 → 3) */
export function liftTickSequence(from: BuildingFloorId, to: BuildingFloorId): BuildingFloorId[] {
  const a = floorLevel(from);
  const b = floorLevel(to);
  const step = b >= a ? 1 : -1;
  const out: BuildingFloorId[] = [];
  for (let i = a; ; i += step) {
    out.push(BUILDING_FLOOR_ORDER[i]);
    if (i === b) break;
  }
  return out;
}

/* ── Ride timing ── */

/** ~2.8s for one floor, ~4.5s for four */
const ONE_FLOOR_MS = 2800;
const PER_EXTRA_FLOOR_MS = 1700 / 3;
/** Ding → doors open → caption → step out → hand-off */
const OUTRO_MS = 1100;
/** Lift door panels take this long to slide shut */
const DOOR_SLIDE_MS = 800;

export interface LiftRideTimeline {
  /**
   * `push`: start on a downstairs floor, pushing in toward its lift before cutting inside (doors closed).
   * `step-in`: start on the rooftop, pulling back into the lift with the Terrace framed in its open doors.
   */
  intro: 'push' | 'step-in';
  /** Floors travelled (≥ 1) */
  floors: number;
  footsteps: number[];
  /** `push`: cut from the floor painting into the lift interior */
  liftIn: number;
  /** `step-in`: the lift interior settles around the traveler */
  stepIn: number;
  /** `step-in`: the open doors slide shut */
  doorsClose: number;
  rideStart: number;
  /** With the doors shut, the view behind them becomes the destination floor */
  swapBehind: number;
  ticks: { at: number; floor: BuildingFloorId }[];
  arrive: number;
  doorsOpen: number;
  caption: number;
  stepOut: number;
  /** The whole ride, in ms */
  total: number;
}

export function liftRideTimeline(from: BuildingFloorId, to: BuildingFloorId): LiftRideTimeline {
  const sequence = liftTickSequence(from, to);
  const floors = Math.max(1, sequence.length - 1);
  const total = Math.round(ONE_FLOOR_MS + (floors - 1) * PER_EXTRA_FLOOR_MS);
  const intro = from === 'R' ? 'step-in' : 'push';

  const stepIn = 60;
  const doorsClose = 450;
  const liftIn = 750;
  const rideStart = intro === 'step-in' ? 700 : 950;
  const footsteps = intro === 'step-in' ? [100, 380] : [150, 500];
  const arrive = total - OUTRO_MS;
  /* Only swap once the doors are fully shut (push rides start with the doors closed) */
  const swapBehind = intro === 'step-in' ? doorsClose + DOOR_SLIDE_MS + 100 : rideStart + 80;

  const step = (arrive - rideStart) / floors;
  const ticks = sequence.slice(1).map((floor, i) => ({ at: Math.round(rideStart + step * (i + 0.75)), floor }));

  return {
    intro,
    floors,
    footsteps,
    liftIn,
    stepIn,
    doorsClose,
    rideStart,
    swapBehind,
    ticks,
    arrive,
    doorsOpen: arrive + 150,
    caption: arrive + 400,
    stepOut: arrive + 650,
    total,
  };
}

/** The screen fade-out at the end of every lift ride */
export const LIFT_FADE_MS = 400;

/** When the ride's screen should start fading out (the ride ends exactly as the fade does) */
export function liftRideHoldMs(from: BuildingFloorId, to: BuildingFloorId): number {
  return liftRideTimeline(from, to).total - LIFT_FADE_MS;
}
