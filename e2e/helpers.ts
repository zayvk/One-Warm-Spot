import { test as base, expect, type Page } from '@playwright/test';
import {
  TERRACE_BOX_VARIANTS,
  TERRACE_STATIONS,
  TERRACE_WEED_VARIANTS,
  terraceScene,
  type TerracePropSpawn,
} from '../src/game/data/scenes/terrace.ts';
import { fitStage } from '../src/game/engine/stageFit.ts';

export { expect };

/** Painted stage art size — every normalized scene coordinate is relative to it */
const STAGE_W = 1376;
const STAGE_H = 768;

export const SAVE_KEY = 'one-warm-spot-save';
export const TERRACE_KEY = 'ows_terrace_state';

/**
 * `test` with a guard that fails any test whose page throws or logs a console error.
 * Each test gets a brand-new browser context (empty localStorage).
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()} @ ${msg.location().url}`);
      });
      await use(errors);
      expect(errors, 'no page errors or console errors').toEqual([]);
    },
    { auto: true },
  ],
});

/* ───── Stage geometry (cover-fit of the 1376×768 art over the canvas) ───── */

async function stageRect(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const box = await page.locator('main canvas').boundingBox();
  if (!box) throw new Error('scene canvas not found');
  const r = fitStage(box.width, box.height, STAGE_W, STAGE_H, terraceScene.safeArea);
  return { x: box.x + r.x, y: box.y + r.y, w: r.width, h: r.height };
}

export async function stageToScreen(page: Page, nx: number, ny: number): Promise<{ x: number; y: number }> {
  const r = await stageRect(page);
  return { x: r.x + nx * r.w, y: r.y + ny * r.h };
}

/** Click a normalized stage point, optionally lifted up by a fraction of a prop's height */
export async function clickStage(page: Page, nx: number, ny: number, liftFraction = 0, propScale = 0): Promise<void> {
  const r = await stageRect(page);
  await page.mouse.click(r.x + nx * r.w, r.y + ny * r.h - propScale * r.h * liftFraction);
}

export async function hoverStage(page: Page, nx: number, ny: number, liftFraction = 0, propScale = 0): Promise<void> {
  const r = await stageRect(page);
  await page.mouse.move(r.x + nx * r.w, r.y + ny * r.h - propScale * r.h * liftFraction);
}

/** Click the body of a sprite prop anchored bottom-centre at (x, y) */
export async function clickProp(page: Page, pos: { x: number; y: number }, propScale: number): Promise<void> {
  await clickStage(page, pos.x, pos.y, 0.45, propScale);
}

export function hotspotPos(id: string): { x: number; y: number } {
  const hs = terraceScene.hotspots.find((h) => h.id === id);
  if (!hs) throw new Error(`no hotspot ${id}`);
  return hs.position;
}

export function stationTierScale(stationId: string, tier: number): number {
  const station = TERRACE_STATIONS.find((s) => s.id === stationId);
  const cfg = station?.tiers.find((t) => t.tier === tier);
  if (!cfg) throw new Error(`no ${stationId} tier ${tier}`);
  return cfg.propScale;
}

export function spawnScale(spawn: TerracePropSpawn): number {
  const variants = { ...TERRACE_BOX_VARIANTS, ...TERRACE_WEED_VARIANTS } as Record<string, { propScale: number }>;
  return variants[spawn.variant].propScale * spawn.scale;
}

/* ───── Persisted state ───── */

export interface SaveLike {
  day: number;
  dayPhase: string;
  stamina: number;
  strength: number;
  chosenSite: string | null;
  travelerGender: string;
  resources: Record<string, number>;
}

export interface TerraceLike {
  shelterTier: number;
  firepitTier: number;
  planterTier: number;
  barrelTier: number;
  grillTier: number;
  sewingTier: number;
  planterReady: boolean;
  barrelReady: boolean;
  fireLit: boolean;
  searchedBoxes: string[];
  clearedWeeds: string[];
  slotAssignments: Record<string, string | null>;
  spawns: Record<string, TerracePropSpawn>;
  [key: string]: unknown;
}

export async function readSave(page: Page): Promise<SaveLike | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, SAVE_KEY);
}

export async function readTerrace(page: Page): Promise<TerraceLike | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, TERRACE_KEY);
}

/* ───── Flows ───── */

/** Title → Start → claim the Terrace → skip the lift arrival → the playable rooftop */
export async function startFreshTerrace(
  page: Page,
  opts: { gender?: 'female' | 'male'; reduceMotion?: boolean } = {},
): Promise<void> {
  if (opts.reduceMotion) {
    await page.addInitScript(() => localStorage.setItem('ows_reduce_motion', 'true'));
  }
  await page.goto('/');
  await page.getByRole('button', { name: /Start/ }).click();
  if (opts.gender === 'male') await page.getByRole('button', { name: 'Male', exact: true }).click();
  await page.getByRole('button', { name: 'Restore this shelter' }).first().click();
  await page.getByRole('button', { name: /Skip/ }).click();
  await waitForRooftop(page, opts.reduceMotion);
}

/** Wait for the shelter canvas and the traveler's entry stroll to finish */
export async function waitForRooftop(page: Page, reduceMotion = false): Promise<void> {
  await expect(page.locator('main canvas')).toBeVisible();
  await expect(page.getByLabel('Found Materials Pouch')).toBeVisible();
  /* Stage reveal (220ms) + pause (280ms) + ~2s stroll before the traveler takes input */
  await page.waitForTimeout(reduceMotion ? 800 : 3200);
}
