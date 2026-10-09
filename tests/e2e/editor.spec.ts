import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { addPlanWindow, expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

/** Crée un mur 300 × 240 en décalé ½, carreau 60 × 30, et ouvre l'éditeur ; renvoie l'identifiant du projet. */
async function newWall(page: Page): Promise<string> {
  await page.goto('/#/new/carrelage');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /\d+ carreaux/ })).toBeVisible();
  return /#\/p\/([^/]+)/.exec(page.url())![1]!;
}

const isMobile = (info: TestInfo) => info.project.name === 'mobile';

/** Ouvre un onglet du panneau (sur téléphone, lève d'abord le panneau tiré). */
async function tab(page: Page, info: TestInfo, name: string): Promise<void> {
  if (isMobile(info)) {
    const handle = page.getByRole('button', { name: /^Réglages :/ });
    if ((await handle.getAttribute('aria-expanded')) !== 'true') await handle.click();
  }
  await page.getByRole('tab', { name }).click();
}

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

/** Glisse sur le plan de (dx, dy) px depuis un point relatif du canvas. */
async function dragPlan(page: Page, fx: number, fy: number, dx: number, dy: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  const x = box.x + box.width * fx,
    y = box.y + box.height * fy;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(x + (dx * i) / 5, y + (dy * i) / 5);
  await page.mouse.up();
}

test('plan : glisser le motif, annuler, rétablir, toucher une pièce', async ({ page }, info) => {
  await newWall(page);
  await check(page);
  await shot(page, info, '60-editeur');

  await dragPlan(page, 0.5, 0.4, 37, 23);
  await tab(page, info, 'Motif');
  const offX = page.getByLabel('Décalage horizontal', { exact: true });
  await expect(offX).not.toHaveValue('0');
  const moved = await offX.inputValue();
  await shot(page, info, '61-motif-deplace');

  await page.getByRole('button', { name: 'Annuler', exact: true }).first().click();
  await expect(offX).toHaveValue('0');
  await page.getByRole('button', { name: 'Rétablir' }).click();
  await expect(offX).toHaveValue(moved);

  await page.getByRole('button', { name: 'Remettre le décalage à zéro' }).click();
  await expect(offX).toHaveValue('0');

  // toucher une pièce : sa description s'affiche
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
  await expect(page.getByText(/Pièce entière|Coupe droite/)).toBeVisible();

  // zoom
  await page.getByRole('button', { name: 'Zoomer', exact: true }).click();
  await page.getByRole('button', { name: 'Ajuster à l’écran' }).click();

  // persistance après rechargement
  await page.getByRole('button', { name: 'Rétablir' }).isDisabled();
  await dragPlan(page, 0.5, 0.4, 60, 0);
  await page.waitForTimeout(400);
  await page.reload();
  await tab(page, info, 'Motif');
  await expect(page.getByLabel('Décalage horizontal', { exact: true })).not.toHaveValue('0');
});

