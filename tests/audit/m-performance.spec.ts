/** M. Performance : durée des calculs, réactivité, Lighthouse, taille du bundle, images par seconde en 3D. */
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import lighthouse, { desktopConfig, type Flags } from 'lighthouse';
import { cover, createProject, openPose, openRoom } from '../e2e/helpers';
import { maison, openSheet, panel, seed, test } from './audit';

const summary = (page: Page) =>
  page
    .locator('a.summary')
    .first()
    .innerText()
    .catch(() => '');

/** Durée d'un recalcul : clic sur un motif jusqu'au nouveau résumé, tâches longues pendant ce temps (Chromium). */
async function recompute(
  page: Page,
  group: string,
  option: string,
): Promise<{ ms: number; longues: number; maxLongue: number; resume: string }> {
  await page.evaluate(() => {
    const w = window as unknown as { __lt: number[] };
    w.__lt = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__lt.push(e.duration))).observe({
        type: 'longtask',
        buffered: false,
      });
    } catch {
      /* pas de longtask hors Chromium */
    }
  });
  const before = await summary(page);
  const t0 = Date.now();
  await panel(page).getByRole('radiogroup', { name: group }).getByRole('radio', { name: option, exact: true }).click();
  await page
    .waitForFunction(
      (b) => {
        const t = document.querySelector('a.summary')?.textContent ?? '';
        return t !== b && !t.includes('Calcul');
      },
      before,
      { timeout: 60_000 },
    )
    .catch(() => undefined);
  const ms = Date.now() - t0;
  const lt = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
  return { ms, longues: lt.length, maxLongue: Math.round(Math.max(0, ...lt)), resume: await summary(page) };
}

test('M1 durée de calcul : petit, moyen, gros projet', async ({ page, au }) => {
  test.setTimeout(300_000);
  const res: Record<string, unknown> = {};
  // moyen : la maison
  await seed(page, 'maison', `/#/p/${maison().id}/m/parquet/pose/${maison().poses[0]!.id}`);
  await page.waitForTimeout(2000);
  await openSheet(page);
  await panel(page).getByRole('tab', { name: 'Pose', exact: true }).click();
  res['moyen-parquet-hongrie'] = await recompute(page, 'Motif', 'Hongrie');
  res['moyen-parquet-droite'] = await recompute(page, 'Motif', 'Droite');
  // gros : pièce de 12 × 10 m, parquet au sol
  const id = await createProject(page, { project: 'Gros', name: 'Plateau', size: [1200, 1000] });
  await openRoom(page, id, 'Plateau');
  await cover(page, 'Sol', 'parquet');
  const t0 = Date.now();
  await openPose(page, 'Sol');
  await page
    .waitForFunction(() => /\d/.test(document.querySelector('a.summary')?.textContent ?? ''), null, { timeout: 60_000 })
    .catch(() => undefined);
  res['gros-premier-calcul-ms'] = Date.now() - t0;
  await openSheet(page);
  await panel(page).getByRole('tab', { name: 'Pose', exact: true }).click();
  res['gros-parquet-hongrie'] = await recompute(page, 'Motif', 'Hongrie');
  res['gros-parquet-baton'] = await recompute(page, 'Motif', 'Bâton rompu');
  await au.shot('calepinage-parquet', 'gros', { full: false });
  // gros : carrelage 60 × 60 au sol de la même pièce
  await openRoom(page, id, 'Plateau');
  await page
    .getByRole('button', { name: /^Mur 1( \(| :)/ })
    .first()
    .click();
  await cover(page, 'Mur 1', 'carrelage');
  await openPose(page, 'Mur 1');
  await page.waitForTimeout(2000);
  await openSheet(page);
  await panel(page).getByRole('tab', { name: 'Pose', exact: true }).click();
  res['gros-carrelage-mur-batons'] = await recompute(page, 'Motif de pose', 'Bâtons rompus');
  au.note('calculs', res);
});

test('M2 réactivité : saisie pendant un calcul', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/m/carrelage/s/${maison().poses[4]!.id}`);
  await page.waitForTimeout(2000);
  await openSheet(page);
  await panel(page).getByRole('tab', { name: 'Produit', exact: true }).click();
  // délai entre un appui et l'image suivante, pendant des changements rapides du joint
  const delays = await page.evaluate(async () => {
    const input = [...document.querySelectorAll('input')].find(
      (i) => i.getAttribute('aria-label') === 'Joint' || i.labels?.[0]?.textContent?.trim() === 'Joint',
    ) as HTMLInputElement | undefined;
    const plus = [...document.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'Augmenter Joint',
    );
    const out: number[] = [];
    for (let i = 0; i < 8; i++) {
      const t = performance.now();
      plus?.click();
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      out.push(Math.round(performance.now() - t));
      await new Promise((r) => setTimeout(r, 30));
    }
    return { out, trouve: !!input && !!plus };
  });
  au.note('delais-ms', delays);
});

test('M3 Lighthouse sur chaque écran principal', async ({ au }, info) => {
  test.setTimeout(900_000);
  if (au.engine !== 'chromium') {
    au.note('non-teste', 'Lighthouse : Chromium seulement');
    return;
  }
  const vp = info.project.use.viewport ?? { width: 1280, height: 800 };
  const mobile = au.isTouch;
  const port = 9400 + info.workerIndex;
  const profile = mkdtempSync(join(tmpdir(), 'pp-lh-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${port}`],
    locale: 'fr-FR',
    viewport: vp,
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const base = 'http://localhost:4174';
  await page.goto(base + '/#/');
  await seed(page, 'maison', base + '/#/', base);
  const m = maison();
  const urls: Record<string, string> = {
    accueil: '/#/',
    projet: `/#/p/${m.id}`,
    plan: `/#/p/${m.id}/plan`,
    piece: `/#/p/${m.id}/r/${m.rooms['Salle de bain']}`,
    calepinage: `/#/p/${m.id}/m/carrelage/s/${m.poses[4]!.id}`,
    parquet: `/#/p/${m.id}/m/parquet/pose/${m.poses[0]!.id}`,
    resultats: `/#/p/${m.id}/resultats`,
    achats: `/#/p/${m.id}/achats`,
    bibliotheque: '/#/library/tiles',
    reglages: '/#/settings',
  };
  const flags: Flags = {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    disableStorageReset: true,
    formFactor: mobile ? 'mobile' : 'desktop',
    screenEmulation: { mobile, width: vp.width, height: vp.height, deviceScaleFactor: mobile ? 3 : 1, disabled: false },
  };
  const res: Record<string, unknown> = {};
  try {
    for (const [k, u] of Object.entries(urls)) {
      try {
        const r = await lighthouse(base + u, flags, mobile ? undefined : desktopConfig);
        const lhr = r?.lhr;
        if (!lhr) continue;
        res[k] = {
          notes: Object.fromEntries(
            Object.entries(lhr.categories).map(([c, v]) => [c, Math.round((v.score ?? 0) * 100)]),
          ),
          lcp: lhr.audits['largest-contentful-paint']?.displayValue,
          tbt: lhr.audits['total-blocking-time']?.displayValue,
          cls: lhr.audits['cumulative-layout-shift']?.displayValue,
          fcp: lhr.audits['first-contentful-paint']?.displayValue,
          echecs: Object.values(lhr.audits)
            .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === 'binary')
            .map((a) => a.id)
            .slice(0, 15),
        };
      } catch (e) {
        res[k] = `erreur : ${String(e).slice(0, 200)}`;
      }
    }
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
  au.note('lighthouse', res);
});

