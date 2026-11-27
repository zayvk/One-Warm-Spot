import { readFile } from 'node:fs/promises';
import { test, expect, clickStage, readSave, readTerrace, startFreshTerrace, waitForRooftop } from './helpers.ts';
import { TERRACE_BUILD_SLOTS } from '../src/game/data/scenes/terrace.ts';

const slot1 = TERRACE_BUILD_SLOTS[0].position;

test.describe('Saves, backups & starting over', () => {
  test('a refresh resumes right where you were; a new visit starts at the Title', async ({ page, context }) => {
    await startFreshTerrace(page);
    await clickStage(page, slot1.x, slot1.y);
    await page.getByRole('button', { name: 'Build Seedling Crate here' }).click();
    await expect.poll(async () => (await readTerrace(page))?.slotAssignments['slot-1'], { timeout: 15_000 }).toBe('planter');
    const resources = (await readSave(page))!.resources;

    /* Rooftop → refresh → rooftop (no Title, no cutscene) */
    await page.reload();
    await waitForRooftop(page);
    await expect(page.getByRole('button', { name: /Continue/ })).toHaveCount(0);
    expect((await readSave(page))!.resources).toEqual(resources);
    expect((await readTerrace(page))!.planterTier).toBe(1);

    /* The slot now holds the crate: clicking it opens the crate's menu, not the build menu */
    await clickStage(page, slot1.x, slot1.y, 0.45, 0.1);
    await expect(page.getByRole('dialog', { name: 'Seedling Crate actions' })).toBeVisible();
    await page.keyboard.press('Escape');

    /* Downstairs → refresh → same floor */
    await clickStage(page, 0.8575, 0.54);
    await page.getByRole('button', { name: 'Ride to Floor 3 · Utility Corridor' }).click();
    await page.getByRole('button', { name: /Skip/ }).click();
    await expect(page.getByText('Floor 3 · Utility Corridor').first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('Floor 3 · Utility Corridor').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sparking Fuse Box', exact: true })).toBeVisible();

    /* Mid-ride → refresh → the ride's destination (the cutscene isn't replayed) */
    await page.getByRole('button', { name: 'Elevator — choose a floor' }).click();
    await page.getByRole('button', { name: 'Ride to Floor 2 · Hallway' }).click();
    await expect(page.getByRole('button', { name: /Skip/ })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Floor 2 · Residential Hallway').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Skip/ })).toHaveCount(0);

    /* Opening the game in a new tab later starts at the Title with Continue → rooftop */
    const later = await context.newPage();
    await later.goto('/');
    await expect(later.getByRole('button', { name: /Continue/ })).toBeVisible();
    await later.getByRole('button', { name: /Continue/ }).click();
    await waitForRooftop(later);
    await later.close();

    /* Back on the Title → refresh → Title */
    await page.getByRole('button', { name: 'Elevator — choose a floor' }).click();
    await page.getByRole('button', { name: 'Ride to Rooftop Terrace' }).click();
    await page.getByRole('button', { name: /Skip/ }).click();
    await waitForRooftop(page);
    await page.getByRole('button', { name: /Title/ }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();
  });

  test('export a backup, then load it into a fresh browser', async ({ page, browser }) => {
    await startFreshTerrace(page);
    await clickStage(page, slot1.x, slot1.y);
    await page.getByRole('button', { name: 'Build Grill Rack here' }).click();
    await expect.poll(async () => (await readTerrace(page))?.slotAssignments['slot-1'], { timeout: 15_000 }).toBe('grill');
    const save = (await readSave(page))!;
    const terrace = (await readTerrace(page))!;

    await page.getByRole('button', { name: 'Open settings' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Backup (.json)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('one-warm-spot-day1.json');
    const file = await download.path();
    const backup = JSON.parse(await readFile(file, 'utf8'));
    expect(backup.terraceState.slotAssignments['slot-1']).toBe('grill');

    const fresh = await browser.newContext();
    const page2 = await fresh.newPage();
    const errors: string[] = [];
    page2.on('pageerror', (e) => errors.push(e.message));
    await page2.goto('/');
    await expect(page2.getByRole('button', { name: /Start/ })).toBeVisible();
    await page2.locator('input[type="file"]').setInputFiles(file);
    await expect(page2.getByText('Backup restored')).toBeVisible();
    await page2.getByRole('button', { name: /Continue/ }).click();
    await waitForRooftop(page2);
    const restoredSave = await page2.evaluate(() => JSON.parse(localStorage.getItem('one-warm-spot-save')!));
    const restoredTerrace = await page2.evaluate(() => JSON.parse(localStorage.getItem('ows_terrace_state')!));
    expect(restoredSave.resources).toEqual(save.resources);
    expect(restoredTerrace.slotAssignments).toEqual(terrace.slotAssignments);
    expect(restoredTerrace.spawns).toEqual(terrace.spawns);
    expect(errors).toEqual([]);
    await fresh.close();
  });

  test('a damaged backup is rejected calmly', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ not json'),
    });
    await expect(page.getByText("That backup couldn't be loaded")).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/ })).toHaveCount(0);
  });

  test('New Game over a save asks first: Cancel keeps it, Start Fresh wipes it', async ({ page }) => {
    await startFreshTerrace(page);
    await page.getByRole('button', { name: /Title/ }).click();

    await page.getByRole('button', { name: 'New Game' }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toHaveCount(0);
    expect((await readSave(page))?.chosenSite).toBe('terrace');

    await page.getByRole('button', { name: 'New Game' }).click();
    await page.getByRole('button', { name: 'Start Fresh' }).click();
    await expect(page.getByRole('button', { name: 'Restore this shelter' })).toBeVisible();
    expect(await readTerrace(page)).toBeNull();
    expect((await readSave(page))?.chosenSite ?? null).toBeNull();
  });
});
