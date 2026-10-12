/**
 * Audit Lighthouse du build de production (performances, accessibilité, bonnes pratiques, SEO), profils mobile
 * et ordinateur, sur les écrans principaux. Un projet est d'abord créé dans le navigateur (IndexedDB conservé)
 * pour auditer aussi l'éditeur et les résultats : ces écrans sont mesurés avec le stockage conservé (visite suivante,
 * service worker actif), les autres en premier chargement (cache et stockage vidés), puis le projet est perdu.
 * Usage : npm run build && npm run lighthouse   (rapports HTML dans reports/lighthouse/)
 * Échec si une note est inférieure à 90.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import lighthouse, { desktopConfig, type Flags } from 'lighthouse';

const PORT = 4180;
const DEBUG_PORT = 9333;
const BASE = `http://localhost:${PORT}/`;
const MIN = 90;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
const out = join(import.meta.dirname, '..', 'reports', 'lighthouse');
mkdirSync(out, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  shell: true,
  stdio: 'ignore',
});
const profile = mkdtempSync(join(tmpdir(), 'calepinage-lh-'));

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('serveur de prévisualisation injoignable');
}

let failed = false;
try {
  await waitServer();
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${DEBUG_PORT}`],
    locale: 'fr-FR',
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  // projet de démonstration (parcours normal) : carreau 60 × 30 dans la bibliothèque, pièce « Cuisine » de
  // 300 × 240, carrelage sur le mur 1, parquet au sol
  await page.goto(BASE + '#/library/tiles/new');
  await page.getByRole('button', { name: 'Ajouter le carreau' }).click();
  await page.waitForURL(/#\/library\/tiles$/);
  await page.goto(BASE + '#/new');
  const dialog = page.getByRole('dialog', { name: 'Nouveau projet' });
  for (const [label, value] of [
    ['Nom du projet', 'Maison'],
    ['Nom', 'Cuisine'],
    ['Longueur', '300'],
    ['Largeur', '240'],
  ] as const) {
    const f = dialog.getByLabel(label, { exact: true });
    await f.fill(value);
    await f.press('Enter');
  }
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await page.waitForURL(/#\/p\/[^/]+\/plan$/);
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.goto(BASE + `#/p/${id}`);
  await page
    .getByRole('link', { name: /^Cuisine/ })
    .first()
    .click();
  await page.waitForURL(/#\/p\/[^/]+\/r\/[^/]+$/);
  const room = /#\/p\/[^/]+\/r\/([^/]+)/.exec(page.url())![1]!;
  const cover = async (surface: string, tool: string) => {
    await page
      .getByRole('button', { name: new RegExp(`^${surface}( \\(| :)`) })
      .first()
      .click();
    await page.getByRole('button', { name: `Revêtir : ${tool}` }).click();
  };
  await cover('Mur 1', 'carrelage');
  await cover('Sol', 'parquet');
  await page.goto(BASE + `#/p/${id}`);
  const href = async (name: RegExp) =>
    (await page.getByRole('link', { name }).first().getAttribute('href'))!.replace(/^#/, '');
  const tiling = await href(/^Carrelage · /);
  const wood = await href(/^Parquet · /);
  const tilePose = tiling.split('/').at(-1)!;
  await page.waitForTimeout(500);

  // [nom, adresse, premier chargement]
  const pages: [string, string, boolean][] = [
    ['projet', `#/p/${id}`, false],
    ['piece', `#/p/${id}/r/${room}`, false],
    ['carrelage', `#${tiling}`, false],
    ['parquet', `#${wood}`, false],
    ['resultats-pose', `#/p/${id}/pose/${tilePose}/resultats`, false],
    ['resultats-piece', `#/p/${id}/r/${room}/resultats`, false],
    ['resultats-projet', `#/p/${id}/resultats`, false],
    ['comparer', `#/p/${id}/m/carrelage/compare`, false],
    ['parquet-chantier', `#/p/${id}/m/parquet/chantier`, false],
    ['achats', `#/p/${id}/achats`, false],
    ['accueil', '#/', true],
    ['nouveau', '#/new', true],
    ['bibliotheque', '#/library', true],
    ['reglages', '#/settings', true],
  ];
  const runs = [false, true].flatMap((cold) =>
    (['mobile', 'desktop'] as const).flatMap((form) =>
      pages.filter((p) => p[2] === cold).map(([name, hash]) => ({ form, name, hash, cold })),
    ),
  );
  const rows: string[] = [];
  for (const { form, name, hash, cold } of runs) {
    const flags: Flags = {
      port: DEBUG_PORT,
      output: 'html',
      onlyCategories: [...CATEGORIES],
      disableStorageReset: !cold,
      locale: 'fr',
    };
    const r = await lighthouse(BASE + hash, flags, form === 'desktop' ? desktopConfig : undefined);
    if (!r) throw new Error('Lighthouse sans résultat');
    writeFileSync(join(out, `${form}-${name}.html`), r.report as string);
    const scores = CATEGORIES.map((c) => Math.round((r.lhr.categories[c]?.score ?? 0) * 100));
    if (scores.some((s) => s < MIN)) failed = true;
    rows.push(
      `${form.padEnd(8)} ${name.padEnd(18)} ${(cold ? 'froid' : 'cache').padEnd(6)} ${scores.map((s) => String(s).padStart(4)).join(' ')}`,
    );
    console.log(rows.at(-1));
  }
  const table = [`profil   écran              départ perf a11y  bp  seo`, ...rows].join('\n');
  writeFileSync(join(out, 'resume.txt'), table + '\n');
  console.log('\n' + table);
  await ctx.close();
} finally {
  server.kill();
  if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  // Chrome peut garder le profil verrouillé un instant (Windows) : un échec ici ne doit pas masquer le résultat
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  } catch {
    console.warn(`Profil temporaire non supprimé : ${profile}`);
  }
}
if (failed) {
  console.error(`\nAu moins une note est inférieure à ${MIN}.`);
  process.exit(1);
}
