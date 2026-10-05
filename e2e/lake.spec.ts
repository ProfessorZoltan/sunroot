/**
 * Lake Gardens on screen (LG4, proposals/lake-gardens.md): "a lake run plays to
 * the end with mouse and keyboard". A chinampa makes land, the lake shows in the
 * left panel, the forecast and the season report, and every season plays out
 * without errors.
 */
import { expect, test, type Page } from '@playwright/test';
import { fromMenu } from './menu';

type Hex = { q: number; r: number };
type Sunroot = {
  store: {
    state: {
      contentId: string;
      status: string;
      turn: number;
      season: string;
      buildings: Record<string, { type: string; at: Hex }>;
      map: { tiles: Record<string, Hex & { type: string }> };
    };
    resolution: unknown;
    reveals: unknown[];
  };
  view: { screenOf(h: Hex): { x: number; y: number } };
  saved: { turn: number };
  canPlace: (...a: unknown[]) => { ok: boolean };
  content: unknown;
};
const win = (page: Page) =>
  page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const s = w.store.state;
    return {
      contentId: s.contentId,
      status: s.status,
      turn: s.turn,
      season: s.season,
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

/** The legal site for `id` nearest the camp, on screen. */
const siteFor = (page: Page, id: string) =>
  page.evaluate((id) => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const s = w.store.state;
    const camp = s.buildings.b0!.at;
    const d = (a: Hex, b: Hex) =>
      (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
    const t = Object.values(s.map.tiles)
      .filter((x) => w.canPlace(w.content, s, id, x).ok)
      .sort((a, b) => d(a, camp) - d(b, camp))[0];
    return t ? w.view.screenOf(t) : null;
  }, id);

test('a chinampa and a stilt house by mouse; the lake in the panel, banner and report', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=lakeGardens&seed=lake-mouse&visions=0&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('lakeGardens');
  await settle(page);
  // The lake's row in the left panel.
  await expect(page.locator('.lake-row')).toContainText('Lake');
  const box = (await page.locator('#map-host canvas').boundingBox())!;
  for (const [name, id] of [
    ['Chinampa', 'chinampa'],
    ['Stilt House', 'stiltHouse'],
  ] as const) {
    const site = await siteFor(page, id);
    expect(site, id).not.toBeNull();
    await page.locator('#palette button', { hasText: name }).click();
    await page.mouse.click(box.x + site!.x, box.y + site!.y);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await win(page)).types).toContain(id);
  }
  // The chinampa made land: its tile is a raised bed now.
  const bed = await page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const s = w.store.state;
    const b = Object.values(s.buildings).find((x) => x.type === 'chinampa')!;
    return s.map.tiles[`${b.at.q},${b.at.r}`]!.type;
  });
  expect(bed).toBe('bed');
  // On to summer: the banner says whether the lake will bloom.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await win(page)).season).toBe('summer');
  await settle(page);
  await expect(page.getByRole('note', { name: 'Forecast' })).toContainText(/the lake will hold/);
  // The spring's season report has the lake.
  await fromMenu(page, 'Season report');
  const report = page.getByRole('dialog', { name: 'Season report' });
  await report.getByRole('tab', { name: 'Spring, year 1' }).click();
  await expect(report.getByRole('heading', { name: 'The lake' })).toBeVisible();
  await expect(report.locator('.lake-notes')).toContainText('grey water reached the lake');
  expect(errors).toEqual([]);
});

test('a whole lake run, keyboard only, to the end screen', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=lakeGardens&seed=lake-keyboard');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('lakeGardens');

  // Beds on the shallows, the drowned town's salvage and a workshop, homes, a mud boat, solar.
  const names = [
    'Chinampa',
    'Salvage Yard',
    'Workshop',
    'Chinampa',
    'Stilt House',
    'Solar Canopy',
    'Mud Boat',
    'Composter',
    'Chinampa',
    'Stilt House',
    'Solar Canopy',
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
  expect(end.types).toEqual(expect.arrayContaining(['chinampa', 'workshop']));
  await settle(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Score: (Seedling|Sapling|Heartwood) Graft/);
  // A visit is never saved.
  expect((await win(page)).saved).toBe(-1);
  expect(errors).toEqual([]);
});

test("the lake's wonder on the palette, and Flower Boats held from its card", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=lakeGardens&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect(page.locator('#palette .tool-name', { hasText: /^Floating City$/ })).toHaveCount(1);
  const card = page.getByRole('region', { name: 'Festival' });
  await expect(card.getByRole('heading', { name: 'Flower Boats' })).toBeVisible();
  await card.getByRole('button', { name: /^Hold it/ }).click();
  await expect(card.getByRole('button', { name: 'Call off' })).toBeVisible();
  expect(errors).toEqual([]);
});
