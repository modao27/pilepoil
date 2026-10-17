/** Accueil (lot A) : la même carte pour tous les projets, avec son menu et le résumé de chaque outil. */
import { expect, test } from '@playwright/test';
import { createProject, expectAccessible, expectNoHorizontalScroll, expectTouchTargets, woodFloor } from './helpers';

test('projet parquet seul : carte avec plan, résumé et menu complet', async ({ page }) => {
  const id = await createProject(page, { project: 'Séjour parquet', name: 'Séjour', size: [400, 300] });
  await woodFloor(page, id, 'Séjour');

  await page.goto('/#/');
  const card = page.getByRole('article').filter({ hasText: 'Séjour parquet' });
  await expect(card.getByRole('img', { name: 'Plan de Séjour parquet' })).toBeVisible();
  await expect(card).toContainText('1 pièce');
  await expect(card).toContainText('Parquet :');
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);

  // renommer, dupliquer, supprimer : le menu existe pour tous les projets
  await page.getByRole('button', { name: 'Actions pour Séjour parquet' }).click();
  await page.getByRole('button', { name: 'Renommer' }).click();
  await page.getByLabel('Nouveau nom').fill('Salon');
  await page.getByRole('dialog').getByRole('button', { name: 'Renommer' }).click();
  await expect(page.getByRole('link', { name: 'Salon', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Actions pour Salon' }).click();
  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await expect(page.getByRole('heading', { name: 'Salon (copie)' })).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: /^Salon/ })).toHaveCount(2);

  await page.getByRole('button', { name: 'Actions pour Salon (copie)' }).click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('status')).toContainText('supprimé');
  await page.reload();
  await expect(page.getByRole('link', { name: /^Salon/ })).toHaveCount(1);
});

test('projet sans revêtement : carte sans outil', async ({ page }) => {
  await createProject(page, { project: 'Vide', name: 'Pièce', size: [300, 300] });
  await page.goto('/#/');
  await expect(page.getByRole('article').filter({ hasText: 'Vide' })).toContainText('Aucun revêtement');
});
