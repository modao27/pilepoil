/**
 * Agrège les relevés de l'audit (docs/audit/captures-local/mesures/<scénario>/<appareil>.json) en synthèses
 * versionnées dans docs/audit/mesures/ : couverture (scénarios × appareils), contrôles automatiques par écran
 * (axe-core, cibles, débordement, champs < 16 px) et échecs d'étape. Usage : npx tsx tests/audit/aggregate.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Check {
  url: string;
  axe: { id: string; impact: string | null; help: string; nodes: string[] }[];
  smallTargets: string[];
  overflowX: number;
  smallInputs: string[];
  clipped: string[];
}
interface Record_ {
  title: string;
  device: string;
  status: string;
  notes: Record<string, unknown>;
  checks: Record<string, Check>;
}

const root = join(import.meta.dirname, '..', '..', 'docs', 'audit');
const src = join(root, 'captures-local', 'mesures');
const out = join(root, 'mesures');
mkdirSync(out, { recursive: true });

const records: Record_[] = [];
for (const s of existsSync(src) ? readdirSync(src) : [])
  for (const f of readdirSync(join(src, s))) records.push(JSON.parse(readFileSync(join(src, s, f), 'utf8')) as Record_);

const scenarios = [...new Set(records.map((r) => /^([A-N]\d+)/.exec(r.title)?.[1] ?? '?'))].sort((a, b) =>
  a.localeCompare(b, 'fr', { numeric: true }),
);
const devices = [...new Set(records.map((r) => r.device))].sort();

// couverture : statut de chaque scénario sur chaque appareil
const cell = (s: string, d: string) => {
  const r = records.find((x) => x.device === d && x.title.startsWith(s + ' '));
  if (!r) return '·';
  const fails = Object.keys(r.notes).filter((k) => k.startsWith('échec:')).length;
  const skipped = 'non-teste' in r.notes;
  return r.status === 'passed'
    ? skipped
      ? 'n/a'
      : fails
        ? `~${fails}`
        : 'ok'
    : r.status === 'timedOut'
      ? 'délai'
      : 'KO';
};
const short = (d: string) =>
  d
    .replace('tel-', 'T')
    .replace('tab-', 'Tab')
    .replace('pc-', 'PC')
    .replace('-portrait', '-po')
    .replace('-paysage', '-pa')
    .replace('chromium', 'cr')
    .replace('webkit', 'wk')
    .replace('firefox', 'ff');
let cov = `# Couverture : scénarios × appareils\n\nok : scénario au bout sans échec d'étape ; ~n : n étapes en échec (relevées comme constats ou limites du test) ; n/a : sans objet sur ce moteur ; délai / KO : scénario interrompu ; · : pas lancé.\n\n| Scénario | ${devices.map(short).join(' | ')} |\n|---|${devices.map(() => '---').join('|')}|\n`;
for (const s of scenarios) cov += `| ${s} | ${devices.map((d) => cell(s, d)).join(' | ')} |\n`;
writeFileSync(join(out, 'couverture.md'), cov);

// contrôles automatiques par écran
const checks: Record<string, Record<string, Check>> = {};
for (const r of records) for (const [k, c] of Object.entries(r.checks)) (checks[k] ??= {})[r.device] = c;
let ctl =
  '# Contrôles automatiques par écran\n\nPar écran (et thème) : violations axe-core WCAG 2.2 A/AA (identifiant : nombre d’appareils), cibles < 44 px (maximum sur les appareils), défilement horizontal (appareils concernés), champs < 16 px (zoom iOS).\n\n| Écran | axe | cibles < 44 px | débordement | champs < 16 px |\n|---|---|---|---|---|\n';
const axeDetail: Record<string, { help: string; impact: string | null; screens: Set<string>; nodes: Set<string> }> = {};
for (const [screen, byDev] of Object.entries(checks).sort()) {
  const axeCount: Record<string, number> = {};
  for (const c of Object.values(byDev))
    for (const v of c.axe) {
      axeCount[v.id] = (axeCount[v.id] ?? 0) + 1;
      const a = (axeDetail[v.id] ??= { help: v.help, impact: v.impact, screens: new Set(), nodes: new Set() });
      a.screens.add(screen);
      v.nodes.slice(0, 3).forEach((n) => a.nodes.add(n));
    }
  const targets = Math.max(0, ...Object.values(byDev).map((c) => c.smallTargets.length));
  const over = Object.entries(byDev)
    .filter(([, c]) => c.overflowX > 0)
    .map(([d, c]) => `${short(d)} (+${c.overflowX})`);
  const inputs = Math.max(0, ...Object.values(byDev).map((c) => c.smallInputs.length));
  ctl += `| ${screen} | ${
    Object.entries(axeCount)
      .map(([k, n]) => `${k}: ${n}`)
      .join(', ') || '—'
  } | ${targets || '—'} | ${over.join(', ') || '—'} | ${inputs || '—'} |\n`;
}
ctl += '\n## Violations axe-core\n\n';
for (const [id, a] of Object.entries(axeDetail).sort())
  ctl += `### ${id} (${a.impact ?? '?'})\n${a.help}\n\nÉcrans : ${[...a.screens].sort().join(', ')}\n\nExemples : ${[
    ...a.nodes,
  ]
    .slice(0, 6)
    .map((n) => '`' + n + '`')
    .join(', ')}\n\n`;
ctl += '## Cibles < 44 px (exemples, appareil de référence téléphone)\n\n';
for (const [screen, byDev] of Object.entries(checks).sort()) {
  const c = byDev['tel-390x844-portrait-chromium'];
  if (c?.smallTargets.length) ctl += `- ${screen} : ${c.smallTargets.slice(0, 8).join(' ; ')}\n`;
}
ctl += '\n## Champs < 16 px (exemples)\n\n';
for (const [screen, byDev] of Object.entries(checks).sort()) {
  const c = Object.values(byDev).find((x) => x.smallInputs.length);
  if (c) ctl += `- ${screen} : ${c.smallInputs.slice(0, 5).join(' ; ')}\n`;
}
writeFileSync(join(out, 'controles.md'), ctl);

// échecs d'étape et erreurs console
let fails = '# Étapes en échec et erreurs de la console\n\n';
for (const s of scenarios) {
  const rs = records.filter((r) => r.title.startsWith(s + ' '));
  const lines: string[] = [];
  for (const r of rs) {
    for (const [k, v] of Object.entries(r.notes))
      if (k.startsWith('échec:'))
        lines.push(`- ${short(r.device)} — ${k.slice(6)} : ${(v as { message: string }).message.slice(0, 160)}`);
    if (r.notes['erreurs-console'])
      lines.push(`- ${short(r.device)} — console : ${JSON.stringify(r.notes['erreurs-console']).slice(0, 200)}`);
    if (r.status !== 'passed') lines.push(`- ${short(r.device)} — scénario ${r.status}`);
  }
  if (lines.length) fails += `## ${s}\n\n${lines.join('\n')}\n\n`;
}
writeFileSync(join(out, 'echecs.md'), fails);

// mesures de performance et Lighthouse, par appareil
let perf = '# Mesures de performance par appareil\n\n';
for (const s of ['M1', 'M2', 'M3', 'M5', 'L11', 'I2']) {
  perf += `## ${s}\n\n`;
  for (const r of records.filter((x) => x.title.startsWith(s + ' ')).sort((a, b) => a.device.localeCompare(b.device)))
    perf += `- ${short(r.device)} : \`${JSON.stringify(r.notes).slice(0, 1500)}\`\n`;
  perf += '\n';
}
writeFileSync(join(out, 'performance.md'), perf);

console.log(`${records.length} relevés, ${scenarios.length} scénarios, ${devices.length} appareils`);
