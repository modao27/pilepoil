import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

async function setNumber(scope: Locator, label: string, value: string) {
  const f = scope.getByLabel(label, { exact: true });
  await f.fill(value);
  await f.press('Enter');
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

/** Projet « Maison » : un séjour de 6 × 4 m avec une cloison de 4 m au milieu ; renvoie l'identifiant du projet. */
async function houseWithPartition(page: Page): Promise<string> {
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await setNumber(dialog, 'Nom du projet', 'Maison');
  await dialog.getByRole('radio', { name: 'Rectangle' }).click();
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '600');
  await setNumber(dialog, 'Largeur', '400');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  const p = panel(page);
  await p.getByRole('radio', { name: 'Travaux' }).click();
  await p.getByRole('button', { name: 'Tracer une cloison' }).click();
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + 3);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 3);
  await expect(p.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  return id;
}

test('bibliothèque : les systèmes 72/48, 98/48 et 100/70 sont posés au premier lancement', async ({ page }, info) => {
  await page.goto('/#/library/systems');
  const list = page.getByRole('list', { name: 'Systèmes de cloison' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('link', { name: /^72\/48/ })).toContainText('72 mm finis');
  await expect(list.getByRole('link', { name: /^98\/48/ })).toContainText('2 plaques');
  await check(page);
  await shot(page, info, '73-systemes');

  // un système se crée et s'enregistre
  await page.getByRole('link', { name: 'Ajouter un système' }).first().click();
  await page.getByLabel('Nom', { exact: true }).fill('72/48 maison');
  await page.getByRole('button', { name: 'Ajouter le système' }).click();
  await expect(page.getByRole('list', { name: 'Systèmes de cloison' }).getByRole('listitem')).toHaveCount(4);
});

test('cloisons : une cloison du plan se chiffre, ses lignes arrivent dans les achats', async ({ page }, info) => {
  const id = await houseWithPartition(page);

  // écran Projet : l'outil est activé par la première cloison
  await page.goto(`/#/p/${id}`);
  const card = page.getByRole('link', { name: /^Cloisons/ });
  await expect(card).toContainText(/1 cloison, \d+ plaques?/);

  // écran des cloisons : système par défaut (même épaisseur), réglages
  await card.click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/cloisons$`));
  await expect(page.getByRole('heading', { name: /^Cloison 1 · Séjour/ })).toBeVisible();
  await expect(page.getByLabel('Système')).toHaveValue('modele-72-48');
  await check(page);
  await shot(page, info, '74-cloisons');

  // plaque hydrofuge sur la face B : la ligne d'achat suit
  await page.getByLabel('Plaque, face B').selectOption({ label: 'Hydrofuge' });
  await page.getByRole('link', { name: 'Liste d’achat' }).click();
  await expect(page.getByRole('heading', { name: /^Achats — / })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ossature et plaques' })).toBeVisible();
  await expect(page.getByText(/^Rail R48/)).toBeVisible();
  await expect(page.getByText(/^Montant M48/)).toBeVisible();
  await expect(page.getByText(/^Plaque de plâtre standard/)).toBeVisible();
  await expect(page.getByText(/^Plaque de plâtre hydrofuge/)).toBeVisible();
  await expect(page.getByText('Vis à plaque 25 mm').first()).toBeVisible();
  await check(page);
  await shot(page, info, '75-achats-cloisons');
});

test('cloisons : changer de système change l’épaisseur de la cloison dans le plan, annulable', async ({ page }) => {
  const id = await houseWithPartition(page);
  await page.goto(`/#/p/${id}/m/cloisons`);
  await page.getByLabel('Système').selectOption({ label: '98/48' });
  await expect(page.getByLabel('Système')).toHaveValue('modele-98-48');
  // la cloison de 98 mm : les deux pièces ont perdu 49 mm de chaque côté
  await page.goto(`/#/p/${id}/plan`);
  await page.getByRole('radio', { name: 'Travaux' }).click();
  await page.getByRole('button', { name: /^Cloison 1/ }).click();
  await expect(page.getByLabel('Épaisseur', { exact: true })).toHaveValue(/98/);
});
