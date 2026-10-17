/**
 * Parcours complet du parquet (docs/PLAN.md, P5) : dessiner deux pièces → poser un point de Hongrie → acheter →
 * suivre la pose. Écrit pour le téléphone (profil mobile 390 px), vérifié aussi sur ordinateur.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot, step, woodFloor } from './helpers';

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

test('parcours : deux pièces, point de Hongrie, achats', async ({ page }, info) => {
  test.setTimeout(120_000);

  // 1. nouveau projet de parquet : on commence par le plan
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouveau projet' }).click();
  const first = page.getByRole('dialog', { name: 'Nouveau projet' });
  await setNumber(first, 'Nom du projet', 'Maison');
  const dialog = page.getByRole('dialog', { name: /^(Nouveau projet|Ajouter une pièce)$/ });
  await expect(dialog).toBeVisible();

  // 2. deux pièces reliées par une porte
  const pp = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '400');
  await setNumber(dialog, 'Largeur', '300');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(pp.getByRole('heading', { name: 'Séjour' })).toBeVisible();
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
  await shot(page, info, 'P1-parcours-plan');

  // 3. le parquet : le sol du séjour (écran Pièce), puis le bureau relié par la porte, en point de Hongrie
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await woodFloor(page, id, 'Séjour');
  const p = page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));
  await step(page, 'Découpage');
  await p.getByRole('checkbox', { name: 'Bureau' }).check();
  await step(page, 'Produit');
  await p.getByRole('combobox', { name: 'Lame' }).selectOption({ label: 'Point de Hongrie 45° 600 × 90 (lames A/B)' });
  await step(page, 'Pose');
  await p.getByRole('radio', { name: 'Hongrie' }).click();
  const summary = page.getByRole('link', { name: /lames · \d+ paquets/ }).first();
  await expect(summary).toBeVisible();
  // porte étroite : seuil conseillé, posé
  await step(page, 'Découpage');
  await p.getByRole('button', { name: 'Poser ce seuil' }).click();
  await expect(p.getByText('Seuil posé entre Séjour et Bureau')).toBeVisible();
  // axe aligné sur le mur de référence
  await step(page, 'Pose');
  await p.getByRole('group', { name: 'Axe du motif' }).getByText('Aligné sur le mur de référence').click();
  await check(page);
  await shot(page, info, 'P2-parcours-hongrie');

  // 4. acheter : lames A et B, sous-couche, plinthes, barre de seuil
  await summary.click();
  await expect(page.getByText(/\(lames A\) : \d+ lames/)).toBeVisible();
  await expect(page.getByText(/\(lames B\) : \d+ lames/)).toBeVisible();
  await page.getByRole('tab', { name: 'Détail' }).click();
  await expect(page.getByText(/Seuils : 1 barre de seuil/)).toBeVisible();
  await page.goto(`/#/p/${id}/achats`);
  await expect(page.getByText(/^[\d,]+ \S+ · Sous-couche$/).first()).toBeVisible();
  await check(page);
  await shot(page, info, 'P3-parcours-achats');
});
