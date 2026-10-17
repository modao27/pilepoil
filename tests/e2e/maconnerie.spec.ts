/** Maçonnerie (N6) : bibliothèque de matériaux, mur saisi par ses dimensions, quantités et achats. */
import { expect, test } from '@playwright/test';
import {
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  shot,
} from './helpers';

test('bibliothèque de matériaux : modèles types, briques de verre comprises', async ({ page }, info) => {
  await page.goto('/#/library/materials');
  const list = page.getByRole('list', { name: 'Matériaux de maçonnerie' });
  await expect(list.getByText('Parpaing creux 20×20×50')).toBeVisible();
  await expect(list.getByText('Brique de verre 19×19×8 colorée')).toBeVisible();
  await list.getByText('Brique de verre 19×19×8', { exact: true }).click();
  await expect(page.getByText('Ce matériau ne se coupe pas')).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '80-materiaux');
});

test('un mur en parpaings : rangs, éléments, liant, puis la liste d’achat', async ({ page }, info) => {
  const id = await createProject(page, { project: 'Garage', name: 'Atelier', size: [500, 400] });
  await page.goto(`/#/p/${id}`);
  await page.getByRole('link', { name: 'Maçonnerie' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/maconnerie$`));
  await page.getByRole('button', { name: 'Ajouter un mur' }).click();
  await page.getByLabel('Matériau', { exact: true }).selectOption({ label: 'Parpaing creux 20×20×50' });
  await fillNumber(page, 'Longueur', '300');
  await fillNumber(page, 'Hauteur', '250');
  await expect(page.getByText('1 mur, 78 éléments')).toBeVisible();
  await expect(page.getByText('281,3 kg')).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '81-mur-parpaings');

  await page.getByRole('link', { name: 'Voir les achats' }).click();
  await expect(page.getByText('Parpaing creux 20×20×50').first()).toBeVisible();
  await expect(page.getByText('12 sacs · Mortier — sac de 25 kg')).toBeVisible();
});
