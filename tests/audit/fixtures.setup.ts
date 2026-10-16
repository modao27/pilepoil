/**
 * Jeux de données de l'audit, créés par le parcours normal puis figés dans tests/audit/fixtures/*.json.
 * Lancé seulement à la demande : AUDIT_FIXTURES=1 npm run test:audit -- --project=pc-1280x800-chromium fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cover, fillNumber, openRoom, woodFloor } from '../e2e/helpers';
import { dumpDb, expect, panel, test } from './audit';

test.skip(!process.env['AUDIT_FIXTURES'], 'jeux de données créés à la demande (AUDIT_FIXTURES=1)');

test('X0 jeu « maison » : quatre outils, deux poses continues, prix', async ({ page }) => {
  test.setTimeout(120_000);
  // maison de 6 × 4 m coupée par une cloison (comme tests/e2e/mixed.spec.ts)
  await page.goto('/#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  await fillNumber(dialog, 'Nom du projet', 'Maison Dupont');
  await fillNumber(dialog, 'Nom', 'Séjour');
  await fillNumber(dialog, 'Longueur', '600');
  await fillNumber(dialog, 'Largeur', '400');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page).toHaveURL(/#\/p\/[^/]+\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await panel(page).getByRole('radio', { name: 'Travaux' }).click();
  await panel(page).getByRole('button', { name: 'Tracer une cloison' }).click();
  const box = (await page.locator('polygon.floor').first().boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + 3);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 3);
  await expect(panel(page).getByRole('heading', { name: 'Cloison 1' })).toBeVisible();
  await panel(page).getByRole('radio', { name: 'État des lieux' }).click();

  // salle de bain en L à côté
  await page.getByRole('banner').getByRole('button', { name: 'Ajouter une pièce' }).click();
  const add = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  await add.getByRole('radio', { name: 'En L' }).click();
  await add.getByLabel('Nom', { exact: true }).fill('Salle de bain');
  await fillNumber(add, 'Longueur', '300');
  await fillNumber(add, 'Largeur', '250');
  await fillNumber(add, 'Retrait en longueur', '100');
  await fillNumber(add, 'Retrait en largeur', '80');
  await add.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(add).toBeHidden();

  // parquet au séjour ; crédence carrelée jusqu'à 120 cm, peinture au-dessus ; mur 3 peint
  await woodFloor(page, id, 'Séjour');
  await openRoom(page, id, 'Séjour');
  await cover(page, 'Mur 1', 'carrelage');
  await fillNumber(page, 'Jusqu’à', '120');
  await page.locator('.free').getByRole('button', { name: 'Revêtir : peinture' }).click();
  await cover(page, 'Mur 3', 'peinture');

  // salle de bain : sol carrelé, murs 1 et 2 carrelés en une pose qui fait l'angle
  await openRoom(page, id, 'Salle de bain');
  await cover(page, 'Sol', 'carrelage');
  await cover(page, 'Mur 1', 'carrelage');
  await cover(page, 'Mur 2', 'carrelage', 'continue');

  // un prix saisi aux achats
  await page.goto(`/#/p/${id}/achats`);
  await expect(page.getByRole('heading', { name: /^Achats — / })).toBeVisible();
  const price = page.getByRole('textbox', { name: /^Prix / }).first();
  await price.fill('24,90');
  await price.press('Enter');
  await page.waitForTimeout(500);

  const dump = await dumpDb(page);
  const dir = join(import.meta.dirname, 'fixtures');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'maison.json'), JSON.stringify(dump));
});
