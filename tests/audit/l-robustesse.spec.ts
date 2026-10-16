/** L. Robustesse : valeurs limites, rechargement, retour, liens profonds, rotation, arrière-plan, deux onglets, taps répétés, stockage, mise à jour, réseau lent, calcul en échec. */
import type { Page } from '@playwright/test';
import { serveDist } from '../e2e/static-server';
import { dumpDb, maison, panel, seed, test, typeIn } from './audit';

const projectNames = (page: Page) =>
  dumpDb(page).then((d) => (d.stores['projects']?.rows ?? []).map((r) => (r.value as { name: string }).name));

test('L1 valeurs limites : fiche carreau et lame', async ({ page, au }) => {
  const res: Record<string, unknown> = {};
  for (const [url, fields] of [
    ['/#/library/tiles/new', ['Longueur', 'Largeur', 'Épaisseur']],
    ['/#/library/boards/new', ['Longueur', 'Largeur utile', 'Épaisseur', 'Prix du paquet']],
  ] as const) {
    await page.goto(url);
    await page.locator('main').waitFor();
    await page.waitForTimeout(600);
    for (const f of fields)
      for (const v of ['0', '-5', '0,5', '100000', 'abc', '', '12,345']) {
        const shown = await typeIn(page.locator('main'), f, v).catch(() => 'absent');
        res[`${url.split('/')[2]}:${f}=${v}`] = {
          affiche: shown,
          alertes: await page.locator('[role=alert]').allInnerTexts(),
        };
      }
    await au.shot(url.includes('tiles') ? 'fiche-carreau-nouveau' : 'fiche-lame', 'limites');
  }
  au.note('limites', res);
});

test('L2 rechargement en pleine saisie', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/plan`);
  await panel(page).getByRole('button', { name: 'Séjour', exact: true }).click();
  // saisie non validée (sans Entrée) puis rechargement
  await panel(page).getByLabel('Hauteur sous plafond', { exact: true }).fill('275');
  await page.reload();
  await page.waitForTimeout(1500);
  await panel(page)
    .getByRole('button', { name: 'Séjour', exact: true })
    .click()
    .catch(() => undefined);
  au.note(
    'plan-non-valide',
    await panel(page)
      .getByLabel('Hauteur sous plafond', { exact: true })
      .inputValue()
      .catch(() => '?'),
  );
  // saisie validée puis rechargement immédiat
  await typeIn(panel(page), 'Hauteur sous plafond', '265');
  await page.reload();
  await page.waitForTimeout(1500);
  await panel(page)
    .getByRole('button', { name: 'Séjour', exact: true })
    .click()
    .catch(() => undefined);
  au.note(
    'plan-valide',
    await panel(page)
      .getByLabel('Hauteur sous plafond', { exact: true })
      .inputValue()
      .catch(() => '?'),
  );
  // fiche de bibliothèque à moitié remplie
  await page.goto('/#/library/tiles/new');
  await page.getByLabel('Nom', { exact: true }).fill('Brouillon perdu ?');
  await page.reload();
  await page.waitForTimeout(800);
  au.note(
    'fiche-brouillon',
    await page
      .getByLabel('Nom', { exact: true })
      .inputValue()
      .catch(() => '?'),
  );
  // calepinage : changer le joint puis recharger aussitôt
  await page.goto(`/#/p/${m.id}/m/carrelage/s/${m.poses[4]!.id}`);
  await page.waitForTimeout(1500);
  const h = page.locator('.sheet > button.handle').first();
  if (await h.count()) await h.click();
  await panel(page).getByRole('tab', { name: 'Produit', exact: true }).click();
  await typeIn(panel(page), 'Joint', '5');
  await page.reload();
  await page.waitForTimeout(2000);
  if (await h.count()) await h.click();
  await panel(page)
    .getByRole('tab', { name: 'Produit', exact: true })
    .click()
    .catch(() => undefined);
  au.note(
    'calepinage-joint',
    await panel(page)
      .getByLabel('Joint', { exact: true })
      .inputValue()
      .catch(() => '?'),
  );
});

