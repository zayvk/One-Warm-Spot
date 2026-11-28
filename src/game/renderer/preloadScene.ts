import type { SiteId } from '../types/game.ts';

/**
 * Warms the shelter scene ahead of time (during the arrival cutscene or a lift ride up):
 * fetches the lazily-loaded renderer (PixiJS + scene code, split out of the main bundle)
 * and decodes the shelter's backdrop texture. Never throws.
 */
export function preloadShelterScene(siteId: SiteId): void {
  void import('./ShelterCanvas.tsx').catch(() => {});
  void import('./shelterScene.ts').then((m) => m.preloadSceneBackdrop(siteId)).catch(() => {});
}
