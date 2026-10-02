/**
 * Water on screen (EXPANSION.md, E2): the camp's channel and its water on
 * the map, laying channel tile by tile, what each tile does with water in the
 * tooltip, and where every unit went in the season report.
 */
import { expect, test, type Page } from '@playwright/test';
import { fromMenu } from './menu';

const SHOTS = process.env.SUNROOT_SHOTS;
type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: {
        turn: number;
        buildings: Record<string, { uid: string; type: string; at: Hex }>;
      };
      resolution: unknown;
      reveals: unknown[];
      hoverAt(hex: Hex | null): void;
      clickAt(hex: Hex): void;
      selectBuilding(id: string | null): void;
      legalSites: { at: Hex }[];
      waterForecast: { uses: Record<string, { short: boolean; from: string | null }> } | null;
    };
    view: { waterShown: { channels: number[][]; river: number[] } | null } | null;
  };
};

const sunroot = (page: Page) =>
  page.evaluate(() => (window as unknown as Win).sunroot !== undefined);

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

test('water: the camp channel, laying more, tooltips and the season report', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=e2e-water&water=1&visions=0&guided=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect.poll(() => sunroot(page)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view?.waterShown !== null))
    .toBe(true);

  // The camp starts with 3 tiles of channel; the left panel has a Water row.
  const channel = () =>
    page.evaluate(() =>
      Object.values((window as unknown as Win).sunroot.store.state.buildings)
        .filter((b) => b.type === 'irrigationChannel')
        .map((b) => b.at),
    );
  expect(await channel()).toHaveLength(3);
  await expect(page.locator('.water-row')).toContainText('river 12');

  // A farm beside the channel drinks from it: the water line carries 1 to it.
  const farmAt = await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    const ditch = new Set(
      Object.values(s.state.buildings)
        .filter((b) => b.type === 'irrigationChannel')
        .map((b) => `${b.at.q},${b.at.r}`),
    );
    s.selectBuilding('floodplainFarm');
    const near = (h: Hex) =>
      [
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, 0],
        [-1, 1],
        [0, 1],
      ].some(([dq, dr]) => ditch.has(`${h.q + dq!},${h.r + dr!}`));
    const site = s.legalSites.map((x) => x.at).find(near)!;
    s.clickAt(site);
    s.selectBuilding(null);
    return site;
  });
  const farm = await page.evaluate((at) => {
    const s = (window as unknown as Win).sunroot.store;
    const b = Object.values(s.state.buildings).find((x) => x.at.q === at.q && x.at.r === at.r)!;
    return s.waterForecast!.uses[b.uid];
  }, farmAt);
  expect(farm).toMatchObject({ from: 'channel', short: false });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as Win).sunroot.view!.waterShown!.channels.flat().some((u) => u > 0),
      ),
    )
    .toBe(true);

  // Hovering the farm and a tile of channel tells what each does with water.
  await page.evaluate((at) => (window as unknown as Win).sunroot.store.hoverAt(at), farmAt);
  await expect(page.locator('.map-tip')).toContainText('needs 1, gets 1 clean from the channel');
  const ditch = (await channel())[0]!;
  await page.evaluate((at) => (window as unknown as Win).sunroot.store.hoverAt(at), ditch);
  await expect(page.locator('.map-tip')).toContainText('Channel: tile 1 of 3');
  await expect(page.locator('.map-tip')).toContainText('Takes 1 from the river');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/water.png` });

  // Laying channel: the tool stays in hand, and each click digs one more tile from the end.
  const laid = await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    s.selectBuilding('irrigationChannel');
    let n = 0;
    for (let i = 0; i < 2; i++) {
      const before = Object.keys(s.state.buildings).length;
      const site = s.legalSites[0]?.at;
      if (!site) break;
      s.clickAt(site);
      if (Object.keys(s.state.buildings).length > before) n++;
    }
    s.selectBuilding(null);
    return n;
  });
  expect(laid).toBe(2);

  // The season report: where the water came from and went.
  await endSeason(page, 1);
  await fromMenu(page, 'Season report');
  const dialog = page.getByRole('dialog', { name: 'Season report' });
  await expect(dialog.getByRole('heading', { name: 'Water' })).toBeVisible();
  await expect(dialog).toContainText('The river brought 12.');
  await expect(dialog).toContainText('Every building got its water.');
  await dialog.getByRole('button', { name: /^Water: / }).focus();
  await expect(dialog.locator('.sankey-tip')).toContainText('Water');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
