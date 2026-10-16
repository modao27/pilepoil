/** A. Premier contact : premier lancement, installation PWA, hors ligne. */
import { maison, seed, test } from './audit';

test('A1 premier lancement : accueil vide, ce que fait l’appli en 5 s', async ({ page, au }) => {
  const t0 = Date.now();
  await page.goto('/');
  const h1 = page.locator('h1').first();
  await h1.waitFor({ timeout: 30_000 });
  au.note('ms-premier-titre', Date.now() - t0);
  await page.waitForTimeout(Math.max(0, 5000 - (Date.now() - t0)));
  await au.shot('accueil', 'vide-5s', { full: false });
  await au.shot('accueil', 'vide');
  au.note(
    'texte-visible-5s',
    (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ').slice(0, 600),
  );
  au.note('titre-document', await page.title());
  await au.check('accueil-vide');
  // ce que promet l'écran vide : la carte « Nouveau projet » et le lien vers l'ancienne version
  au.note('lien-ancienne-version', await page.getByRole('link', { name: /Importez vos données/ }).count());
  await au.step('lien-ancienne-version', async () => {
    await page.getByRole('link', { name: /Importez vos données/ }).click();
    await page.waitForTimeout(500);
    au.note('import-dans-reglages', {
      url: page.url().replace(/^.*#/, '#'),
      motImport: await page.getByText(/import/i).allInnerTexts(),
    });
    await au.shot('reglages', 'depuis-lien-import');
  });
});

test('A2 installation PWA : manifeste, icônes, couleur, service worker', async ({ page, au, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  au.note('manifeste-href', href);
  if (href) {
    const res = await request.get(new URL(href, page.url()).toString());
    const m = (await res.json()) as Record<string, unknown> & {
      icons?: { src: string; sizes: string; purpose?: string }[];
    };
    au.note('manifeste', { ...m, icons: undefined });
    const icons: string[] = [];
    for (const i of m.icons ?? []) {
      const r = await request.get(new URL(i.src, res.url()).toString());
      icons.push(`${i.sizes} ${i.purpose ?? 'any'} ${r.status()} ${r.headers()['content-type']}`);
    }
    au.note('icones', icons);
  }
  au.note('head', {
    themeColor: await page
      .locator('meta[name="theme-color"]')
      .evaluateAll((ms) => ms.map((m) => `${m.getAttribute('media')} ${m.getAttribute('content')}`)),
    appleIcon: await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute('href')
      .catch(() => null),
    appleCapable: await page
      .locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]')
      .count(),
    appleTitle: await page
      .locator('meta[name="apple-mobile-web-app-title"]')
      .getAttribute('content')
      .catch(() => null),
    statusBar: await page
      .locator('meta[name="apple-mobile-web-app-status-bar-style"]')
      .getAttribute('content')
      .catch(() => null),
    viewport: await page.locator('meta[name="viewport"]').getAttribute('content'),
    lang: await page.locator('html').getAttribute('lang'),
    description: await page
      .locator('meta[name="description"]')
      .getAttribute('content')
      .catch(() => null),
    splash: await page.locator('link[rel="apple-touch-startup-image"]').count(),
  });
  au.note(
    'service-worker',
    await page
      .evaluate(() =>
        Promise.race([
          navigator.serviceWorker.ready.then((r) => r.active?.scriptURL ?? 'aucun'),
          new Promise((r) => setTimeout(() => r('délai'), 15000)),
        ]),
      )
      .catch((e) => String(e)),
  );
  if (au.engine === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const r = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
    au.note(
      'installabilite-chromium',
      r.installabilityErrors.map((e) => e.errorId),
    );
  }
  // les réglages disent-ils comment installer ?
  await page.goto('/#/settings');
  await page.getByRole('heading', { name: 'Application' }).waitFor();
  au.note(
    'reglages-installation',
    await page
      .getByRole('region', { name: 'Application' })
      .innerText()
      .catch(() => ''),
  );
  await au.shot('reglages', 'installation');
});

test('A3 hors ligne après le premier chargement', async ({ page, context, au }) => {
  await seed(page, 'maison');
  const ok = await page
    .evaluate(() =>
      Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise<boolean>((r) => setTimeout(() => r(false), 20000)),
      ]),
    )
    .catch(() => false);
  au.note('service-worker-pret', ok);
  // attendre la fin de la mise en cache (toast « sans connexion », ou contrôleur présent)
  await page
    .waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20_000 })
    .catch(() => au.note('controleur-absent', true));
  await context.setOffline(true);
  const m = maison();
  const pages: Record<string, string> = {
    accueil: '/#/',
    projet: `/#/p/${m.id}`,
    piece: `/#/p/${m.id}/r/${m.rooms['Salle de bain']}`,
    calepinage: `/#/p/${m.id}/m/carrelage/s/${m.poses[4]!.id}`,
    resultats: `/#/p/${m.id}/resultats`,
    achats: `/#/p/${m.id}/achats`,
    reglages: '/#/settings',
  };
  const res: Record<string, string> = {};
  for (const [k, url] of Object.entries(pages)) {
    const r = await au.step(`hors-ligne-${k}`, async () => {
      await page.goto(url);
      await page.reload();
      await page.locator('h1').first().waitFor({ state: 'attached', timeout: 15_000 });
      await page.waitForTimeout(1500);
      return (await page.locator('h1').first().innerText()).slice(0, 60);
    });
    res[k] = r ?? 'échec';
    if (k === 'reglages' || k === 'calepinage')
      await au.shot(k === 'reglages' ? 'reglages' : 'calepinage-carrelage', 'hors-ligne');
  }
  au.note('ecrans-hors-ligne', res);
  au.note(
    'reglages-hors-ligne',
    await page
      .getByText(/hors ligne|sans connexion/i)
      .allInnerTexts()
      .catch(() => []),
  );
  // export PDF sans réseau
  await page.goto(pages['resultats']!);
  await au.step('pdf-hors-ligne', async () => {
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      page.getByRole('button', { name: /PDF/ }).first().click(),
    ]);
    au.note('pdf-hors-ligne', d.suggestedFilename());
  });
  await context.setOffline(false);
});
