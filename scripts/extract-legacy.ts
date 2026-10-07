/**
 * Extrait les résultats de legacy/calepinage.html pour le jeu de configurations de référence.
 * Usage : npm run parity:extract
 *
 * legacy est une IIFE fermée : on ajoute en mémoire (pas sur disque) une ligne qui expose
 * ses fonctions internes, puis on sert la page via Playwright en bloquant tout accès réseau.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import configs from '../tests/parity/configs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legacyPath = resolve(root, 'legacy/calepinage.html');
const outPath = resolve(root, 'tests/parity/fixtures/legacy-results.json');

const HOOK = `window.__legacy = { applyState, model: () => model, metrics, shoppingItems, optimize,
  setGoal: g => { $('optGoal').value = g; }, proj: () => proj,
  err: () => $('err').classList.contains('on') ? $('err').textContent : null, note: () => $('note').textContent };
`;

const source = readFileSync(legacyPath, 'utf8');
const end = source.lastIndexOf('})();');
if (end < 0) throw new Error('Fin de l’IIFE legacy introuvable.');
const patched = source.slice(0, end) + HOOK + source.slice(end);
const probe = readFileSync(resolve(root, 'scripts/legacy-probe.js'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/*', (route) =>
  route.request().url() === 'http://legacy.test/'
    ? route.fulfill({ contentType: 'text/html; charset=utf-8', body: patched })
    : route.abort(),
);

const results: Record<string, unknown> = {};
for (const cfg of configs) {
  if (cfg.name in results) throw new Error('Nom de configuration en double : ' + cfg.name);
  await page.goto('http://legacy.test/');
  await page.evaluate(() => localStorage.clear());
  await page.addScriptTag({ content: probe });
  results[cfg.name] = await page.evaluate('window.__dump(' + JSON.stringify(cfg) + ')');
  if (errors.length) throw new Error(cfg.name + ' : ' + errors.join('; '));
  process.stdout.write('.');
}
await browser.close();

mkdirSync(dirname(outPath), { recursive: true });
const legacySha256 = createHash('sha256').update(source).digest('hex');
writeFileSync(outPath, JSON.stringify({ legacySha256, results }) + '\n');
console.log(`\n${configs.length} configurations extraites dans ${outPath}`);
