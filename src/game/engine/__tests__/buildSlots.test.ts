import { describe, expect, it } from 'vitest';
import {
  emptySlotAssignments,
  placeStationInSlot,
  reconcileSlotAssignments,
  slotOfStation,
  unplacedStations,
  type SlotAssignments,
} from '../buildSlots.ts';
import { ASSIGNABLE_STATION_IDS, TERRACE_SLOT_IDS } from '../../data/scenes/terrace.ts';
import type { AssignableStationId } from '../../data/scenes/types.ts';
import type { StationTiers } from '../stations.ts';

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

const tiers = (built: Partial<StationTiers>): StationTiers => ({
  shelter: 1, firepit: 1, planter: 0, barrel: 0, grill: 0, sewing: 0, ...built,
});

describe('flexible build slots', () => {
  it('lets all 4 stations be placed in any slot, in any order', () => {
    const slotOrders = permutations(TERRACE_SLOT_IDS);
    const stationOrders = permutations(ASSIGNABLE_STATION_IDS);
    expect(slotOrders).toHaveLength(24);
    for (const slotOrder of slotOrders) {
      for (const stationOrder of stationOrders) {
        let slots: SlotAssignments = emptySlotAssignments();
        stationOrder.forEach((station, i) => {
          const next = placeStationInSlot(slots, slotOrder[i], station);
          expect(next, `${station} → ${slotOrder[i]}`).not.toBeNull();
          slots = next!;
          expect(unplacedStations(slots)).toHaveLength(ASSIGNABLE_STATION_IDS.length - i - 1);
        });
        stationOrder.forEach((station, i) => expect(slotOfStation(slots, station)).toBe(slotOrder[i]));
        /* Every station is placed once, so no empty "Build here" spot remains */
        expect(Object.values(slots).every((s) => s !== null)).toBe(true);
      }
    }
  });

  it('refuses a taken slot, a station placed twice, or an unknown slot', () => {
    const slots = placeStationInSlot(emptySlotAssignments(), 'slot-2', 'grill')!;
    expect(placeStationInSlot(slots, 'slot-2', 'sewing')).toBeNull();
    expect(placeStationInSlot(slots, 'slot-4', 'grill')).toBeNull();
    expect(placeStationInSlot(slots, 'slot-9', 'sewing')).toBeNull();
    expect(placeStationInSlot(slots, 'slot-1', 'hot-tub' as AssignableStationId)).toBeNull();
    expect(unplacedStations(slots)).toEqual(['planter', 'rain-barrel', 'sewing']);
  });

  it('migrates built stations without a slot to their old spots, or the first free one', () => {
    expect(reconcileSlotAssignments(emptySlotAssignments(), tiers({ planter: 1, barrel: 2, grill: 3, sewing: 1 }))).toEqual({
      'slot-1': 'planter',
      'slot-2': 'sewing',
      'slot-3': 'grill',
      'slot-4': 'rain-barrel',
    });
    /* The farm's old spot is already taken by the grill → the farm moves to the first free slot */
    const custom = { ...emptySlotAssignments(), 'slot-1': 'grill' as const };
    expect(reconcileSlotAssignments(custom, tiers({ grill: 1, planter: 1 }))).toMatchObject({
      'slot-1': 'grill',
      'slot-2': 'planter',
    });
  });

  it('frees slots claimed by stations that were never built', () => {
    const slots = { ...emptySlotAssignments(), 'slot-3': 'sewing' as const };
    expect(reconcileSlotAssignments(slots, tiers({}))).toEqual(emptySlotAssignments());
  });
});
