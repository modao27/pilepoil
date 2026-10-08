/**
 * Textes des résultats (liste d'achat, encollage, scénarios), communs à l'écran et au PDF.
 * Formulations reprises de legacy.
 */
import {
  pattern,
  type GlueNote,
  type Notch,
  type Piece,
  type PriceUnit,
  type ProductGroup,
  type ProjectResult,
  type ShoppingItem,
  type ZoneGlue,
} from '../../core';
import type { Tile } from '../../state/model';
import type { CarrelageProject } from '../../state/data';
import { productName } from './messages';

const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export const PRICE_UNIT: Record<PriceUnit, string> = {
  m2: '€/m²',
  piece: '€/pièce',
  bag: '€/sac',
  sachet: '€/sachet',
  litre: '€/L',
  bar: '€/barre',
  cartridge: '€/cartouche',
};

export interface ItemLabel {
  label: string;
  qty: string;
  unit: string;
  /** Pastille de couleur (carreau, joint). */
  dot?: string;
}

export function shoppingLabel(it: ShoppingItem, groups: ProductGroup[]): ItemLabel {
  const unit = PRICE_UNIT[it.unit];
  switch (it.kind) {
    case 'tile': {
      const g = groups[it.group];
      return {
        label: g ? productName(g.label) : 'Carreau',
        dot: g?.color,
        unit,
        qty: it.boxes
          ? `${fr(it.boxes)} carton${it.boxes > 1 ? 's' : ''} (${fr(it.buyM2, 2)} m²)`
          : `${fr(it.order)} pièce${it.order > 1 ? 's' : ''} (${fr(it.m2, 2)} m²)`,
      };
    }
    case 'adhesive':
      return {
        label: `Mortier-colle ${it.flexible ? 'déformable C2 S1' : 'C2'}`,
        unit,
        qty: `${fr(it.bags)} sacs de 25 kg (${fr(it.kg)} kg)`,
      };
    case 'grout':
      return {
        label: 'Mortier de joint',
        dot: it.color,
        unit,
        qty: `${fr(it.bags)} sac${it.bags > 1 ? 's' : ''} de 5 kg (${fr(it.kg, 1)} kg)`,
      };
    case 'spacers':
      return {
        label: `Croisillons ${fr(it.joint, 1)} mm`,
        unit,
        qty: `${fr(it.bags)} sachet${it.bags > 1 ? 's' : ''} de 200`,
      };
    case 'clips':
      return {
        label: 'Cales de nivellement (grands formats)',
        unit,
        qty: `${fr(it.bags)} sachet${it.bags > 1 ? 's' : ''} de 100`,
      };
    case 'primer':
      return { label: 'Primaire d’accrochage', unit, qty: `${fr(it.litres)} L` };
    case 'profiles':
      return {
        label: 'Profilés d’angle',
        unit,
        qty: `${fr(it.bars)} barre${it.bars > 1 ? 's' : ''} de 2,5 m (${fr(it.meters, 1)} m)`,
      };
    case 'silicone':
      return {
        label: 'Silicone sanitaire (angles, menuiseries)',
        unit,
        qty: `${fr(it.cartridges)} cartouche${it.cartridges > 1 ? 's' : ''} (${fr(it.meters, 1)} m)`,
      };
  }
}

export const NOTCH_LABEL: Record<Notch, string> = {
  U3: 'U3 (3 mm)',
  U6: 'U6 (6 mm)',
  U9: 'U9 (9 mm)',
  'U9-or-DL20': 'U9 ou demi-lune DL20',
  DL20: 'Demi-lune DL20',
};

export function glueNoteText(n: GlueNote, kind: 'wall' | 'floor'): string {
  switch (n) {
    case 'mosaic':
      return 'Mosaïque : peigne fin, bien serrer la colle.';
    case 'deformable':
      return 'Mortier-colle déformable (C2 S1) conseillé.';
    case 'large-format':
      return 'Grand format : mortier-colle déformable (C2 S1), support très plan.';
    case 'beyond-dtu':
      return `${kind === 'floor' ? 'Au-delà de 10 000 cm²' : 'Au-delà de 3 600 cm² en mur'} : hors DTU, suivre l’avis technique du fabricant.`;
    case 'elongated':
      return 'Format allongé : double encollage recommandé contre le tuilage.';
  }
}

export interface GlueRow {
  where: string;
  tile: string;
  size: string;
  notch: string;
  mode: string;
  double: boolean;
  note: string;
  kg: string;
}

