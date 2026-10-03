/**
 * Milestone 8: Root City. "5 runs in a row play through with progression
 * kept": each run is sent home, the city places its Graft and chooses the
 * next expedition, and the city survives reloads.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { inOverview } from './menu';
import {
  applyCityCommand,
  createCity,
  loadContent,
  makeCitySave,
  type CityCommand,
  type CityState,
  type Graft,
} from '../src/sim';
import { withWorld } from '../src/sim/content/load';

const json = (file: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/content/${file}`, import.meta.url), 'utf8'));
// Willow Reach with Root City's shared parts, as the game loads it (src/content/index.ts).
const content = loadContent(withWorld(json('root-city.json'), json('willow-reach.json')));
const SHOTS = process.env.SUNROOT_SHOTS;

const graft = (district: string, tier = 'seedling'): Graft => ({
  district,
  tier,
  score: 300,
  seeds: 31,
  seed: 'earlier',
  vision: null,
  visionAchieved: false,
  sentAt: '2026-10-01T00:00:00Z',
});

function city(commands: CityCommand[]): CityState {
  let c = createCity(content, 'e2e-city');
  for (const command of commands) {
    const r = applyCityCommand(content, c, command);
    if (!r.ok) throw new Error(r.error);
    c = r.city;
  }
  return c;
}

/** Writes a city save into the browser's IndexedDB, as the game would. */
async function seedCity(page: Page, c: CityState) {
  await page.goto('/?sandbox');
  await page.evaluate(
    (save) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('sunroot', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('saves');
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(save, 'city');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    makeCitySave(c, '2026-10-01T00:00:00Z'),
  );
}

type Win = {
  sunroot: {
    city(): CityState;
    savedCity: { runs: number };
    store?: {
      state: {
        status: string;
        turn: number;
        contentId: string;
        options: Record<string, unknown>;
        draft: { offer: string[]; picked: string | null };
        visionOffer: string[];
        charterOffer: string[];
      };
      resolution: unknown;
      reveals: { kind: string }[];
      dispatch(c: unknown): boolean;
      finishResolution(): void;
      dismissReveal(): void;
    };
  };
};

const cityNow = (page: Page) => page.evaluate(() => (window as unknown as Win).sunroot.city());

test('Root City: place the Graft, find a landmark, raise a district, choose an expedition', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // An Orchard Ward in the city, a Millrace Quarter waiting, and Seeds to spend.
  await seedCity(
    page,
    city([
      { type: 'sendHome', result: { graft: graft('orchardWard'), earned: 40, spent: 35 } },
      { type: 'place', slot: 0 },
      { type: 'sendHome', result: { graft: graft('millraceQuarter'), earned: 45, spent: 35 } },
    ]),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const placing = page.getByRole('region', { name: 'Place the Graft' });
  await expect(placing).toContainText('Millrace Quarter, Seedling');
  // Choosing an expedition waits until the Graft is placed.
  await expect(page.getByRole('region', { name: 'Next expedition' })).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/city-placing.png` });

  // Next to the Orchard Ward (slot 1): the Cider Mill.
  await page.getByRole('button', { name: 'Slot 2: empty (place here)' }).click();
  const reveal = page.getByRole('dialog', { name: 'Landmark discovered: Cider Mill' });
  await expect(reveal).toBeVisible();
  await expect(reveal.getByRole('button', { name: 'Continue' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(reveal).toBeHidden();

  // Raise it to Sapling: 15 of the 15 Seeds.
  await page.getByRole('button', { name: 'Raise to Sapling for 15 Seeds' }).click();
  await expect(
    page.getByRole('button', { name: /Slot 2: Millrace Quarter, Sapling/ }),
  ).toBeVisible();
  await expect.poll(async () => (await cityNow(page)).seeds).toBe(0);

  // Three expeditions; choose one and set out.
  const next = page.getByRole('region', { name: 'Next expedition' });
  const options = next.locator('.card.expedition');
  await expect(options).toHaveCount(3);
  // Each is a valley region with a twist, its map drawn on the card.
  for (let i = 0; i < 3; i++) {
    await expect(options.nth(i).locator('.card-kind')).toContainText(/Willow Reach · \S/);
    await expect(options.nth(i).locator('.region-thumb')).toBeVisible();
  }
  await expect(next.getByRole('button', { name: 'Choose an expedition first' })).toBeDisabled();
  await options.nth(1).click();
  await expect(next.getByRole('button', { pressed: true })).toHaveCount(1);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/city-expedition.png` });
  const chosen = (await cityNow(page)).expedition!;
  await next.getByRole('button', { name: 'Set out on run 3' }).click();

  // The run begins with its start card: the twist, the city's gifts, and charters joining.
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toBeVisible();
  await expect(start).toContainText('Millrace Quarter (Sapling): River wheels cost 4');
  await expect(start).toContainText('Cider Mill');
  await expect(start).toContainText('New this run: charters');
  const region = content.regions.find((r) => r.id === chosen.region)!;
  await expect(start).toContainText(`${region.name}: ${region.text}`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/run-start.png` });
  const options3 = await page.evaluate(
    () => (window as unknown as Win).sunroot.store!.state.options,
  );
  expect(options3).toMatchObject({
    seed: chosen.seed,
    guided: false,
    tunings: true,
    charters: true,
    visions: false,
    city: {
      districts: { orchardWard: 'seedling', millraceQuarter: 'sapling' },
      landmarks: ['ciderMill'],
    },
    expedition: { twist: chosen.twist, request: chosen.request, region: chosen.region },
  });
  await page.keyboard.press('Enter');
  await inOverview(page, (d) =>
    expect(d.getByRole('region', { name: 'Expedition' })).toBeVisible(),
  );
  expect(errors).toEqual([]);
});

/** Plays the run in the page to its end, quickly: no building, so it ends early. */
async function playToEnd(page: Page) {
  await page.waitForFunction(() => (window as unknown as Win).sunroot?.store !== undefined);
  await page.evaluate(() => {
    const store = (window as unknown as Win).sunroot.store!;
    for (let guard = 0; guard < 60 && store.state.status === 'active'; guard++) {
      while (store.reveals.length > 0) store.dismissReveal();
      const s = store.state;
      if (s.visionOffer.length > 0)
        store.dispatch({ type: 'pickVision', vision: s.visionOffer[0] });
      if (s.charterOffer.length > 0)
        store.dispatch({ type: 'pickCharter', charter: s.charterOffer[0] });
      if (s.draft.offer.length > 0 && !s.draft.picked)
        store.dispatch({ type: 'pickCard', card: store.state.draft.offer[0] });
      store.dispatch({ type: 'endSeason' });
      store.finishResolution();
    }
    while (store.reveals.length > 0) store.dismissReveal();
  });
}

test('5 runs in a row, with Root City kept between them', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  for (let run = 1; run <= 5; run++) {
    // A new player goes straight into run 1; later runs set out from Root City.
    if (run > 1) {
      await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
      const waiting = page.getByRole('region', { name: 'Place the Graft' });
      if (await waiting.isVisible()) {
        await page
          .getByRole('button', { name: /\(place here\)/ })
          .first()
          .click();
        const card = page.getByRole('dialog');
        if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
      }
      const next = page.getByRole('region', { name: 'Next expedition' });
      await next.locator('.card.expedition').first().click();
      await next.getByRole('button', { name: `Set out on run ${run}` }).click();
    }
    // A new page for each run: give it time to load on a busy machine. A page error (a run that
    // can't start) shows in the message.
    await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
      timeout: 15_000,
    });
    await playToEnd(page);
    const dialog = page.getByRole('dialog', { name: 'The run has ended' });
    await expect(dialog).toBeVisible();
    const plant = dialog.locator('.card.graft').first();
    if (await plant.isVisible()) await plant.click();
    else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
    await expect(dialog.getByRole('status')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
      .toBe(run);
    await dialog.getByRole('button', { name: 'Go to Root City' }).click();
  }
  // A reload: Root City is still there, with all 5 runs and what they planted.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(5);
  expect(c.grafts.length).toBeGreaterThan(0);
  expect(c.districts.length + c.pending.length).toBe(c.grafts.length);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/city-after-5.png` });
  expect(errors).toEqual([]);
});

