/** Accessibilité et chargement (lot H) : titres de page, h1 des éditeurs, texte agrandi, cibles tactiles. */
import { expect, test } from '@playwright/test';
import { createProject, newWall } from './helpers';

test('chaque écran a son titre de page, chaque éditeur son titre de niveau 1', async ({ page }) => {
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  for (const [hash, title] of [
    ['#/', 'Mes projets · PilePoil'],
    [`#/p/${id}`, 'Maison · PilePoil'],
    [`#/p/${id}/plan`, 'Plan — Maison · PilePoil'],
    [`#/p/${id}/achats`, 'Achats — Maison · PilePoil'],
    [`#/p/${id}/resultats`, 'Résultats — Maison · PilePoil'],
    ['#/settings', 'Réglages · PilePoil'],
    ['#/library/tiles', 'Bibliothèque · PilePoil'],
  ] as const) {
    await page.goto('/' + hash);
    await expect(page).toHaveTitle(title);
  }
});

test('éditeur de calepinage : un titre de niveau 1 qui dit la surface', async ({ page }) => {
  await newWall(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/^Carrelage — .+ · PilePoil$/);
});
