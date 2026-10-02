/**
 * A branching evolution on screen (E3): a greenhouse next to both a fish pond
 * and a heat well asks what it becomes, and the season waits for the answer.
 */
import { expect, test, type Page } from '@playwright/test';

type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: {
        turn: number;
        buildings: Record<string, { uid: string; type: string; at: Hex }>;
        evolutionOffer: { uid: string; options: string[] }[];
      };
      resolution: unknown;
      reveals: unknown[];
      selectBuilding(id: string | null): void;
      clickAt(hex: Hex): void;
      legalSites: { at: Hex }[];
    };
    view: unknown;
  };
};

async function endSeason(page: Page, turn: number) {
  await page.keyboard.press('1');
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.state.turn))
    .toBe(turn);
  for (let i = 0; i < 10; i++) {
    const busy = await page.evaluate(() => {
      const s = (window as unknown as Win).sunroot.store;
      return s.resolution !== null || s.reveals.length > 0;
    });
    if (!busy) break;
    await page.keyboard.press('Escape');
  }
}

test('a greenhouse next to a fish pond and a heat well: choose what it becomes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sandbox&water=1');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot?.view !== null))
    .toBe(true);

  // A fish pond, a greenhouse next to it, and a heat well next to the greenhouse.
  const placed = await page.evaluate(() => {
    const s = (window as unknown as Win).sunroot.store;
    const d = (a: Hex, b: Hex) =>
      (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
    const sites = (id: string) => {
      s.selectBuilding(id);
      const at = s.legalSites.map((x) => x.at);
      s.selectBuilding(null);
      return at;
    };
    const put = (id: string, at: Hex) => {
      s.selectBuilding(id);
      s.clickAt(at);
      s.selectBuilding(null);
    };
    for (const pond of sites('fishPond')) {
      const gh = sites('greenhouse').find((g) => d(g, pond) === 1);
      if (!gh) continue;
      const well = sites('heatWell').find((w) => d(w, gh) === 1 && d(w, pond) > 0);
      if (!well) continue;
      put('fishPond', pond);
      put('greenhouse', gh);
      put('heatWell', well);
      return Object.values(s.state.buildings).some((b) => b.type === 'greenhouse');
    }
    return false;
  });
  expect(placed).toBe(true);

  await endSeason(page, 1);
  const panel = page.getByRole('region', { name: 'Evolution' });
  await expect(panel).toContainText('What does the Greenhouse become?');
  await expect(panel).toContainText('Winter Garden');
  await expect(panel).toContainText('Aquaponics Hall');
  await expect(page.getByRole('button', { name: /^End / })).toBeDisabled();

  await page.keyboard.press('2');
  await expect(panel).toHaveCount(0);
  const types = await page.evaluate(() =>
    Object.values((window as unknown as Win).sunroot.store.state.buildings).map((b) => b.type),
  );
  expect(types).toContain('aquaponicsHall');
  expect(errors).toEqual([]);
});
