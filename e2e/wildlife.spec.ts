/**
 * Wildlife and festivals on screen (E4): holding this season's festival from
 * its card (and calling it off), its bunting on the map, and wild bees coming
 * to the meadows once Harmony reaches 20, moving on the map and listed in the
 * run overview.
 */
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SUNROOT_SHOTS;
type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: {
        turn: number;
        harmony: number;
        wildlife: string[];
        stores: { materials: number };
        buildings: Record<string, { type: string; at: Hex }>;
      };
      resolution: unknown;
      reveals: unknown[];
      selectBuilding(id: string | null): void;
      clickAt(hex: Hex): void;
      legalSites: { at: Hex }[];
    };
    view: { scenery: { animals: Record<string, number>; props: Record<string, number> } } | null;
  };
};
const win = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as Win).sunroot;
    return {
      turn: s.store.state.turn,
      harmony: s.store.state.harmony,
      wildlife: s.store.state.wildlife,
      materials: s.store.state.stores.materials,
      animals: s.view?.scenery.animals ?? {},
      props: s.view?.scenery.props ?? {},
    };
  });

test('a festival from its card, and wild bees at Harmony 20', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sandbox&water=1');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect.poll(async () => (await win(page)).props).toEqual({});

  // A building beside the camp, for the bunting to reach; then pollinator meadows to Harmony 20.
  await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    const camp = Object.values(s.state.buildings).find((b) => b.type === 'foundersCamp')!.at;
    const d = (a: Hex, b: Hex) =>
      (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
    const put = (id: string, near: boolean) => {
      s.selectBuilding(id);
      const site = s.legalSites.find((x) => !near || d(x.at, camp) === 1);
      if (site) s.clickAt(site.at);
      s.selectBuilding(null);
    };
    put('composter', true);
    for (let i = 0; i < 6 && s.state.harmony < 20; i++) put('pollinatorMeadow', false);
  });
  expect((await win(page)).harmony).toBeGreaterThanOrEqual(20);

  // Spring's festival: the Flood Fair.
  const card = page.getByRole('region', { name: 'Festival' });
  await expect(card.getByRole('heading', { name: 'Flood Fair' })).toBeVisible();
  const before = (await win(page)).materials;
  await card.getByRole('button', { name: /^Hold it/ }).click();
  await expect(card.getByRole('button', { name: 'Call off' })).toBeVisible();
  expect(before - (await win(page)).materials).toBe(5);
  await expect.poll(async () => (await win(page)).props.bunting ?? 0).toBeGreaterThan(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/festival.png` });
  // Called off, and its cost back; then held again.
  await card.getByRole('button', { name: 'Call off' }).click();
  expect((await win(page)).materials).toBe(before);
  await card.getByRole('button', { name: /^Hold it/ }).click();

  // As summer starts the bees come, and fly over their meadows.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await win(page)).turn).toBe(1);
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const s = (window as unknown as Win).sunroot.store;
      return s.resolution !== null || s.reveals.length > 0;
    });
    if (!busy) break;
    await page.keyboard.press('Escape');
  }
  await expect.poll(async () => (await win(page)).wildlife).toContain('wildBees');
  await expect.poll(async () => (await win(page)).animals.wildBees ?? 0).toBeGreaterThan(0);
  // No festival in summer.
  await expect(card).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wild-bees.png` });

  // The overview lists who lives in the valley.
  await page.getByRole('button', { name: 'Run overview' }).click();
  const wildlife = page.getByRole('dialog', { name: 'Run overview' }).getByRole('region', {
    name: 'Wildlife',
  });
  await expect(wildlife).toContainText('Wild bees · Living in the valley');
  await expect(wildlife).toContainText('Come at Harmony 40');
  expect(errors).toEqual([]);
});
