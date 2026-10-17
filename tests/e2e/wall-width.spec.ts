/** Carreler une partie seulement de la largeur d'un mur (PLAN N1). */
import { expect, test } from '@playwright/test';
import { addTile, cover, createProject, fillNumber, openPose, openRoom, selectSurface } from './helpers';

test('mur : une largeur de 120 cm carrelée sur 300, réglée depuis le bord gauche', async ({ page }) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Cuisine', name: 'Cuisine', size: [300, 240] });
  await openRoom(page, id, 'Cuisine');
  await cover(page, 'Mur 1', 'carrelage');

  // largeur : de 50 à 170 cm depuis le bord gauche, vu de l'intérieur
  await fillNumber(page, 'Depuis le bord gauche', '50');
  await fillNumber(page, 'Jusqu’à (largeur)', '170');
  await expect(page.getByLabel('Depuis le bord gauche', { exact: true })).toHaveValue('50');
  await expect(page.getByLabel('Jusqu’à (largeur)', { exact: true })).toHaveValue('170');

  // enregistrée : la même après rechargement
  await page.waitForTimeout(600);
  await page.reload();
  await selectSurface(page, 'Mur 1');
  await expect(page.getByLabel('Depuis le bord gauche', { exact: true })).toHaveValue('50');
  await expect(page.getByLabel('Jusqu’à (largeur)', { exact: true })).toHaveValue('170');
  // la hauteur n'a pas bougé : tout le mur de bas en haut
  await expect(page.getByLabel('Depuis le sol', { exact: true })).toHaveValue('0');

  // le calepinage porte sur 120 cm de large
  await openPose(page, 'Mur 1');
  await page
    .getByRole('button', { name: /^Cuisine/ })
    .first()
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Surfaces' })
      .getByText(/120 cm/)
      .first(),
  ).toBeVisible();

  // une largeur incohérente est refusée avec son explication
  await openRoom(page, id, 'Cuisine');
  await selectSurface(page, 'Mur 1');
  await fillNumber(page, 'Depuis le bord gauche', '200');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Le côté droit de la zone doit être à droite du côté gauche' }),
  ).toBeVisible();
});
