import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessible, expectNoHorizontalScroll, expectTouchTargets, shot } from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

/** Mur 300 × 240 avec une fenêtre à tableaux, puis page Résultats. */
async function wallWithResults(page: Page, info: TestInfo): Promise<string> {
  await page.goto('/#/new');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByLabel('Prix', { exact: true }).fill('32,5');
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(page.getByRole('application', { name: /^Plan de Mur/ })).toBeVisible();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Ouvertures' }).click();
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const depth = page.getByLabel('Profondeur du tableau', { exact: true });
  await depth.fill('15');
  await depth.press('Enter');
  await page.waitForTimeout(400);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.goto(`/#/p/${id}/results`);
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  return id;
}

test('résultats : commande, découpe, achats avec prix, encollage', async ({ page }, info) => {
  await wallWithResults(page, info);
  await check(page);
  await shot(page, info, '90-resultats-commande');

  await page.getByRole('tab', { name: 'Découpe' }).click();
  await expect(page.getByText('n° 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/\(F1 (tableau gauche|tableau droit|linteau)\)/).first()).toBeVisible();
  await check(page);
  await shot(page, info, '91-resultats-decoupe');

  await page.getByRole('tab', { name: 'Achats' }).click();
  const tilePrice = page.getByRole('textbox', { name: /^Prix 60 × 30 cm/ });
  await expect(tilePrice).toHaveAttribute('placeholder', '32,5');
  const total = page.locator('tfoot td').last();
  const before = await total.innerText();
  const glue = page.getByRole('textbox', { name: /^Prix Mortier-colle/ });
  await glue.fill('18,90');
  await glue.press('Tab');
  await expect(total).not.toHaveText(before);
  await expect(glue).toHaveValue('18,9');
  await check(page);
  await shot(page, info, '92-resultats-achats');

  await page.getByRole('tab', { name: 'Encollage' }).click();
  await expect(page.getByText(/U9 \(9 mm\)/).first()).toBeVisible();
  await check(page);
  await shot(page, info, '93-resultats-encollage');
});

test('comparer deux scénarios, charger puis annuler', async ({ page }, info) => {
  const id = await wallWithResults(page, info);
  await page.getByRole('link', { name: 'Comparer' }).click();
  await page.getByRole('button', { name: 'Enregistrer l’état actuel' }).first().click();
  await expect(page.getByRole('heading', { name: /^A\s*Scénario A/ })).toBeVisible();
  // tableau A contre l'état actuel : aucun écart
  await expect(page.getByRole('table')).toContainText('État actuel');

  // modifier le projet : motif bâtons rompus à 45°
  await page.goto(`/#/p/${id}`);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Motif' }).click();
  await page.getByRole('radio', { name: 'Bâtons rompus' }).click();
  await page.getByRole('radio', { name: '45°' }).click();
  await page.waitForTimeout(400);

  await page.goto(`/#/p/${id}/compare`);
  await page.getByLabel('Nom du scénario A').fill('Décalé droit');
  await page.getByLabel('Nom du scénario A').press('Tab');
  await page.getByRole('button', { name: 'Enregistrer l’état actuel' }).click(); // B
  await expect(page.getByRole('columnheader', { name: 'Décalé droit' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Scénario B' })).toBeVisible();
  await expect(page.locator('td.worse, td.better').first()).toBeVisible();
  await check(page);
  await shot(page, info, '94-comparer');

  await page.getByRole('article').filter({ hasText: 'Décalé droit' }).getByRole('button', { name: 'Charger' }).click();
  await page.getByRole('button', { name: 'Charger le scénario' }).click();
  await expect(page.getByText('Scénario « Décalé droit » chargé.')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click();
  await page.goto(`/#/p/${id}`);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Motif' }).click();
  await expect(page.getByRole('radio', { name: 'Bâtons rompus' })).toHaveAttribute('aria-checked', 'true');
});

test('export PDF A4 : téléchargement et rendu des pages', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  await wallWithResults(page, info);
  await page.getByRole('button', { name: 'PDF' }).click();
  const dlg = page.getByRole('dialog', { name: 'Exporter en PDF' });
  await expectAccessible(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dlg.getByRole('button', { name: 'Télécharger le PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^calepinage-mur-300-240\.pdf$/);
  await expect(dlg.getByRole('status')).toHaveText('PDF enregistré dans vos téléchargements.');
  const bytes = readFileSync((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

  // rendu de chaque page par pdf.js, à 150 dpi, pour vérifier la lisibilité en A4
  const require = createRequire(import.meta.url);
  const pdfjsDir = join(dirname(require.resolve('pdfjs-dist/package.json')), 'build');
  const viewer = await browser.newPage({ viewport: { width: 1300, height: 1300 } });
  await viewer.route('http://pdf.test/**', (route) => {
    const name = route.request().url().replace('http://pdf.test/', '');
    if (name === 'doc.pdf') return route.fulfill({ body: bytes, contentType: 'application/pdf' });
    if (name.endsWith('.mjs')) return route.fulfill({ path: join(pdfjsDir, name), contentType: 'text/javascript' });
    return route.fulfill({
      body: '<!doctype html><body style="margin:0;background:#888"></body>',
      contentType: 'text/html',
    });
  });
  await viewer.goto('http://pdf.test/index.html');
  const n = await viewer.evaluate(async () => {
    const pdfjs = await import('http://pdf.test/pdf.min.mjs' as string);
    pdfjs.GlobalWorkerOptions.workerSrc = 'http://pdf.test/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ url: 'http://pdf.test/doc.pdf' }).promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const vp = p.getViewport({ scale: 150 / 72 });
      const c = document.createElement('canvas');
      c.width = vp.width;
      c.height = vp.height;
      c.id = 'p' + i;
      document.body.append(c);
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    }
    return doc.numPages as number;
  });
  expect(n).toBeGreaterThanOrEqual(3);
  if (info.project.name === 'desktop') {
    for (let i = 1; i <= n; i++) await viewer.locator('#p' + i).screenshot({ path: `screenshots/pdf/page-${i}.png` });
  }
  await viewer.close();
});
