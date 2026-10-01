/**
 * Milestone 6: a discovery reveals with its stained-glass card and is filed in
 * the Almanac, which keeps it across runs.
 */
import { expect, test } from '@playwright/test';

test('a discovery unfolds as a card, and the Almanac keeps it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&sandbox&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  // A cottage beside green land: the Green Doorstep.
  await page.evaluate(() => {
    const { store, canPlace, content } = (
      window as unknown as {
        sunroot: {
          store: {
            state: { map: { tiles: Record<string, { q: number; r: number; type: string }> } };
            dispatch(c: unknown): boolean;
          };
          canPlace(c: unknown, s: unknown, id: string, h: unknown): { ok: boolean };
          content: unknown;
        };
      }
    ).sunroot;
    const tiles = Object.values(store.state.map.tiles);
    const green = (t: { q: number; r: number }) =>
      tiles.some(
        (n) =>
          ['meadow', 'woodland'].includes(n.type) &&
          Math.max(Math.abs(n.q - t.q), Math.abs(n.r - t.r), Math.abs(n.q + n.r - t.q - t.r)) === 1,
      );
    const site = tiles.find(
      (t) => t.type !== 'floodplain' && green(t) && canPlace(content, store.state, 'cottage', t).ok,
    )!;
    store.dispatch({ type: 'place', building: 'cottage', at: { q: site.q, r: site.r } });
  });
  await page.keyboard.press('e');
  await page.keyboard.press(' ');
  const card = page.getByRole('dialog', { name: 'Discovered: Green Doorstep' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Filed in the Almanac');
  // Close every card (there may be more than one), then open the Almanac.
  for (let i = 0; i < 5 && (await page.getByRole('dialog').count()) > 0; i++) {
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('a');
  const almanac = page.getByRole('dialog', { name: 'Almanac' });
  await expect(almanac.getByRole('article', { name: 'Green Doorstep' })).toContainText(
    'found this run',
  );
  await expect(almanac.getByRole('article', { name: 'Undiscovered' }).first()).toBeVisible();
  await expect(almanac.getByRole('button', { name: /Buy a hint/ }).first()).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(almanac).toBeHidden();

  // A new run: the Almanac still knows it.
  await page.goto('/?seed=another-run');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Almanac' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Almanac' }).getByRole('article', { name: 'Green Doorstep' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
