/**
 * Walks to work on screen (C2): a workplace far from any home shows its walk
 * on the map, in the panels and in the season report, and costs wellbeing.
 */
import { expect, test, type Page } from '@playwright/test';
import { fromMenu } from './menu';

const SHOTS = process.env.SUNROOT_SHOTS;
type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: { turn: number; buildings: Record<string, { uid: string; type: string; at: Hex }> };
      resolution: unknown;
      reveals: unknown[];
      selectBuilding(id: string | null): void;
      clickAt(hex: Hex): void;
      inspect(uid: string | null): void;
      legalSites: { at: Hex }[];
      commuteForecast: { excess: number; wellbeing: number } | null;
    };
    view: { walksShown: number } | null;
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

test('walks to work: a far workshop, its walk and what it costs', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-walks&commute=1&visions=0&guided=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot?.view !== null))
    .toBe(true);
  await expect(page.locator('.walks-row')).toContainText('short');

  // A workshop on the legal site furthest from the camp.
  const uid = await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    const camp = s.state.buildings.b0!.at;
    const d = (a: Hex, b: Hex) =>
      (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
    s.selectBuilding('workshop');
    const far = s.legalSites.map((x) => x.at).sort((a, b) => d(b, camp) - d(a, camp))[0]!;
    s.clickAt(far);
    s.selectBuilding(null);
    return Object.values(s.state.buildings).find((b) => b.at.q === far.q && b.at.r === far.r)!.uid;
  });
  const cost = await page.evaluate(
    () => (window as unknown as Win).sunroot.store.commuteForecast!.wellbeing,
  );
  expect(cost).toBeLessThan(0);
  await expect(page.locator('.walks-row')).toContainText(`−${-cost} wellbeing`);

  // Selecting it draws its walk and says where its worker comes from.
  await page.evaluate((id) => (window as unknown as Win).sunroot.store.inspect(id), uid);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view!.walksShown))
    .toBe(1);
  await expect(page.locator('.walk-line').first()).toContainText(
    "its worker comes from the Founders' Camp",
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/walks.png` });
  await page.evaluate(() => (window as unknown as Win).sunroot.store.inspect(null));

  // The season report says what the walks cost.
  await endSeason(page, 1);
  await fromMenu(page, 'Season report');
  const dialog = page.getByRole('dialog', { name: 'Season report' });
  await expect(dialog.getByRole('heading', { name: 'Walks to work' })).toBeVisible();
  await expect(dialog).toContainText('walked further than the free 2 tiles');
  await expect(dialog).toContainText('long walks to work');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
