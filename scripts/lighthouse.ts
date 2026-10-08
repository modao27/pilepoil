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
  // projet de démonstration : mur 300 × 240, carreau 60 × 30
  await page.goto(BASE + '#/new');
  const next = () => page.getByRole('button', { name: 'Suivant' }).click();
  await next();
  await next();
  await page.getByRole('button', { name: 'Ajouter ce carreau' }).click();
  await next();
  await page.getByRole('button', { name: 'Créer le projet' }).click();
  await page
    .getByRole('link', { name: /\d+ carreaux/ })
    .first()
    .waitFor();
  const id = /#\/p\/([^/]+)/.exec(page.url())![1]!;
  await page.waitForTimeout(500);

  // [nom, adresse, premier chargement]
  const pages: [string, string, boolean][] = [
    ['editeur', `#/p/${id}`, false],
    ['resultats', `#/p/${id}/results`, false],
    ['comparer', `#/p/${id}/compare`, false],
    ['accueil', '#/', true],
    ['assistant', '#/new', true],
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
      `${form.padEnd(8)} ${name.padEnd(13)} ${(cold ? 'froid' : 'cache').padEnd(6)} ${scores.map((s) => String(s).padStart(4)).join(' ')}`,
    );
    console.log(rows.at(-1));
  }
  const table = [`profil   écran         départ perf a11y  bp  seo`, ...rows].join('\n');
  writeFileSync(join(out, 'resume.txt'), table + '\n');
  console.log('\n' + table);
  await ctx.close();
} finally {
  server.kill();
  if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  rmSync(profile, { recursive: true, force: true });
}
if (failed) {
  console.error(`\nAu moins une note est inférieure à ${MIN}.`);
  process.exit(1);
}
