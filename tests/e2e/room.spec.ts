import { expect, test } from '@playwright/test';
import { newRoom, sceneStats } from './room-helpers';
import { addPlanWindow, expectAccessible, expectNoHorizontalScroll, openPose, shot } from './helpers';

test('pièce : résultats de toutes ses poses, maquette 3D', async ({ page }, info) => {
  await newRoom(page);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '79-ecran-piece');
  await openPose(page, 'Mur 1');
  await page.getByRole('link', { name: 'Résultats de la pièce' }).click();
  await expect(page.getByRole('heading', { name: 'Résultats — Pièce' })).toBeVisible();
  await expect(page.getByRole('article', { name: /^Carrelage · / }).first()).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '80-piece-resultats');

  await page.getByRole('tab', { name: '3D' }).click();
  const st = await sceneStats(page);
  expect(st.drawCalls).toBeGreaterThan(3);
  await shot(page, info, '81-piece-3d-biais');
  await page.getByRole('radio', { name: 'Plongée' }).click();
  await page.waitForTimeout(500);
  await shot(page, info, '82-piece-3d-plongee');

  await page.getByRole('tab', { name: 'Résumé' }).click();
  await page.getByRole('link', { name: 'Calepinage' }).first().click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, / })).toBeVisible();
});

test('éditeur : vue 3D d’un mur avec fenêtre, puis de toute la pièce', async ({ page }, info) => {
  const id = await newRoom(page);
  await addPlanWindow(page, id);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Découpage', exact: true }).click();
  await page.getByRole('button', { name: /^Fenêtre 1/ }).click();
  const depth = page.getByLabel('Profondeur du tableau', { exact: true });
  await depth.fill('20');
  await depth.press('Enter');
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).press('Home');
  await page.getByRole('radio', { name: '3D' }).click();
  await sceneStats(page);
  await page.getByRole('radio', { name: 'Face', exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, info, '83-editeur-3d-mur-face');
  await page.getByRole('radio', { name: 'Biais' }).click();
  await page.waitForTimeout(500);
  await shot(page, info, '84-editeur-3d-mur-biais');
  await page.getByRole('radio', { name: 'Pièce' }).click();
  await expect(page.getByRole('application', { name: 'Vue 3D de la pièce' })).toBeVisible();
  await sceneStats(page);
  await page.waitForTimeout(500);
  await shot(page, info, '85-editeur-3d-piece');
});
