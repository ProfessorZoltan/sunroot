/** The in-run menu (everything but End season, Undo and Fast-forward lives there). */
import { expect, type Page } from '@playwright/test';

export async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('menu', { name: 'Menu' });
  await expect(menu).toBeVisible();
  return menu;
}

export async function fromMenu(page: Page, item: string | RegExp) {
  const menu = await openMenu(page);
  await menu.getByRole('menuitem', { name: item }).click();
}

/** Opens the run overview, runs `check` on it, then closes it. */
export async function inOverview(
  page: Page,
  check: (dialog: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  await page.getByRole('button', { name: 'Run overview' }).click();
  const dialog = page.getByRole('dialog', { name: 'Run overview' });
  await check(dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}
