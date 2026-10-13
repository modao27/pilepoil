/**
 * Peinture (PE3) : un mur entier peint depuis l'écran Pièce, réglages de la pose (support, apprêt, boiseries),
 * résumé en direct, résultats de la pose et achats du projet.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { sceneStats } from './room-helpers';
import {
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  openRoom,
  shot,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Réglages de la peinture' }).or(page.locator('.sheet'));
const step = (page: Page, name: string) => panel(page).getByRole('tab', { name, exact: true }).click();

test('peinture : mur entier, réglages, résumé, résultats et achats', async ({ page }, info) => {
  test.setTimeout(90_000);
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  await openRoom(page, id, 'Séjour');

  // « Peindre » est proposé sur un mur, pas sur le sol
  await page
    .getByRole('button', { name: /^Sol( \(| :)/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Revêtir : peinture' })).toHaveCount(0);
  await cover(page, 'Mur 1', 'peinture');
  await page.getByRole('link', { name: 'Réglages' }).first().click();

  // murs à plat et résumé : 4 m × 2,5 m (hauteur par défaut) sans ouverture
  await expect(page.getByRole('img', { name: 'Murs à peindre, à plat' })).toBeVisible();
  const summary = page.getByRole('link', { name: / m² · / }).first();
  await expect(summary).toContainText('10 m² · 2,2 L');
  await check(page);
  await shot(page, info, '95-peinture');

  // support neuf : l'apprêt est conseillé, puis choisi ; les litres montent
  await step(page, 'Pose');
  await panel(page).getByLabel('Support', { exact: true }).selectOption({ label: 'Plâtre ou placo neuf' });
  await expect(page.getByText('Support neuf ou poreux : une sous-couche est conseillée.')).toBeVisible();
  await step(page, 'Produit');
  await panel(page).getByLabel('Apprêt', { exact: true }).selectOption({ label: 'Sous-couche universelle' });
  await expect(page.getByText('Support neuf ou poreux')).toHaveCount(0);
  await fillNumber(panel(page), 'Couches de finition', '3');
  await expect(summary).toContainText('10 m² · 4,1 L');
  await step(page, 'Finitions');
  await panel(page).getByRole('checkbox', { name: 'Plinthes' }).check();
  await expect(panel(page).getByText(/m² de boiseries/)).toBeVisible();
  await check(page);

  // retour arrière annulable
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(panel(page).getByText(/m² de boiseries/)).toHaveCount(0);

  // résultats de la pose
  await page.getByRole('link', { name: 'Résultats' }).first().click();
  await expect(page.getByRole('heading', { name: /^Résultats — Peinture · / })).toBeVisible();
  await expect(page.getByRole('article', { name: /^Peinture · / })).toContainText('Surface à peindre');
  await check(page);

  // 3D : le mur peint s'ajoute à l'enveloppe, dans le budget de dessin
  await page.getByRole('tab', { name: '3D' }).click();
  const st = await sceneStats(page);
  expect(st.drawCalls).toBeGreaterThanOrEqual(3);
  expect(st.drawCalls).toBeLessThanOrEqual(40);
  await shot(page, info, '96-peinture-3d');

  // PDF de la pose
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF du calepinage' }).click(),
  ]);
  expect(
    readFileSync((await download.path())!)
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');

  // achats du projet : pots de peinture
  await page.goto(`/#/p/${id}/achats`);
  await expect(page.getByText(/pots? de /).first()).toBeVisible();
});
