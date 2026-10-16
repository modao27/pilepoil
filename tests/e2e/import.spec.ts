/** Fiche produit collée dans un formulaire, ou reçue du favori « Envoyer à PilePoil » (#/import). Produits fictifs. */
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

const BOARD_SHEET = [
  'Sol stratifié Exemplo chêne fumé, Ép.8 mm',
  'Longueur (en cm)\t128,5',
  'Largeur (en cm)\t19,2',
  'Epaisseur totale (en mm)\t8',
  'Nombre de lames ou dalles dans le pack\t9',
  'Contenance de la boîte (en m²)\t2,22',
].join('\n');

const TILE_SHEET = [
  'Carrelage sol effet béton Exemplo l.60 x L.60 cm',
  'Marque\tEXEMPLO',
  'Epaisseur (en mm)\t9,5',
  'Longueur (en cm)\t60',
  'Largeur (en cm)\t60',
  'Couleur\tGris',
  'Contenance de la boîte (en m²)\t1,08',
].join('\n');

test('coller une fiche produit dans le formulaire de lame', async ({ page }, info) => {
  await page.goto('/#/library/boards/new');
  await page.getByRole('button', { name: 'Coller une fiche produit' }).click();
  const dialog = page.getByRole('dialog', { name: 'Coller une fiche produit' });
  await dialog.getByRole('button', { name: 'Remplir' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Aucune caractéristique reconnue');
  await dialog.getByLabel('Caractéristiques du produit').fill(BOARD_SHEET);
  await check(page);
  await shot(page, info, '83-coller-fiche');
  await dialog.getByRole('button', { name: 'Remplir' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(/^Rempli depuis la fiche/)).toContainText('Rempli depuis la fiche : nom, type, longueur');
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Sol stratifié Exemplo chêne fumé, Ép.8 mm');
  await expect(page.getByLabel('Longueur', { exact: true })).toHaveValue('1285');
  await expect(page.getByLabel('Largeur utile', { exact: true })).toHaveValue('192');
  await check(page);
  await shot(page, info, '84-lame-remplie');
  await page.getByRole('button', { name: 'Ajouter la lame' }).click();
  await expect(
    page.getByRole('list', { name: 'Lames' }).getByRole('link', { name: /Exemplo chêne fumé/ }),
  ).toBeVisible();
});

test('fiche reçue du favori : bibliothèque devinée, carreau pré-rempli', async ({ page }, info) => {
  await page.goto('/#/import/' + encodeURIComponent(TILE_SHEET));
  await expect(page.getByText('Produit reçu')).toContainText('Carrelage sol effet béton Exemplo');
  await expect(page.getByRole('radio', { name: 'Carreaux' })).toHaveAttribute('aria-checked', 'true');
  await check(page);
  await shot(page, info, '85-import-favori');
  await page.getByRole('button', { name: 'Continuer' }).click();

  await expect(page).toHaveURL(/#\/library\/tiles\/new$/);
  await expect(page.getByText(/^Rempli depuis la fiche/)).toContainText('Rempli depuis la fiche');
  await expect(page.getByLabel('Longueur', { exact: true })).toHaveValue('600');
  await expect(page.getByLabel('Épaisseur', { exact: true })).toHaveValue('9,5');
  await page.getByRole('button', { name: 'Ajouter le carreau' }).click();
  await expect(page.getByRole('link', { name: /Carrelage sol effet béton Exemplo/ })).toBeVisible();
});

test('réglages : favori « Envoyer à PilePoil » à installer', async ({ page }) => {
  await page.goto('/#/settings');
  const link = page.getByRole('link', { name: 'Envoyer à PilePoil' });
  await expect(link).toHaveAttribute('href', /^javascript:/);
  await page.getByRole('link', { name: 'Coller une fiche' }).click();
  await expect(page).toHaveURL(/#\/import$/);
  await expect(page.getByLabel('Caractéristiques du produit')).toBeVisible();
});