/** Une ligne par zone carrelée : carreau, spatule, simple ou double encollage, colle estimée. */
export function glueRows(project: CarrelageProject, result: ProjectResult): GlueRow[] {
  const multi = project.surfaces.length > 1;
  return result.glue.map((g: ZoneGlue) => {
    const s = project.surfaces[g.surface];
    const kind = s?.kind ?? 'wall';
    const p = result.pieces.find((x) => x.surface === g.surface && x.zone === g.zone && x.kind === 'main');
    return {
      where: `${multi ? (s?.name ?? '') + ', ' : ''}Zone ${g.zone + 1}`,
      tile: p ? productName(p.label) : '',
      size: `${fr(g.advice.S)} cm²`,
      notch: NOTCH_LABEL[g.advice.notch],
      mode: g.advice.double ? 'Double' : 'Simple',
      double: g.advice.double,
      note: g.advice.notes.map((n) => glueNoteText(n, kind)).join(' '),
      kg: `${fr(g.kg)} kg`,
    };
  });
}

const SIDE = { L: 'tableau gauche', R: 'tableau droit', T: 'linteau', B: 'appui' } as const;
const mm = (v: number) => fr(Math.round(v * 10) / 10, 1);

/** Pièce du plan de découpe : « encoche 600 × 120 (F1 linteau) [Mur B] » (comme legacy). */
export function pieceCutText(pc: Piece, project: CarrelageProject): string {
  const kind = pc.notch ? 'encoche ' : pc.rect ? '' : 'biais ';
  const extra = pc.plinth ? ' (plinthe)' : pc.reveal ? ` (F${pc.reveal.opening + 1} ${SIDE[pc.reveal.side]})` : '';
  const where = project.surfaces.length > 1 ? ` [${project.surfaces[pc.surface]?.name ?? ''}]` : '';
  return `${kind}${mm(pc.pw)} × ${mm(pc.ph)}${extra}${where}`;
}

export interface CompareMetrics {
  posed: number;
  needed: number;
  order: number;
  m2: number;
  boxes: number;
  cuts: number;
  thin: number;
  vis: number;
  reused: number;
  minCut: number;
  cost: number;
}

/** Critères de comparaison A/B : libellé, clé, décimales, sens (1 : moins c'est mieux, −1 : plus c'est mieux). */
export const COMPARE_ROWS: [string, keyof CompareMetrics, number, number][] = [
  ['Carreaux posés', 'posed', 0, 0],
  ['Carreaux nécessaires', 'needed', 0, 1],
  ['À commander', 'order', 0, 1],
  ['Surface à commander (m²)', 'm2', 2, 1],
  ['Cartons', 'boxes', 0, 1],
  ['Pièces coupées', 'cuts', 0, 1],
  ['Coupes fines', 'thin', 0, 1],
  ['Coupes apparentes', 'vis', 0, 1],
  ['Taillées dans les chutes', 'reused', 0, -1],
  ['Coupe la plus étroite (mm)', 'minCut', 0, -1],
  ['Coût estimé (€)', 'cost', 2, 1],
];

export type Verdict = 'better' | 'worse' | 'same';

/** Écart B − A et verdict selon le sens du critère. */
export function compareValue(a: number, b: number, dir: number): { delta: number; verdict: Verdict } {
  const delta = b - a;
  if (!dir || Math.abs(delta) < 1e-9) return { delta, verdict: 'same' };
  return { delta, verdict: delta * dir < 0 ? 'better' : 'worse' };
}

/** « 2 surfaces, décalé ½ 60 × 30 / bâtons rompus 60 × 30 » [metrics.desc]. */
export function projectDescription(project: CarrelageProject, tiles: readonly Tile[]): string {
  const byId = new Map(tiles.map((t) => [t.id, t]));
  const zones = project.surfaces.flatMap((s) => s.zones);
  const parts = [
    ...new Set(
      zones.map((z) => {
        const t = byId.get(z.tileId);
        const size = t
          ? t.shape === 'hex' || t.shape === 'octo'
            ? `${fr(t.length / 10, 1)}`
            : `${fr(t.length / 10, 1)} × ${fr(t.width / 10, 1)}`
          : '?';
        return `${pattern(z.pattern).name} ${size}`;
      }),
    ),
  ];
  return (project.surfaces.length > 1 ? `${project.surfaces.length} surfaces, ` : '') + parts.join(' / ');
}
