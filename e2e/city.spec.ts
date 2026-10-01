/**
 * Milestone 8: Root City. "5 runs in a row play through with progression
 * kept": each run is sent home, the city places its Graft and chooses the
 * next expedition, and the city survives reloads.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  applyCityCommand,
  createCity,
  loadContent,
  makeCitySave,
  type CityCommand,
  type CityState,
  type Graft,
} from '../src/sim';

const content = loadContent(
  JSON.parse(readFileSync(new URL('../src/content/willow-reach.json', import.meta.url), 'utf8')),
);
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
  await expect(page.getByRole('region', { name: 'Expedition' })).toBeVisible();
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
  await expect(page.getByRole('region', { name: 'Expedition' })).toContainText(
    'Tempest 2: Bitter Nights, Thin Drafts.',
  );
  expect(errors).toEqual([]);
});
