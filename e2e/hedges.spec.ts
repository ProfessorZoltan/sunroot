/**
 * Hedgerows on edges on screen: the hedge tool aims at the side of a tile the
 * pointer is nearest, [ and ] turn it, a click plants a hedge (or clears one),
 * the map draws it and the tooltip says what it shelters.
 */
import { expect, test } from '@playwright/test';

const SHOTS = process.env.SUNROOT_SHOTS;
type Hex = { q: number; r: number };
type Win = {
  sunroot: {
    store: {
      state: { hedges: string[]; stores: { materials: number } };
      hover: Hex | null;
      hedgeSide: number;
      hoverEdge: { key: string; planted: boolean; problem: string | null } | null;
      selectBuilding(id: string | null): void;
      nextSite(step?: 1 | -1): void;
      clickAt(hex: Hex): void;
      hoverAt(hex: Hex | null, side?: number): void;
      setTool(t: null): void;
    };
    view: { hedgesShown: number; screenOf(h: Hex): { x: number; y: number } } | null;
  };
};

test('the hedge tool aims at a side, plants, clears, and the map draws hedges', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?sandbox&water=1');
  const canvas = page.locator('#map-host canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot?.view !== null))
    .toBe(true);

  // The hedge tool, on the first tile it can plant on.
  const start = await page.evaluate(() => {
    const st = (window as unknown as Win).sunroot.store;
    st.selectBuilding('hedgerow');
    st.nextSite(1);
    return { hover: st.hover!, edge: st.hoverEdge!, materials: st.state.stores.materials };
  });
  expect(start.edge.problem).toBeNull();

  // ] turns to the next side.
  const side0 = await page.evaluate(() => (window as unknown as Win).sunroot.store.hedgeSide);
  await page.keyboard.press(']');
  expect(await page.evaluate(() => (window as unknown as Win).sunroot.store.hedgeSide)).toBe(
    (side0 + 1) % 6,
  );

  // The pointer near a side aims at that side: here, the middle of the edge to the east.
  const box = (await canvas.boundingBox())!;
  const target = await page.evaluate((h) => {
    const v = (window as unknown as Win).sunroot.view!;
    const a = v.screenOf(h);
    const b = v.screenOf({ q: h.q + 1, r: h.r });
    return { x: (3 * a.x + b.x) / 4, y: (3 * a.y + b.y) / 4 };
  }, start.hover);
  await page.mouse.move(box.x + target.x, box.y + target.y);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.hedgeSide))
    .toBe(0);

  // A click plants it: 2 materials, drawn on the map.
  await page.mouse.click(box.x + target.x, box.y + target.y);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.state.hedges.length))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as unknown as Win).sunroot.store.state.stores.materials),
  ).toBe(start.materials - 2);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.view!.hedgesShown))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as unknown as Win).sunroot.store.hoverEdge!.planted),
  ).toBe(true);

  // The tile's tooltip says it is sheltered (with the tool put away).
  await page.evaluate(() => (window as unknown as Win).sunroot.store.setTool(null));
  await page.mouse.move(box.x + target.x - 20, box.y + target.y);
  await expect(page.locator('.map-tip')).toContainText('A hedge along 1 side');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/hedge.png` });

  // Clicking a planted edge clears it.
  await page.evaluate(() => (window as unknown as Win).sunroot.store.selectBuilding('hedgerow'));
  await page.mouse.move(box.x + target.x, box.y + target.y);
  await page.mouse.click(box.x + target.x, box.y + target.y);
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Win).sunroot.store.state.hedges.length))
    .toBe(0);
  expect(errors).toEqual([]);
});