test('M4 taille du bundle', async ({ au }) => {
  const dir = join(import.meta.dirname, '..', '..', 'dist', 'assets');
  const files = readdirSync(dir).map((f) => ({ f, ko: Math.round(statSync(join(dir, f)).size / 1024) }));
  files.sort((a, b) => b.ko - a.ko);
  au.note(
    'total-ko',
    files.reduce((s, x) => s + x.ko, 0),
  );
  au.note('plus-gros', files.slice(0, 12));
  au.note('nombre', files.length);
});

test('M5 images par seconde en 3D (projet moyen)', async ({ page, au }) => {
  await seed(page, 'maison', `/#/p/${maison().id}/3d`);
  await page.waitForTimeout(3000);
  const canvas = page.locator('canvas').first();
  const b = (await canvas.boundingBox())!;
  const fps = await page.evaluate(async () => {
    let frames = 0;
    let run = true;
    const tick = () => {
      frames++;
      if (run) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 2500));
    run = false;
    return Math.round((frames / (performance.now() - t0)) * 1000);
  });
  // en glissant (rotation)
  const p = page.evaluate(async () => {
    let frames = 0;
    let run = true;
    const tick = () => {
      frames++;
      if (run) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 2500));
    run = false;
    return Math.round((frames / (performance.now() - t0)) * 1000);
  });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 40; i++) await page.mouse.move(b.x + b.width / 2 + i * 4, b.y + b.height / 2, { steps: 1 });
  await page.mouse.up();
  au.note('ips', {
    repos: fps,
    rotation: await p,
    drawCalls: await page
      .locator('[data-draw-calls]')
      .first()
      .getAttribute('data-draw-calls')
      .catch(() => null),
  });
});
