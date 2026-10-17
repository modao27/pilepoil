import { expect, test } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, shot } from './helpers';

test('accueil vide : invitation à créer un projet', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aucun projet pour l’instant' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nouveau projet' })).toBeVisible();
  await expect(page.getByText('Importez vos données')).toHaveCount(0);
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

test('nouveau projet : annuler ramène à l’accueil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouveau projet' }).click();
  await page.getByRole('dialog', { name: 'Nouveau projet' }).getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
});

test('stockage indisponible : un seul message, sans « fonctionne sans connexion »', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('Navigation privée', 'InvalidStateError');
      },
    });
  });
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Impossible d’ouvrir vos données' })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText('fonctionne maintenant sans connexion')).toHaveCount(0);
});
