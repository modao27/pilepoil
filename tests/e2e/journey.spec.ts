/**
 * Parcours complet du parquet (docs/PLAN.md, P5) : dessiner deux pièces → poser un point de Hongrie → acheter →
 * suivre la pose. Écrit pour le téléphone (profil mobile 390 px), vérifié aussi sur ordinateur.
 */
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

test('parcours : deux pièces, point de Hongrie, achats, chantier', async ({ page }, info) => {
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

  // 3. le parquet : une pose sur les deux pièces, en point de Hongrie
  await page.getByRole('link', { name: 'Projet' }).click();
  await page.getByRole('button', { name: 'Ajouter parquet' }).click();
  const p = page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));
  await p.getByRole('button', { name: 'Créer une pose' }).click();
  await p.getByRole('checkbox', { name: 'Bureau' }).check();
  await p.getByRole('combobox', { name: 'Lame' }).selectOption({ label: 'Point de Hongrie 45° 600 × 90 (lames A/B)' });
  await p.getByRole('radio', { name: 'Hongrie' }).click();
  const summary = page.getByRole('link', { name: /lames · \d+ paquets/ }).first();
  await expect(summary).toBeVisible();
  // porte étroite : seuil conseillé, posé
  await p.getByRole('button', { name: 'Poser ce seuil' }).click();
  await expect(p.getByText('Seuil posé entre Séjour et Bureau')).toBeVisible();
  // axe aligné sur le mur de référence
  await p.getByRole('group', { name: 'Axe du motif' }).getByText('Aligné sur le mur de référence').click();
  await check(page);
  await shot(page, info, 'P2-parcours-hongrie');

  // 4. acheter : lames A et B, sous-couche, plinthes, barre de seuil
  await summary.click();
  await page.getByRole('tab', { name: 'Achats' }).click();
  await expect(page.getByText(/\(lames A\) : \d+ paquets?/)).toBeVisible();
  await expect(page.getByText(/\(lames B\) : \d+ paquets?/)).toBeVisible();
  await expect(page.getByText(/Barres de seuil : 1 barre/)).toBeVisible();
  await page.getByRole('link', { name: 'Liste d’achat du projet et prix' }).click();
  await expect(page.getByText('Sous-couche', { exact: true }).first()).toBeVisible();
  await check(page);
  await shot(page, info, 'P3-parcours-achats');

  // 5. suivre la pose ligne par ligne
  await page.goBack();
  await page.getByRole('link', { name: 'Suivre le chantier' }).click();
  await expect(page.getByRole('heading', { name: /— ligne 1 \(1 \/ \d+\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Toute cette ligne est posée' }).click();
  await expect(page.getByText(/^[1-9]\d* \/ \d+ pièces posées/)).toBeVisible();
  await page.getByRole('button', { name: 'Ligne suivante' }).click();
  await expect(page.getByRole('heading', { name: /— ligne \d+ \(2 \/ \d+\)/ })).toBeVisible();
  await check(page);
  await shot(page, info, 'P4-parcours-chantier');
});
