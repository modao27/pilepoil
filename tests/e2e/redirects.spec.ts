import { expect, test } from '@playwright/test';

/** Les favoris d'avant la boîte à outils (#/p/:id/…) mènent aux nouvelles adresses du carrelage. */
test('anciennes adresses redirigées vers le module carrelage', async ({ page }) => {
  await page.goto('/#/new');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  expect(page.url()).toContain(`#/p/${id}/m/carrelage`);

  await page.goto('/#/');
  await page.goto(`/#/p/${id}/results`);
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage/results$`));
  // la redirection remplace l'ancienne adresse : retour = page précédente
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);

  await page.goto(`/#/p/${id}`);
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage$`));

  await page.goto(`/#/p/${id}/s/s9`);
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage/s/s9$`));

  await page.goto(`/#/p/${id}/compare`);
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/carrelage/compare$`));
});
