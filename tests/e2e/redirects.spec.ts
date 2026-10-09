import { expect, test } from '@playwright/test';
import { newWall } from './helpers';

/** Les favoris d'avant la boîte à outils (#/p/:id/…) mènent aux nouvelles adresses du carrelage. */
test('anciennes adresses redirigées vers le module carrelage', async ({ page }) => {
  const id = await newWall(page);
  expect(page.url()).toContain(`#/p/${id}/m/carrelage`);

  await page.goto('/#/');
  await page.goto(`/#/p/${id}/results`);
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage/results$`));
  // la redirection remplace l'ancienne adresse : retour = page précédente
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);

  await page.goto(`/#/p/${id}/s/s9`);
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage/s/s9$`));

  await page.goto(`/#/p/${id}/compare`);
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage/compare$`));
});
