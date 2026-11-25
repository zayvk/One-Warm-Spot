/* ───── Old Apartment Terrace — Interactive Scene Config ───── */

import type { ShelterSceneConfig } from './types.ts';
import { SCENE_PROPS } from '../media.ts';

export const terraceScene: ShelterSceneConfig = {
  backdrop: '/source/scenes/terrace-stage.webp',

  walkableArea: { xMin: 0.12, xMax: 0.84, yMin: 0.55, yMax: 0.88 },
  entryPoint: { x: -0.05, y: 0.75 },
  idlePoint: { x: 0.38, y: 0.72 },

  hotspots: [
    {
      id: 'firepit',
      type: 'firepit',
      position: { x: 0.48, y: 0.69 },
      propSprite: SCENE_PROPS['prop-firepit'],
      propScale: 0.12,
      label: 'Fire Pit — Light a campfire',
    },
    {
      id: 'boxes',
      type: 'searchable',
      position: { x: 0.24, y: 0.57 },
      propSprite: SCENE_PROPS['prop-boxes-intact'],
      propSpriteAfter: SCENE_PROPS['prop-boxes-cleared'],
      propScale: 0.11,
      label: 'Broken Boxes — Rummage for materials',
      reward: { scrap: 2, timber: 1 },
    },
    {
      id: 'weeds-1',
      type: 'weeds',
      position: { x: 0.17, y: 0.67 },
      propSprite: SCENE_PROPS['prop-weeds-1'],
      propScale: 0.08,
      label: 'Overgrown Weeds — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
    },
    {
      id: 'weeds-2',
      type: 'weeds',
      position: { x: 0.58, y: 0.54 },
      propSprite: SCENE_PROPS['prop-weeds-2'],
      propScale: 0.08,
      label: 'Tangled Weeds — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
    },
    {
      id: 'weeds-3',
      type: 'weeds',
      position: { x: 0.34, y: 0.80 },
      propSprite: SCENE_PROPS['prop-weeds-1'],
      propScale: 0.08,
      label: 'Wild Brush — Clear for materials',
      reward: { seeds: 1, cloth: 1 },
    },
    {
      id: 'sleep-shed',
      type: 'sleep',
      position: { x: 0.80, y: 0.67 },
      propSprite: '', // no separate prop — uses backdrop area
      propScale: 0,
      label: 'Under Shed — Rest here',
    },
  ],
};
