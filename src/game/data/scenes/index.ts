/* ───── Interactive Scene Registry ───── */

import type { SiteId } from '../../types/game.ts';
import type { ShelterSceneConfig } from './types.ts';
import { terraceScene } from './terrace.ts';

const SCENES: Partial<Record<SiteId, ShelterSceneConfig>> = {
  terrace: terraceScene,
};

/** Interactive scene for a shelter, or `null` if it still uses the generic fallback */
export function getSceneConfig(siteId: SiteId | null): ShelterSceneConfig | null {
  return (siteId && SCENES[siteId]) || null;
}
