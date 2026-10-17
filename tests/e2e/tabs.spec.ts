/** Deux onglets sur le même projet (lot D) : les enregistrements se diffusent, aucun n'écrase l'autre en silence. */
import { expect, test, type Page } from '@playwright/test';
import { newWall, savedProjectNames } from './helpers';

async function rename(page: Page, name: string) {
  await page.getByRole('button', { name: 'Renommer le projet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Renommer le projet' });
  await dialog.getByLabel('Nom du projet', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: 'Renommer' }).click();
}

test('deux onglets : le nom changé dans l’un survit au prix saisi dans l’autre, l’éditeur ouvert est prévenu', async ({
  page,
  context,
}) => {
  const id = await newWall(page);

  // onglet B : les achats ; onglet C : l'éditeur du plan, ouvert avant la modification
  const b = await context.newPage();
  await b.goto(`/#/p/${id}/achats`);
  await expect(b.getByRole('heading', { name: /^Achats — / })).toBeVisible();
  const c = await context.newPage();
  await c.goto(`/#/p/${id}/plan`);
  await expect(c.getByRole('button', { name: 'Renommer le projet' })).toBeVisible();

  // onglet A : le plan, on renomme
  await page.goto(`/#/p/${id}/plan`);
  await rename(page, 'Studio');
  await expect.poll(() => savedProjectNames(page)).toContain('Studio');

  // B voit le nouveau nom sans recharger, puis saisit un prix : le nom reste
  await expect(b.getByRole('heading', { name: 'Achats — Studio' })).toBeVisible();
  const glue = b.getByLabel(/^Prix Mortier-colle/);
  await glue.fill('18,90');
  await glue.press('Enter');
  await expect(b.getByText(/Prix de « Mortier-colle.* » enregistré/)).toBeVisible();
  await b.reload();
  await expect(b.getByRole('heading', { name: 'Achats — Studio' })).toBeVisible();
  await expect(b.getByLabel(/^Prix Mortier-colle/)).toHaveValue('18,9');

  // C, avec un éditeur ouvert, est prévenu et n'écrase rien
  await expect(c.getByText(/modifié dans un autre onglet/)).toBeVisible();
  await rename(c, 'Écrasé');
  await c.waitForTimeout(800);
  expect(await savedProjectNames(page)).toContain('Studio');
  expect(await savedProjectNames(page)).not.toContain('Écrasé');
});
