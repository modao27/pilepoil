/**
 * Pose de carrelage continue (PLAN N2, écran Pièce N3) : deux murs qui se suivent posés en une seule pose, hauteur
 * carrelée mur par mur, séparés en retirant un mur. Téléphone et ordinateur.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  openPose,
  openRoom,
  selectSurface,
  shot,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('murs 1 et 2 en une pose, hauteur par mur, puis séparés', async ({ page }, info) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Cuisine', name: 'Cuisine', size: [300, 200] });
  await openRoom(page, id, 'Cuisine');

  // mur 1, puis mur 2 : la fenêtre propose de continuer la pose du mur 1
  await cover(page, 'Mur 1');
  await selectSurface(page, 'Mur 2');
  await page.getByRole('button', { name: 'Revêtir : carrelage' }).click();
  const dialog = page.getByRole('dialog', { name: 'Carrelage : mur 2' });
  await expect(dialog.getByRole('button', { name: 'Continuer « Pose 1 »' })).toBeVisible();
  await check(page);
  await shot(page, info, 'N2-continuer');
  await dialog.getByRole('button', { name: 'Continuer « Pose 1 »' }).click();
  await expect(page.getByRole('button', { name: /^Mur 2 \(.*: Pose 1$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mur 1 \(.*: Pose 1$/ })).toBeVisible();

  // calepinage : une surface de 5 m, hauteur carrelée réglable mur par mur
  await openPose(page, 'Mur 1');
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

  // écran Pièce : la hauteur du mur 1 ; les résultats de la pièce montrent une pose sur les deux murs
  await openRoom(page, id, 'Cuisine');
  await selectSurface(page, 'Mur 1');
  await expect(page.getByLabel('Jusqu’à', { exact: true })).toHaveValue('120');
  await page.goto(`/#/p/${id}/r/${new URL(page.url()).hash.split('/')[4]}/resultats`);
  const poses = page.getByRole('article', { name: /^Carrelage · / });
  await expect(poses).toHaveCount(1);
  await expect(poses).toContainText('Cuisine, murs 1 et 2');

  // retirer le mur 1 : la pose reste sur le mur 2
  await openRoom(page, id, 'Cuisine');
  await selectSurface(page, 'Mur 1');
  await page.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.getByRole('button', { name: /^Mur 1 \(.*: sans revêtement$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mur 2 \(.*: Pose 1$/ })).toBeVisible();
});
