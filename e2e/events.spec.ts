/**
 * Asked for in playtesting: every tile a building can go on is highlighted
 * while placing; the map marks the coming event's reach and the effects that
 * last; each event plays out on the tiles it touches; and small life moves
 * about the valley.
 */
import { expect, test, type Page } from '@playwright/test';

interface Store {
  resolution: { phase: string } | null;
  reveals: unknown[];
  dismissReveal(): void;
  legalSites: { at: { q: number; r: number }; risky: boolean }[];
  marks: { kind: string; coming: boolean; at: { q: number; r: number } }[];
  selectBuilding(b: string | null): void;
  dispatch(c: unknown): boolean;
}
interface Sunroot {
  store: Store;
  view: { scenery: Record<string, number | string | boolean> };
}

const sunroot = <T>(page: Page, f: (s: Sunroot) => T) => page.evaluate(f as never) as Promise<T>;

test('legal tiles, event reach, the flood played out, and life about the valley', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=willow-reach-golden&visions=0&sandbox&guided=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();

  // Choosing a building highlights every tile it can go on.
  await page
    .getByRole('button', { name: /^Workshop/ })
    .first()
    .click();
  const sites = await sunroot(page, () =>
    (window as unknown as { sunroot: Sunroot }).sunroot.store.legalSites.map((s) => s.risky),
  );
  expect(sites.length).toBeGreaterThan(10);
  expect(sites.some(Boolean)).toBe(true); // floodplain, where the flood would damage it
  await page.keyboard.press('Escape');

  // Build a little: a levee and farms on the floodplain, a pollinator meadow and an apiary.
  const placed = await sunroot(page, () => {
    const s = (window as unknown as { sunroot: Sunroot }).sunroot.store;
    const out: string[] = [];
    for (const [b, risky] of [
      ['levee', null],
      ['workshop', true],
      ['pollinatorMeadow', false],
      ['apiary', false],
      ['cottage', false],
    ] as const) {
      s.selectBuilding(b);
      const site = s.legalSites.find((x) => risky === null || x.risky === risky);
      if (site && s.dispatch({ type: 'place', building: b, at: site.at })) out.push(b);
    }
    // A farm where the flood will reach, to be silted.
    s.selectBuilding('floodplainFarm');
    const wet = new Set(
      s.marks.filter((m) => m.kind === 'flood').map((m) => `${m.at.q},${m.at.r}`),
    );
    const farm = s.legalSites.find((x) => wet.has(`${x.at.q},${x.at.r}`));
    if (farm && s.dispatch({ type: 'place', building: 'floodplainFarm', at: farm.at }))
      out.push('floodplainFarm');
    s.selectBuilding(null);
    return out;
  });
  expect(placed).toHaveLength(6);

  // The map marks how far the coming flood reaches.
  const marks = await sunroot(
    page,
    () => (window as unknown as { sunroot: Sunroot }).sunroot.store.marks,
  );
  expect(marks.some((m) => m.kind === 'flood' && m.coming)).toBe(true);
  await expect(page.getByText(/\d+ tiles will flood/)).toBeVisible();

  // Life about the valley: butterflies over the meadow, bees at the apiary, petals in spring.
  const scenery = await sunroot(
    page,
    () => (window as unknown as { sunroot: Sunroot }).sunroot.view.scenery,
  );
  expect(scenery).toMatchObject({ season: 'spring', bees: 3, falling: 'petal' });
  expect(scenery.butterflies).toBeGreaterThanOrEqual(2);

  // The flood plays out, then the season's lasting effects are marked.
  await page.keyboard.press('1'); // the season's draft
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /End spring/ }).click();
  await expect(page.getByRole('status', { name: 'The season is resolving' })).toBeVisible();
  await expect
    .poll(
      () =>
        sunroot(page, () => (window as unknown as { sunroot: Sunroot }).sunroot.store.resolution),
      { timeout: 10_000 },
    )
    .toBeNull();
  const after = await sunroot(page, () =>
    (window as unknown as { sunroot: Sunroot }).sunroot.store.marks.filter((m) => !m.coming),
  );
  expect(after.some((m) => m.kind === 'silt')).toBe(true);
  expect(errors).toEqual([]);
});
