import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, shot } from './helpers';

test('accueil vide : invitation à créer un projet', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aucun projet pour l’instant' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nouveau projet' })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '01-accueil-vide');
});

test('page introuvable', async ({ page }) => {
  await page.goto('/#/nimporte/quoi');
  await expect(page.getByRole('heading', { name: 'Cette page n’existe pas' })).toBeVisible();
  await page.getByRole('link', { name: 'Voir mes projets' }).click();
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
});
