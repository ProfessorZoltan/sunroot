/**
 * The in-run layout after playtesting: the menu, the forecast banner, labelled
 * season cards, collapsible Stores and Build, the run overview, building
 * details over the map, the priority list (drag to rearrange, highlights shared
 * with the map) and the terrain highlight.
 */
import { expect, test, type Page } from '@playwright/test';
import { fromMenu, openMenu } from './menu';

const SHOTS = process.env.SUNROOT_SHOTS;
type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: { priority: string[]; buildings: Record<string, { at: Hex; type: string }> };
      rules: { byId: Record<string, { kind: string }> };
      inspected: string | null;
      terrainFocus: string | null;
      selectBuilding(id: string | null): void;
      nextSite(step?: 1 | -1): void;
      confirm(): void;
      inspect(uid: string | null): void;
      clickAt(hex: Hex): void;
    };
  };
};
const store = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    return { priority: s.state.priority, inspected: s.inspected, terrain: s.terrainFocus };
  });

test('the menu, banner, season cards, collapsing panels and the overview', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0&water=1');
  await expect(page.locator('#map-host canvas')).toBeVisible();

  // The forecast along the top of the map; energy and heat named on the season cards.
  await expect(page.getByRole('note', { name: 'Forecast' })).toContainText('Spring ends with');
  await expect(page.locator('.season.now .slot-grid')).toContainText('energy');
  await expect(page.locator('.season.now .slot-grid')).toContainText('heat');
  await expect(page.locator('[aria-label^="Spring day energy: made"]')).toBeVisible();

  // Everything else lives in the menu; the dock keeps Undo, Fast-forward and End.
  const menu = await openMenu(page);
  for (const item of ['Run overview', 'Prioritize buildings', 'Almanac', 'Fullscreen', 'New run'])
    await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  for (const name of ['Undo', 'Fast-forward', 'End spring'])
    await expect(
      page.getByRole('group', { name: 'Season controls' }).getByRole('button', { name }),
    ).toBeVisible();

  // Stores fold to the few that matter every season.
  const stores = page.getByRole('complementary', { name: 'Stores' });
  await expect(stores.getByText('Salvage')).toBeVisible();
  await stores.getByRole('button', { name: 'Fewer' }).click();
  await expect(stores.getByText('Salvage')).toBeHidden();
  for (const row of ['Materials', 'Food', 'Jobs filled', 'Water'])
    await expect(stores.getByText(row, { exact: false }).first()).toBeVisible();
  await stores.getByRole('button', { name: 'All' }).click();
  await expect(stores.getByText('Salvage')).toBeVisible();

  // Build folds away too.
  const palette = page.getByRole('group', { name: 'Buildings' });
  await expect(palette).toBeVisible();
  await page.getByRole('button', { name: 'Hide' }).click();
  await expect(palette).toBeHidden();
  await page.getByRole('button', { name: 'Show' }).click();
  await expect(palette).toBeVisible();

  // The run overview holds the goals and history.
  await page.getByRole('button', { name: 'Run overview' }).click();
  const overview = page.getByRole('dialog', { name: 'Run overview' });
  await expect(overview.getByRole('heading', { name: 'Loops' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-overview.png` });
  await page.keyboard.press('Escape');
  await expect(overview).toBeHidden();
  expect(errors).toEqual([]);
});

test('building details over the map, the priority list and the terrain highlight', async ({
  page,
}) => {
  // Long: it works through the details, the priority list and every terrain highlight.
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  // Two buildings beside the camp.
  await page.keyboard.press('1');
  for (const key of ['f', 'c']) {
    await page.keyboard.press(key);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
  }

  // A building's details open over the map, and Esc puts them away.
  await page.evaluate(() => (window as unknown as Win).sunroot.store.inspect('b0'));
  const details = page.locator('.inspector-overlay');
  await expect(details.getByRole('region', { name: "Founders' Camp details" })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();

  // Prioritize buildings: the list takes the right column; the map stays live.
  await fromMenu(page, 'Prioritize buildings');
  const panel = page.getByRole('complementary', { name: 'Prioritize buildings' });
  const rows = panel.locator('.priority-row');
  await expect(rows).toHaveCount(3);
  const before = (await store(page)).priority;
  // Drag the last building above the second.
  await rows.nth(2).dragTo(rows.nth(1));
  await expect
    .poll(async () => (await store(page)).priority)
    .toEqual([before[0], before[2], before[1]]);
  // Clicking one in the list highlights it there and on the map.
  await rows.nth(2).getByRole('button').first().click();
  const picked = (await store(page)).priority[2];
  await expect.poll(async () => (await store(page)).inspected).toBe(picked);
  await expect(rows.nth(2)).toHaveClass(/selected/);
  // Clicking one on the map highlights it in the list (no details pop up over it).
  await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    s.clickAt(s.state.buildings.b0!.at);
  });
  await expect(rows.nth(0)).toHaveClass(/selected/);
  await expect(details).toBeHidden();
  // Several at once: tick one, send it to the top; Clear lets go.
  const ticked = (await store(page)).priority;
  await rows.nth(2).getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'To the top' }).click();
  await expect
    .poll(async () => (await store(page)).priority)
    .toEqual([ticked[0], ticked[2], ticked[1]]);
  await panel.getByRole('button', { name: 'Clear' }).click();
  await expect(panel.getByRole('button', { name: 'To the top' })).toBeHidden();
  // A whole kind at once, and presets that sort the list by kind.
  const kinds = panel.getByRole('group', { name: 'Choose by kind' }).getByRole('button');
  await kinds.first().click();
  await expect(panel.locator('.priority-row.chosen')).not.toHaveCount(0);
  await panel.getByRole('button', { name: 'Clear' }).click();
  const kindAt = (i: number) =>
    page.evaluate((i) => {
      const s = (window as unknown as Win).sunroot.store;
      const uid = s.state.priority[i]!;
      return s.rules.byId[s.state.buildings[uid]!.type]!.kind;
    }, i);
  await panel.getByRole('button', { name: 'Food first' }).click();
  await expect.poll(() => kindAt(1)).toBe('food');
  // A list of its own for energy: rearranging under its tab leaves the main list as it was.
  const lists = () =>
    page.evaluate(() => {
      const s = (window as unknown as { sunroot: { store: { state: Record<string, unknown> } } })
        .sunroot.store.state;
      return {
        main: s.priority as string[],
        own: s.priorities as Record<string, string[]> | undefined,
      };
    });
  const main = (await lists()).main;
  await panel.getByRole('tab', { name: 'Energy' }).click();
  await expect(panel.getByText('It follows the main list')).toBeVisible();
  await rows.nth(2).dragTo(rows.nth(1));
  await expect.poll(async () => (await lists()).own?.energy).toEqual([main[0], main[2], main[1]]);
  expect((await lists()).main).toEqual(main);
  await panel.getByRole('button', { name: 'Use the main list' }).click();
  await expect.poll(async () => (await lists()).own).toBeUndefined();
  await panel.getByRole('tab', { name: 'Main' }).click();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/priorities.png` });
  await panel.getByRole('button', { name: 'Done' }).click();
  await expect(panel).toBeHidden();

  // Highlight a terrain: the others are dimmed on the map.
  await page.getByRole('combobox', { name: 'Highlight terrain' }).selectOption('floodplain');
  await expect.poll(async () => (await store(page)).terrain).toBe('floodplain');
  await page.getByRole('combobox', { name: 'Highlight terrain' }).selectOption('');
  await expect.poll(async () => (await store(page)).terrain).toBe(null);
  expect(errors).toEqual([]);
});

