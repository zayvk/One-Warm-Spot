import type { Page } from '@playwright/test';
import {
  test,
  expect,
  clickProp,
  clickStage,
  hotspotPos,
  readSave,
  readTerrace,
  spawnScale,
  startFreshTerrace,
  stationTierScale,
  type TerraceLike,
} from './helpers.ts';
import { TERRACE_BUILD_SLOTS } from '../src/game/data/scenes/terrace.ts';

const slotPos = (id: string) => TERRACE_BUILD_SLOTS.find((s) => s.id === id)!.position;

async function terrace(page: Page): Promise<TerraceLike> {
  const t = await readTerrace(page);
  if (!t) throw new Error('no terrace state saved');
  return t;
}

async function openFirepitMenu(page: Page) {
  await clickProp(page, hotspotPos('firepit'), stationTierScale('firepit', (await terrace(page)).firepitTier));
  const menu = page.getByRole('dialog', { name: /actions$/ });
  await expect(menu).toBeVisible();
  return menu;
}

async function openShelterMenu(page: Page) {
  const tier = (await terrace(page)).shelterTier;
  await clickProp(page, hotspotPos('sleep-shed'), stationTierScale('shelter', tier));
  const menu = page.getByRole('dialog', { name: /actions$/ });
  await expect(menu).toBeVisible();
  return menu;
}

async function buildInSlot(page: Page, slotId: string, stationName: string) {
  const p = slotPos(slotId);
  await clickStage(page, p.x, p.y);
  const menu = page.getByRole('dialog', { name: 'Choose what to build here' });
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: `Build ${stationName} here` }).click();
  await expect(menu).toHaveCount(0);
}

