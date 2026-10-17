/** Niveaux de sol et hauteur propre d'un mur (T1) : saisie, marche d'un passage, pose continue refusée. */
import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  openRoom,
  selectSurface,
  shot,
} from './helpers';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

test('deux pièces à des niveaux différents : marche au passage, pose séparée au sol', async ({ page }, info) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await fillNumber(dialog, 'Nom', 'Bureau');
  await fillNumber(dialog, 'Longueur', '300');
  await fillNumber(dialog, 'Largeur', '300');
  await dialog.getByLabel('Emplacement').selectOption({ label: 'Contre Séjour, mur 2' });
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const p = panel(page);
  await p.getByRole('button', { name: 'Porte vers Séjour' }).click();
  await expect(p.getByRole('heading', { name: 'Passage' })).toBeVisible();
  await expect(p.getByTestId('step')).toContainText('Sans marche');

  // le bureau est 15 cm plus bas que le séjour
  await p.getByRole('button', { name: 'Toutes les pièces' }).click();
  await p.getByRole('button', { name: 'Bureau', exact: true }).click();
  await fillNumber(p, 'Niveau du sol', '-15');
  await expect(page.locator('text.name tspan.area', { hasText: 'niveau −15 cm' })).toBeVisible();
  await page.locator('line.passage').click({ force: true });
  await expect(p.getByTestId('step')).toContainText(/Marche de 15 cm, (montante|descendante)/);
  await expect(p.getByText(/nez de marche/)).toBeVisible();
  await expect(page.locator('line.passage.stepped')).toHaveCount(1);
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '73-niveaux');

  // le séjour en parquet ; le bureau ne peut pas continuer la même pose, il reçoit la sienne
  await openRoom(page, id, 'Séjour');
  await cover(page, 'Sol', 'parquet');
  await openRoom(page, id, 'Bureau');
  await expect(page.getByText(/Niveau du sol : −15 cm/)).toBeVisible();
  await selectSurface(page, 'Sol');
  await page.getByRole('button', { name: 'Revêtir : parquet' }).click();
  await expect(
    page.getByRole('region', { name: 'Sol et murs' }).getByRole('button', { name: /^Sol : Parquet · Bureau, sol$/ }),
  ).toBeVisible();
});

test('mur bas : sa hauteur propre limite sa surface à revêtir', async ({ page }) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Cuisine', name: 'Cuisine', size: [300, 240] });
  const p = panel(page);
  await p
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .first()
    .click();
  await fillNumber(p, 'Hauteur du mur', '90');
  await expect(p.getByLabel('Hauteur du mur', { exact: true })).toHaveValue('90');

  // sur l'écran Pièce, le mur 1 ne monte qu'à 90 cm
  await openRoom(page, id, 'Cuisine');
  await cover(page, 'Mur 1', 'carrelage');
  await expect(page.getByLabel('Jusqu’à', { exact: true })).toHaveValue('90');
  await fillNumber(page, 'Jusqu’à', '200');
  await expect(page.getByLabel('Jusqu’à', { exact: true })).toHaveValue('90');
  await expect(page.getByText(/Ramené à 90 cm/)).toBeVisible();
});

test('maquette 3D : le bureau plus bas que le séjour, sols revêtus à leurs niveaux', async ({ page }, info) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await fillNumber(dialog, 'Nom', 'Bureau');
  await fillNumber(dialog, 'Longueur', '300');
  await fillNumber(dialog, 'Largeur', '300');
  await dialog.getByLabel('Emplacement').selectOption({ label: 'Contre Séjour, mur 2' });
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const p = panel(page);
  await fillNumber(p, 'Niveau du sol', '-30');
  await openRoom(page, id, 'Séjour');
  await cover(page, 'Sol', 'carrelage');
  await openRoom(page, id, 'Bureau');
  await cover(page, 'Sol', 'parquet');
  await page.goto(`/#/p/${id}/3d`);
  await expect(page.locator('[data-draw-calls]')).not.toHaveAttribute('data-draw-calls', '0', { timeout: 20_000 });
  await page.waitForTimeout(800);
  await shot(page, info, '74-niveaux-3d');
});
