/** Cloisons de hauteur propre (N3) : une cloison basse qui traverse sépare, un muret qui ne traverse pas est un obstacle. */
import { expect, test, type Page } from '@playwright/test';
import {
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  shot,
} from './helpers';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

/** Trace une cloison entre deux points (fractions du sol de la pièce), garde le nom proposé s'il est demandé. */
async function trace(page: Page, from: [number, number], to: [number, number]) {
  await panel(page).getByRole('radio', { name: 'Travaux' }).click();
  await panel(page).getByRole('button', { name: 'Tracer une cloison' }).click();
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  const at = (f: [number, number]) => page.mouse.click(box.x + box.width * f[0], box.y + box.height * f[1]);
  await at(from);
  await at(to);
  const naming = page.getByRole('dialog', { name: 'Nommer la nouvelle pièce' });
  if (await naming.isVisible({ timeout: 1500 }).catch(() => false))
    await naming.getByRole('button', { name: 'Garder les noms proposés' }).click();
}

test('cloison basse qui traverse la pièce : elle la sépare, ses faces sont basses', async ({ page }, info) => {
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [600, 400] });
  await trace(page, [0.5, 0.002], [0.5, 0.998]);
  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await fillNumber(p, 'Hauteur de la cloison', '90');
  await expect(p.getByLabel('Hauteur de la cloison', { exact: true })).toHaveValue('90');
  await expect(p.getByText('elle la sépare tout de même')).toBeVisible();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '75-cloison-basse');

  // maquette 3D : la cloison s'arrête à 90 cm
  await page.waitForTimeout(600);
  await page.goto(`/#/p/${id}/3d`);
  await expect(page.locator('[data-draw-calls]')).not.toHaveAttribute('data-draw-calls', '0', { timeout: 20_000 });
  await page.waitForTimeout(800);
  await shot(page, info, '77-cloison-basse-3d');
});

test('muret qui ne traverse pas : un obstacle, une seule pièce', async ({ page }, info) => {
  await createProject(page, { project: 'Maison', name: 'Séjour', size: [600, 400] });
  await trace(page, [0.5, 0.002], [0.5, 0.5]);
  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  // pleine hauteur : un renfoncement dans le contour, toujours une seule pièce
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
  await expect(p.getByTestId('muret')).toHaveCount(0);
  // basse : un obstacle, dit en clair
  await fillNumber(p, 'Hauteur de la cloison', '90');
  await expect(p.getByTestId('muret')).toBeVisible();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();
  await expect(page.locator('polygon.obstacle')).toHaveCount(1);
  await shot(page, info, '76-muret');
  // remise jusqu'au plafond : le renfoncement revient
  await p.getByRole('button', { name: 'Remettre jusqu’au plafond' }).click();
  await expect(p.getByTestId('muret')).toHaveCount(0);
  await expect(page.locator('polygon.obstacle')).toHaveCount(0);
});

test('muret en 3D : un petit volume bas, la pièce reste ouverte', async ({ page }, info) => {
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [600, 400] });
  await trace(page, [0.5, 0.002], [0.5, 0.5]);
  await fillNumber(panel(page), 'Hauteur de la cloison', '90');
  await expect(panel(page).getByTestId('muret')).toBeVisible();
  await page.waitForTimeout(600);
  await page.goto(`/#/p/${id}/3d`);
  await expect(page.locator('[data-draw-calls]')).not.toHaveAttribute('data-draw-calls', '0', { timeout: 20_000 });
  await page.waitForTimeout(800);
  await shot(page, info, '78-muret-3d');
});
