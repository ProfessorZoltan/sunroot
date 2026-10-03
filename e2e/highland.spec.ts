/**
 * The Highland on screen (HL4, proposals/highland.md): "a Highland run plays to
 * the end with mouse and keyboard". Tiles stand at their height, and the
 * pointer finds the raised tile it is over.
 */
import { expect, test, type Page } from '@playwright/test';

type Hex = { q: number; r: number };
type Sunroot = {
  store: {
    state: {
      contentId: string;
      status: string;
      turn: number;
      buildings: Record<string, { type: string; at: Hex }>;
      map: { tiles: Record<string, Hex & { type: string; height?: number }> };
    };
    hover: Hex | null;
    resolution: unknown;
    reveals: unknown[];
  };
  view: { screenOf(h: Hex): { x: number; y: number } };
  saved: { turn: number };
};
const win = (page: Page) =>
  page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const s = w.store.state;
    return {
      contentId: s.contentId,
      status: s.status,
      turn: s.turn,
      types: Object.values(s.buildings).map((b) => b.type),
      saved: w.saved.turn,
    };
  });

async function settle(page: Page) {
  for (let i = 0; i < 12; i++) {
    const busy = await page.evaluate(() => {
      const { store } = (window as unknown as { sunroot: Sunroot }).sunroot;
      return store.resolution !== null || store.reveals.length > 0;
    });
    if (!busy) return;
    await page.keyboard.press('Escape');
  }
}

const keyOf = async (page: Page, name: string) =>
  (
    await page
      .locator('#palette button', {
        has: page.locator('.tool-name', { hasText: new RegExp(`^${name}$`) }),
      })
      .getAttribute('aria-keyshortcuts')
  )?.toLowerCase();

test('the pointer finds raised tiles, and a terrace is placed up the slope by mouse', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=highland&seed=glen-mouse&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('highland');
  await settle(page);
  // Each height, hovered at its raised centre, is the tile under the pointer.
  const box = (await page.locator('#map-host canvas').boundingBox())!;
  const picks = await page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const tiles = Object.values(w.store.state.map.tiles);
    return [0, 1, 2, 3]
      .map((h) => tiles.find((t) => (t.height ?? 0) === h))
      .filter((t) => t !== undefined)
      .map((t) => ({ at: { q: t.q, r: t.r }, screen: w.view.screenOf(t) }));
  });
  expect(picks.length).toBe(4);
  for (const { at, screen } of picks) {
    if (screen.x < 0 || screen.y < 0 || screen.x > box.width || screen.y > box.height) continue;
    await page.mouse.move(box.x + screen.x, box.y + screen.y);
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { sunroot: Sunroot }).sunroot.store.hover),
      )
      .toEqual(at);
  }
  // A terrace farm (heights 1 and 2), placed with the mouse on the first legal site.
  const site = await page.evaluate(() => {
    const w = (
      window as unknown as {
        sunroot: Sunroot & { canPlace: (...a: unknown[]) => { ok: boolean }; content: unknown };
      }
    ).sunroot;
    const s = w.store.state;
    const t = Object.values(s.map.tiles).find((x) => w.canPlace(w.content, s, 'terraceFarm', x).ok);
    return t ? w.view.screenOf(t) : null;
  });
  expect(site).not.toBeNull();
  await page.locator('#palette button', { hasText: 'Terrace Farm' }).click();
  await page.mouse.click(box.x + site!.x, box.y + site!.y);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await win(page)).types).toContain('terraceFarm');
  expect(errors).toEqual([]);
});

test('a whole Highland run, keyboard only, to the end screen', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=highland&seed=glen-keyboard');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('highland');

  // Glen farms, the mine and workshop, a hill turbine, then bothies and more farms.
  const names = [
    'Glen Farm',
    'Salvage Yard',
    'Workshop',
    'Glen Farm',
    'Composter',
    'Bothy',
    'Hill Turbine',
    'Glen Farm',
    'Bothy',
    'Terrace Farm',
  ];
  const keys = await Promise.all(names.map((n) => keyOf(page, n)));
  expect(keys.every(Boolean)).toBe(true);
  for (let season = 0; season < 48; season++) {
    const s = await win(page);
    if (s.status !== 'active') break;
    await settle(page);
    await page.keyboard.press('1'); // a charter, when one is offered at a new era
    await page.keyboard.press('1'); // the draft card
    const key = keys[season];
    if (key) {
      await page.keyboard.press(key);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('e');
    await expect.poll(async () => (await win(page)).turn).toBe(season + 1);
  }
  const end = await win(page);
  expect(['complete', 'collapsed']).toContain(end.status);
  expect(end.types).toEqual(expect.arrayContaining(['glenFarm', 'workshop']));
  await settle(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Score: (Seedling|Sapling|Heartwood) Graft/);
  // A visit is never saved.
  expect((await win(page)).saved).toBe(-1);
  expect(errors).toEqual([]);
});
