/**
 * The Energy mix chart: opened from the year strip, it stacks the year's energy
 * by kind of source, by day and by night, with a tooltip, a table and Esc to close.
 */
import { expect, test } from '@playwright/test';

const SHOTS = process.env.SUNROOT_SHOTS;

test('the energy mix: the year by kind of source, hover, table and close', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=mix&sandbox&visions=0');
  await expect(page.locator('#map-host canvas')).toBeVisible();
  // A solar canopy, a wind spire and a river wheel beside the camp, for a mix.
  await page.evaluate(() => {
    const w = (
      window as unknown as {
        sunroot: {
          store: {
            state: { map: { tiles: Record<string, { q: number; r: number }> } };
            dispatch(c: unknown): boolean;
          };
          canPlace: (...a: unknown[]) => { ok: boolean };
          content: unknown;
        };
      }
    ).sunroot;
    for (const id of ['solarCanopy', 'windSpire', 'riverWheel']) {
      const s = w.store.state;
      const t = Object.values(s.map.tiles).find((x) => w.canPlace(w.content, s, id, x).ok);
      if (t) w.store.dispatch({ type: 'place', building: id, at: { q: t.q, r: t.r } });
    }
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Energy mix this year' }).click();
  const dialog = page.getByRole('dialog', { name: 'Energy mix this year' });
  await expect(dialog).toBeVisible();
  const legend = dialog.getByRole('list', { name: 'Kinds of source' });
  await expect(legend).toContainText("Founders' Camp");
  await expect(legend).toContainText('Sun');
  await expect(legend).toContainText('Needed');
  // Hovering a slot reads out its mix.
  const chart = dialog.locator('svg[role="img"]');
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  const tip = dialog.getByRole('status');
  await expect(tip).toContainText(/Spring|Summer/);
  await expect(tip).toContainText('needed');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/energy-mix.png` });
  // The same numbers as a table.
  await dialog.getByRole('button', { name: 'Show table' }).click();
  await expect(dialog.locator('table.mix-table tbody tr')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});
