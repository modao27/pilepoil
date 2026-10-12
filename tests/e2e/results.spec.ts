import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
  addPlanWindow,
  expectAccessible,
  expectNoHorizontalScroll,
  expectTouchTargets,
  newWall,
  openPose,
  openRoom,
  shot,
} from './helpers';

async function check(page: Page) {
  await expectAccessible(page);
  await expectTouchTargets(page);
  await expectNoHorizontalScroll(page);
}

/** Calepinage du mur 1 depuis l'écran Pièce. */
async function openWall(page: Page, id: string) {
  await openRoom(page, id);
  await openPose(page, 'Mur 1');
  await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
}

/** Mur 300 × 240 avec une fenêtre à tableaux, puis résultats de la pose (bouton Résultats du calepinage). */
async function wallWithResults(page: Page, info: TestInfo): Promise<string> {
  const id = await newWall(page, async () => {
    await page.getByLabel('Prix', { exact: true }).fill('32,5');
  });
  await addPlanWindow(page, id);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Découpage', exact: true }).click();
  await page.getByRole('button', { name: /^Fenêtre 1/ }).click();
  const depth = page.getByLabel('Profondeur du tableau', { exact: true });
  await depth.fill('15');
  await depth.press('Enter');
  await page.waitForTimeout(400);
  await page.getByRole('link', { name: 'Résultats', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Résultats — Carrelage · / })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'À commander' })).toBeVisible();
  return id;
}

test('résultats d’une pose : chiffres, commande, découpe, encollage ; fil vers la pièce et le projet', async ({
  page,
}, info) => {
  const id = await wallWithResults(page, info);
  const pose = page.getByRole('article', { name: /^Carrelage · / });
  await expect(pose.getByText('Carreaux posés')).toBeVisible();
  await expect(pose.getByText(/carreaux 60 × 30 cm/)).toBeVisible();
  await check(page);
  await shot(page, info, '90-resultats-pose');

  await page.getByRole('tab', { name: 'Détail' }).click();
  await expect(page.getByRole('heading', { name: 'Commande des carreaux' })).toBeVisible();
  await expect(page.getByText('n° 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/\(F1 (tableau gauche|tableau droit|linteau)\)/).first()).toBeVisible();
  await expect(page.getByText(/U9 \(9 mm\)/).first()).toBeVisible();
  await check(page);
  await shot(page, info, '91-resultats-detail');

  // fil : la pièce, puis le projet
  const crumbs = page.getByRole('navigation', { name: 'Fil de navigation' });
  await crumbs.getByRole('link', { name: 'Pièce' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}/r/`));
  await page.getByRole('link', { name: 'Résultats de la pièce (3D, PDF)' }).click();
  await expect(page.getByRole('heading', { name: 'Résultats — Pièce' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Fil de navigation' }).getByRole('link', { name: 'Projet' }).click();
  await expect(page).toHaveURL(new RegExp(`#/p/${id}$`));
});

test('comparer deux scénarios, charger puis annuler', async ({ page }, info) => {
  const id = await wallWithResults(page, info);
  await page.goto(`/#/p/${id}/resultats`);
  await page.getByRole('tab', { name: 'Détail' }).click();
  await page.getByRole('link', { name: 'Comparer deux versions du carrelage' }).click();
  await page.getByRole('button', { name: 'Enregistrer l’état actuel' }).first().click();
  await expect(page.getByRole('heading', { name: /^A\s*Scénario A/ })).toBeVisible();
  // tableau A contre l'état actuel : aucun écart
  await expect(page.getByRole('table')).toContainText('État actuel');

  // modifier le projet : motif bâtons rompus à 45°
  await openWall(page, id);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Pose', exact: true }).click();
  await page.getByRole('radio', { name: 'Bâtons rompus' }).click();
  await page.getByRole('radio', { name: '45°' }).click();
  await page.waitForTimeout(400);

  await page.goto(`/#/p/${id}/m/carrelage/compare`);
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
  await openWall(page, id);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
  await page.getByRole('tab', { name: 'Pose', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Bâtons rompus' })).toHaveAttribute('aria-checked', 'true');
});

test('export PDF A4 du calepinage : téléchargement et rendu des pages', async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  await wallWithResults(page, info);
  await expectAccessible(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF du calepinage' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('calepinage-piece-300-240-piece-mur-1.pdf');
  await expect(page.getByText('PDF enregistré dans vos téléchargements.')).toBeVisible();
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