test.describe('Old Apartment Terrace — rooftop loop', () => {
  test('HUD: day plaque, vitality medallion and the 7-item pouch', async ({ page }) => {
    await startFreshTerrace(page);
    await expect(page.getByLabel('Traveler clock and vitality')).toBeVisible();
    await expect(page.getByLabel('Traveler clock and vitality')).toContainText('Day 1');
    const pouch = page.getByLabel('Found Materials Pouch');
    for (const name of ['Timber', 'Cloth', 'Seeds', 'Water', 'Scrap', 'Stone', 'Food']) {
      await expect(pouch.getByLabel(new RegExp(`${name}: \\d+`))).toBeVisible();
    }
    const save = await readSave(page);
    expect(save?.chosenSite).toBe('terrace');
    expect(save?.day).toBe(1);
    const t = await terrace(page);
    /* 2 wooden crates + 1–2 cartons + 6 weeds */
    const props = Object.keys(t.spawns ?? {}).length;
    expect(props).toBeGreaterThanOrEqual(9);
    expect(props).toBeLessThanOrEqual(10);
  });

  test('search a wooden crate (stays, opened), a cardboard carton (carried off) and clear a weed patch', async ({ page }) => {
    await startFreshTerrace(page);
    const t = await terrace(page);
    const before = (await readSave(page))!.resources;

    const crate = t.spawns['crate-1'];
    await clickProp(page, crate, spawnScale(crate));
    await expect.poll(async () => (await terrace(page)).searchedBoxes, { timeout: 15_000 }).toContain('crate-1');
    const afterBox = (await readSave(page))!.resources;
    const gained = Object.keys(afterBox).some((k) => afterBox[k] > before[k]);
    expect(gained, 'searching a crate yields materials').toBe(true);
    expect((await terrace(page)).spawns['crate-1']).toEqual(crate);

    /* Every fresh run starts with at least one carton */
    const cartonId = ['cardboard-1', 'cardboard-2', 'cardboard-3'].find((id) => t.spawns[id])!;
    const carton = t.spawns[cartonId];
    await clickProp(page, carton, spawnScale(carton));
    await expect.poll(async () => (await terrace(page)).spawns[cartonId], { timeout: 15_000 }).toBeUndefined();

    const weed = t.spawns['weeds-1'];
    await clickProp(page, weed, spawnScale(weed));
    await expect.poll(async () => (await terrace(page)).clearedWeeds, { timeout: 15_000 }).toContain('weeds-1');

    /* An opened crate can't be searched twice — it just waits for an axe */
    const resources = (await readSave(page))!.resources;
    await clickProp(page, crate, spawnScale(crate));
    await page.waitForTimeout(1500);
    expect((await terrace(page)).searchedBoxes.filter((id) => id === 'crate-1')).toHaveLength(1);
    expect((await readSave(page))!.resources).toEqual(resources);
  });

  test('light the fire pit (−1 timber), then extinguish it', async ({ page }) => {
    await startFreshTerrace(page);
    const timber = (await readSave(page))!.resources.timber;
    const menu = await openFirepitMenu(page);
    await menu.getByRole('button', { name: /Light/ }).click();
    await expect.poll(async () => (await terrace(page)).fireLit, { timeout: 15_000 }).toBe(true);
    expect((await readSave(page))!.resources.timber).toBe(timber - 1);
    /* The traveler settles onto the ground before taking the next click */
    await page.waitForTimeout(1000);

    const lit = await openFirepitMenu(page);
    await expect(lit.getByRole('button', { name: /Sit/ })).toBeVisible();
    await lit.getByRole('button', { name: 'Extinguish' }).click();
    await expect.poll(async () => (await terrace(page)).fireLit, { timeout: 15_000 }).toBe(false);
  });

  test('upgrade the fire pit from its action menu', async ({ page }) => {
    await startFreshTerrace(page);
    const menu = await openFirepitMenu(page);
    await menu.getByRole('button', { name: /Upgrade to Stacked Logs/ }).click();
    await expect.poll(async () => (await terrace(page)).firepitTier, { timeout: 15_000 }).toBe(2);
  });

  test('build all four stations into slots in any order; menus shrink as stations are placed', async ({ page }) => {
    await startFreshTerrace(page);
    const order: [string, string, string][] = [
      ['slot-3', 'Needle & Thread', 'sewing'],
      ['slot-1', 'Grill Rack', 'grill'],
      ['slot-4', 'Seedling Crate', 'planter'],
      ['slot-2', 'Bucket Barrel', 'rain-barrel'],
    ];
    for (const [i, [slot, name, id]] of order.entries()) {
      const p = slotPos(slot);
      await clickStage(page, p.x, p.y);
      const menu = page.getByRole('dialog', { name: 'Choose what to build here' });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('button')).toHaveCount(4 - i);
      await menu.getByRole('button', { name: `Build ${name} here` }).click();
      await expect.poll(async () => (await terrace(page)).slotAssignments[slot], { timeout: 15_000 }).toBe(id);
    }
    const t = await terrace(page);
    expect(t).toMatchObject({ planterTier: 1, barrelTier: 1, grillTier: 1, sewingTier: 1 });

    /* A built slot now opens its station menu */
    await clickProp(page, slotPos('slot-1'), stationTierScale('grill', 1));
    const grillMenu = page.getByRole('dialog', { name: 'Grill Rack actions' });
    await expect(grillMenu).toBeVisible();
    await grillMenu.getByRole('button', { name: /Cook/ }).click();
    const cook = page.getByRole('dialog', { name: /Grill Rack/ }).last();
    await expect(cook).toBeVisible({ timeout: 15_000 });
    await cook.getByRole('button', { name: 'Close' }).click();

    await clickProp(page, slotPos('slot-3'), stationTierScale('sewing', 1));
    const sewMenu = page.getByRole('dialog', { name: 'Needle & Thread actions' });
    await expect(sewMenu).toBeVisible();
    await sewMenu.getByRole('button', { name: /Mend/ }).click();
    const mend = page.getByRole('dialog', { name: /Needle & Thread/ }).last();
    await expect(mend).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(mend).toHaveCount(0);
  });

  test('rest twice to nightfall, sleep into Day 2, then harvest the planter', async ({ page }) => {
    await startFreshTerrace(page);
    await buildInSlot(page, 'slot-1', 'Seedling Crate');
    await expect.poll(async () => (await terrace(page)).planterTier, { timeout: 15_000 }).toBe(1);

    for (const phase of ['dusk', 'night']) {
      const menu = await openShelterMenu(page);
      await menu.getByRole('button', { name: /Rest/ }).click();
      await expect.poll(async () => (await readSave(page))!.dayPhase, { timeout: 20_000 }).toBe(phase);
      await page.waitForTimeout(1200);
    }

    const night = await openShelterMenu(page);
    await night.getByRole('button', { name: /Sleep/ }).click();
    await expect.poll(async () => (await readSave(page))!.day, { timeout: 30_000 }).toBe(2);
    await expect(page.getByLabel('Traveler clock and vitality')).toContainText('Day 2', { timeout: 15_000 });
    await expect(page.getByText(/Day 2 · Morning/).first()).toBeVisible();
    expect((await readSave(page))!.dayPhase).toBe('day');
    await page.waitForTimeout(2500);

    const seeds = (await readSave(page))!.resources;
    await clickProp(page, slotPos('slot-1'), stationTierScale('planter', 1));
    const plant = page.getByRole('dialog', { name: 'Seedling Crate actions' });
    await expect(plant).toBeVisible();
    await plant.getByRole('button', { name: /Harvest/ }).click();
    await expect
      .poll(async () => {
        const r = (await readSave(page))!.resources;
        return Object.keys(r).some((k) => r[k] > seeds[k]);
      }, { timeout: 15_000 })
      .toBe(true);
  });
});
