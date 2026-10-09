import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

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

  // 1. type
  await expect(page.getByText('Étape 1 sur 4')).toBeVisible();
  await expect(page.getByRole('radio', { name: /Un mur/ })).toHaveAttribute('aria-checked', 'true');
  await check(page);
  await shot(page, info, '10-assistant-type');
  await next(page);

  // 2. dimensions, saisie calculée
  const w = page.getByLabel('Largeur', { exact: true });
  await w.fill('300-12');
  await w.press('Enter');
  await expect(w).toHaveValue('288');
  await check(page);
  await shot(page, info, '11-assistant-dimensions');
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
  await expect(page.getByRole('img', { name: 'Aperçu de Mur' })).toBeVisible();
  await check(page);
  await shot(page, info, '13-assistant-carreau');
  await next(page);

  // 4. motif
  await page.getByRole('radio', { name: 'Bâtons rompus' }).click();
  await page.getByRole('radio', { name: '45°' }).click();
  await check(page);
  await shot(page, info, '14-assistant-motif');
  await page.getByRole('button', { name: 'Créer le projet' }).click();

  // éditeur puis résultats
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  await expect(page.getByText('Mur 288 × 240')).toBeVisible();
  await page.getByRole('link', { name: /\d+ carreaux/ }).click();
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  await check(page);
  await shot(page, info, '20-resultats-mur');

  // persistance
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Résultats — Mur 288 × 240' })).toBeVisible();
  await page.getByRole('link', { name: 'Retour au plan' }).click();

  // éditeur → écran Projet → accueil, carte, menu
  await page.getByRole('link', { name: 'Projet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Outils' })).toBeVisible();
  await page.getByRole('link', { name: 'Mes projets' }).click();
  await expect(page.getByRole('link', { name: 'Mur 288 × 240' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Aperçu de Mur' })).toBeVisible();
  await check(page);
  await shot(page, info, '30-accueil');

  await page.getByRole('button', { name: 'Actions pour Mur 288 × 240' }).click();
  await page.getByRole('button', { name: 'Renommer' }).click();
  await page.getByLabel('Nouveau nom').fill('Crédence cuisine');
  await page.getByRole('dialog').getByRole('button', { name: 'Renommer' }).click();
  await expect(page.getByRole('link', { name: 'Crédence cuisine' })).toBeVisible();

  await page.getByRole('button', { name: 'Actions pour Crédence cuisine' }).click();
  await page.getByRole('button', { name: 'Dupliquer' }).click();
  await expect(page.getByRole('button', { name: /^Crédence cuisine \(copie\)/ })).toBeVisible();
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
  await page.goto('/#/new/carrelage');
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  await page.goto('/#/library');
  await page.getByRole('link', { name: /Hexagone terracotta/ }).click();
  await page.getByRole('button', { name: 'Supprimer le carreau' }).click();
  await expect(page.getByRole('dialog', { name: 'Carreau utilisé' })).toContainText('Mur 300 × 240');
  await shot(page, info, '43-carreau-utilise');
});

test('pièce complète : murs et sol', async ({ page }, info) => {
  await page.goto('/#/new/carrelage');
  await page.getByRole('radio', { name: /Une pièce/ }).click();
  await next(page);
  await page.getByLabel('Mur C (longueur)').uncheck();
  await check(page);
  await shot(page, info, '15-assistant-piece');
  await next(page);
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next(page);
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByText('Pièce 240 × 180')).toBeVisible();
  await page.getByRole('button', { name: /Pièce 240 × 180/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Surfaces et pièce' });
  await expect(dlg.getByRole('button', { name: /^(Mur|Sol)/ })).toHaveText([/^Mur A/, /^Mur B/, /^Mur D/, /^Sol/]);
  await dlg.getByRole('button', { name: /^Sol/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('application', { name: /^Plan de Sol/ })).toBeVisible();
  await check(page);
  await shot(page, info, '22-projet-piece-sol');
});

test('réglages : thème sombre, import du fichier de l’ancienne version', async ({ page }, info) => {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await check(page);
  await shot(page, info, '50-reglages-sombre');

  const exportFile = JSON.stringify({
    format: 'calepinage-legacy-export',
    version: 1,
    data: {
      'calepinage-v3': JSON.stringify({
        surfaces: [{ name: 'Mur douche', W: 1800, H: 2100, zones: [{ pattern: 'herring', a: 450, b: 90 }] }],
        active: 0,
      }),
      'calepinage-nuancier': JSON.stringify({ tiles: ['#aa5533'], grouts: ['#333333'] }),
    },
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer un fichier' }).click();
  await (
    await chooser
  ).setFiles({ name: 'calepinage-export.json', mimeType: 'application/json', buffer: Buffer.from(exportFile) });
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Projet de l’ancienne version importé : 1 surface, 1 carreau.' })
      .first(),
  ).toBeVisible();

  const bad = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer un fichier' }).click();
  await (await bad).setFiles({ name: 'photo.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.getByText(/n’est pas un export de l’ancienne version/)).toBeVisible();

  await page.getByRole('link', { name: 'Accueil' }).click();
  await expect(page.getByRole('link', { name: 'Projet importé' })).toBeVisible();
  await check(page);
  await shot(page, info, '31-accueil-sombre-import');
});
