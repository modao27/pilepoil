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

const panel = (page: Page) =>
  page.getByRole('complementary', { name: 'Réglages du parquet' }).or(page.locator('.sheet'));

test('parquet : pose droite d’une pièce du plan, résumé, motif annulable, achats', async ({ page }, info) => {
  // projet carrelage puis une pièce de 4 × 3 m dans le plan
  await page.goto('/#/new');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.goto(`/#/p/${id}/plan`);
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await setNumber(dialog, 'Nom', 'Séjour');
  await setNumber(dialog, 'Longueur', '400');
  await setNumber(dialog, 'Largeur', '300');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('application', { name: /1 pièce/ })).toBeVisible();

  // écran Projet : ajouter le parquet
  await page.getByRole('link', { name: 'Projet' }).click();
  await page.getByRole('button', { name: 'Ajouter parquet' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/m/parquet$`));

  // R1 dans l'appli : 16 rangs de stratifié 1285 × 192 sur 3984 × 2984
  const plan = page.getByRole('img', { name: /^Plan des lames : \d+ lames · \d+ paquets · perte \d+ %/ });
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

  // diagonale
  await setNumber(p, 'Angle des lames', '45');
  await expect(summary).not.toContainText('52 lames');
  await shot(page, info, '92-parquet-45');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(summary).toContainText('52 lames');

  // résultats et liste d'achat du projet
  await summary.click();
  await expect(page.getByRole('heading', { name: /^Résultats — / })).toBeVisible();
  await expect(page.getByText('Stratifié 1285 × 192 : 7 paquets')).toBeVisible();
  await check(page);
  await page.goto(`/#/p/${id}/achats`);
  await expect(page.getByText('Stratifié 1285 × 192', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/52 lames \+ 5 %/)).toBeVisible();
});
