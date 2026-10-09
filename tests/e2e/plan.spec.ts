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

test('plan : pièce en L avec poteau et porte, seconde pièce reliée par un passage, tout annulable', async ({
  page,
}, info) => {
  // nouveau projet : le plan s'ouvre avec la fenêtre « Nouveau projet » (nom du projet, première pièce)
  await page.goto('/#/new');
  const first = page.getByRole('dialog', { name: 'Nouveau projet' });
  await expect(first).toBeVisible();
  await setNumber(first, 'Nom du projet', 'Maison');
  const dialog = page.getByRole('dialog', { name: /^(Nouveau projet|Ajouter une pièce)$/ });
  await dialog.getByRole('radio', { name: 'En L' }).click();
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '600');
  await setNumber(dialog, 'Largeur', '500');
  await setNumber(dialog, 'Retrait en longueur', '300');
  await setNumber(dialog, 'Retrait en largeur', '200');
  await shot(page, info, '61-plan-ajout-L');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(dialog).toBeHidden();
  // enregistré avec sa première pièce : l'adresse devient celle de son plan, l'éditeur reste ouvert
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await expect(page.getByRole('heading', { name: /^Maison/ })).toBeVisible();

  const p = panel(page);
  await expect(p.getByRole('heading', { name: 'Séjour' })).toBeVisible();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();

  // poteau
  await p.getByRole('button', { name: 'Ajouter un obstacle' }).click();
  await expect(p.getByRole('heading', { name: 'Obstacle — Séjour' })).toBeVisible();
  await setNumber(p, 'Largeur', '25');

  // porte sur le mur 2 (côté droit, x = 6 m)
  await p.getByRole('button', { name: 'Retour à Séjour' }).click();
  await p
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .nth(1)
    .click();
  await expect(p.getByRole('heading', { name: 'Mur 2 — Séjour' })).toBeVisible();
  await p.getByRole('button', { name: 'Ajouter une porte' }).click();
  await expect(p.getByRole('heading', { name: 'Porte — Séjour' })).toBeVisible();
  await check(page);
  await shot(page, info, '62-plan-L-poteau-porte');

  // seconde pièce, porte sur son mur 4 (côté gauche)
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  await dialog.getByRole('radio', { name: 'Rectangle' }).click();
  await setNumber(dialog, 'Nom', 'Cuisine');
  await setNumber(dialog, 'Longueur', '300');
  await setNumber(dialog, 'Largeur', '300');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Cuisine' })).toBeVisible();
  await p
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .nth(3)
    .click();
  await p.getByRole('button', { name: 'Ajouter une porte' }).click();

  // relier les deux portes
  await p.getByRole('button', { name: 'Retour à Cuisine' }).click();
  await p.getByRole('button', { name: 'Toutes les pièces' }).click();
  await p.getByRole('button', { name: 'Séjour', exact: true }).click();
  await p.getByRole('button', { name: /^Porte, mur 2/ }).click();
  await p.getByRole('button', { name: 'Relier à une autre porte' }).click();
  await expect(page.getByRole('application', { name: /choix de la porte à relier/ })).toBeVisible();
  await shot(page, info, '63-plan-liaison');
  await p.getByRole('button', { name: 'Porte de Cuisine, mur 4' }).click();
  await expect(p.getByRole('heading', { name: 'Passage' })).toBeVisible();
  await expect(p.getByText('Entre Séjour et Cuisine.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Problèmes à corriger' })).toHaveCount(0);
  await check(page);
  await shot(page, info, '64-plan-passage');

  // tout est annulable : passage (et déplacement de la cuisine), porte, cuisine…
  const undo = page.getByRole('button', { name: 'Annuler', exact: true });
  await undo.click();
  await expect(p.getByRole('heading', { name: 'Passage' })).toBeHidden();
  for (let i = 0; i < 8 && (await undo.isEnabled()); i++) await undo.click();
  await expect(undo).toBeDisabled();
  await expect(page.getByRole('application', { name: /0 pièce/ })).toBeVisible();
  const redo = page.getByRole('button', { name: 'Rétablir' });
  while (await redo.isEnabled()) await redo.click();
  await expect(page.getByRole('application', { name: /2 pièces/ })).toBeVisible();
  await expect(page.locator('line.passage')).toHaveCount(1);

  // enregistré : retour au projet, puis réouverture
  await page.getByRole('link', { name: 'Projet' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}$`));
  await expect(page.getByRole('heading', { name: 'Outils' })).toBeVisible();
  await expect(page.getByRole('link', { name: /2 pièces/ })).toBeVisible();
  await check(page);
  await shot(page, info, '60-projet');
  await shot(page, info, '65-projet-plan');
  await page.reload();
  await page.getByRole('link', { name: /2 pièces/ }).click();
  await expect(page.locator('line.passage')).toHaveCount(1);
  await expect(page.locator('.obstacle')).toHaveCount(1);
});

test('plan : dessin libre point par point, aimanté', async ({ page }, info) => {
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByRole('radio', { name: 'Dessin' }).click();
  await dialog.getByRole('button', { name: 'Commencer le dessin' }).click();
  const plan = page.getByRole('application', { name: /dessin en cours/ });
  const box = (await plan.boundingBox())!;
  const at = (fx: number, fy: number) => page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await at(0.2, 0.2);
  await at(0.7, 0.21);
  await at(0.69, 0.6);
  await at(0.2, 0.61);
  await shot(page, info, '66-plan-dessin');
  await at(0.2, 0.2);
  // contour fermé : la pièce se nomme, puis le projet est créé avec elle
  const naming = page.getByRole('dialog', { name: 'Nommer la pièce' });
  await naming.getByLabel('Nom de la pièce', { exact: true }).fill('Entrée');
  await naming.getByRole('button', { name: 'Créer la pièce' }).click();
  await expect(page.getByRole('application', { name: /1 pièce$/ })).toBeVisible();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  await expect(panel(page).getByRole('heading', { name: 'Entrée' })).toBeVisible();

  // aimantation aux angles droits : 4 murs, rectangle (les cotes opposées sont égales)
  const dims = await page.locator('.dim text').allTextContents();
  expect(dims).toHaveLength(4);
  expect(dims[0]).toBe(dims[2]);
  expect(dims[1]).toBe(dims[3]);

  // renommer le projet depuis le plan
  await page.getByRole('button', { name: 'Renommer le projet' }).click();
  const rename = page.getByRole('dialog', { name: 'Renommer le projet' });
  await rename.getByLabel('Nom du projet', { exact: true }).fill('Studio');
  await rename.getByRole('button', { name: 'Renommer' }).click();
  await expect(page.getByRole('heading', { name: /^Studio/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Studio/ })).toBeVisible();
});
