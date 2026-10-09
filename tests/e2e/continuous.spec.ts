/**
 * Pose de carrelage continue (PLAN N2) : deux murs qui se suivent posés en une seule pose, hauteur carrelée mur
 * par mur, séparés en retirant un mur. Téléphone et ordinateur.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  addTool,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  shot,
  tick,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('murs 1 et 2 en une pose, hauteur par mur, puis séparés', async ({ page }, info) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Cuisine', name: 'Cuisine', size: [300, 200] });
  await addTool(page, id, 'carrelage');
  const box = (n: number) => page.getByRole('checkbox', { name: new RegExp(`^Mur ${n} `) });

  // mur 1, puis mur 2 : la fenêtre propose de continuer la pose du mur 1
  await tick(page, box(1));
  await box(2).click();
  const dialog = page.getByRole('dialog', { name: 'Carreler Cuisine, mur 2' });
  await expect(dialog.getByRole('button', { name: 'Continuer « Cuisine, mur 1 »' })).toBeVisible();
  await check(page);
  await shot(page, info, 'N2-continuer');
  await dialog.getByRole('button', { name: 'Continuer « Cuisine, mur 1 »' }).click();
  const link = page.getByRole('link', { name: 'Ouvrir Cuisine, murs 1 et 2' });
  await expect(link).toContainText(/\d+ pièces/);
  await expect(page.getByRole('link', { name: /^Ouvrir Cuisine, / })).toHaveCount(1);

  // éditeur : une surface de 5 m, hauteur carrelée réglable mur par mur
  await link.click();
  await expect(page.getByRole('application', { name: /^Plan de Cuisine, murs 1 et 2/ })).toBeVisible();
  await page
    .getByRole('button', { name: /^Cuisine/ })
    .first()
    .click();
  const surfaces = page.getByRole('dialog', { name: 'Surfaces' });
  await fillNumber(surfaces, 'Hauteur carrelée, mur 1', '120');
  await expect(surfaces.getByLabel('Hauteur carrelée, mur 2', { exact: true })).toHaveValue('250');
  await expect(surfaces.getByText(/^Mur de 500 cm × 250 cm/)).toBeVisible();
  await check(page);
  await shot(page, info, 'N2-hauteurs');
  await page.keyboard.press('Escape');

  // vue de la pièce : les deux murs dépliés, une seule pose
  await page.goto(`/#/p/${id}/m/carrelage`);
  await expect(page.getByText('300 cm, carrelé sur 120 cm')).toBeVisible();
  await page.getByRole('link', { name: 'Vue de la pièce' }).click();
  await expect(page.getByRole('link', { name: 'Ouvrir Cuisine, murs 1 et 2' })).toHaveCount(2);
  await page.goBack();

  // retirer le mur 1 : la pose reste sur le mur 2
  await box(1).click();
  await expect(page.getByRole('link', { name: /^Ouvrir Cuisine, mur 2/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Ouvrir Cuisine, / })).toHaveCount(1);
});
