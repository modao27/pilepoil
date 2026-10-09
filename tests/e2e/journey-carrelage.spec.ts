/**
 * Parcours complet du carrelage bâti sur le plan (docs/PLAN.md, C3) : dessiner une pièce en L → carreler le sol
 * et deux murs → poser du parquet dans une autre pièce du même projet → acheter. Téléphone et ordinateur.
 */
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

test('parcours : pièce en L, sol et deux murs carrelés, parquet à côté, achats', async ({ page }, info) => {
  test.setTimeout(120_000);

  // 1. projet vide, le plan d'abord : salle de bain en L et chambre
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouveau projet' }).click();
  await setNumber(page.locator('main'), 'Nom du projet', 'Appartement');
  await page.getByRole('button', { name: 'Commencer : parquet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await dialog.getByRole('radio', { name: 'En L' }).click();
  await setNumber(dialog, 'Nom', 'Salle de bain');
  await setNumber(dialog, 'Longueur', '400');
  await setNumber(dialog, 'Largeur', '300');
  await setNumber(dialog, 'Retrait en longueur', '150');
  await setNumber(dialog, 'Retrait en largeur', '100');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const pp = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await expect(pp.getByRole('heading', { name: 'Salle de bain' })).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  await dialog.getByRole('radio', { name: 'Rectangle' }).click();
  await setNumber(dialog, 'Nom', 'Chambre');
  await setNumber(dialog, 'Longueur', '300');
  await setNumber(dialog, 'Largeur', '300');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await shot(page, info, 'C1-parcours-plan');

  // 2. le carrelage : le sol de la salle de bain est proposé, on choisit le carreau
  await page.getByRole('link', { name: 'Projet' }).click();
  await page.getByRole('button', { name: 'Ajouter carrelage' }).click();
  await expect(page.getByRole('heading', { name: 'Carrelage — Appartement' })).toBeVisible();
  const bath = page.getByRole('region', { name: 'Salle de bain' });
  await expect(bath.getByRole('checkbox', { name: 'Sol', exact: true })).toBeChecked();
  await bath.getByRole('link', { name: 'Ouvrir Salle de bain, sol' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Salle de bain, sol/ })).toBeVisible();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Carreau' }).click();
  await page.getByRole('button', { name: 'Nouveau carreau' }).click();
  await page.getByRole('dialog', { name: 'Nouveau carreau' }).getByLabel('Prix', { exact: true }).fill('29,9');
  await page.getByRole('button', { name: 'Ajouter et utiliser' }).click();
  await expect(page.getByRole('link', { name: /\d+ carreaux/ })).toBeVisible();

  // 3. deux murs de la salle de bain, avec le même carreau ; cotes reprises du plan
  await page.getByRole('link', { name: 'Carrelage', exact: true }).click();
  await bath.getByRole('checkbox', { name: /^Mur 1 / }).check();
  await bath.getByRole('checkbox', { name: /^Mur 6 / }).check();
  await expect(bath.getByRole('link', { name: /^Ouvrir Salle de bain, / })).toHaveCount(3);
  await expect(bath.getByRole('link', { name: 'Ouvrir Salle de bain, mur 1' })).toContainText(/\d+ pièces/);
  await expect(bath.getByRole('link', { name: 'Ouvrir Salle de bain, mur 6' })).toContainText(/\d+ pièces/);
  await check(page);
  await shot(page, info, 'C2-parcours-carrelage');
  await bath.getByRole('link', { name: 'Vue de la pièce' }).click();
  await expect(page.getByRole('link', { name: /^Ouvrir Salle de bain, / })).toHaveCount(3);
  await shot(page, info, 'C3-parcours-piece');

  // 4. le parquet dans la chambre
  await page.goto(page.url().replace(/\/m\/carrelage\/room\/.*$/, '/m/parquet'));
  const p = page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));
  await p.getByRole('button', { name: 'Créer une pose' }).click();
  await p.getByRole('checkbox', { name: 'Chambre' }).check();
  await p.getByRole('checkbox', { name: 'Salle de bain' }).uncheck();
  await expect(page.getByRole('link', { name: /lames · \d+ paquets/ }).first()).toBeVisible();

  // 5. acheter : carrelage et parquet sur la même liste
  await page.goto(page.url().replace(/\/m\/parquet$/, ''));
  await page.getByRole('link', { name: /^Achats/ }).click();
  await expect(page.getByRole('heading', { name: 'Achats — Appartement' })).toBeVisible();
  await expect(page.getByText(/^Carrelage : /)).toBeVisible();
  await expect(page.getByText(/^Parquet : /)).toBeVisible();
  await expect(page.getByText('Mortier-colle', { exact: false }).first()).toBeVisible();
  await check(page);
  await shot(page, info, 'C4-parcours-achats');
});