test('spreading compost many times, where it gives the most Harmony', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  type Live = { state: { harmony: number; stores: { compost: number } } };
  const live = () =>
    page.evaluate(() => {
      const s = (window as unknown as { sunroot: { store: Live } }).sunroot.store.state;
      return { harmony: s.harmony, compost: s.stores.compost };
    });
  // 20 compost: room for 10 spreads at 2 each.
  await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    (s.state as unknown as Live['state']).stores.compost = 20;
    s.selectBuilding(null);
  });
  const build = page.locator('.auto-compost');
  await build.getByRole('spinbutton', { name: 'Times to spread compost' }).fill('3');
  const before = await live();
  if (SHOTS) await build.screenshot({ path: `${SHOTS}/auto-compost.png` });
  await build.getByRole('button', { name: /Spread · 6 compost, \+\d+ Harmony/ }).click();
  await expect.poll(async () => (await live()).compost).toBe(14);
  expect((await live()).harmony).toBeGreaterThan(before.harmony);
  // One undo takes it all back (to the season's start, before the 20 put in by hand).
  await page
    .getByRole('group', { name: 'Season controls' })
    .getByRole('button', { name: 'Undo' })
    .click();
  await expect.poll(async () => (await live()).harmony).toBe(before.harmony);
  expect(errors).toEqual([]);
});

test('what would go short if the season ended now', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0&water=1');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  type Short = {
    state: { buildings: Record<string, { type: string; at: Hex }> };
    legalSites: { at: Hex }[];
    selectBuilding(id: string | null): void;
    clickAt(h: Hex): void;
    shortfalls: { uid: string; needs: string[] }[];
    inspected: string | null;
  };
  // A farm out of the channels' reach: it would go short of water.
  const farm = await page.evaluate(() => {
    const s = (window as unknown as { sunroot: { store: Short } }).sunroot.store;
    s.selectBuilding('floodplainFarm');
    for (const site of [...s.legalSites].reverse()) {
      s.clickAt(site.at);
      const short = s.shortfalls.find((x) => x.needs.includes('water'));
      if (short) return short.uid;
    }
    return null;
  });
  expect(farm).not.toBeNull();
  const picker = page.getByRole('combobox', { name: 'Highlight shortfalls' });
  await expect(picker.locator('option[value="water"]')).toHaveText(/Water \(\d+\)/);
  await picker.selectOption('water');
  const list = page.getByRole('group', { name: 'Buildings that would go short' });
  await expect(list).toContainText('Floodplain Farm');
  await expect(list).toContainText(/water/);
  await list.getByRole('button').first().click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { sunroot: { store: Short } }).sunroot.store.inspected,
      ),
    )
    .not.toBeNull();
  await picker.selectOption('');
  await expect(list).toBeHidden();
  expect(errors).toEqual([]);
});
