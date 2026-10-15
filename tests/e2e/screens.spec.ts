import { expect, test, type Page } from '@playwright/test';
import {
  addTile,
  cover,
  createProject,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  newWall,
  openPose,
  openRoom,
  shot,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('créer un mur de bout en bout, le retrouver, le gérer', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouveau projet' }).click();
  // nouveau projet : nom du projet et première pièce, sur le plan
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await dialog.getByLabel('Nom du projet', { exact: true }).fill('Pièce 288 × 240');
  await expect(dialog.getByRole('radio', { name: 'Rectangle' })).toHaveAttribute('aria-checked', 'true');
  await check(page);
  await shot(page, info, '09-nouveau-projet');

  // 1. pièce, saisie calculée
  await fillNumber(dialog, 'Nom', 'Pièce');
  const w = dialog.getByLabel('Longueur', { exact: true });
  await w.fill('300-12');
  await w.press('Enter');
  await expect(w).toHaveValue('288');
  await fillNumber(dialog, 'Largeur', '240');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const plan = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await fillNumber(plan, 'Hauteur sous plafond', '240');
  await check(page);
  await shot(page, info, '10-plan-piece');

  // 2. revêtement choisi après le plan : vue globale, la pièce, son mur 1 en carrelage
  await plan.getByRole('button', { name: 'Toutes les pièces' }).click();
  await plan.getByRole('link', { name: 'Choisir les revêtements' }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+$/);
  await page.getByRole('link', { name: /^Pièce Sans revêtement/ }).click();
  await cover(page, 'Mur 1');
  await check(page);
  await shot(page, info, '11-piece-mur');
  await openPose(page, 'Mur 1');
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();

  // 3. carreau : bibliothèque vide → nouveau carreau, utilisé par la bande
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Produit', exact: true }).click();
  await page.getByRole('button', { name: 'Nouveau carreau' }).click();
  const tileDialog = page.getByRole('dialog', { name: 'Nouveau carreau' });
  await tileDialog.getByLabel('Largeur', { exact: true }).fill('200');
  await check(page);
  await shot(page, info, '12-nouveau-carreau');
  await tileDialog.getByRole('button', { name: 'Ajouter et utiliser' }).click();
  await expect(page.getByRole('radio', { name: /60 × 20 cm/ })).toHaveAttribute('aria-checked', 'true');

  // 4. motif
  await page.getByRole('tab', { name: 'Pose', exact: true }).click();
  await page.getByRole('radio', { name: 'Bâtons rompus' }).click();
  await page.getByRole('radio', { name: '45°' }).click();
  await check(page);
  await shot(page, info, '14-motif');

  // vue globale, puis la pose depuis la liste des pièces, puis résultats
  await page.getByRole('link', { name: 'Pièce', exact: true }).click();
  await page.getByRole('link', { name: 'Projet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pièce 288 × 240' })).toBeVisible();
  await check(page);
  await shot(page, info, '15-vue-globale');
  await page.getByRole('link', { name: /^Carrelage · Pose 1/ }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  await expect(page.getByText('Pièce 288 × 240')).toBeVisible();
  await page.getByRole('link', { name: /\d+ carreaux/ }).click();
  await expect(page.getByRole('heading', { name: 'À commander' })).toBeVisible();
  await check(page);
  await shot(page, info, '20-resultats-mur');

  // persistance
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Résultats — Carrelage · Pose 1' })).toBeVisible();

  // résultats → vue globale → accueil, carte, menu
  await page.getByRole('link', { name: 'Projet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revêtements' })).toBeVisible();
  await page.getByRole('link', { name: 'Mes projets' }).click();
  await expect(page.getByRole('link', { name: 'Pièce 288 × 240' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Aperçu de Pièce, mur 1' })).toBeVisible();
  await check(page);
  await shot(page, info, '30-accueil');

  await page.getByRole('button', { name: 'Actions pour Pièce 288 × 240' }).click();
  await page.getByRole('button', { name: 'Renommer' }).click();
  await page.getByLabel('Nouveau nom').fill('Crédence cuisine');
  await page.getByRole('dialog').getByRole('button', { name: 'Renommer' }).click();
  await expect(page.getByRole('link', { name: 'Crédence cuisine' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions pour Crédence cuisine' }).click();
  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await expect(page.getByRole('heading', { name: 'Crédence cuisine (copie)' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: /Crédence cuisine/ })).toHaveCount(2);

  await page.getByRole('button', { name: 'Actions pour Crédence cuisine (copie)' }).click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('link', { name: /Crédence cuisine/ })).toHaveCount(1);
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('link', { name: /Crédence cuisine/ })).toHaveCount(2);
});

test('bibliothèque : ajouter, modifier, suppression refusée si utilisé', async ({ page }, info) => {
  await page.goto('/#/library');
  // modèles types posés au premier lancement
  const list = page.getByRole('list', { name: 'Carreaux' });
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await expect(list.getByRole('link', { name: /Grès cérame 60 × 60 cm/ })).toContainText('prix non saisi');
  await check(page);
  await shot(page, info, '40-bibliotheque-modeles');

  await page.getByRole('link', { name: 'Ajouter un carreau' }).click();
  await page.getByRole('radio', { name: 'Hexagone' }).click();
  await expect(page.getByLabel('Largeur plat à plat', { exact: true })).toBeVisible();
  await page.getByLabel('Largeur plat à plat', { exact: true }).fill('200');
  await page.getByLabel('Prix', { exact: true }).fill('42,5');
  await page.getByRole('radio', { name: 'Orienté' }).click();
  await check(page);
  await shot(page, info, '41-carreau-nouveau');
  await page.getByRole('button', { name: 'Ajouter le carreau' }).click();

  await expect(page.getByRole('link', { name: /Hexagone 20 cm/ })).toBeVisible();
  await expect(page.getByText('42,50 €/m²')).toBeVisible();
  await check(page);
  await shot(page, info, '42-bibliotheque');

  await page.getByRole('link', { name: /Hexagone 20 cm/ }).click();
  await page.getByLabel('Nom').fill('Hexagone terracotta');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('link', { name: /Hexagone terracotta/ })).toBeVisible();

  // utilisé par un projet → suppression refusée
  await newWall(page, null);
  await page.goto('/#/library');
  await list.getByRole('link', { name: /utilisé dans 1 projet/ }).click();
  await page.getByRole('button', { name: 'Supprimer le carreau' }).click();
  await expect(page.getByRole('dialog', { name: 'Carreau utilisé' })).toContainText('Pièce 300 × 240');
  await shot(page, info, '43-carreau-utilise');
});

test('pièce en L : sol et murs revêtus sur l’écran Pièce', async ({ page }, info) => {
  await addTile(page);
  const id = await createProject(page, { project: 'Pièce 400 × 300', name: 'Pièce', size: [400, 300], shape: 'En L' });
  await openRoom(page, id);
  await cover(page, 'Sol');
  for (const n of [1, 2, 6]) await cover(page, `Mur ${n}`, 'carrelage', n > 1 ? 'new' : undefined);
  await check(page);
  await shot(page, info, '16-piece-L');
  await expect(
    page.getByRole('region', { name: 'Sol et murs' }).getByRole('button', { name: /: Pose \d$/ }),
  ).toHaveText([/Sol :/, /Mur 1 /, /Mur 2 /, /Mur 6 /]);
  await openPose(page, 'Sol');
  await expect(page.getByRole('application', { name: /^Plan de Pièce, sol/ })).toBeVisible();
  await check(page);
  await shot(page, info, '22-projet-piece-sol');
});

test('réglages : thème sombre', async ({ page }, info) => {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await check(page);
  await shot(page, info, '50-reglages-sombre');

  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(page.getByRole('heading', { name: 'Aucun projet pour l’instant' })).toBeVisible();
  await check(page);
  await shot(page, info, '31-accueil-sombre');
});
