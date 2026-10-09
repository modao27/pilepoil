import { expect, test, type Locator, type Page } from '@playwright/test';
import { emptyProject, expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

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

const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));

/** Projet parquet, une pièce de 4 × 3 m dans le plan, une pose : renvoie l'identifiant. */
async function parquetProject(page: Page): Promise<string> {
  const id = await emptyProject(page);
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '400');
  await setNumber(dialog, 'Largeur', '300');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();

  // parquet : première pose sur la pièce
  await page.goto(`/#/p/${id}/m/parquet`);
  await page.getByRole('button', { name: 'Créer une pose' }).click();
  return id;
}

test('parquet : pose droite d’une pièce du plan, résumé, motif annulable, achats', async ({ page }, info) => {
  const id = await parquetProject(page);

  // R1 dans l'appli : 16 rangs de stratifié 1285 × 192 sur 3984 × 2984
  const plan = page.getByRole('application', { name: /^Plan des lames : \d+ lames · \d+ paquets · perte \d+ %/ });
  await expect(plan).toBeVisible();
  await expect(page.locator('polygon.piece')).toHaveCount(64);
  const summary = page.getByRole('link', { name: /lames · \d+ paquets/ }).first();
  await expect(summary).toContainText('52 lames · 7 paquets');
  await check(page);
  await shot(page, info, '90-parquet');

  // décalage ½ puis annulation
  const p = panel(page);
  await p.getByRole('radio', { name: '½' }).click();
  await expect(summary).not.toContainText('52 lames');
  await expect(p.getByRole('radio', { name: '½' })).toHaveAttribute('aria-checked', 'true');
  await shot(page, info, '91-parquet-demi');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(summary).toContainText('52 lames · 7 paquets');

  // glisser la pose sur le plan : les lames bougent ; un geste = une seule étape d'annulation
  const firstPiece = page.locator('polygon.piece').first();
  const before = await firstPiece.getAttribute('points');
  const box = (await plan.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 5; k++) await page.mouse.move(box.x + box.width / 2 + k * 6, box.y + box.height / 2 + k * 6);
  await page.mouse.up();
  await expect(firstPiece).not.toHaveAttribute('points', before!);
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(firstPiece).toHaveAttribute('points', before!);
  // au clavier : flèches
  await plan.focus();
  await page.keyboard.press('ArrowDown');
  await expect(firstPiece).not.toHaveAttribute('points', before!);
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(firstPiece).toHaveAttribute('points', before!);

  // seuil tracé à la main : deux touchers sur le plan, prolongé jusqu'aux murs, puis retiré
  await p.getByRole('button', { name: 'Tracer un seuil' }).click();
  const b2 = (await plan.boundingBox())!;
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height * 0.45);
  await page.mouse.click(b2.x + b2.width / 2 + 2, b2.y + b2.height * 0.55);
  await expect(p.getByText('Seuil posé', { exact: true })).toBeVisible();
  await expect(page.locator('line.threshold:not(.proposed)')).toHaveCount(1);
  await p.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.locator('line.threshold')).toHaveCount(0);

  // diagonale
  await setNumber(p, 'Angle des lames', '45');
  await expect(summary).not.toContainText('52 lames');
  await shot(page, info, '92-parquet-45');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(summary).toContainText('52 lames');

  // optimisation du départ : progression puis départ appliqué (ou déjà le meilleur), jamais plus de lames
  await p.getByRole('button', { name: 'Optimiser le départ' }).click();
  await expect(page.getByText(/Départ optimisé : 52 → (5[0-2]|4\d) lames|déjà le meilleur/)).toBeVisible();
  await expect(p.getByRole('button', { name: 'Optimiser le départ' })).toBeEnabled();

  // résultats et liste d'achat du projet
  await summary.click();
  await expect(page.getByRole('heading', { name: /^Résultats — / })).toBeVisible();
  // plan coté, fiche de coupe, achats
  await expect(page.getByRole('img', { name: 'Plan coté' })).toBeVisible();
  await expect(page.locator('text.dim').first()).toHaveText('400');
  await check(page);
  await shot(page, info, '99-parquet-resultats-plan');
  await page.getByRole('tab', { name: 'Coupes' }).click();
  await expect(page.getByRole('heading', { name: 'Séjour — rang 1', exact: true })).toBeVisible();
  await expect(page.getByText(/^1\. lame neuve → couper à/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Plinthes : \d+ barres/ })).toBeVisible();
  await check(page);
  await shot(page, info, '99-parquet-resultats-coupes');
  await page.getByRole('tab', { name: 'Achats' }).click();
  await expect(page.getByText(/Stratifié 1285 × 192 : 7 paquets/)).toBeVisible();
  await expect(page.getByText(/Sous-couche : 1 rouleau/)).toBeVisible();
  await expect(page.getByText(/Plinthes : 6 barres/)).toBeVisible();
  // export PDF
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en PDF' }).click();
  expect((await download).suggestedFilename()).toMatch(/parquet\.pdf$/);
  await check(page);
  await page.goto(`/#/p/${id}/achats`);
  await expect(page.getByText('Stratifié 1285 × 192', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/52 lames \+ 5 %/)).toBeVisible();
});

