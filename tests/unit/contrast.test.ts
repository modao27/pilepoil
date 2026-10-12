/** Contraste WCAG AA des variables de src/ui/design/tokens.css, en clair et en sombre. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/ui/design/tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Déclarations `--nom: valeur` de tous les blocs dont le sélecteur vaut `selector`. */
function block(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const [, sel, body] of css.matchAll(re)) {
    if (sel!.trim() !== selector) continue;
    for (const [, k, v] of body!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[k!] = v!.trim();
  }
  return out;
}

const light = block(':root');
const darkMedia = block(":root:not([data-theme='light'])");
const darkAttr = block(":root[data-theme='dark']");
const themes = { clair: light, sombre: { ...light, ...darkAttr } };

function resolve(vars: Record<string, string>, name: string): string {
  let v = vars[name];
  for (let i = 0; v && i < 10; i++) {
    const m = /^var\((--[\w-]+)\)$/.exec(v);
    if (!m) break;
    v = vars[m[1]!];
  }
  if (!v || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(`${name} : couleur non résolue (${v})`);
  return v;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

/** Texte : 4,5:1. Le texte secondaire ne va jamais sur --color-surface-2 (sauge, 4,49:1 en clair). */
const TEXT: [string, string][] = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-surface-2'],
  ['--color-text', '--color-info-bg'],
  ['--color-text', '--color-selected-bg'],
  ['--color-text-muted', '--color-selected-bg'],
  ['--color-primary', '--color-selected-bg'],
  ['--color-text-muted', '--color-bg'],
  ['--color-text-muted', '--color-surface'],
  ['--color-primary', '--color-bg'],
  ['--color-primary', '--color-surface'],
  ['--color-primary', '--color-info-bg'],
  ['--color-on-primary', '--color-primary'],
  ['--color-on-primary', '--color-primary-hover'],
  ['--color-accent-text', '--color-bg'],
  ['--color-accent-text', '--color-surface'],
  ['--color-error', '--color-surface'],
  ['--color-error', '--color-bg'],
  ['--color-error', '--color-error-bg'],
  ['--color-warning', '--color-warning-bg'],
  ['--color-success', '--color-success-bg'],
  ['--color-success', '--color-surface'],
  ['--color-info', '--color-info-bg'],
];

/** Bordures de champ, focus, bouton plein : 3:1 (WCAG 1.4.11). */
const UI: [string, string][] = [
  ['--color-field-border', '--color-surface'],
  ['--color-field-border', '--color-bg'],
  ['--color-field-border', '--color-surface-2'],
  ['--color-focus', '--color-bg'],
  ['--color-focus', '--color-surface'],
  ['--color-primary', '--color-surface'],
  ['--color-error', '--color-surface'],
];

describe('contraste AA des tokens', () => {
  it('le mode sombre est le même par le système et par le réglage', () => {
    expect(darkMedia).toEqual(darkAttr);
  });

  for (const [theme, vars] of Object.entries(themes)) {
    it.each(TEXT)(`${theme} : texte %s sur %s ≥ 4,5:1`, (fg, bg) => {
      expect(ratio(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(4.5);
    });
    it.each(UI)(`${theme} : %s sur %s ≥ 3:1`, (fg, bg) => {
      expect(ratio(resolve(vars, fg), resolve(vars, bg))).toBeGreaterThanOrEqual(3);
    });
  }

  it('terracotta et ocre purs échouent en texte : les teintes « -texte » existent pour ça', () => {
    expect(ratio(resolve(light, '--pp-terracotta'), resolve(light, '--pp-ivoire'))).toBeLessThan(4.5);
    expect(ratio(resolve(light, '--pp-terracotta-texte'), resolve(light, '--pp-ivoire'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio(resolve(light, '--pp-ocre-texte'), resolve(light, '--pp-ivoire'))).toBeGreaterThanOrEqual(4.5);
  });
});
