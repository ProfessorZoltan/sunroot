/**
 * Rainforest Gardens on screen (FG4, proposals/rainforest-gardens.md): "a forest run plays to the
 * end with mouse and keyboard". A milpa burned out of the forest, a forest garden given its
 * understory from the inspector, the forest in the left panel, the banner and the season report,
 * and every season played out without errors.
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
      buildings: Record<string, { uid: string; type: string; at: Hex; layers?: unknown[] }>;
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
      layers: Object.values(s.buildings).reduce((n, b) => n + (b.layers?.length ?? 0), 0),
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

/** The legal site for `id` nearest the camp, on rainforest if asked, on screen. */
const siteFor = (page: Page, id: string, onForest = false) =>
  page.evaluate(
    ([id, onForest]) => {
      const w = (window as unknown as { sunroot: Sunroot }).sunroot;
      const s = w.store.state;
      const camp = s.buildings.b0!.at;
      const d = (a: Hex, b: Hex) =>
        (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
      const t = Object.values(s.map.tiles)
        .filter((x) => (!onForest || x.type === 'woodland') && w.canPlace(w.content, s, id, x).ok)
        .sort((a, b) => d(a, camp) - d(b, camp))[0];
      return t ? w.view.screenOf(t) : null;
    },
    [id, onForest] as const,
  );

test('a milpa and a forest garden by mouse, its understory from the inspector', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=rainforestGardens&seed=forest-mouse&visions=0&sandbox');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('rainforestGardens');
  await settle(page);
  await expect(page.locator('.forest-row')).toContainText('Forest');
  const box = (await page.locator('#map-host canvas').boundingBox())!;
  for (const [name, id] of [
    ['Milpa', 'milpa'],
    ['Forest Garden', 'forestGarden'],
  ] as const) {
    const site = await siteFor(page, id, true);
    expect(site, id).not.toBeNull();
    await page.locator('#palette button', { hasText: name }).click();
    await page.mouse.click(box.x + site!.x, box.y + site!.y);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await win(page)).types).toContain(id);
  }
  // The milpa burned the forest clear: its tile is scrub now.
  const burned = await page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const s = w.store.state;
    const b = Object.values(s.buildings).find((x) => x.type === 'milpa')!;
    return s.map.tiles[`${b.at.q},${b.at.r}`]!.type;
  });
  expect(burned).toBe('scrub');
  // On to summer: the banner says which fields the monsoon will wash.
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await win(page)).season).toBe('summer');
  await settle(page);
  await expect(page.getByRole('note', { name: 'Forecast' })).toContainText(/will lose fertility/);
  // The garden's inspector: add its understory.
  const where = await page.evaluate(() => {
    const w = (window as unknown as { sunroot: Sunroot }).sunroot;
    const g = Object.values(w.store.state.buildings).find((b) => b.type === 'forestGarden')!;
    return w.view.screenOf(g.at);
  });
  await page.mouse.click(box.x + where.x, box.y + where.y);
  const details = page.getByRole('region', { name: 'Forest Garden details' });
  await expect(details).toBeVisible();
  await details.getByRole('button', { name: /Add understory/ }).click();
  await expect.poll(async () => (await win(page)).layers).toBe(1);
  await expect(details.getByRole('group', { name: 'Layers' })).toContainText('Understory: growing');
  // Through the monsoon: the season report has the forest.
  await page.keyboard.press('Escape');
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect.poll(async () => (await win(page)).season).toBe('autumn');
  await settle(page);
  await fromMenu(page, 'Season report');
  const report = page.getByRole('dialog', { name: 'Season report' });
  await report.getByRole('tab', { name: 'Summer, year 1' }).click();
  await expect(report.getByRole('heading', { name: 'The forest' })).toBeVisible();
  await expect(report.locator('.forest-notes')).toContainText('The rain washed 1 fertility');
  expect(errors).toEqual([]);
});

test('a whole forest run, keyboard only, to the end screen', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?biome=rainforestGardens&seed=forest-keyboard');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  expect((await win(page)).contentId).toBe('rainforestGardens');

  // Fields and gardens, the estate's salvage and a workshop, houses and solar.
  const names = [
    'Milpa',
    'Salvage Yard',
    'Workshop',
    'Raised House',
    'Forest Garden',
    'Solar Canopy',
    'Composter',
    'Milpa',
    'Raised House',
    'Forest Garden',
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
  // (Its milpas may have grown into forest gardens by the end: the Milpa Cycle.)
  expect(end.types).toEqual(expect.arrayContaining(['forestGarden', 'workshop']));
  await settle(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/Score: (Seedling|Sapling|Heartwood) Graft/);
  // A visit is never saved.
  expect((await win(page)).saved).toBe(-1);
  expect(errors).toEqual([]);
});
