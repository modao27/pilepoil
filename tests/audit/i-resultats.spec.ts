/** I. Résultats (pose, pièce, projet), vue 3D, dossier PDF, partage. */
import { statSync } from 'node:fs';
import { maison, pdfText, seed, test } from './audit';

test('I1 trois niveaux de résultats, onglets, fil de navigation', async ({ page, au }) => {
  const m = maison();
  const levels: Record<string, string> = {
    projet: `/#/p/${m.id}/resultats`,
    piece: `/#/p/${m.id}/r/${m.rooms['Séjour']}/resultats`,
    pose: `/#/p/${m.id}/pose/${m.poses[0]!.id}/resultats`,
  };
  await seed(page, 'maison', levels['projet']);
  for (const [k, url] of Object.entries(levels)) {
    await page.goto(url);
    await page.waitForTimeout(2500);
    au.note(
      `${k}:fil`,
      await page
        .getByRole('navigation', { name: 'Fil de navigation' })
        .innerText()
        .catch(() => 'absent'),
    );
    au.note(`${k}:boutons`, await page.locator('main').getByRole('button').allInnerTexts());
    for (const t of ['Résumé', 'Détail', '3D']) {
      await page.getByRole('tab', { name: t }).click();
      await page.waitForTimeout(t === '3D' ? 3000 : 600);
      au.note(`${k}:${t}`, (await page.locator('main').innerText()).slice(0, 1500));
      await au.shot(`resultats-${k}`, t.toLowerCase().replace('é', 'e'));
      await au.check(`resultats-${k}-${t}`);
    }
  }
});

test('I2 vue 3D du projet : murs, sélection, liste, clavier', async ({ page, au }) => {
  const m = maison();
  await seed(page, 'maison', `/#/p/${m.id}/3d`);
  await page.waitForTimeout(3000);
  au.note('commandes', await page.locator('main').getByRole('radio').allInnerTexts());
  for (const w of ['Pleins', 'Bas', 'Coupés']) {
    await page
      .getByRole('radio', { name: w })
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(1200);
    await au.shot('vue-3d', `murs-${w}`, { full: false });
  }
  const canvas = page.locator('canvas').first();
  const b = (await canvas.boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.45, b.y + b.height * 0.5);
  await page.waitForTimeout(800);
  au.note('toucher-1', {
    url: page.url().replace(/^.*#/, '#'),
    texte: (await page.locator('main').innerText()).slice(0, 400),
  });
  await au.shot('vue-3d', 'piece-touchee', { full: false });
  au.note(
    'liste-pieces',
    await page
      .getByRole('navigation', { name: 'Pièces' })
      .innerText()
      .catch(() => 'absente'),
  );
  // fluidité : images par seconde en tournant au clavier pendant 3 s
  const fps = await page.evaluate(async () => {
    const el = document.querySelector('canvas')?.closest('[tabindex]') as HTMLElement | null;
    el?.focus();
    let frames = 0;
    let run = true;
    const tick = () => {
      frames++;
      if (run) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    while (performance.now() - t0 < 3000) {
      el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    }
    run = false;
    return Math.round((frames / (performance.now() - t0)) * 1000);
  });
  au.note('ips-3d', fps);
  await au.check('vue-3d');
});

test('I3 dossier PDF du projet : ouvert et lu', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/resultats`);
  await page.waitForTimeout(3000);
  await au.step('dossier', async () => {
    const t0 = Date.now();
    const [d] = await Promise.all([
      page.waitForEvent('download', { timeout: 90_000 }),
      page
        .getByRole('button', { name: /Dossier|PDF/ })
        .first()
        .click(),
    ]);
    const path = await d.path();
    const pages = await pdfText(path, 900);
    au.note('dossier', {
      nom: d.suggestedFilename(),
      octets: statSync(path).size,
      ms: Date.now() - t0,
      pages: pages.length,
    });
    au.note('dossier-texte', pages);
    au.note('message', await page.getByRole('status').allInnerTexts());
  });
});

test('I4 partager le PDF', async ({ page, au }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: unknown[] };
    w.__shared = [];
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', {
      value: async (d: unknown) => void w.__shared.push(d),
      configurable: true,
    });
  });
  await seed(page, 'maison', `/#/p/${maison().id}/pose/${maison().poses[4]!.id}/resultats`);
  await page.waitForTimeout(2500);
  const btn = page.getByRole('button', { name: 'Partager' });
  au.note('bouton-partager', await btn.count());
  await au.step('partager', async () => {
    await btn.click();
    await page.waitForTimeout(3000);
    au.note(
      'partage',
      await page.evaluate(() =>
        (window as unknown as { __shared: { title?: string; text?: string; files?: File[] }[] }).__shared.map((d) => ({
          title: d.title,
          text: d.text,
          files: d.files?.map((f) => `${f.name} ${f.type} ${f.size}`),
        })),
      ),
    );
    au.note('message', await page.getByRole('status').allInnerTexts());
  });
  // sans partage natif (ordinateur) : le bouton est-il caché ?
  const p2 = await page.context().newPage();
  await p2.goto(`/#/p/${maison().id}/pose/${maison().poses[4]!.id}/resultats`);
  await p2.waitForTimeout(2500);
  au.note(
    'natif',
    await p2.evaluate(() => typeof navigator.share === 'function' && typeof navigator.canShare === 'function'),
  );
  await p2.close();
});
