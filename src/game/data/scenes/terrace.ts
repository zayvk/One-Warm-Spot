/* ───── Old Apartment Terrace — Interactive Scene Config (v2) ───── */

import type { ShelterSceneConfig } from './types.ts';
import { SCENE_PROPS } from '../media.ts';

export const terraceScene: ShelterSceneConfig = {
  backdrop: '/source/scenes/terrace-stage.webp',

  walkableArea: { xMin: 0.12, xMax: 0.9, yMin: 0.53, yMax: 0.88 },
  obstacles: [
    /* Diagonal left parapet wall */
    { shape: 'ellipse', x: 0, y: 0.5, rx: 0.2, ry: 0.2 },
    /* Brick stairwell/lift bulkhead (right) */
    { shape: 'rect', xMin: 0.79, xMax: 1, yMin: 0.3, yMax: 0.7 },
  ],

  /* Step out of the ajar stairwell door onto the rooftop */
  entryPoint: { x: 0.895, y: 0.725 },
  idlePoint: { x: 0.62, y: 0.72 },

  hotspots: [
    /* ── Central Fire Pit ── */
    {
      id: 'firepit',
      type: 'firepit',
      position: { x: 0.5, y: 0.7 },
      propSprite: SCENE_PROPS['prop-firepit'],
      propScale: 0.085,
      label: 'Light fire pit',
      collider: { rx: 0.042, ry: 0.026 },
      standOffset: { dx: -0.058, dy: 0.015 },
    },

    /* ── Shabby cloth lean-to, tucked behind-left of the fire ── */
    {
      id: 'sleep-shed',
      type: 'sleep',
      position: { x: 0.36, y: 0.61 },
      propSprite: SCENE_PROPS.clothShed,
      propScale: 0.19,
      label: 'Rest by shelter',
      collider: { rx: 0.062, ry: 0.03 },
      standOffset: { dx: -0.03, dy: -0.012 },
      restOffset: { dx: 0.085, dy: 0.035 },
    },

    /* ── 3 Searchable box spots, each with distinct artwork ── */
    {
      id: 'boxes-1',
      type: 'searchable',
      position: { x: 0.25, y: 0.555 },
      propSprite: SCENE_PROPS['prop-boxes-intact'],
      propSpriteAfter: SCENE_PROPS['prop-boxes-cleared'],
      propScale: 0.095,
      label: 'Broken Boxes — Rummage for materials',
      reward: { scrap: 2, timber: 2 },
      collider: { rx: 0.04, ry: 0.024 },
      standOffset: { dx: 0.02, dy: 0.04 },
    },
    {
      id: 'boxes-2',
      type: 'searchable',
      position: { x: 0.18, y: 0.8 },
      propSprite: SCENE_PROPS.boxDouble,
      propScale: 0.1,
      label: 'Weathered Crates — Rummage for materials',
      reward: { timber: 3, cloth: 1 },
      collider: { rx: 0.046, ry: 0.026 },
      standOffset: { dx: 0.062, dy: 0.008 },
    },
    {
      id: 'boxes-3',
      type: 'searchable',
      position: { x: 0.66, y: 0.555 },
      propSprite: SCENE_PROPS.boxSingle,
      propScale: 0.092,
      flipX: true,
      label: 'Abandoned Parcel — Rummage for materials',
      reward: { scrap: 1, timber: 1, cloth: 1 },
      collider: { rx: 0.03, ry: 0.02 },
      standOffset: { dx: -0.045, dy: 0.026 },
    },

    /* ── 6 Weed patches using all 3 weed sprites ── */
    {
      id: 'weeds-1',
      type: 'weeds',
      position: { x: 0.45, y: 0.53 },
      propSprite: SCENE_PROPS.weeds3,
      propScale: 0.05,
      label: 'Parapet Dandelions — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
      collider: { rx: 0.03, ry: 0.016 },
      standOffset: { dx: -0.03, dy: 0.024 },
    },
    {
      id: 'weeds-2',
      type: 'weeds',
      position: { x: 0.575, y: 0.535 },
      propSprite: SCENE_PROPS['prop-weeds-1'],
      propScale: 0.066,
      flipX: true,
      label: 'Overgrown Ivy — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
      collider: { rx: 0.03, ry: 0.018 },
      standOffset: { dx: -0.04, dy: 0.022 },
    },
    {
      id: 'weeds-3',
      type: 'weeds',
      position: { x: 0.145, y: 0.665 },
      propSprite: SCENE_PROPS['prop-weeds-2'],
      propScale: 0.074,
      label: 'Wall Brush — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
      collider: { rx: 0.032, ry: 0.02 },
      standOffset: { dx: 0.048, dy: 0.016 },
    },
    {
      id: 'weeds-4',
      type: 'weeds',
      position: { x: 0.37, y: 0.835 },
      propSprite: SCENE_PROPS.weeds3,
      propScale: 0.056,
      flipX: true,
      label: 'Concrete Wildflowers — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
      collider: { rx: 0.034, ry: 0.018 },
      standOffset: { dx: 0.05, dy: -0.01 },
    },
    {
      id: 'weeds-5',
      type: 'weeds',
      position: { x: 0.655, y: 0.81 },
      propSprite: SCENE_PROPS['prop-weeds-2'],
      propScale: 0.07,
      flipX: true,
      label: 'Tangled Grass — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
      collider: { rx: 0.032, ry: 0.02 },
      standOffset: { dx: -0.046, dy: 0.01 },
    },
    {
      id: 'weeds-6',
      type: 'weeds',
      position: { x: 0.85, y: 0.865 },
      propSprite: SCENE_PROPS['prop-weeds-1'],
      propScale: 0.062,
      label: 'Wild Tufts — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
      collider: { rx: 0.03, ry: 0.018 },
      standOffset: { dx: -0.05, dy: -0.004 },
    },

    /* ── Ajar rooftop stairwell/lift door ── */
    {
      id: 'stairwell-door',
      type: 'door',
      position: { x: 0.86, y: 0.66 },
      propSprite: '',
      label: 'Stairwell downstairs (coming soon)',
      standOffset: { dx: -0.01, dy: 0.09 },
      hitRect: { dx: -0.065, dy: -0.32, w: 0.125, h: 0.4 },
      message: 'The stairs lead down into the quiet building—more to explore soon.',
    },
  ],

  /* ── In-scene visual upgrades (spend found materials) ── */
  buildables: [
    {
      id: 'shed-upgrade',
      name: 'Upgrade Shelter',
      icon: '🛖',
      cost: { timber: 3, cloth: 2 },
      position: { x: 0.36, y: 0.61 },
      propSprite: SCENE_PROPS.shedUpgraded,
      propScale: 0.225,
      upgradesHotspot: 'sleep-shed',
      hotspotOverrides: {
        propScale: 0.225,
        collider: { rx: 0.064, ry: 0.032 },
        standOffset: { dx: 0.004, dy: -0.024 },
        restOffset: { dx: 0.085, dy: 0.035 },
      },
      standOffset: { dx: 0.085, dy: 0.035 },
      effect: 'lantern',
      lanternAnchor: { x: 0.216, y: 0.585 },
    },
    {
      id: 'herb-planter',
      name: 'Herb Planter',
      icon: '🌿',
      cost: { timber: 2, seeds: 2 },
      position: { x: 0.24, y: 0.69 },
      propSprite: SCENE_PROPS.planter,
      propScale: 0.14,
      collider: { rx: 0.036, ry: 0.022 },
      standOffset: { dx: 0.058, dy: 0.02 },
      effect: 'leaves',
    },
    {
      id: 'rain-barrel',
      name: 'Rain Barrel',
      icon: '🛢️',
      cost: { scrap: 2, timber: 1 },
      position: { x: 0.75, y: 0.59 },
      propSprite: SCENE_PROPS.rainBarrel,
      propScale: 0.13,
      collider: { rx: 0.024, ry: 0.016 },
      standOffset: { dx: -0.045, dy: 0.025 },
      effect: 'water',
    },
  ],
};
