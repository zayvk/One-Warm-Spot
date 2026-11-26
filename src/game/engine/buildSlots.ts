/* ───── Flexible Terrace build slots: pure placement, migration & validation rules ───── */

import type { AssignableStationId } from '../data/scenes/types.ts';
import {
  ASSIGNABLE_STATION,
  ASSIGNABLE_STATION_IDS,
  LEGACY_DEFAULT_SLOT,
  TERRACE_SLOT_IDS,
} from '../data/scenes/terrace.ts';
import type { StationTiers } from './stations.ts';

/** Which station stands in each build slot (`null` = empty "Build here" spot) */
export type SlotAssignments = Record<string, AssignableStationId | null>;

const SLOT_IDS: readonly string[] = TERRACE_SLOT_IDS;

export function isAssignableStationId(v: unknown): v is AssignableStationId {
  return typeof v === 'string' && (ASSIGNABLE_STATION_IDS as readonly string[]).includes(v);
}

export function emptySlotAssignments(): SlotAssignments {
  return Object.fromEntries(SLOT_IDS.map((id) => [id, null]));
}

/** The slot a station was placed in, or `null` */
export function slotOfStation(slots: SlotAssignments, station: AssignableStationId): string | null {
  return SLOT_IDS.find((id) => slots[id] === station) ?? null;
}

/** Stations not yet placed anywhere — what an empty slot's build menu offers */
export function unplacedStations(slots: SlotAssignments): AssignableStationId[] {
  return ASSIGNABLE_STATION_IDS.filter((id) => slotOfStation(slots, id) === null);
}

/**
 * Place a station in an empty slot. Returns the new assignments, or `null` if the
 * slot is unknown or taken, or the station is already standing somewhere else.
 */
export function placeStationInSlot(
  slots: SlotAssignments,
  slotId: string,
  station: AssignableStationId,
): SlotAssignments | null {
  if (!SLOT_IDS.includes(slotId) || slots[slotId] !== null) return null;
  if (!isAssignableStationId(station) || slotOfStation(slots, station) !== null) return null;
  return { ...slots, [slotId]: station };
}

/**
 * Keep assignments consistent with station tiers:
 * - a station that isn't built (tier 0) frees its slot;
 * - a built station with no slot (older saves) goes back to its old spot,
 *   or the first free slot if someone else is standing there.
 * Older rooftops without `slotAssignments` reconcile from empty, keeping their exact layout.
 */
export function reconcileSlotAssignments(slots: SlotAssignments, tiers: StationTiers): SlotAssignments {
  const out = emptySlotAssignments();
  for (const id of SLOT_IDS) {
    const station = slots[id];
    if (station && tiers[ASSIGNABLE_STATION[station]] > 0) out[id] = station;
  }
  for (const station of ASSIGNABLE_STATION_IDS) {
    if (tiers[ASSIGNABLE_STATION[station]] <= 0 || slotOfStation(out, station) !== null) continue;
    const preferred = LEGACY_DEFAULT_SLOT[station];
    const slot = out[preferred] === null ? preferred : SLOT_IDS.find((id) => out[id] === null);
    if (slot) out[slot] = station;
  }
  return out;
}

/**
 * Read a stored `slotAssignments` object. Missing → empty (older saves, migrated by
 * `reconcileSlotAssignments`). `strict` (backups) returns `null` for any unknown slot,
 * unknown station or a station assigned twice; lenient mode drops the bad entries.
 */
export function parseSlotAssignments(v: unknown, strict: boolean): SlotAssignments | null {
  if (v === undefined || v === null) return emptySlotAssignments();
  if (typeof v !== 'object' || Array.isArray(v)) return strict ? null : emptySlotAssignments();

  const out = emptySlotAssignments();
  for (const [slotId, station] of Object.entries(v as Record<string, unknown>)) {
    if (!SLOT_IDS.includes(slotId)) {
      if (strict) return null;
      continue;
    }
    if (station === null) continue;
    if (!isAssignableStationId(station) || slotOfStation(out, station) !== null) {
      if (strict) return null;
      continue;
    }
    out[slotId] = station;
  }
  return out;
}
