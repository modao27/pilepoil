/**
 * Calepinage des plaques d'une cloison et réemploi des chutes (docs/cloisons/SPEC.md §4.3). Montage vertical :
 * la plaque est coupée à `hauteur − plateGap`, les joints tombent sur des montants (multiples de l'entraxe).
 * Repère : x le long de l'axe depuis le départ. Pur ; mm.
 */
import type { Alert, CloisonsSettings, Face, PlateFormat, PlatePiece, SpecPartition } from './types';

/** Plus petit format de plaque assez long pour `height` ; null si aucun. */
export function chooseFormat(height: number, s: Pick<CloisonsSettings, 'plateFormats'>): PlateFormat | null {
  const sorted = [...s.plateFormats].sort((a, b) => a.length - b.length || a.width - b.width);
  return sorted.find((f) => f.length >= height - 1e-6) ?? null;
}

/** Décalage normal des joints : un entraxe d'écart entre couches d'une face et entre les deux faces. */
export function staggerOffset(face: Face, layer: number, spacing: number): number {
  return ((layer - 1 + (face === 'b' ? 1 : 0)) % 2) * spacing;
}

/** Abscisses des joints verticaux d'une face, 0 < x < longueur. */
export function joints(length: number, offset: number, width: number): number[] {
  const out: number[] = [];
  for (let x = offset > 0 ? offset : width; x < length - 0.5; x += width) out.push(x);
  return out;
}

const nearJamb = (xs: number[], p: SpecPartition, gap: number) =>
  xs.some((x) => p.openings.some((o) => [o.offset, o.offset + o.width].some((e) => Math.abs(x - e) < gap)));

/**
 * Décalage de chaque face et couche. Un joint à moins de `studMinGap` d'un bord de baie n'a pas de montant dessous :
 * le décalage passe à l'autre valeur permise (0 ou un entraxe) ; si aucune ne convient, le décalage normal est gardé
 * avec l'alerte `joint-at-jamb`. Les joints de deux couches ou de deux faces qui coïncident après correction sont
 * signalés (`joints-aligned`).
 */
export function chooseOffsets(
  p: SpecPartition,
  layers: number,
  width: number,
  s: Pick<CloisonsSettings, 'studMinGap'>,
): { offsets: { face: Face; layer: number; offset: number }[]; alerts: Alert[] } {
  const alerts: Alert[] = [];
  const offsets: { face: Face; layer: number; offset: number }[] = [];
  for (const face of ['a', 'b'] as const)
    for (let layer = 1; layer <= layers; layer++) {
      const normal = staggerOffset(face, layer, p.spacing);
      const other = normal === 0 ? p.spacing : 0;
      const pick = [normal, other].find((o) => !nearJamb(joints(p.length, o, width), p, s.studMinGap));
      if (pick === undefined) alerts.push({ code: 'joint-at-jamb', partition: p.id, params: { face, layer } });
      offsets.push({ face, layer, offset: pick ?? normal });
    }
  const at = (face: Face, layer: number) => offsets.find((o) => o.face === face && o.layer === layer)?.offset;
  let aligned = false;
  for (let layer = 1; layer <= layers; layer++) if (at('a', layer) === at('b', layer)) aligned = true;
  for (const face of ['a', 'b'] as const) if (layers > 1 && at(face, 1) === at(face, 2)) aligned = true;
  if (aligned) alerts.push({ code: 'joints-aligned', partition: p.id });
  return { offsets, alerts };
}

/**
 * Pièces de plaque d'une face et d'une couche : une par colonne entre deux joints. Une baie découpe la colonne (pièce
 * en L ou en U, qui occupe sa boîte englobante dans la feuille) ; une colonne entièrement dans la largeur d'une baie
 * ne garde que la bande au-dessus.
 */
