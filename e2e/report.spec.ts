/**
 * Playtest requests: the season report (what each resource was made and used
 * by, for the last of each season) and demolishing a building.
 */
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SUNROOT_SHOTS;
type Win = {
  sunroot: {
    store: {
      state: {
        turn: number;
        buildings: Record<string, { type: string; at: { q: number; r: number } }>;
        map: { tiles: Record<string, { type: string }> };
        stores: Record<string, number>;
      };
      resolution: unknown;
      reveals: unknown[];
      inspect(uid: string | null): void;
    };
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

test('the season report shows what made and used each resource', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  const button = page.getByRole('button', { name: 'Season report' });
  await expect(button).toBeDisabled();
  // Spring: a farm, then end the season.
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await endSeason(page, 1);
  await endSeason(page, 2);

  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Season report' });
  await expect(dialog.getByRole('tab')).toHaveCount(2);
  await expect(dialog.getByRole('tab', { name: 'Summer, year 1' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(dialog).toContainText('Citizens eat');
  // The Sankey: a node per source, resource and use; focusing one shows its numbers.
  const sankey = dialog.getByRole('img', { name: /Where each resource came from and went/ });
  await expect(sankey).toBeVisible();
  await dialog.getByRole('button', { name: /^Food: / }).focus();
  await expect(dialog.locator('.sankey-tip')).toContainText('Food made and used');
  await expect(dialog).toContainText('Floodplain Farm');
  await dialog.getByRole('tab', { name: 'Spring, year 1' }).click();
  await expect(dialog).toContainText('Building: Floodplain Farm');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/season-report.png` });
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // The year strip links each past season to its report.
  await page.getByRole('button', { name: 'Report for the last spring' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Season report' })
      .getByRole('tab', { name: 'Spring, year 1' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('a building can be demolished from the inspector, or with Delete', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('c');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  const ids = () =>
    page.evaluate(() =>
      Object.entries((window as unknown as Win).sunroot.store.state.buildings)
        .filter(([, b]) => b.type !== 'foundersCamp')
        .map(([uid, b]) => [uid, b.type] as const),
    );
  const built = await ids();
  const farm = built[0]![0];
  const composter = built[1]![0];
  await page.evaluate((uid) => (window as unknown as Win).sunroot.store.inspect(uid), farm);
  const details = page.getByRole('region', { name: 'Floodplain Farm details' });
  await expect(details).toContainText('2 day energy this season, leaves 1 clutter');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/demolish.png` });
  await details.getByRole('button', { name: 'Demolish' }).click();
  await expect.poll(async () => (await ids()).map(([, t]) => t)).toEqual(['composter']);
  // Delete demolishes what the inspector shows.
  await page.evaluate((uid) => (window as unknown as Win).sunroot.store.inspect(uid), composter);
  await expect(page.getByRole('region', { name: 'Composter details' })).toBeVisible();
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await ids()).length).toBe(0);
  // Undo brings it back.
  await page.keyboard.press('z');
  await expect.poll(async () => (await ids()).length).toBe(1);
  expect(errors).toEqual([]);
});