test('carreau : nouveau carreau, mélange, rendu', async ({ page }, info) => {
  await newWall(page);
  await tab(page, info, 'Carreau');
  await page.getByRole('button', { name: 'Nouveau carreau' }).click();
  const dlg = page.getByRole('dialog', { name: 'Nouveau carreau' });
  await dlg.getByRole('button', { name: '20 × 20' }).click();
  await dlg.getByRole('button', { name: 'Ajouter et utiliser' }).click();
  await expect(page.getByRole('radio', { name: /20 × 20 cm/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Alterné' }).click();
  await expect(page.getByRole('group', { name: 'Seconde couleur' })).toBeVisible();
  await expect(page.getByText(/Spatule crantée/)).toBeVisible();
  await check(page);
  await shot(page, info, '62-onglet-carreau');

  await page.getByRole('radio', { name: 'Rendu' }).click();
  await shot(page, info, '63-rendu');
});

test('photo du carreau appliquée dans le rendu, retournements aléatoires', async ({ page }, info) => {
  await newWall(page);
  await tab(page, info, 'Carreau');
  await page.getByRole('button', { name: 'Modifier ce carreau' }).click();
  const dlg = page.getByRole('dialog', { name: 'Modifier le carreau' });
  // photo 4 × 2 px : moitié claire, moitié foncée, pour voir les retournements
  const png = await page.evaluate(async () => {
    const c = new OffscreenCanvas(4, 2);
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8e2d6';
    g.fillRect(0, 0, 4, 2);
    g.fillStyle = '#7a6a55';
    g.fillRect(0, 0, 2, 2);
    const b = await c.convertToBlob({ type: 'image/png' });
    return [...new Uint8Array(await b.arrayBuffer())];
  });
  const chooser = page.waitForEvent('filechooser');
  await dlg.getByRole('button', { name: 'Choisir une photo' }).click();
  await (await chooser).setFiles({ name: 'carreau.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await expect(dlg.getByRole('status')).toHaveText('Photo appliquée.');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByLabel('Retourner la photo au hasard')).toBeChecked();
  await page.getByRole('radio', { name: 'Rendu' }).click();
  await shot(page, info, '62b-rendu-photo');
});

test('zones : ajouter, taille, modèle frise, supprimer et annuler', async ({ page }, info) => {
  await newWall(page);
  await tab(page, info, 'Zones');
  await page.getByRole('button', { name: 'Ajouter une zone' }).click();
  const list = page.getByRole('list', { name: 'Zones' });
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('radio', { name: 'Rangées' }).click();
  await page.getByLabel('Nombre de rangées', { exact: true }).fill('2');
  await page.getByLabel('Nombre de rangées', { exact: true }).press('Enter');
  await expect(page.getByText(/Hauteur de la zone : 60,3 cm/)).toBeVisible();
  await page.getByRole('button', { name: /Frise/ }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await check(page);
  await shot(page, info, '64-zones-frise');

  await page.getByRole('button', { name: 'Supprimer la zone' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);
});

test('ouvertures : fenêtre du plan avec tableaux, prise déplacée au clavier', async ({ page }, info) => {
  const id = await newWall(page);
  await addPlanWindow(page, id);
  await tab(page, info, 'Ouvertures');
  await page.getByRole('button', { name: /^Fenêtre 1/ }).click();
  await expect(page.getByRole('heading', { name: 'Fenêtre 1' })).toBeVisible();
  await expect(page.getByText(/Les cotes viennent du plan\./)).toBeVisible();
  const depth = page.getByLabel('Profondeur du tableau', { exact: true });
  await depth.fill('15');
  await depth.press('Enter');
  await expect(page.getByText(/Tableaux : \d+ pièces/)).toBeVisible();
  await check(page);
  await shot(page, info, '65-ouverture');

  await page.getByLabel('Type à ajouter').selectOption({ label: 'Prise, interrupteur' });
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prise 2' })).toBeVisible();
  const x = page.getByLabel('Depuis le bord gauche', { exact: true });
  const before = await x.inputValue();
  await page.getByRole('application').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(x).not.toHaveValue(before);
  await page.getByRole('button', { name: 'Centrer horizontalement' }).click();
  await expect(x).toHaveValue(before);
  await page.getByRole('radio', { name: 'Rendu' }).click();
  await shot(page, info, '66-ouvertures-rendu');
});

test('finitions : bords visibles, plinthes du sol, alerte actionnable', async ({ page }, info) => {
  await newWall(page);
  // sol de la pièce : plinthes sur le pourtour
  await page.getByRole('button', { name: /Mur 300 × 240/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Surfaces' });
  await dlg.getByLabel('Sol', { exact: true }).check();
  await dlg.getByRole('button', { name: /^Pièce, sol/ }).click();
  await page.keyboard.press('Escape');
  await tab(page, info, 'Finitions');
  await page.getByRole('button', { name: 'Périmètre' }).click();
  await expect(page.getByText(/\d+ pièces de 8 cm/)).toBeVisible();
  // mur : un bord visible
  await page.getByRole('button', { name: /Mur 300 × 240/ }).click();
  await dlg.getByRole('button', { name: /^Pièce, mur 1/ }).click();
  await page.keyboard.press('Escape');
  await tab(page, info, 'Finitions');
  await page.getByLabel('Droite', { exact: true }).uncheck();
  await expect(page.getByText(/coupes? apparentes? sur un bord visible/)).toBeVisible();
  await check(page);
  await shot(page, info, '67-finitions');
  await page.getByRole('button', { name: 'Bords cachés' }).click();
  await expect(page.getByRole('tab', { name: 'Finitions' })).toHaveAttribute('aria-selected', 'true');
});

test('optimisation : progression, résultat, annulation', async ({ page }, info) => {
  await newWall(page);
  await dragPlan(page, 0.5, 0.4, 25, 15);
  await page.getByRole('button', { name: 'Optimiser le départ de toutes les zones' }).click();
  await expect(page.getByText(/^Départ optimisé\./)).toBeVisible({ timeout: 20000 });
  await shot(page, info, '68-optimise');
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await tab(page, info, 'Motif');
  await expect(page.getByRole('button', { name: 'Optimiser le départ', exact: true })).toBeVisible();
});

test('surfaces : sol et murs de la pièce à cocher, puis résultats et plan de découpe', async ({ page }, info) => {
  await newWall(page);
  await page.getByRole('button', { name: /Mur 300 × 240/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Surfaces' });
  for (const name of ['Sol', 'Mur 2', 'Mur 3', 'Mur 4']) await dlg.getByLabel(name, { exact: true }).check();
  await expect(dlg.getByRole('button', { name: /^Pièce, sol/ })).toBeVisible();
  await expect(dlg.getByRole('button', { name: /^Pièce, mur [1-4]/ })).toHaveCount(4);
  await expectAccessible(page);
  await shot(page, info, '69-surfaces-piece');
  await dlg.getByRole('button', { name: /^Pièce, sol/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('application', { name: /^Plan de Pièce, sol/ })).toBeVisible();

  await page
    .getByRole('link', { name: /\d+ carreaux/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  await page.getByRole('tab', { name: 'Découpe' }).click();
  await expect(page.getByText('n° 1', { exact: true })).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
  await shot(page, info, '70-resultats');
  await page.getByRole('link', { name: 'Retour au plan' }).click();
  await expect(page.getByRole('application')).toBeVisible();
});
