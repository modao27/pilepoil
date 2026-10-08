/** Liste d'achat consolidée du projet : lignes de tous les modules, regroupées par rayon (docs/BOITE.md §7). */
import type { ShoppingGroup, ShoppingLine } from '../../core/shopping/types';

/** Ordre des rayons, comme dans un magasin de bricolage. */
export const GROUP_ORDER: ShoppingGroup[] = ['covering', 'underlay', 'finish', 'consumable', 'tool'];

export interface Consolidated {
  groups: { group: ShoppingGroup; lines: ShoppingLine[]; total: number }[];
  /** Dans l'ordre d'apparition des modules. */
  byModule: { module: string; total: number; unpriced: number }[];
  total: number;
  /** Lignes sans prix (exclues des totaux). */
  unpriced: number;
}

export const lineCost = (l: ShoppingLine): number | null => (l.unitPrice == null ? null : l.unitPrice * l.quantity);

export function consolidate(lines: ShoppingLine[]): Consolidated {
  const groups = GROUP_ORDER.map((group) => {
    const ls = lines.filter((l) => l.group === group);
    return { group, lines: ls, total: ls.reduce((t, l) => t + (lineCost(l) ?? 0), 0) };
  }).filter((g) => g.lines.length);
  const byModule: Consolidated['byModule'] = [];
  for (const l of lines) {
    let m = byModule.find((x) => x.module === l.module);
    if (!m) byModule.push((m = { module: l.module, total: 0, unpriced: 0 }));
    const c = lineCost(l);
    if (c == null) m.unpriced++;
    else m.total += c;
  }
  return {
    groups,
    byModule,
    total: byModule.reduce((t, m) => t + m.total, 0),
    unpriced: byModule.reduce((t, m) => t + m.unpriced, 0),
  };
}

export const GROUP_LABEL: Record<ShoppingGroup, string> = {
  covering: 'Revêtements',
  underlay: 'Sous-couches',
  finish: 'Finitions',
  consumable: 'Consommables',
  tool: 'Outillage',
};

/** Unité du prix unitaire saisi. */
export const PRICE_LABEL: Record<ShoppingLine['unit'], string> = {
  pack: '€/paquet',
  box: '€/carton',
  roll: '€/rouleau',
  bar: '€/barre',
  bag: '€/sac',
  sachet: '€/sachet',
  tube: '€/tube',
  cartridge: '€/cartouche',
  litre: '€/L',
  piece: '€/pièce',
  m2: '€/m²',
  m: '€/m',
};

/** Prix saisi (« 12,5 », « 12.50 € ») ; null si vide ou invalide (revenir au prix de la bibliothèque). */
export function parsePrice(text: string): number | null {
  const v = Number(text.replace(/[\s€]/g, '').replace(',', '.'));
  return text.trim() && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

const csvNum = (v: number | null, d = 2) =>
  v == null ? '' : v.toLocaleString('fr-FR', { maximumFractionDigits: d, useGrouping: false });
const csvText = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * Liste d'achat en CSV pour un tableur en français : séparateur « ; », virgule décimale, BOM UTF-8
 * (accents lus correctement par Excel).
 */
export function toCsv(c: Consolidated, moduleLabel: (id: string) => string): string {
  const rows = [['Rayon', 'Outil', 'Article', 'Détail', 'Quantité', 'Prix unitaire', 'Unité de prix', 'Total']];
  for (const g of c.groups)
    for (const l of g.lines)
      rows.push([
        GROUP_LABEL[g.group],
        moduleLabel(l.module),
        l.label,
        l.detail ?? '',
        csvNum(l.quantity),
        csvNum(l.unitPrice),
        PRICE_LABEL[l.unit],
        csvNum(lineCost(l)),
      ]);
  rows.push([
    'Total estimé',
    '',
    '',
    c.unpriced ? `${c.unpriced} article(s) sans prix` : '',
    '',
    '',
    '',
    csvNum(c.total),
  ]);
  return '\uFEFF' + rows.map((r) => r.map(csvText).join(';')).join('\r\n') + '\r\n';
}
