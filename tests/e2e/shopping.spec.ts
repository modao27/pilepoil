import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

test('achats du projet : même total que le carrelage, prix modifiable et annulable, exports', async ({
  page,
}, info) => {
  // mur avec un carreau à 32,50 €/m²
  await page.goto('/#/new/carrelage');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByLabel('Prix', { exact: true }).fill('32,5');
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;

  // total de l'écran Résultats du carrelage
  await page.goto(`/#/p/${id}/m/carrelage/results`);
  await page.getByRole('tab', { name: 'Achats' }).click();
  const carrelageTotal = (await page
    .getByRole('row', { name: /Total estimé/ })
    .locator('td')
    .last()
    .textContent())!;
  expect(carrelageTotal).toMatch(/\d/);

  // écran Projet : carte Achats, puis écran Achats
  await page.goto(`/#/p/${id}`);
  await expect(page.getByRole('link', { name: /Achats/ })).toContainText(carrelageTotal.trim());
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

  // exports
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter pour un tableur' }).click();
  const c = await csv;
  expect(c.suggestedFilename()).toMatch(/^achats-mur-300-240\.csv$/);
  const text = await (await c.createReadStream()).toArray().then((b) => Buffer.concat(b).toString('utf8'));
  expect(text).toContain('Rayon;Outil;Article');
  expect(text).toContain('Revêtements;Carrelage;');
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter en PDF' }).click();
  expect((await pdf).suggestedFilename()).toBe('achats-mur-300-240.pdf');
});
