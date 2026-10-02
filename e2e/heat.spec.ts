/**
 * Local heat on screen (as in a Long Winter): a heat pump beside the camp
 * shows what it warms on the map, in the panels and in the season report.
 */
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SUNROOT_SHOTS;
type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: {
        turn: number;
        season: string;
        buildings: Record<string, { uid: string; type: string; at: Hex }>;
      };
      resolution: unknown;
      reveals: unknown[];
      selectBuilding(id: string | null): void;
      clickAt(hex: Hex): void;
      inspect(uid: string | null): void;
      legalSites: { at: Hex }[];
      heatForecast: unknown[] | null;
    };
    view: { heatShown: number } | null;
  };
};

async function endSeason(page: Page, turn: number) {
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.state.turn))
    .toBe(turn);
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const s = (window as unknown as Win).sunroot.store;
      return s.resolution !== null || s.reveals.length > 0;
    });
    if (!busy) break;
    await page.keyboard.press('Escape');
  }
}

test('local heat: a heat pump beside the camp and what it warms', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sandbox&heat=1');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot?.view !== null))
    .toBe(true);

  // Homes need heat only on winter nights.
  for (const turn of [1, 2, 3]) await endSeason(page, turn);
  expect(await page.evaluate(() => (window as unknown as Win).sunroot.store.state.season)).toBe(
    'winter',
  );

  // A heat pump on the legal site nearest the camp.
  const uid = await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    const camp = s.state.buildings.b0!.at;
    const d = (a: Hex, b: Hex) =>
      (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
    s.selectBuilding('heatPump');
    const near = s.legalSites.map((x) => x.at).sort((a, b) => d(a, camp) - d(b, camp))[0]!;
    s.clickAt(near);
    s.selectBuilding(null);
    return Object.values(s.state.buildings).find((b) => b.at.q === near.q && b.at.r === near.r)!
      .uid;
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Win).sunroot.store.heatForecast?.length ?? 0),
    )
    .toBeGreaterThan(0);

  // Selecting it draws its heat to the camp and says so.
  await page.evaluate((id) => (window as unknown as Win).sunroot.store.inspect(id), uid);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view!.heatShown))
    .toBeGreaterThan(0);
  await expect(page.locator('.heat-line').first()).toContainText("Founders' Camp");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/heat.png` });
  await page.evaluate(() => (window as unknown as Win).sunroot.store.inspect(null));

  // The season report says where the heat came from.
  await endSeason(page, 4);
  await page.getByRole('button', { name: 'Season report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Season report' });
  await expect(dialog.getByRole('heading', { name: 'Heat kept close' })).toBeVisible();
  await expect(dialog.locator('.heat-notes')).toContainText('Heat Pump warmed buildings near it');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