test('runs 5 and 6: the coast opens, a coast run plays and resumes, then back to the Reach', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city four runs in, its next expedition still to choose.
  await seedCity(page, { ...city([]), runs: 4, seeds: 3 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const coast = next.locator('.card.expedition', { hasText: 'Windswept Coast' });
  await expect(coast.first()).toBeVisible();
  await expect(next.locator('.card.expedition', { hasText: 'Willow Reach' }).first()).toBeVisible();
  await coast.first().click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'windsweptCoast' });
  await next.getByRole('button', { name: 'Set out on run 5' }).click();

  // Run 5 on the coast: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: the Windswept Coast');
  expect(await contentId()).toBe('windsweptCoast');
  await page.keyboard.press('Enter');
  // A reload resumes the coast run.
  await page.evaluate(() => {
    const store = (window as unknown as Win).sunroot.store!;
    const s = store.state;
    if (s.visionOffer.length > 0) store.dispatch({ type: 'pickVision', vision: s.visionOffer[0] });
    if (s.charterOffer.length > 0)
      store.dispatch({ type: 'pickCharter', charter: s.charterOffer[0] });
    if (s.draft.offer.length > 0) store.dispatch({ type: 'pickCard', card: s.draft.offer[0] });
    store.dispatch({ type: 'endSeason' });
    store.finishResolution();
  });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store!.state.turn))
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { sunroot: { saved: { turn: number } } }).sunroot.saved.turn,
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('windsweptCoast');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(5);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Run 6 back in the Reach, with the coast run counted.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(5);
  expect((c as CityState).biomeRuns).toEqual({ windsweptCoast: 1 });
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  await next.locator('.card.expedition', { hasText: 'Willow Reach' }).first().click();
  await next.getByRole('button', { name: 'Set out on run 6' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('willowReach');
  expect(errors).toEqual([]);
});