export function layoutPlates(
  p: SpecPartition,
  face: Face,
  layer: number,
  offset: number,
  width: number,
  plateHeight: number,
): PlatePiece[] {
  const xs = [0, ...joints(p.length, offset, width), p.length];
  const out: PlatePiece[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i]!,
      x1 = xs[i + 1]!,
      w = x1 - x0;
    if (w < 0.5) continue;
    const id = `${p.id}#${face}${layer}.${out.length + 1}`;
    const base = { id, face, layer, type: p.plates[face], x0, x1, width: w, from: null };
    const covering = p.openings.find((o) => o.offset <= x0 + 0.5 && o.offset + o.width >= x1 - 0.5);
    if (covering) {
      const h = plateHeight - covering.height;
      if (h > 0.5) out.push({ ...base, y0: covering.height, height: h, area: w * h });
      continue;
    }
    const cut = p.openings.reduce(
      (sum, o) =>
        sum + Math.max(0, Math.min(x1, o.offset + o.width) - Math.max(x0, o.offset)) * Math.min(o.height, plateHeight),
      0,
    );
    out.push({ ...base, y0: 0, height: plateHeight, area: w * plateHeight - cut });
  }
  return out;
}

/** Résultat du placement des pièces d'un lot sur des feuilles et des chutes. */
export interface Packing {
  /** Feuilles neuves, par format « longueurxlargeur ». */
  sheets: Record<string, number>;
  /** Chutes gardées, `[largeur, hauteur, identifiant]`. */
  offcuts: [number, number, string][];
}

interface Offcut {
  w: number;
  h: number;
  id: string;
}

export const formatKey = (f: PlateFormat) => `${f.length}x${f.width}`;

/**
 * Places les pièces (largeur décroissante, puis hauteur, puis identifiant) au premier ajustement : d'abord dans la
 * plus petite chute qui convient, sinon dans une feuille neuve du plus petit format assez long. Le reste d'une feuille
 * ou d'une chute se coupe en guillotine : la bande de droite sur toute la hauteur, la bande du haut sur la largeur de la
 * pièce ; une bande dont la plus petite dimension est inférieure à `minOffcut` est perdue. Renseigne `from` de chaque
 * pièce. `prefix` rend les identifiants de chute uniques entre lots. Pur, sans rotation.
 */
export function packPlates(pieces: PlatePiece[], formats: PlateFormat[], minOffcut: number, prefix = ''): Packing {
  const sorted = [...pieces].sort((a, b) => b.width - a.width || b.height - a.height || (a.id < b.id ? -1 : 1));
  const fmts = [...formats].sort((a, b) => a.length - b.length || a.width - b.width);
  const sheets: Record<string, number> = {};
  const stock: Offcut[] = [];
  let sheetNo = 0,
    cutNo = 0;
  const keep = (w: number, h: number) => {
    if (Math.min(w, h) >= minOffcut) stock.push({ w, h, id: `${prefix}C-${++cutNo}` });
  };
  for (const piece of sorted) {
    const fit = stock
      .filter((o) => o.w >= piece.width - 1e-6 && o.h >= piece.height - 1e-6)
      .sort((a, b) => a.w * a.h - b.w * b.h || (a.id < b.id ? -1 : 1))[0];
    if (fit) {
      stock.splice(stock.indexOf(fit), 1);
      piece.from = { offcut: fit.id };
      keep(fit.w - piece.width, fit.h);
      keep(piece.width, fit.h - piece.height);
      continue;
    }
    const f = fmts.find((x) => x.length >= piece.height - 1e-6 && x.width >= piece.width - 1e-6);
    if (!f) continue;
    sheets[formatKey(f)] = (sheets[formatKey(f)] ?? 0) + 1;
    piece.from = { sheet: ++sheetNo };
    keep(f.width - piece.width, f.length);
    keep(piece.width, f.length - piece.height);
  }
  return { sheets, offcuts: stock.map((o): [number, number, string] => [o.w, o.h, o.id]) };
}
