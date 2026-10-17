/**
 * Vue 3D du projet (maquette façon maison de poupée) : aperçu sur l'écran Projet, écran #/p/:id/3d, murs
 * pleins / bas / coupés, pièce choisie au toucher ou dans la liste, ouverture de la pièce ; budget de dessin.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  openPose,
  openRoom,
  shot,
} from './helpers';
import { sceneStats } from './room-helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('vue 3D : aperçu, murs pleins, bas et coupés, pièce touchée puis ouverte', async ({ page }, info) => {
  test.setTimeout(120_000);
  await addTile(page);
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await fillNumber(dialog, 'Nom', 'Bureau');
  await fillNumber(dialog, 'Longueur', '300');
  await fillNumber(dialog, 'Largeur', '300');
  await dialog.getByLabel('Emplacement').selectOption({ label: 'Contre Séjour, mur 2' });
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const plan = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await plan.getByRole('button', { name: 'Porte vers Séjour' }).click();
  await expect(plan.getByRole('heading', { name: 'Passage' })).toBeVisible();

  // le séjour : parquet au sol, carrelage sur la cloison commune avec le bureau (mur 2)
  await openRoom(page, id, 'Séjour');
  await cover(page, 'Sol', 'parquet');
  await cover(page, 'Mur 2');
  // tableau carrelé de 20 cm à la porte de la cloison : plus profond que le mur, coupé avec lui
  await openPose(page, 'Mur 2');
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Découpage', exact: true }).click();
  await page
    .getByRole('button', { name: /^Porte/ })
    .first()
    .click();
  await fillNumber(page, 'Profondeur du tableau', '20');
  for (const c of ['Gauche', 'Droite', 'Linteau (haut)']) await page.getByLabel(c, { exact: true }).check();
  await openRoom(page, id, 'Bureau');
  await cover(page, 'Sol');
  await cover(page, 'Mur 1');

  // écran Projet : aperçu 3D (image fixe) qui mène à la vue
  await page.goto(`/#/p/${id}`);
  const card = page.getByRole('link', { name: /^Vue 3D/ });
  // l'aperçu animé n'est monté que sur grand écran (sur téléphone, une icône mène à la vue 3D)
  if (info.project.name === 'desktop')
    await expect(card.locator('[data-draw-calls]')).not.toHaveAttribute('data-draw-calls', '0', {
      timeout: 15_000,
    });
  await check(page);
  await shot(page, info, 'V3D-projet-apercu');

  await card.click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/3d$`));
  await expect(page.getByRole('heading', { name: 'Vue 3D — Maison' })).toBeVisible();
  const st = await sceneStats(page);
  expect(st.drawCalls).toBeGreaterThanOrEqual(4);
  expect(st.drawCalls).toBeLessThanOrEqual(40);
  expect(st.triangles).toBeLessThanOrEqual(200_000);

  // murs coupés par défaut, puis bas, puis pleins
  const walls = page.getByRole('radiogroup', { name: 'Murs' });
  await expect(walls.getByRole('radio', { name: 'Coupés' })).toHaveAttribute('aria-checked', 'true');
  await check(page);
  await shot(page, info, 'V3D-murs-coupes');
  await walls.getByRole('radio', { name: 'Bas' }).click();
  await shot(page, info, 'V3D-murs-bas');
  await walls.getByRole('radio', { name: 'Pleins' }).click();
  await shot(page, info, 'V3D-murs-pleins');
  await walls.getByRole('radio', { name: 'Coupés' }).click();

  // toucher la maquette au milieu : une pièce est choisie (vue de biais, le plan est centré)
  const view = page.getByRole('application', { name: 'Maquette 3D de Maison' });
  const box = (await view.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('link', { name: /^Ouvrir (Séjour|Bureau)$/ })).toBeVisible();

  // choix dans la liste (clavier), puis ouverture de la pièce
  await page.getByRole('navigation', { name: 'Pièces' }).getByRole('button', { name: 'Bureau' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Pièces' }).getByRole('button', { name: 'Bureau' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await check(page);
  await shot(page, info, 'V3D-piece-choisie');
  await page.getByRole('link', { name: 'Ouvrir Bureau' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/r/`));
  await expect(page.getByRole('heading', { name: 'Bureau' })).toBeVisible();

  // mode sombre : mêmes écrans, mêmes contrastes
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`/#/p/${id}`);
  // l'aperçu animé n'est monté que sur grand écran (sur téléphone, une icône mène à la vue 3D)
  if (info.project.name === 'desktop')
    await expect(card.locator('[data-draw-calls]')).not.toHaveAttribute('data-draw-calls', '0', {
      timeout: 15_000,
    });
  await expectAccessible(page);
  await shot(page, info, 'V3D-projet-apercu-sombre');
  await page.goto(`/#/p/${id}/3d`);
  await sceneStats(page);
  await page.getByRole('navigation', { name: 'Pièces' }).getByRole('button', { name: 'Séjour' }).click();
  await expectAccessible(page);
  await shot(page, info, 'V3D-murs-coupes-sombre');
});
