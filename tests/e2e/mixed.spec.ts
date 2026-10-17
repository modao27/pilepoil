/**
 * Projet mixte (F1) : les quatre outils dans le même projet. Une cloison partage la maison ; le séjour reçoit du
 * parquet avec plinthes, une crédence carrelée, de la peinture au-dessus et sur le mur d'en face. La peinture lit les
 * plinthes du parquet, les achats regroupent les quatre outils, le dossier PDF du projet se génère.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cover,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  fillNumber,
  openRoom,
  shot,
  woodFloor,
} from './helpers';

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

/** Maison de 6 × 4 m coupée par une cloison au milieu : renvoie l'identifiant du projet. */
async function house(page: Page): Promise<string> {
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await setNumber(dialog, 'Nom du projet', 'Maison');
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '600');
  await setNumber(dialog, 'Largeur', '400');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  const panel = page.getByRole('complementary', { name: 'Réglages du plan' }).or(page.locator('.sheet'));
  await panel.getByRole('radio', { name: 'Travaux' }).click();
  await panel.getByRole('button', { name: 'Tracer une cloison' }).click();
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + 3);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 3);
  await expect(panel.getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  return id;
}

test('projet mixte : parquet, carrelage, peinture et cloison se lisent, achats et dossier communs', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const id = await house(page);

  // parquet au sol du séjour (plinthes prévues par défaut)
  await woodFloor(page, id, 'Séjour');

  // crédence carrelée jusqu'à 120 cm sur le mur 1, peinture au-dessus ; mur 3 peint en entier
  await openRoom(page, id, 'Séjour');
  await cover(page, 'Mur 1', 'carrelage');
  await fillNumber(page, 'Jusqu’à', '120');
  await page.locator('.free').getByRole('button', { name: 'Revêtir : peinture' }).click();
  await cover(page, 'Mur 3', 'peinture');
  await check(page);
  await shot(page, info, 'F1-piece-mixte');

  // résultats de la pièce : la peinture retire la bande des plinthes du parquet
  await page.getByRole('link', { name: /^Résultats de la pièce/ }).click();
  const painted = page.getByRole('article', { name: /^Peinture · / });
  await expect(painted.filter({ hasText: 'Plinthes déduites' })).toHaveCount(1);
  await expect(page.getByRole('article', { name: /^Parquet · / })).toBeVisible();
  await expect(page.getByRole('article', { name: /^Carrelage · / })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cloisons' })).toBeVisible();
  await check(page);

  // accueil : une ligne par outil sur la carte du projet
  await page.goto('/#/');
  const card = page.getByRole('article').filter({ hasText: 'Maison' });
  for (const tool of ['Carrelage', 'Parquet', 'Peinture', 'Cloisons']) await expect(card).toContainText(tool + ' :');

  // achats du projet : les quatre outils dans une seule liste
  await page.goto(`/#/p/${id}/achats`);
  await expect(page.getByRole('heading', { name: /^Achats — / })).toBeVisible();
  await expect(page.getByText(/^[\d,]+ \S+ · Stratifié 1285 × 192/).first()).toBeVisible();
  await expect(page.getByText(/^[\d,]+ \S+ · Plinthes$/)).toBeVisible();
  await expect(page.getByText(/ — pot de /).first()).toBeVisible();
  await expect(page.getByText(/^[\d,]+ \S+ · Plaque de plâtre standard/)).toBeVisible();
  await expect(page.getByText(/^[\d,]+ \S+ · Mortier-colle/).first()).toBeVisible();
  await expect(page.getByText(/1 sac de 25 kg/)).toBeVisible();
  await check(page);
  await shot(page, info, 'F1-achats-mixte');

  // détail du projet : un repli par outil, le premier ouvert, un sommaire pour aller aux autres
  await page.goto(`/#/p/${id}/resultats`);
  await page.getByRole('tab', { name: 'Détail' }).click();
  const folds = page.locator('details.fold');
  expect(await folds.count()).toBeGreaterThan(2);
  await expect(page.locator('details.fold[open]')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Aller à' }).getByRole('button', { name: 'Parquet' }).click();
  await expect(page.locator('details#d-parquet')).toHaveAttribute('open', '');
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/resultats$`));

  // dossier PDF du projet
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Dossier du projet (PDF)' }).click(),
  ]);
  expect(
    readFileSync((await download.path())!)
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');
});
