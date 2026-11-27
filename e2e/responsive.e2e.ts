import type { Locator, Page } from '@playwright/test';
import { test, expect, clickProp, clickStage, hotspotPos, readTerrace, startFreshTerrace, stageToScreen, stationTierScale } from './helpers.ts';
import { TERRACE_BUILD_SLOTS } from '../src/game/data/scenes/terrace.ts';

/* Desktop browsers plus landscape phones & tablets (portrait isn't a supported layout) */
const SIZES = [
  { name: 'small phone landscape', width: 667, height: 375 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'large phone landscape', width: 932, height: 430 },
  { name: 'tablet 4:3', width: 1024, height: 768 },
  { name: 'tablet landscape', width: 1180, height: 820 },
  { name: 'large tablet', width: 1366, height: 1024 },
  { name: 'ultrawide', width: 2400, height: 900 },
];

async function expectFullyOnScreen(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, 'element rendered').not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height + 0.5);
}

async function expectBelowPouch(page: Page, locator: Locator) {
  const pouch = await page.getByLabel('Found Materials Pouch').boundingBox();
  const box = await locator.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(pouch!.y + pouch!.height);
}

test.describe('Accessibility & window shapes', () => {
  test('Reduce Motion run: still play, build and ride', async ({ page }) => {
    await startFreshTerrace(page, { reduceMotion: true, gender: 'male' });
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');
    const p = TERRACE_BUILD_SLOTS[1].position;
    await clickStage(page, p.x, p.y);
    await page.getByRole('button', { name: 'Build Needle & Thread here' }).click();
    await expect.poll(async () => (await readTerrace(page))?.slotAssignments['slot-2'], { timeout: 15_000 }).toBe('sewing');
    await page.waitForTimeout(1200);

    await clickStage(page, 0.8575, 0.54);
    const panel = page.getByRole('dialog', { name: 'Elevator — choose a floor' });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await panel.getByRole('button', { name: 'Ride to Floor 3 · Utility Corridor' }).click();
    await expect(page.getByText('Floor 3 · Utility Corridor').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.ows-sparks')).toHaveCount(0);
  });

  for (const size of SIZES) {
    test(`${size.name} (${size.width}×${size.height}): HUD and menus stay on screen, everything responds`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await startFreshTerrace(page);

      /* One-row pouch, the medallion and the ← Title button all on screen */
      const pouch = page.getByLabel('Found Materials Pouch');
      await expectFullyOnScreen(page, pouch);
      expect((await pouch.boundingBox())!.height, 'pouch stays a single row').toBeLessThan(60);
      await expectFullyOnScreen(page, page.getByLabel('Traveler clock and vitality'));
      const titleBtn = (await page.getByRole('button', { name: /Title/ }).boundingBox())!;
      expect(titleBtn.x + titleBtn.width, 'pouch clears the ← Title button').toBeLessThan((await pouch.boundingBox())!.x);

      /* The build menu (tallest menu) fits on screen below the pouch */
      const p = TERRACE_BUILD_SLOTS[1].position;
      await clickStage(page, p.x, p.y);
      const build = page.getByRole('dialog', { name: 'Choose what to build here' });
      await expect(build).toBeVisible();
      await expectFullyOnScreen(page, build);
      await expectBelowPouch(page, build);
      await page.keyboard.press('Escape');

      await clickProp(page, hotspotPos('firepit'), stationTierScale('firepit', 1));
      const fire = page.getByRole('dialog', { name: 'Twig Fire Pit actions' });
      await expect(fire).toBeVisible();
      await expectFullyOnScreen(page, fire);
      await expectBelowPouch(page, fire);
      await page.keyboard.press('Escape');

      await clickStage(page, 0.8575, 0.54);
      const panel = page.getByRole('dialog', { name: 'Elevator — choose a floor' });
      await expect(panel).toBeVisible({ timeout: 10_000 });
      await expectFullyOnScreen(page, panel);
      await panel.getByRole('button', { name: 'Ride to Floor 2 · Hallway' }).click();
      await page.getByRole('button', { name: /Skip/ }).click();
      for (const name of ['Hallway Cupboard', 'Boarded Doorway & Debris', 'Sunlit Room 2A', 'Cracked Door 2B']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeInViewport({ ratio: 0.4 });
      }
      await page.getByRole('button', { name: 'Sunlit Room 2A', exact: true }).click();
      await expect(page.getByText('Sunlit Room 2A — scavenging puzzle coming soon.')).toBeVisible();
    });
  }
});

test.describe('Touch (landscape phone)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('taps build, open menus and reach the lift', async ({ page }) => {
    await startFreshTerrace(page);
    const tap = async (nx: number, ny: number) => {
      const pt = await stageToScreen(page, nx, ny);
      await page.touchscreen.tap(pt.x, pt.y);
    };

    const p = TERRACE_BUILD_SLOTS[0].position;
    await tap(p.x, p.y);
    const build = page.getByRole('dialog', { name: 'Choose what to build here' });
    await expect(build).toBeVisible();
    await build.getByRole('button', { name: 'Build Seedling Crate here' }).tap();
    await expect.poll(async () => (await readTerrace(page))?.slotAssignments['slot-1'], { timeout: 15_000 }).toBe('planter');
    await page.waitForTimeout(1200);

    await tap(0.8575, 0.54);
    const panel = page.getByRole('dialog', { name: 'Elevator — choose a floor' });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await panel.getByRole('button', { name: 'Ride to Floor 4 · Skylight Landing' }).tap();
    await page.getByRole('button', { name: /Skip/ }).tap();
    await page.getByRole('button', { name: 'Dusty Steamer Trunk', exact: true }).tap();
    await expect(page.getByText('Dusty Steamer Trunk — scavenging puzzle coming soon.')).toBeVisible();
  });
});
