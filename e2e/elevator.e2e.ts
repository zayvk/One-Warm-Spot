import type { Page } from '@playwright/test';
import { test, expect, clickStage, readSave, waitForRooftop, startFreshTerrace } from './helpers.ts';
import { BUILDING_FLOORS, ELEVATOR_STOPS } from '../src/game/data/floors.ts';

const DOOR = { x: 0.8575, y: 0.54 };
const stopLabel = (id: number | 'R') => ELEVATOR_STOPS.find((s) => s.id === id)!.label;

async function openRooftopPanel(page: Page) {
  await clickStage(page, DOOR.x, DOOR.y);
  const panel = page.getByRole('dialog', { name: 'Elevator — choose a floor' });
  await expect(panel).toBeVisible({ timeout: 10_000 });
  return panel;
}

async function rideTo(page: Page, id: number | 'R', opts: { skip?: boolean } = { skip: true }) {
  const panel = page.getByRole('dialog', { name: 'Elevator — choose a floor' });
  await panel.getByRole('button', { name: `Ride to ${stopLabel(id)}` }).click();
  await expect(panel).toHaveCount(0);
  const skip = page.getByRole('button', { name: /Skip/ });
  if (opts.skip) {
    await skip.click();
  }
  await expect(skip).toHaveCount(0, { timeout: 15_000 });
}

async function openFloorPanel(page: Page) {
  await page.getByRole('button', { name: 'Elevator — choose a floor' }).click();
  const panel = page.getByRole('dialog', { name: 'Elevator — choose a floor' });
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('Rooftop elevator & the four floors', () => {
  test('door opens the floor panel; Cancel, Escape and click-outside all close it', async ({ page }) => {
    await startFreshTerrace(page);
    let panel = await openRooftopPanel(page);
    await expect(panel.getByRole('button', { name: `${stopLabel('R')} (current floor)` })).toBeDisabled();
    await panel.getByRole('button', { name: 'Cancel' }).click();
    await expect(panel).toHaveCount(0);

    panel = await openRooftopPanel(page);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    panel = await openRooftopPanel(page);
    await page.mouse.click(30, 400);
    await expect(panel).toHaveCount(0);
  });

  test('visit every floor; each scavenge spot answers with a toast; ride back up', async ({ page }) => {
    await startFreshTerrace(page);
    await openRooftopPanel(page);

    for (const floorId of [4, 3, 2, 1] as const) {
      await rideTo(page, floorId);
      const floor = BUILDING_FLOORS[floorId];
      await expect(page.getByText(floor.name).first()).toBeVisible();

      for (const spot of floor.hotspots.filter((h) => h.kind === 'scavenge')) {
        await page.getByRole('button', { name: spot.label, exact: true }).click();
        await expect(page.getByText(`${spot.label} — scavenging puzzle coming soon.`)).toBeVisible();
      }
      if (floorId === 3) await expect(page.locator('.ows-sparks')).toHaveCount(1);
      else await expect(page.locator('.ows-sparks')).toHaveCount(0);

      const panel = await openFloorPanel(page);
      await expect(panel.getByRole('button', { name: `${stopLabel(floorId)} (current floor)` })).toBeDisabled();
    }

    /* Clock stays paused downstairs */
    const before = await readSave(page);
    await page.waitForTimeout(2500);
    const after = await readSave(page);
    expect(after?.dayPhase).toBe(before?.dayPhase);
    expect((after as unknown as { phaseElapsedSec: number }).phaseElapsedSec).toBe(
      (before as unknown as { phaseElapsedSec: number }).phaseElapsedSec,
    );

    await rideTo(page, 'R');
    await waitForRooftop(page);
    await expect(page.getByText('Old Apartment Terrace').first()).toBeVisible();
  });

  test('an unskipped ride plays through and arrives on its own', async ({ page }) => {
    await startFreshTerrace(page);
    await openRooftopPanel(page);
    await rideTo(page, 4, { skip: false });
    await expect(page.getByText(BUILDING_FLOORS[4].name).first()).toBeVisible();
  });

  test('Settings opened mid-ride keeps the keyboard (no accidental skip or restart)', async ({ page }) => {
    await startFreshTerrace(page);
    await openRooftopPanel(page);
    await page.getByRole('button', { name: `Ride to ${stopLabel(1)}` }).click();
    await page.getByRole('button', { name: 'Open settings' }).click();
    const sw = page.getByRole('switch', { name: 'Reduce Motion' });
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: /Skip/ })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Game settings' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Skip/ })).toBeVisible();

    /* The ride still finishes on schedule after the toggles */
    await expect(page.getByText(BUILDING_FLOORS[1].name).first()).toBeVisible({ timeout: 10_000 });
  });
});
