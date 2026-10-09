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
  // projet de démonstration : sol d'une pièce de 300 × 240, carreau 60 × 30
  await page.goto(BASE + '#/new/carrelage');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await page.getByRole('link', { name: 'Ouvrir Pièce, sol' }).click();
  await page
    .getByRole('link', { name: /\d+ carreaux/ })
    .first()
    .waitFor();
  const [, id, surface] = /#\/p\/([^/]+)\/m\/carrelage\/s\/([^/]+)/.exec(page.url())!;
  const room = surface!.split('~')[0]!;
  await page.waitForTimeout(500);

  // projet de parquet : pièce 400 × 300, une pose de stratifié
  await page.goto(BASE + '#/new');
  await page.getByRole('button', { name: 'Commencer : parquet' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ajouter une pièce' });
  for (const [label, value] of [
    ['Longueur', '400'],
    ['Largeur', '300'],
  ] as const) {
    const f = dialog.getByLabel(label, { exact: true });
    await f.fill(value);
    await f.press('Enter');
  }
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const pid = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.goto(BASE + `#/p/${pid}/m/parquet`);
  await page.getByRole('button', { name: 'Créer une pose' }).first().click();
  await page
    .getByRole('link', { name: /\d+ lames · \d+ paquets/ })
    .first()
    .waitFor();
  await page.waitForTimeout(500);

  // [nom, adresse, premier chargement]
  const pages: [string, string, boolean][] = [
    ['projet', `#/p/${id}`, false],
    ['carrelage', `#/p/${id}/m/carrelage`, false],
    ['editeur', `#/p/${id}/m/carrelage/s/${surface}`, false],
    ['piece', `#/p/${id}/m/carrelage/room/${room}`, false],
    ['resultats', `#/p/${id}/m/carrelage/results`, false],
    ['comparer', `#/p/${id}/m/carrelage/compare`, false],
    ['parquet', `#/p/${pid}/m/parquet`, false],
    ['parquet-resultats', `#/p/${pid}/m/parquet/results`, false],
    ['parquet-chantier', `#/p/${pid}/m/parquet/chantier`, false],
    ['accueil', '#/', true],
    ['nouveau', '#/new', true],
    ['assistant', '#/new/carrelage', true],
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