test('parquet : bâton rompu et point de Hongrie, axe du motif, lames A et B', async ({ page }, info) => {
  const id = await parquetProject(page);
  const p = panel(page);
  const summary = page.getByRole('link', { name: /lames · \d+ paquets/ }).first();
  await expect(summary).toContainText('52 lames');

  // lame à bâton rompu, puis le motif
  await p.getByRole('combobox', { name: 'Lame' }).selectOption({ label: 'Bâton rompu 600 × 100 (lames A/B)' });
  await p.getByRole('radio', { name: 'Bâton rompu' }).click();
  await expect(summary).not.toContainText('52 lames');
  await expect(p.getByRole('radio', { name: '½' })).toHaveCount(0);

  // pièce sans porte : deux propositions d'axe, chacune avec sa plus petite coupe
  const axes = p.getByRole('group', { name: 'Axe du motif' });
  await expect(axes.getByRole('radio')).toHaveCount(2);
  await expect(axes.getByText(/plus petite coupe en bord : \d+ mm/)).toHaveCount(2);
  await expect(axes.getByRole('radio', { name: /Centre de la pièce/ })).toBeChecked();
  const before = await summary.textContent();
  await axes.getByText('Aligné sur le mur de référence').click();
  await expect(axes.getByRole('radio', { name: /Aligné sur le mur de référence/ })).toBeChecked();
  await expect(summary).not.toHaveText(before!);
  await check(page);
  await shot(page, info, '95-parquet-baton-rompu');

  // point de Hongrie à 60°
  await p.getByRole('combobox', { name: 'Lame' }).selectOption({ label: 'Point de Hongrie 60° 500 × 90 (lames A/B)' });
  await p.getByRole('radio', { name: 'Hongrie' }).click();
  await p.getByRole('radio', { name: '60°' }).click();
  await expect(p.getByRole('radio', { name: '60°' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('polygon.piece').first()).toBeVisible();
  await check(page);
  await shot(page, info, '96-parquet-hongrie-60');

  // achats : lames A et B
  await summary.click();
  await page.getByRole('tab', { name: 'Achats' }).click();
  await expect(page.getByText(/Point de Hongrie 60° 500 × 90 \(lames A\/B\) \(lames A\) : \d+ paquets?/)).toBeVisible();
  await expect(page.getByText(/\(lames B\) : \d+ paquets?/)).toBeVisible();
  await page.goto(`/#/p/${id}/m/parquet`);
});

test('parquet : deux pièces reliées par une porte, seuil conseillé, poses séparées', async ({ page }, info) => {
  const id = await parquetProject(page);

  // seconde pièce à droite, portes face à face, passage
  await page.goto(`/#/p/${id}/plan`);
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  const pp = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await page.getByRole('button', { name: 'Ajouter une pièce' }).first().click();
  await setNumber(dialog, 'Nom', 'Bureau');
  await setNumber(dialog, 'Longueur', '300');
  await setNumber(dialog, 'Largeur', '300');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(pp.getByRole('heading', { name: 'Bureau' })).toBeVisible();
  await pp
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .nth(3)
    .click();
  await pp.getByRole('button', { name: 'Ajouter une porte' }).click();
  await pp.getByRole('button', { name: 'Retour à Bureau' }).click();
  await pp.getByRole('button', { name: 'Toutes les pièces' }).click();
  await pp.getByRole('button', { name: 'Séjour', exact: true }).click();
  await pp
    .getByRole('button', { name: /^Ouvertures et épaisseur/ })
    .nth(1)
    .click();
  await pp.getByRole('button', { name: 'Ajouter une porte' }).click();
  await pp.getByRole('button', { name: 'Relier à une autre porte' }).click();
  await pp.getByRole('button', { name: 'Porte de Bureau, mur 4' }).click();
  await expect(pp.getByRole('heading', { name: 'Passage' })).toBeVisible();

  // parquet : les deux pièces dans la pose
  await page.goto(`/#/p/${id}/m/parquet`);
  const p = panel(page);
  const summary = page.getByRole('link', { name: /lames · \d+ paquets/ }).first();
  await expect(summary).toContainText('52 lames');
  await p.getByRole('checkbox', { name: 'Bureau' }).check();
  await expect(summary).not.toContainText('52 lames');
  await expect(p.getByText(/^Passage de \d+ mm seulement/)).toBeVisible();
  const advice = p.getByText('Seuil conseillé entre Séjour et Bureau : passage étroit');
  await expect(advice).toBeVisible();
  await expect(page.locator('line.threshold.proposed')).toHaveCount(1);
  await check(page);
  await shot(page, info, '97-parquet-deux-pieces');

  // poser le seuil, puis annuler
  await p.getByRole('button', { name: 'Poser ce seuil' }).click();
  await expect(p.getByText('Seuil posé entre Séjour et Bureau')).toBeVisible();
  await expect(page.locator('line.threshold:not(.proposed)')).toHaveCount(1);
  await expect(p.getByText(/^Passage de \d+ mm seulement/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(advice).toBeVisible();

  // séparer en deux poses : la nouvelle pose est affichée, son angle est libre
  await p.getByRole('button', { name: 'Séparer en deux poses' }).click();
  const which = p.getByRole('combobox', { name: 'Pose affichée' });
  await expect(which).toHaveValue(/.+/);
  await expect(which.locator('option:checked')).toHaveText('Pose 2');
  await expect(p.getByText('Limite avec une autre pose.')).toHaveCount(0);
  await setNumber(p, 'Angle des lames', '90');
  await expect(page.locator('g.other polygon.piece').first()).toBeAttached();
  await which.selectOption({ label: 'Pose 1' });
  await expect(p.getByText('Limite avec une autre pose.')).toBeVisible();
  await expect(p.getByText(/recouvre une autre pose/)).toHaveCount(0);
  await check(page);
  await shot(page, info, '98-parquet-poses-separees');

  // supprimer la pose 2 : la pose 1 reprend toute la surface
  await which.selectOption({ label: 'Pose 2' });
  await p.getByRole('button', { name: 'Supprimer cette pose' }).click();
  await expect(p.getByRole('combobox', { name: 'Pose affichée' })).toHaveCount(0);
  await expect(advice).toBeVisible();
});

test('parquet : chantier rang par rang, hors ligne, gardé au rechargement', async ({ page, context }, info) => {
  const id = await parquetProject(page);
  await expect(page.getByRole('link', { name: /lames · \d+ paquets/ }).first()).toContainText('52 lames');
  await page.goto(`/#/p/${id}/m/parquet/results`);
  await page.getByRole('link', { name: 'Suivre le chantier' }).click();
  await expect(page.getByRole('heading', { name: /^Chantier — / })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Séjour — rang 1 \(1 \/ 16\)/ })).toBeVisible();
  await expect(page.getByText('0 / 64 pièces posées')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  // sans réseau : cocher une pièce, puis tout le rang, passer au suivant
  await context.setOffline(true);
  await page.getByRole('checkbox', { name: /^1\. lame neuve → couper à/ }).check();
  await expect(page.getByText('1 / 64 pièces posées')).toBeVisible();
  await page.getByRole('button', { name: 'Tout ce rang est posé' }).click();
  await expect(page.getByText('4 / 64 pièces posées')).toBeVisible();
  await check(page);
  await shot(page, info, '9a-parquet-chantier');
  await page.getByRole('button', { name: 'Rang suivant' }).click();
  await expect(page.getByRole('heading', { name: /rang 2 \(2 \/ 16\)/ })).toBeVisible();

  // rechargement hors ligne : progression et rang retrouvés
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByText('4 / 64 pièces posées')).toBeVisible();
  await expect(page.getByRole('heading', { name: /rang 2 \(2 \/ 16\)/ })).toBeVisible();
  await context.setOffline(false);

  // calcul changé (décalage ½) : bandeau, garder ce qui existe encore
  await page.goto(`/#/p/${id}/m/parquet`);
  await panel(page).getByRole('radio', { name: '½' }).click();
  await expect(page.getByRole('link', { name: /lames · \d+ paquets/ }).first()).not.toContainText('52 lames');
  await page.goto(`/#/p/${id}/m/parquet/chantier`);
  await expect(page.getByRole('alert')).toContainText('Le calcul a changé');
  await page.getByRole('button', { name: 'Repartir de zéro' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText(/^0 \/ \d+ pièces posées/)).toBeVisible();
});