test('L3 bouton retour (navigateur, Android) sur tout le parcours', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', '/#/');
  const path: string[] = [];
  const at = () => page.url().replace(/^.*#/, '#');
  await page
    .getByRole('link', { name: /Maison Dupont/ })
    .first()
    .click();
  await page.waitForTimeout(800);
  path.push(at());
  await page
    .getByRole('link', { name: /^Salle de bain/ })
    .first()
    .click();
  await page.waitForTimeout(800);
  path.push(at());
  await page
    .getByRole('button', { name: /^Sol( \(| :)/ })
    .first()
    .click();
  path.push(at());
  await page.getByRole('link', { name: 'Calepinage' }).first().click();
  await page.waitForTimeout(1500);
  path.push(at());
  await page.locator('a.summary').first().click();
  await page.waitForTimeout(1500);
  path.push(at());
  const back: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.goBack().catch(() => undefined);
    await page.waitForTimeout(700);
    back.push(
      `${at()} — ${(
        await page
          .locator('h1')
          .first()
          .innerText()
          .catch(() => '')
      ).replace(/\s+/g, ' ')}`,
    );
  }
  au.note('aller', path);
  au.note('retours', back);
  // retour depuis le plan ouvert par lien profond
  await page.goto(`/#/p/${m.id}/plan`);
  await page.waitForTimeout(800);
  await page.getByRole('link', { name: 'Projet' }).first().click();
  await page.goBack();
  au.note('plan-retour', at());
});

test('L4 liens profonds, identifiants inconnus, anciennes adresses', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', '/#/');
  const urls = [
    `/#/p/${m.id}`,
    `/#/p/${m.id}/plan`,
    `/#/p/${m.id}/r/${m.rooms['Séjour']}/sol`,
    `/#/p/${m.id}/m/carrelage/s/${m.poses[1]!.id}`,
    `/#/p/${m.id}/m/carrelage/results`,
    `/#/p/${m.id}/m/carrelage`,
    `/#/p/${m.id}/m/parquet`,
    `/#/p/${m.id}/m/peinture`,
    `/#/p/${m.id}/m/inconnu`,
    '/#/p/inexistant',
    '/#/p/inexistant/plan',
    '/#/p/inexistant/achats',
    `/#/p/${m.id}/r/inexistante`,
    `/#/p/${m.id}/pose/inexistante/resultats`,
    `/#/p/${m.id}/m/carrelage/s/inexistante`,
    `/#/p/${m.id}/m/parquet/pose/inexistante`,
    `/#/p/${m.id}/m/cloisons/c/inexistante`,
    '/#/library',
    '/#/library/inconnue',
    '/#/library/tiles/inexistant',
    '/#/new/carrelage',
    '/#/import/',
    '/#/settings/x',
    '/index.html',
    '/?utm=1#/',
  ];
  const res: Record<string, unknown> = {};
  for (const u of urls) {
    await page.goto(u);
    await page.waitForTimeout(1500);
    res[u.replace(m.id, ':id')] = {
      fin: page
        .url()
        .replace(/^.*?(#|$)/, '#')
        .replace(m.id, ':id'),
      h1: (await page.locator('h1').allInnerTexts()).join(' / ').replace(/\s+/g, ' '),
      texte: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160),
    };
    if (/inexistant|inconnu|new\/carrelage/.test(u)) await au.shot('liens', u.replace(/[^\w]+/g, '_').slice(-40));
  }
  au.note('liens', res);
});

test('L5 rotation pendant l’édition', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/plan`);
  await panel(page).getByRole('button', { name: 'Salle de bain', exact: true }).click();
  const vp = page.viewportSize()!;
  await au.shot('plan', 'avant-rotation', { full: false });
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(800);
  au.note('apres-rotation', {
    selection: await panel(page)
      .locator('h2')
      .first()
      .innerText()
      .catch(() => ''),
    debordement: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  });
  await au.shot('plan', 'apres-rotation', { full: false });
  await page.goto(`/#/p/${m.id}/m/carrelage/s/${m.poses[4]!.id}`);
  await page.waitForTimeout(1500);
  await au.shot('calepinage-carrelage', 'rotation', { full: false });
  await page.setViewportSize(vp);
  await page.waitForTimeout(800);
  await au.shot('calepinage-carrelage', 'rotation-retour', { full: false });
});

