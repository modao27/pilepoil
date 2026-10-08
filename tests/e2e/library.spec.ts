import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('bibliothèque de lames : modèles types, une lame se crée et s’enregistre', async ({ page }, info) => {
  // onglets depuis l'accueil
  await page.goto('/');
  await page.getByRole('link', { name: 'Bibliothèques' }).click();
  await expect(page).toHaveURL(/#\/library\/tiles$/);
  await page.getByRole('navigation', { name: 'Bibliothèques' }).getByRole('link', { name: 'Lames' }).click();
  await expect(page).toHaveURL(/#\/library\/boards$/);

  // 7 modèles types posés au premier lancement
  const list = page.getByRole('list', { name: 'Lames' });
  await expect(list.getByRole('listitem')).toHaveCount(7);
  await expect(list.getByRole('link', { name: /Point de Hongrie 45°/ })).toContainText('lames A/B');
  await check(page);
  await shot(page, info, '80-lames');

  // nouvelle lame à longueurs mixtes ; alerte de paquet incohérent, non bloquante
  await page.getByRole('link', { name: 'Ajouter une lame' }).click();
  await page.getByLabel('Nom', { exact: true }).fill('Chêne rustique');
  await page.getByLabel('Type de lame').selectOption({ label: 'Massif' });
  const len = page.getByLabel('Longueur', { exact: true });
  await len.fill('900');
  await len.press('Enter');
  await page.getByRole('button', { name: /Ajouter une longueur/ }).click();
  await expect(page.getByLabel('Longueur 2', { exact: true })).toBeVisible();
  await page.getByLabel('Largeur utile', { exact: true }).fill('150');
  await page.getByLabel('Largeur utile', { exact: true }).press('Enter');
  await page.getByLabel('Surface annoncée', { exact: true }).fill('3');
  await page.getByLabel('Surface annoncée', { exact: true }).press('Enter');
  await expect(page.getByText(/s’écarte de plus de 3 %/)).toBeVisible();
  await page.getByLabel('Prix du paquet', { exact: true }).fill('64,90');
  await page.getByLabel('Prix du paquet', { exact: true }).press('Enter');
  await check(page);
  await shot(page, info, '81-lame-nouvelle');
  await page.getByRole('button', { name: 'Ajouter la lame' }).click();

  await expect(list.getByRole('link', { name: /Chêne rustique/ })).toContainText('64,90 €/paquet');
  await expect(list.getByRole('listitem')).toHaveCount(8);

  // un modèle supprimé ne revient pas ; la lame créée est toujours là après rechargement
  await list.getByRole('link', { name: /Vinyle clipsable/ }).click();
  await page.getByRole('button', { name: 'Supprimer la lame' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(7);
  await page.reload();
  await expect(list.getByRole('link', { name: /Chêne rustique/ })).toBeVisible();
  await expect(list.getByRole('link', { name: /Vinyle clipsable/ })).toHaveCount(0);
  await expect(list.getByRole('listitem')).toHaveCount(7);
});
