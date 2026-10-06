/**
 * Milestone 3 in a real browser: the map renders, placement previews and
 * places through the simulation's rules, undo is free, and seasons end.
 */
import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

interface Sunroot {
  store: {
    state: {
      stores: { materials: number };
      buildings: Record<string, { type: string }>;
      map: { tiles: Record<string, { q: number; r: number; type: string }> };
      season: string;
    };
    placement: { preview: { ok: boolean } } | null;
  };
  view: { screenOf(h: { q: number; r: number }): { x: number; y: number } };
}

/** Page coordinates of the first free tile matching a type. */
async function tileOf(page: Page, type: string) {
  return page.evaluate((type) => {
    const { store, view } = (window as unknown as { sunroot: Sunroot }).sunroot;
    const t = Object.values(store.state.map.tiles).find((x) => x.type === type)!;
    const rect = document.querySelector('#map-host canvas')!.getBoundingClientRect();
    const s = view.screenOf(t);
    return { x: rect.left + s.x, y: rect.top + s.y };
  }, type);
}

const read = <T>(page: Page, f: (s: Sunroot) => T) =>
  page.evaluate(`(${f.toString()})(window.sunroot)`) as Promise<T>;

test('the map renders, previews, places, undoes and ends a season', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  // The hand-made art: every tile, building, animal and festival prop the importer wrote (tiles in
  // summer and winter, buildings too, lit windows, rotors, channel and hedgerow arms), the
  // keepsakes' props and the citizens is loaded. Festival cards are WebP, for the interface only.
  await page.waitForFunction(() => 'sunroot' in window);
  const imported = ['tiles', 'buildings', 'wildlife', 'festivals', 'keepsakes', 'people', 'wonders']
    .map(
      (dir) =>
        readdirSync(new URL(`../src/art/${dir}`, import.meta.url)).filter((f) => f.endsWith('.png'))
          .length,
    )
    .reduce((a, b) => a + b, 0);
  expect(
    await page.evaluate(() => (window as unknown as { sunroot: { art: number } }).sunroot.art),
  ).toBe(imported);
  await expect(page.getByText('Choose one')).toBeVisible();

  // The canvas has actually drawn the valley (not a blank paper colour).
  const colours = await page.locator('#map-host canvas').screenshot();
  expect(colours.byteLength).toBeGreaterThan(20_000);

  await page.getByRole('button', { name: /^Blueprint Orchard/ }).click();
  await page
    .locator('.palette')
    .getByRole('button', { name: /Floodplain Farm/ })
    .click();
  const field = await tileOf(page, 'floodplain');
  await page.mouse.move(field.x, field.y);
  await expect(page.locator('.panel').getByText('Floodplain Farm')).toBeVisible();
  expect(await read(page, (s) => s.store.placement?.preview.ok)).toBe(true);

  await page.mouse.click(field.x, field.y);
  expect(await read(page, (s) => s.store.state.stores.materials)).toBe(17);

  // Not on the river: the preview says why.
  const river = await tileOf(page, 'river');
  await page.mouse.move(river.x, river.y);
  await expect(page.locator('.panel.invalid')).toContainText("can't be built on river");

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  expect(await read(page, (s) => s.store.state.stores.materials)).toBe(20);

  await page.getByRole('button', { name: 'End spring' }).click();
  await page.getByRole('button', { name: /^Skip/ }).last().click();
  await expect(page.getByRole('button', { name: 'End summer' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sandbox: every building is on the palette', async ({ page }) => {
  await page.goto('/?seed=gallery&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  // 25 buildings, the Cider Press, the Bothy, the Mud Boat and the Forest Garden (Root City
  // cards), plus the compost tool.
  await expect(page.locator('.palette .tool')).toHaveCount(30);
});