test('L6 arrière-plan puis reprise', async ({ page, context, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/plan`);
  await panel(page).getByRole('button', { name: 'Séjour', exact: true }).click();
  await typeIn(panel(page), 'Hauteur sous plafond', '262');
  // l'onglet passe en arrière-plan (pagehide, visibilitychange) puis le système le tue
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
  });
  await page.waitForTimeout(300);
  await page.close({ runBeforeUnload: false });
  const p2 = await context.newPage();
  await p2.goto(`/#/p/${m.id}/plan`);
  await p2.waitForTimeout(1500);
  await panel(p2)
    .getByRole('button', { name: 'Séjour', exact: true })
    .click()
    .catch(() => undefined);
  au.note(
    'hauteur-apres-reprise',
    await panel(p2)
      .getByLabel('Hauteur sous plafond', { exact: true })
      .inputValue()
      .catch(() => '?'),
  );
});

test('L7 deux onglets sur le même projet', async ({ page, context, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/plan`);
  const b = await context.newPage();
  await b.goto(`/#/p/${m.id}/achats`);
  await b.waitForTimeout(2500);
  // onglet A : nom de pièce ; onglet B : prix
  await panel(page).getByRole('button', { name: 'Séjour', exact: true }).click();
  await typeIn(panel(page), 'Nom de la pièce', 'Salon (onglet A)');
  await page.waitForTimeout(1500);
  const price = b.getByRole('textbox', { name: /^Prix / }).nth(1);
  await price.fill('7,77');
  await price.press('Enter');
  await b.waitForTimeout(1500);
  au.note('onglet-B-voit-A', (await b.locator('main').innerText()).includes('Salon (onglet A)'));
  await page.reload();
  await page.waitForTimeout(1500);
  await b.reload();
  await b.waitForTimeout(2500);
  const d = await dumpDb(page);
  const p = d.stores['projects']!.rows[0]!.value as {
    site: { existing: { rooms: { name: string }[] } };
    modules: Record<string, unknown>;
  };
  au.note('final', {
    pieces: p.site.existing.rooms.map((r) => r.name),
    prixGarde: JSON.stringify(p.modules).includes('7.77'),
  });
  await au.shot('plan', 'deux-onglets', { full: false });
  await b.close();
});

test('L8 double tap et taps répétés sur les actions', async ({ page, au }) => {
  await seed(page, 'maison', '/#/new');
  const d = page.getByRole('dialog', { name: 'Nouveau projet' });
  await d.getByRole('button', { name: 'Ajouter', exact: true }).dblclick();
  await page.waitForTimeout(1500);
  au.note('nouveau-projet-double', await projectNames(page));
  await page.goto('/#/');
  await page.waitForTimeout(800);
  await au.step('dupliquer-double', async () => {
    await page
      .getByRole('button', { name: /^Actions pour Maison/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Dupliquer' }).dblclick();
    await page.waitForTimeout(1500);
    au.note('dupliquer-double', await projectNames(page));
  });
  const m = maison();
  await page.goto(`/#/p/${m.id}/r/${m.rooms['Séjour']}`);
  await page.waitForTimeout(800);
  await page
    .getByRole('button', { name: /^Mur 2( \(| :)/ })
    .first()
    .click();
  await au.step('revetir-double', async () => {
    await page.getByRole('button', { name: 'Revêtir : peinture' }).dblclick();
    await page.waitForTimeout(1200);
    au.note('revetir-double', await page.getByRole('region', { name: 'Sol et murs' }).innerText());
  });
  await page.goto(`/#/p/${m.id}/achats`);
  await page.waitForTimeout(2500);
  let downloads = 0;
  page.on('download', () => downloads++);
  const btn = page.getByRole('button', { name: 'Exporter en PDF' });
  await btn.click();
  await btn.click({ timeout: 2000 }).catch(() => undefined);
  await btn.click({ timeout: 2000 }).catch(() => undefined);
  await page.waitForTimeout(4000);
  au.note('pdf-triple', downloads);
});

test('L9 stockage indisponible ou plein', async ({ page, context, au }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      get() {
        throw new DOMException('Navigation privée', 'InvalidStateError');
      },
    });
  });
  await page.goto('/#/');
  await page.waitForTimeout(2500);
  au.note('indisponible', (await page.locator('body').innerText()).slice(0, 400));
  await au.shot('accueil', 'stockage-indisponible');
  // stockage plein : chaque écriture d'un projet échoue
  const p2 = await context.newPage();
  await p2.goto('/#/new');
  await p2.getByRole('dialog', { name: 'Nouveau projet' }).waitFor();
  await p2.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === 'projects') throw new DOMException('Quota dépassé', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await p2
    .getByRole('dialog', { name: 'Nouveau projet' })
    .getByRole('button', { name: 'Ajouter', exact: true })
    .click();
  await p2.waitForTimeout(2000);
  au.note('plein', {
    url: p2.url().replace(/^.*#/, '#'),
    messages: await p2.locator('[role=status], [role=alert]').allInnerTexts(),
  });
  await p2.goto('/#/');
  await p2.waitForTimeout(1500);
  au.note('plein-accueil', (await p2.locator('main').innerText()).slice(0, 300));
  await p2.close();
});

test('L10 mise à jour du service worker avec un projet ouvert', async ({ browser, au }) => {
  const site = await serveDist();
  const ctx = await browser.newContext({ baseURL: site.url, locale: 'fr-FR' });
  const page = await ctx.newPage();
  try {
    await page.goto(site.url + '#/new');
    const d = page.getByRole('dialog', { name: 'Nouveau projet' });
    await d.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await page.waitForURL(/\/plan$/);
    await page
      .waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 })
      .catch(() => undefined);
    await panel(page)
      .getByRole('button', { name: 'Pièce 1', exact: true })
      .click()
      .catch(() => undefined);
    await typeIn(panel(page), 'Hauteur sous plafond', '255').catch(() => undefined);
    site.publishUpdate();
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    await page.waitForTimeout(5000);
    au.note('apres-maj', {
      toast: await page.locator('[role=status]').allInnerTexts(),
      url: page.url().replace(/^.*#/, '#'),
    });
    await au.shot('plan', 'maj-disponible', { full: false });
    const btn = page.getByRole('button', { name: /Mettre à jour|Recharger/ }).first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(4000);
      await panel(page)
        .getByRole('button', { name: 'Pièce 1', exact: true })
        .click()
        .catch(() => undefined);
      au.note('apres-recharge', {
        url: page.url().replace(/^.*#/, '#'),
        hauteur: await panel(page)
          .getByLabel('Hauteur sous plafond', { exact: true })
          .inputValue()
          .catch(() => '?'),
      });
    }
  } finally {
    await ctx.close();
    await site.close();
  }
});

test('L11 réseau 3G lent et processeur ralenti ×4', async ({ browser, au }) => {
  if (au.engine !== 'chromium') {
    au.note('non-teste', 'émulation réseau et processeur : Chromium seulement (CDP)');
    return;
  }
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4174', locale: 'fr-FR' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto('/#/', { timeout: 120_000 });
  await page.getByRole('heading', { name: 'Mes projets' }).waitFor({ timeout: 120_000 });
  const home = Date.now() - t0;
  const t1 = Date.now();
  await page.goto('/#/new');
  await page.getByRole('dialog', { name: 'Nouveau projet' }).waitFor({ timeout: 120_000 });
  const plan = Date.now() - t1;
  await page
    .getByRole('dialog', { name: 'Nouveau projet' })
    .getByRole('button', { name: 'Ajouter', exact: true })
    .click();
  await page.waitForURL(/\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  const t2 = Date.now();
  await page.goto(`/#/p/${id}`);
  await page.locator('h1').first().waitFor({ timeout: 120_000 });
  const project = Date.now() - t2;
  au.note('3g-cpu4-ms', { accueil: home, nouveauProjet: plan, vueGlobale: project });
  await au.shot('projet', '3g-cpu4', { full: false });
  await ctx.close();
});

test('L12 calcul en échec : ce que voit l’utilisateur', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', '/#/');
  // le moteur de calcul ne se charge pas (fichier du worker en erreur)
  await page.route(/compute\.worker|worker.*\.js/, (r) => r.fulfill({ status: 500, body: 'erreur' }));
  await page.goto(`/#/p/${m.id}/m/carrelage/s/${m.poses[4]!.id}`);
  await page.reload();
  await page.waitForTimeout(6000);
  au.note('calepinage', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  await au.shot('calepinage-carrelage', 'calcul-echec', { full: false });
  await page.goto(`/#/p/${m.id}`);
  await page.waitForTimeout(4000);
  au.note('projet', (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 800));
  await au.shot('projet', 'calcul-echec');
});
