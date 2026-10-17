/** Accessibilité et chargement (lot H) : titres de page, h1 des éditeurs, texte agrandi, cibles tactiles. */
import { expect, test } from '@playwright/test';
import { createProject, newWall } from './helpers';

test('chaque écran a son titre de page, chaque éditeur son titre de niveau 1', async ({ page }) => {
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  for (const [hash, title] of [
    ['#/', 'Mes projets · PilePoil'],
    [`#/p/${id}`, 'Maison · PilePoil'],
    [`#/p/${id}/plan`, 'Plan — Maison · PilePoil'],
    [`#/p/${id}/achats`, 'Achats — Maison · PilePoil'],
    [`#/p/${id}/resultats`, 'Résultats — Maison · PilePoil'],
    ['#/settings', 'Réglages · PilePoil'],
    ['#/library/tiles', 'Bibliothèque · PilePoil'],
  ] as const) {
    await page.goto('/' + hash);
    await expect(page).toHaveTitle(title);
  }
});

test('éditeur de calepinage : un titre de niveau 1 qui dit la surface', async ({ page }) => {
  await newWall(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page).toHaveTitle(/^Carrelage — .+ · PilePoil$/);
});

/** Texte agrandi à 200 % (WCAG 1.4.4) : la taille de base de la page double. */
async function zoomText(page: import('@playwright/test').Page) {
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
}
/** Débordement horizontal : de la page, et du plus large élément visible (hors zones à défilement propre). */
const overflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    let max = document.documentElement.scrollWidth - w;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).position === 'fixed') continue;
      if (el.closest('svg, canvas, [data-scroll], .scroll')) continue;
      max = Math.max(max, Math.round(r.right - w));
    }
    return max;
  });

test('texte à 200 % à 360 px : fiche carreau, réglages et achats sans défilement horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const id = await createProject(page, { project: 'Maison', name: 'Séjour', size: [400, 300] });
  for (const hash of ['#/library/tiles/modele-gres-60x60', '#/settings', '#/library/tiles', `#/p/${id}/achats`, '#/']) {
    await page.goto('/' + hash);
    await page.getByRole('heading').first().waitFor();
    await zoomText(page);
    await page.waitForTimeout(150);
    expect(await overflow(page), hash).toBeLessThanOrEqual(0);
  }
});

test('texte à 200 % sur ordinateur : la liste d’achats ne déborde pas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await newWall(page);
  await page.goto(`/#/p/${id}/achats`);
  await page.getByRole('heading', { name: /^Achats/ }).waitFor();
  await zoomText(page);
  await page.waitForTimeout(200);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});
