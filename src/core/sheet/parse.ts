/**
 * Lecture d'une fiche produit collée (tableau de caractéristiques d'un site marchand, texte du favori « Envoyer à
 * PilePoil ») : paires libellé / valeur. Pur, sans réseau. Formats reconnus, ligne par ligne :
 * - « Libellé⇥valeur » (tableau copié) ;
 * - « Libellé : valeur » ;
 * - « Libellé » puis « valeur » sur la ligne suivante (texte de page copié) : chaque ligne sans séparateur est
 *   associée à la suivante ; les associations fausses ne correspondent à aucun libellé cherché.
 */
import { lengthMm, type LengthUnit } from './values';

export interface SheetPair {
  /** Libellé normalisé (minuscules, sans accents, espaces simples) : c'est lui qu'on cherche. */
  key: string;
  label: string;
  value: string;
}

export interface Sheet {
  pairs: SheetPair[];
  /** Première ligne du texte : souvent le nom du produit quand aucun libellé « Nom » n'est donné. */
  title: string;
}

/** Minuscules, sans accents ni ponctuation finale, espaces simples. */
export function normalizeLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s:]+$/, '')
    .trim();
}

const COLON = /^([^:]{2,90}?)\s*:\s+(.+)$/;

function pair(label: string, value: string): SheetPair {
  return { key: normalizeLabel(label), label: label.trim(), value: value.trim() };
}

export function parseSheet(text: string): Sheet {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const pairs: SheetPair[] = [];
  lines.forEach((line, i) => {
    const tab = line.indexOf('\t');
    if (tab > 0) {
      const value = line.slice(tab + 1).trim();
      if (value) pairs.push(pair(line.slice(0, tab), value));
      return;
    }
    const m = COLON.exec(line);
    if (m) {
      pairs.push(pair(m[1]!, m[2]!));
      return;
    }
    const next = lines[i + 1];
    if (next !== undefined && line.length <= 90) pairs.push(pair(line, next));
  });
  return { pairs, title: lines[0] ?? '' };
}

/** Première paire dont le libellé correspond, motifs essayés dans l'ordre (sur le libellé normalisé). */
export function findPair(sheet: Sheet, ...patterns: RegExp[]): SheetPair | undefined {
  for (const p of patterns) {
    const hit = sheet.pairs.find((x) => p.test(x.key));
    if (hit) return hit;
  }
  return undefined;
}

/** Valeur de `findPair`. */
export function findValue(sheet: Sheet, ...patterns: RegExp[]): string | undefined {
  return findPair(sheet, ...patterns)?.value;
}

/** Longueur en mm d'une paire (unité de la valeur, sinon du libellé, sinon `fallback`) : voir `lengthMm`. */
export function findLength(sheet: Sheet, fallback: LengthUnit, ...patterns: RegExp[]): number | null {
  const p = findPair(sheet, ...patterns);
  return p ? lengthMm(p.value, p.label, fallback) : null;
}

/** Tout le texte normalisé (libellés et valeurs), pour les indices diffus (« bâton rompu », « clipsable »…). */
export function sheetText(sheet: Sheet): string {
  return normalizeLabel([sheet.title, ...sheet.pairs.map((p) => p.key + ' ' + p.value)].join(' '));
}
