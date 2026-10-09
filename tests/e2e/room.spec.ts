import { expect, test } from '@playwright/test';
import { newRoom, sceneStats } from './room-helpers';
import { expectAccessible, expectNoHorizontalScroll, shot } from './helpers';

// Vue Pièce et 3D de toute la pièce retirées en C2, refaites depuis le polygone du plan en C3.
test.fixme('pièce : vue de dessus cliquable, maquette 3D', async ({ page }, info) => {
  await newRoom(page);
  await page.getByRole('link', { name: 'Pièce', exact: true }).click();
  await expect(page.getByRole('group', { name: /Pièce vue de dessus/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Ouvrir (Mur [A-D]|Sol)$/ })).toHaveCount(5);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '80-piece-dessus');

  await page.getByRole('radio', { name: '3D' }).click();
  const st = await sceneStats(page);
  expect(st.drawCalls).toBeGreaterThan(3);
  await shot(page, info, '81-piece-3d-biais');
  await page.getByRole('radio', { name: 'Plongée' }).click();
  await page.waitForTimeout(500);
  await shot(page, info, '82-piece-3d-plongee');

  await page.getByRole('radio', { name: 'Dessus' }).click();
  await page.getByRole('link', { name: 'Ouvrir Mur B' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 2/ })).toBeVisible();
});

test.fixme('éditeur : vue 3D d’un mur avec fenêtre, puis de toute la pièce', async ({ page }, info) => {
  await newRoom(page);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Ouvertures' }).click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
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
