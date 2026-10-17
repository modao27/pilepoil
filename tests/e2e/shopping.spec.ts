import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, newWall, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('achats du projet : même total que la vue globale, prix modifiable et annulable, exports', async ({
  page,
}, info) => {
  // mur avec un carreau à 32,50 €/m²
  const id = await newWall(page, async () => {
    await page.getByLabel('Prix', { exact: true }).fill('32,5');
  });

  // écran Projet : carte Achats (total estimé), puis écran Achats
  await page.goto(`/#/p/${id}`);
  const card = page.getByRole('link', { name: /^Achats/ });
  await expect(card).toContainText(/Total estimé \d/);
  const carrelageTotal = /Total estimé (.+?€)/.exec((await card.textContent())!)![1]!;
  await page.getByRole('link', { name: /Achats/ }).click();
  await expect(page.getByRole('heading', { name: /^Achats — / })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revêtements' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consommables' })).toBeVisible();
  await expect(page.getByText(`Total estimé : ${carrelageTotal.trim()}`)).toBeVisible();
  await check(page);
  await shot(page, info, '70-achats');

  // prix de la colle saisi, puis annulé
  const glue = page.getByLabel(/^Prix Mortier-colle/);
  await glue.fill('18,90');
  await glue.press('Enter');
  await expect(page.getByText('Total estimé :')).not.toHaveText(`Total estimé : ${carrelageTotal.trim()}`);
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText(`Total estimé : ${carrelageTotal.trim()}`)).toBeVisible();

  // saisie refusée : l'ancien prix reste, le champ le dit ; 0 € est un prix
  await glue.fill('18,90');
  await glue.press('Enter');
  await expect(glue).toHaveValue('18,9');
  await glue.fill('abc');
  await glue.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Saisissez un prix' })).toBeVisible();
  await expect(glue).toHaveValue('18,9');
  await glue.fill('0');
  await glue.press('Enter');
  await expect(glue).toHaveValue('0');
  await expect(page.getByRole('status')).toHaveCount(1);
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText(`Total estimé : ${carrelageTotal.trim()}`)).toBeVisible();

  // exports
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter pour un tableur' }).click();
  const c = await csv;
  expect(c.suggestedFilename()).toMatch(/^achats-piece-300-240\.csv$/);
  const text = await (await c.createReadStream()).toArray().then((b) => Buffer.concat(b).toString('utf8'));
  expect(text).toContain('Rayon;Outil;Article');
  expect(text).toContain('Revêtements;Carrelage;');
  const pdf = page.waitForEvent('download');
  const pdfButton = page.getByRole('button', { name: 'Exporter en PDF' });
  await pdfButton.dblclick();
  expect((await pdf).suggestedFilename()).toBe('achats-piece-300-240.pdf');
  await expect(pdfButton).toBeEnabled();
});