test('the Highland opens with the fourth district: a run there, then on to the coast', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const contentId = () =>
    page.evaluate(() => (window as unknown as Win).sunroot.store!.state.contentId);
  // A city four runs in, with four districts standing.
  const four = city(
    ['orchardWard', 'millraceQuarter', 'mendedCommons', 'foundryDistrict'].flatMap((d, slot) => [
      { type: 'sendHome', result: { graft: graft(d), earned: 40, spent: 35 } } as CityCommand,
      { type: 'place', slot } as CityCommand,
    ]),
  );
  expect(four.districts).toHaveLength(4);
  await seedCity(page, { ...four, runs: 4 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const next = page.getByRole('region', { name: 'Next expedition' });
  const glen = next.locator('.card.expedition', { hasText: 'Highland' });
  await expect(glen.first()).toBeVisible();
  await glen.first().click();
  expect((await cityNow(page)).expedition).toMatchObject({ biome: 'highland' });
  await next.getByRole('button', { name: 'Set out on run 5' }).click();

  // Run 5 in the glen: guided, and told what is new there.
  await expect(page.locator('#map-host canvas'), errors.join('\n')).toBeVisible({
    timeout: 15_000,
  });
  const start = page.getByRole('dialog', { name: /Expedition: |A new Sprout/ });
  await expect(start).toContainText('New: the Highland');
  expect(await contentId()).toBe('highland');
  await page.keyboard.press('Enter');
  await playToEnd(page);
  const dialog = page.getByRole('dialog', { name: 'The run has ended' });
  await expect(dialog).toBeVisible();
  const plant = dialog.locator('.card.graft').first();
  if (await plant.isVisible()) await plant.click();
  else await dialog.getByRole('button', { name: 'Bank the Seeds' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.savedCity.runs))
    .toBe(5);
  await dialog.getByRole('button', { name: 'Go to Root City' }).click();

  // Back in Root City: the glen run counted, the districts kept; run 6 sets out for the coast.
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  const c = await cityNow(page);
  expect(c.runs).toBe(5);
  expect((c as CityState).biomeRuns).toEqual({ highland: 1 });
  expect(c.districts.length).toBeGreaterThanOrEqual(4);
  const waiting = page.getByRole('region', { name: 'Place the Graft' });
  if (await waiting.isVisible()) {
    await page
      .getByRole('button', { name: /\(place here\)/ })
      .first()
      .click();
    const card = page.getByRole('dialog');
    if (await card.isVisible()) await card.getByRole('button', { name: 'Continue' }).click();
  }
  await next.locator('.card.expedition', { hasText: 'Windswept Coast' }).first().click();
  await next.getByRole('button', { name: 'Set out on run 6' }).click();
  await expect(page.locator('#map-host canvas')).toBeVisible({ timeout: 15_000 });
  expect(await contentId()).toBe('windsweptCoast');
  expect(errors).toEqual([]);
});

test('Tempest: chosen in Root City, played in the run, its mark on the district', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // A Heartwood Graft at Tempest 1 placed (with its mark), and Tempest 2 unlocked.
  const c = city([
    {
      type: 'sendHome',
      result: {
        graft: { ...graft('orchardWard', 'heartwood'), tempest: 1 },
        earned: 40,
        spent: 35,
        tier: 'heartwood',
        tempest: 1,
      },
    },
    { type: 'place', slot: 0 },
  ]);
  expect(c.tempestUnlocked).toBe(2);
  await seedCity(page, c);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Slot 1: Orchard Ward, Heartwood, Tempest 1/ }),
  ).toBeVisible();
  await expect(page.getByLabel('Tempest', { exact: true })).toContainText('2 of 10 unlocked');
  const next = page.getByRole('region', { name: 'Next expedition' });
  await next.getByRole('radio', { name: '2' }).check();
  await expect(next).toContainText('Tempest 2: +4 Seeds');
  await expect(next).toContainText('Thin Drafts');
  expect((await cityNow(page)).tempest).toBe(2);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tempest-city.png` });
  await next.locator('.card.expedition').first().click();
  await next.getByRole('button', { name: 'Set out on run 2' }).click();
  const start = page.getByRole('dialog', { name: /Expedition: / });
  await expect(start).toContainText('Tempest 2: Bitter Nights');
  await page.keyboard.press('Enter');
  await inOverview(page, (d) =>
    expect(d.getByRole('region', { name: 'Expedition' })).toContainText(
      'Tempest 2: Bitter Nights, Thin Drafts.',
    ),
  );
  expect(errors).toEqual([]);
});

test('Start over forgets Root City and begins again at run 1', async ({ page }) => {
  await seedCity(
    page,
    city([
      { type: 'sendHome', result: { graft: graft('orchardWard'), earned: 40, spent: 35 } },
      { type: 'place', slot: 0 },
      { type: 'sendHome', result: { graft: graft('millraceQuarter'), earned: 45, spent: 35 } },
    ]),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Root City' })).toBeVisible();
  await page.getByRole('button', { name: 'Start over' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start over?' });
  await expect(dialog).toContainText('2 runs sent home, 1 district and 15 Seeds');
  // Cancelling keeps the city.
  await expect(dialog.getByRole('button', { name: 'Keep my city' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect((await cityNow(page)).runs).toBe(2);

  await page.getByRole('button', { name: 'Start over' }).click();
  await dialog.getByRole('button', { name: 'Start over' }).click();
  // Run 1 begins, guided, and the new city has sent nothing home.
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store?.state.options))
    .toMatchObject({ guided: true });
  await expect.poll(() => cityNow(page).then((c) => c.runs)).toBe(0);
});
