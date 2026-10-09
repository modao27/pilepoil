import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, expectTouchTargets, shot } from './helpers';
import { sceneStats } from './room-helpers';
import { serveDist } from './static-server';

/** Première visite : attend que le service worker ait tout mis en cache (message « sans connexion »). */
async function firstVisit(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await expect(page.getByText('Pilepoil fonctionne maintenant sans connexion.')).toBeVisible({ timeout: 20_000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
}

test('manifeste et icônes : application installable', async ({ page, request }, info) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(new URL(href!, page.url()).toString());
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as {
    name: string;
    short_name: string;
    lang: string;
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose: string }[];
  };
  expect(m.short_name).toBe('Pilepoil');
  expect(m.lang).toBe('fr');
  expect(m.display).toBe('standalone');
  expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(
    expect.arrayContaining(['192x192 any', '512x512 any', '512x512 maskable']),
  );
  for (const i of m.icons) {
    const r = await request.get(new URL(i.src, res.url()).toString());
    expect(r.ok(), i.src).toBe(true);
  }
  await page.evaluate(() => navigator.serviceWorker.ready);
  // critères d'installation de Chromium (manifeste, icônes, service worker)
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', /^#/);
  if (info.project.name === 'desktop') await shot(page, info, '95-accueil-installable');
});

test('hors ligne : ouvrir, créer, calculer, 3D, résultats et PDF sans réseau', async ({ page, context }, info) => {
  test.setTimeout(90_000);
  await firstVisit(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible();

  await page.goto('/#/new/carrelage');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  // le calcul passe par le worker, lui aussi servi par le cache
  await expect(page.getByRole('link', { name: /\d+ carreaux/ }).first()).toBeVisible();
  await page.getByRole('radio', { name: '3D' }).click();
  await sceneStats(page);

  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.goto(`/#/p/${id}/m/carrelage/results`);
  await expect(page.getByRole('heading', { name: 'Commande' })).toBeVisible();
  await page.getByRole('button', { name: 'PDF' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  await page.keyboard.press('Escape');

  await page.goto('/#/settings');
  await expect(page.getByText('Vous êtes hors ligne.', { exact: false })).toBeVisible();
  await expect(page.getByText(/^Fonctionne sans connexion/)).toBeVisible();
  await page.getByRole('button', { name: 'Rechercher une mise à jour' }).click();
  await expect(page.getByText('Pas de connexion : réessayez plus tard.')).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);
  await shot(page, info, '96-reglages-hors-ligne');
  await context.setOffline(false);
});

test('nouvelle version : message, mise à jour sans perdre le projet', async ({ page }, info) => {
  test.setTimeout(90_000);
  // hébergeur à part (autre port, donc autre service worker) dont on peut publier une nouvelle version
  const site = await serveDist();
  try {
    await firstVisit(page, site.url);
    await page.goto(site.url + '#/new/carrelage');
    const next = () => page.getByRole('button', { name: 'Suivant' }).click();
    await next();
    await next();
    await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
    await next();
    await page.getByRole('button', { name: 'Créer le projet' }).click();
    await expect(page.getByRole('link', { name: /\d+ carreaux/ }).first()).toBeVisible();
    // modification encore en attente d'enregistrement au moment de la mise à jour
    if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
    await page.getByRole('tab', { name: 'Motif' }).click();
    await page.getByRole('radio', { name: 'Droit' }).click();

    site.publishUpdate();
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    const msg = page.getByText('Une nouvelle version est disponible.');
    await expect(msg).toBeVisible({ timeout: 20_000 });
    // le message reste affiché jusqu'au choix de l'utilisateur
    await page.waitForTimeout(7000);
    await expect(msg).toBeVisible();
    await shot(page, info, '97-mise-a-jour');

    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('status').getByRole('button', { name: 'Mettre à jour' }).click(),
    ]);
    await expect(page.getByRole('application', { name: /^Plan de Pièce, mur 1/ })).toBeVisible();
    await expect(msg).toBeHidden();
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);
    if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Réglages :/ }).click();
    await page.getByRole('tab', { name: 'Motif' }).click();
    await expect(page.getByRole('radio', { name: 'Droit' })).toHaveAttribute('aria-checked', 'true');

    await page.goto(site.url + '#/settings');
    await page.getByRole('button', { name: 'Rechercher une mise à jour' }).click();
    await expect(page.getByText('Vous avez la dernière version.')).toBeVisible();

    // cas habituel : page déjà servie par le service worker, la nouvelle version attend l'accord
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    site.publishUpdate();
    await page.getByRole('button', { name: 'Rechercher une mise à jour' }).click();
    await expect(msg).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Mettre à jour maintenant' }).click(),
    ]);
    await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
    expect(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);
  } finally {
    await site.close();
  }
});
