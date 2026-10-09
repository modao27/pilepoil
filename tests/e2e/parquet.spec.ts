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

/** Projet carrelage, une pièce de 4 × 3 m dans le plan, puis le parquet ajouté : renvoie l'identifiant. */
async function parquetProject(page: Page): Promise<string> {
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
  return id;
}

test('parquet : pose droite d’une pièce du plan, résumé, motif annulable, achats', async ({ page }, info) => {
  const id = await parquetProject(page);

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
  await expect(page.getByText(/Point de Hongrie 60° 500 × 90 \(lames A\/B\) \(lames A\) : \d+ paquets?/)).toBeVisible();
  await expect(page.getByText(/\(lames B\) : \d+ paquets?/)).toBeVisible();
  await page.goto(`/#/p/${id}/m/parquet`);
});
