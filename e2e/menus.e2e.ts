import { test, expect, readSave } from './helpers.ts';

test.describe('Title, menus & shelter selector', () => {
  test('title screen loads cleanly with Start, About and Load Backup', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'One Warm Spot' })).toBeAttached();
    await expect(page.getByRole('img', { name: 'One Warm Spot' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'About' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load Backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/ })).toHaveCount(0);
  });

  test('About opens and closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'About' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('settings popover: sliders and a persisted Reduce Motion switch', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Game settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByLabel('Music Volume')).toBeVisible();
    await expect(settings.getByLabel('SFX & Ambience Volume')).toBeVisible();
    const sw = settings.getByRole('switch', { name: 'Reduce Motion' });
    const before = await sw.getAttribute('aria-checked');
    const after = before === 'true' ? 'false' : 'true';
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', after);
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', after);
    await page.keyboard.press('Escape');
    await expect(settings).toHaveCount(0);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', after);
  });

  test('mute toggle flips its label', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Mute audio' }).click();
    await expect(page.getByRole('button', { name: 'Unmute audio' })).toBeVisible();
    await page.getByRole('button', { name: 'Unmute audio' }).click();
    await expect(page.getByRole('button', { name: 'Mute audio' })).toBeVisible();
  });

  test('shelter selector: only the Terrace is claimable; modes and travelers switch', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Start/ }).click();
    await expect(page.getByRole('button', { name: 'Restore this shelter' })).toHaveCount(1);
    await expect(page.getByText('Old Apartment Terrace').first()).toBeVisible();
    await expect(page.getByText(/Locked — coming soon/)).toBeVisible();

    const challenge = page.getByRole('tab', { name: /Challenge/ });
    await challenge.click();
    await expect(challenge).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /Cozy/ }).click();
    await expect(page.getByRole('tab', { name: /Cozy/ })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Male', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Male', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Female', exact: true })).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: /Back/ }).click();
    await expect(page.getByRole('button', { name: /Start/ })).toBeVisible();
    expect(await readSave(page)).toBeNull();
  });
});
