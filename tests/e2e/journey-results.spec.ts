/**
 * Parcours complet de la phase N5 : nouveau projet → pièce → zones → poses (carrelage au mur, parquet au sol) →
 * résultats de la pose, de la pièce (3D des deux revêtements ensemble) et du projet → PDF → vue globale.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  openRoom,
  shot,
} from './helpers';
import { sceneStats } from './room-helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

async function pdf(page: Page, button: string): Promise<Download> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ]);
  expect(
    readFileSync((await download.path())!)
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');
  await expect(page.getByText('PDF enregistré dans vos téléchargements.')).toBeVisible();
  return download;
}

test('nouveau projet → pièce → poses → résultats → PDF → vue globale', async ({ page }, info) => {
  test.setTimeout(120_000);
  await addTile(page);
  const id = await createProject(page, { project: 'Maison', name: 'Cuisine', size: [350, 300] });

  // poses : carrelage sur le mur 1, parquet au sol
  await openRoom(page, id, 'Cuisine');
  await cover(page, 'Mur 1');
  await cover(page, 'Sol', 'parquet');

  // résultats de la pièce : les deux revêtements, chiffres de chaque pose
  await page.getByRole('link', { name: 'Résultats de la pièce (3D, PDF)' }).click();
  await expect(page.getByRole('heading', { name: 'Résultats — Cuisine' })).toBeVisible();
  await expect(page.getByRole('article', { name: /^Carrelage · / })).toContainText('Carreaux posés');
  await expect(page.getByRole('article', { name: /^Parquet · / })).toContainText('Morceaux posés');
  await expect(page.getByRole('article', { name: /^Parquet · / })).toContainText(/\d+ paquets?/);
  await check(page);
  await shot(page, info, 'N5-resultats-piece');

  // 3D de la pièce : enveloppe, carreaux et lames ensemble, dans le budget de dessin
  await page.getByRole('tab', { name: '3D' }).click();
  const st = await sceneStats(page);
  expect(st.drawCalls).toBeGreaterThanOrEqual(4);
  expect(st.drawCalls).toBeLessThanOrEqual(40);
  expect(st.triangles).toBeLessThanOrEqual(200_000);
  await shot(page, info, 'N5-piece-3d');

  // PDF de la pièce
  const room = await pdf(page, 'PDF de la pièce');
  expect(room.suggestedFilename()).toBe('maison-cuisine.pdf');

  // résultats d'une pose, depuis la carte de la pose
  await page.getByRole('tab', { name: 'Résumé' }).click();
  await page
    .getByRole('article', { name: /^Parquet · / })
    .getByRole('link', { name: 'Résultats de la pose' })
    .click();
  await expect(page.getByRole('heading', { name: /^Résultats — Parquet · / })).toBeVisible();
  await expect(page.getByRole('article', { name: /^Carrelage · / })).toHaveCount(0);

  // vue globale, puis résultats et dossier du projet
  await page.getByRole('navigation', { name: 'Fil de navigation' }).getByRole('link', { name: 'Projet' }).click();
  await expect(page.getByRole('heading', { name: 'Pièces', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Résultats du projet (3D, dossier PDF)' }).click();
  await expect(page.getByRole('heading', { name: 'Résultats du projet' })).toBeVisible();
  await check(page);
  await shot(page, info, 'N5-resultats-projet');
  await page.getByRole('tab', { name: '3D' }).click();
  await sceneStats(page);
  await shot(page, info, 'N5-projet-3d');
  const dossier = await pdf(page, 'Dossier du projet (PDF)');
  expect(dossier.suggestedFilename()).toBe('dossier-maison.pdf');

  await page.getByRole('navigation', { name: 'Fil de navigation' }).getByRole('link', { name: 'Projet' }).click();
  await expect(page.getByRole('heading', { name: 'Maison' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Carrelage · / })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Parquet · / })).toBeVisible();
});
