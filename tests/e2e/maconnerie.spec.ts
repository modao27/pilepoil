/**
 * Maçonnerie (N6, N7) : bibliothèque de matériaux, mur saisi par ses dimensions, cloison maçonnée du plan avec un
 * panneau de briques de verre, quantités et achats.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  shot,
} from './helpers';

const panel = (page: Page) => page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));

/** Trace une cloison entre deux points (fractions du sol de la pièce), garde le nom proposé s'il est demandé. */
async function trace(page: Page, from: [number, number], to: [number, number]) {
  await panel(page).getByRole('radio', { name: 'Travaux' }).click();
  await panel(page).getByRole('button', { name: 'Tracer une cloison' }).click();
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  const at = (f: [number, number]) => page.mouse.click(box.x + box.width * f[0], box.y + box.height * f[1]);
  await at(from);
  await at(to);
  const naming = page.getByRole('dialog', { name: 'Nommer la nouvelle pièce' });
  if (await naming.isVisible({ timeout: 1500 }).catch(() => false))
    await naming.getByRole('button', { name: 'Garder les noms proposés' }).click();
}

test('bibliothèque de matériaux : modèles types, briques de verre comprises', async ({ page }, info) => {
  await page.goto('/#/library/materials');
  const list = page.getByRole('list', { name: 'Matériaux de maçonnerie' });
  await expect(list.getByText('Parpaing creux 20×20×50')).toBeVisible();
  await expect(list.getByText('Brique de verre 19×19×8 colorée')).toBeVisible();
  await list.getByText('Brique de verre 19×19×8', { exact: true }).click();
  await expect(page.getByText('Ce matériau ne se coupe pas')).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '80-materiaux');
});

test('un mur saisi en parpaings : rangs, éléments, liant, puis la liste d’achat', async ({ page }, info) => {
  const id = await createProject(page, { project: 'Garage', name: 'Atelier', size: [500, 400] });
  await page.goto(`/#/p/${id}`);
  await page.getByRole('link', { name: 'Maçonnerie' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/maconnerie$`));
  await page.getByRole('button', { name: 'Ajouter un mur' }).click();
  await page.getByLabel('Matériau de base', { exact: true }).selectOption({ label: 'Parpaing creux 20×20×50' });
  await fillNumber(page, 'Longueur', '300');
  await fillNumber(page, 'Hauteur', '250');
  await expect(page.getByText('1 mur, 78 éléments')).toBeVisible();
  await expect(page.getByText(/281,3 kg de liant/)).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '81-mur-parpaings');

  await page.getByRole('link', { name: 'Voir les achats' }).click();
  await expect(page.getByText('Parpaing creux 20×20×50').first()).toBeVisible();
  await expect(page.getByText('12 sacs · Mortier — sac de 25 kg')).toBeVisible();
});

test('cloison maçonnée du plan : parpaings et un panneau de briques de verre', async ({ page }, info) => {
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [600, 400] });
  await trace(page, [0.5, 0.002], [0.5, 0.5]);
  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  await fillNumber(p, 'Hauteur de la cloison', '120');
  await p.getByRole('radio', { name: 'Maçonnerie' }).click();
  await expect(p.getByRole('radio', { name: 'Maçonnerie' })).toBeChecked();
  await p.getByRole('link', { name: 'maçonnerie' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/maconnerie$`));

  // épaisseur de 72 mm : aucun matériau ne correspond, il faut en choisir un
  await expect(page.getByRole('heading', { name: /^Cloison 1/ })).toBeVisible();
  await expect(page.getByText('À compléter')).toBeVisible();
  await page.getByLabel('Matériau de base', { exact: true }).selectOption({ label: 'Parpaing creux 20×20×50' });
  await expect(page.getByText(/20 cm d’épaisseur/)).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter une zone' }).click();
  await expect(page.getByRole('group', { name: 'Zone 1' })).toBeVisible();
  await expect(page.getByText(/4 × 4 briques, bordures de 4 cm/)).toBeVisible();
  await expect(page.getByText(/^1 mur, \d+ éléments$/)).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '82-cloison-maconnee');

  // le module cloisons ne la compte pas ; les achats ont le verre et ses fers
  await page.getByRole('link', { name: 'Voir les achats' }).click();
  await expect(page.getByText('Brique de verre 19×19×8').first()).toBeVisible();
  await expect(page.getByText(/Fers d’armature/).first()).toBeVisible();
  await expect(page.getByText(/Plaque de plâtre/)).toHaveCount(0);
});
