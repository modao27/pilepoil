import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, fillNumber, newWall, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

const next = (page: Page) => page.getByRole('button', { name: 'Suivant' }).click();

test('créer un mur de bout en bout, le retrouver, le gérer', async ({ page }, info) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Nouveau projet' }).click();
  // choix de l'outil : carrelage, avec son assistant
  await expect(page.getByRole('heading', { name: 'Que voulez-vous poser ?' })).toBeVisible();
  await check(page);
  await shot(page, info, '09-nouveau-projet');
  await page.getByRole('link', { name: 'Commencer : carrelage' }).click();

  // 1. pièce, saisie calculée
  await expect(page.getByText('Étape 1 sur 4')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Rectangle' })).toHaveAttribute('aria-checked', 'true');
  const w = page.getByLabel('Longueur de la pièce', { exact: true });
  await w.fill('300-12');
  await w.press('Enter');
  await expect(w).toHaveValue('288');
  await fillNumber(page, 'Hauteur sous plafond', '240');
  await check(page);
  await shot(page, info, '10-assistant-piece');
  await next(page);

  // 2. à carreler : le mur 1 seul
  await page.getByRole('checkbox', { name: 'Sol', exact: true }).uncheck();
  await next(page);
  await expect(page.getByRole('alert')).toHaveText('Choisissez le sol ou au moins un mur.');
  await page.getByRole('checkbox', { name: /^Mur 1 / }).check();
  await check(page);
  await shot(page, info, '11-assistant-a-carreler');
  await next(page);

  // 3. carreau : bibliothèque vide → formulaire
  await expect(page.getByRole('button', { name: 'Ajouter ce carreau' })).toBeVisible();
  await next(page);
  await expect(page.getByRole('alert')).toHaveText('Ajoutez le carreau, ou choisissez-en un dans la liste.');
  await page.getByLabel('Largeur', { exact: true }).fill('200');
  await check(page);
  await shot(page, info, '12-assistant-nouveau-carreau');
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await expect(page.getByRole('radio', { name: /60 × 20 cm/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('img', { name: 'Aperçu de Pièce, mur 1' })).toBeVisible();
  await check(page);
  await shot(page, info, '13-assistant-carreau');
  await next(page);

  // 4. motif
  await page.getByRole('radio', { name: 'Bâtons rompus' }).click();
  await page.getByRole('radio', { name: '45°' }).click();
  await check(page);
  await shot(page, info, '14-assistant-motif');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  // écran Carrelage, éditeur puis résultats
  await expect(page.getByRole('heading', { name: 'Carrelage — Pièce 288 × 240' })).toBeVisible();
  await check(page);
  await shot(page, info, '15-carrelage');
  await page.getByRole('link', { name: 'Ouvrir Pièce, mur 1' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  await expect(page.getByText('Pièce 288 × 240')).toBeVisible();
  await page.getByRole('link', { name: /\d+ carreaux/ }).click();
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  await check(page);
  await shot(page, info, '20-resultats-mur');

  // persistance
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Résultats — Pièce 288 × 240' })).toBeVisible();
  await page.getByRole('link', { name: 'Carrelage', exact: true }).click();

  // écran Carrelage → écran Projet → accueil, carte, menu
  await page.getByRole('link', { name: 'Projet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Outils' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Carrelage — Crédence cuisine (copie)' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Aucun carreau' })).toBeVisible();
  await check(page);
  await shot(page, info, '40-bibliotheque-vide');

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
  await newWall(page, async () => {});
  await page.goto('/#/library');
  await page.getByRole('link', { name: /Hexagone terracotta/ }).click();
  await page.getByRole('button', { name: 'Supprimer le carreau' }).click();
  await expect(page.getByRole('dialog', { name: 'Carreau utilisé' })).toContainText('Pièce 300 × 240');
  await shot(page, info, '43-carreau-utilise');
});

test('pièce en L : sol et murs cochés dans l’assistant', async ({ page }, info) => {
  await page.goto('/#/new/carrelage');
  await page.getByRole('radio', { name: 'En L' }).click();
  await fillNumber(page, 'Longueur de la pièce', '400');
  await fillNumber(page, 'Largeur de la pièce', '300');
  await next(page);
  for (const n of [1, 2, 6]) await page.getByRole('checkbox', { name: new RegExp(`^Mur ${n} `) }).check();
  await expect(page.getByRole('img', { name: 'Pièce dessinée, murs numérotés' })).toBeVisible();
  await check(page);
  await shot(page, info, '16-assistant-piece-L');
  await next(page);
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next(page);
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('heading', { name: 'Carrelage — Pièce 400 × 300' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Ouvrir Pièce, / })).toHaveText([
    /^sol/i,
    /^mur 1/i,
    /^mur 2/i,
    /^mur 6/i,
  ]);
  await page.getByRole('link', { name: 'Ouvrir Pièce, sol' }).click();
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
