/**
 * The Sun Desert on screen (SD4, proposals/sun-desert.md): "a desert run plays
 * to the end with mouse and keyboard". Cooling shows in the tooltip and the
 * season report; the heatwave and the dust storm play out without errors.
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

test('an oasis garden and a wind tower by mouse; cooling in the tooltip and the report', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=sunDesert&seed=desert-mouse&visions=0&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('sunDesert');
  await settle(page);
  const box = (await page.locator('#map-host canvas').boundingBox())!;
  for (const [name, id] of [
    ['Oasis Garden', 'oasisGarden'],
    ['Wind Tower', 'windTower'],
  ] as const) {
    const site = await siteFor(page, id);
    expect(site, id).not.toBeNull();
    await page.locator('#palette button', { hasText: name }).click();
    await page.mouse.click(box.x + site!.x, box.y + site!.y);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await win(page)).types).toContain(id);
  }
  // On to summer, the heatwave: the camp needs cooling, and the tooltip says who pays it.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await win(page)).season).toBe('summer');
  await settle(page);
  const camp = await page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    return w.view.screenOf(w.store.state.buildings.b0!.at);
  });
  await page.mouse.move(box.x + camp.x, box.y + camp.y);
  await expect(page.locator('.map-tip .cool-line').first()).toContainText('Cooling on hot days');
  // The summer's season report has its cooling.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await win(page)).season).toBe('autumn');
  await settle(page);
  await fromMenu(page, 'Season report');
  const report = page.getByRole('dialog', { name: 'Season report' });
  await report.getByRole('tab', { name: 'Summer, year 1' }).click();
  await expect(report.getByRole('heading', { name: 'Kept cool' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a whole desert run, keyboard only, to the end screen', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=sunDesert&seed=desert-keyboard');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('sunDesert');

  // Gardens by the oasis, the old array's salvage and a workshop, houses, a cell bank.
  const names = [
    'Oasis Garden',
    'Salvage Yard',
    'Workshop',
    'Oasis Garden',
    'Mud-brick House',
    'Cell Bank',
    'Composter',
    'Oasis Garden',
    'Mud-brick House',
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
  expect(end.types).toEqual(expect.arrayContaining(['oasisGarden', 'workshop']));
  await settle(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Score: (Seedling|Sapling|Heartwood) Graft/);
  // A visit is never saved.
  expect((await win(page)).saved).toBe(-1);
  expect(errors).toEqual([]);
});

test("the desert's wonder on the palette, and the Rain Feast held from its card", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=sunDesert&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect(page.locator('#palette .tool-name', { hasText: /^Solar Oasis$/ })).toHaveCount(1);
  const card = page.getByRole('region', { name: 'Festival' });
  await expect(card.getByRole('heading', { name: 'Rain Feast' })).toBeVisible();
  await card.getByRole('button', { name: /^Hold it/ }).click();
  await expect(card.getByRole('button', { name: 'Call off' })).toBeVisible();
  expect(errors).toEqual([]);
});
