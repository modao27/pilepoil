/**
 * Élévation d'une cloison (docs/cloisons/SPEC.md §8) : géométrie de dessin (ossature, baies, plaques d'une face et d'une
 * couche) et fiche de coupe, lues dans le résultat du moteur. Partagée par l'écran (SVG) et le PDF. Pur ; mm, x le long
 * de l'axe depuis la face d'appui du départ, y depuis le sol vers le haut.
 */
import type { Face, PartitionResult, PlatePiece, RailPiece, SpecPartition, Stud, StudRole } from '../../core/types';

/** Hauteur dessinée d'un rail et largeur dessinée d'un montant, mm. */
export const RAIL_DRAW = 40;
export const STUD_DRAW = 36;

export interface ElevationStud {
  x: number;
  /** Décalage horizontal pour les montants doublés côte à côte. */
  dx: number;
  y0: number;
  y1: number;
  role: StudRole;
}

export interface ElevationRail {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  kind: RailPiece['kind'];
}

export interface ElevationOpening {
  x0: number;
  x1: number;
  /** Hauteur de la baie. */
  height: number;
  kind: 'door' | 'opening';
}

export interface Elevation {
  length: number;
  height: number;
  studs: ElevationStud[];
  rails: ElevationRail[];
  openings: ElevationOpening[];
}

/** Ossature et baies : identiques pour les deux faces. */
export function elevationOf(p: SpecPartition, r: PartitionResult): Elevation {
  const H = p.height;
  const byX = new Map<number, Stud[]>();
  for (const s of r.studs) byX.set(s.x, [...(byX.get(s.x) ?? []), s]);
  const studs: ElevationStud[] = [];
  for (const group of byX.values())
    group.forEach((s, i) => {
      const y1 = H - RAIL_DRAW;
      studs.push({
        x: s.x,
        dx: (i - (group.length - 1) / 2) * STUD_DRAW,
        y0: Math.max(RAIL_DRAW, y1 - s.length),
        y1,
        role: s.role,
      });
    });
  const rails = r.rails.map((q): ElevationRail => {
    if (q.kind === 'top') return { x0: q.x0, x1: q.x1, y0: H - RAIL_DRAW, y1: H, kind: q.kind };
    if (q.kind === 'bottom') return { x0: q.x0, x1: q.x1, y0: 0, y1: RAIL_DRAW, kind: q.kind };
    // linteau : en tête de la baie qu'il couvre
    const o = p.openings.find((x) => q.x0 <= x.offset && q.x1 >= x.offset + x.width);
    const y = o?.height ?? 0;
    return { x0: q.x0, x1: q.x1, y0: y, y1: y + RAIL_DRAW, kind: q.kind };
  });
  const openings = p.openings.map((o) => ({ x0: o.offset, x1: o.offset + o.width, height: o.height, kind: o.kind }));
  return { length: p.length, height: H, studs, rails, openings };
}

export interface ElevationPlate {
  /** Numéro de la pièce dans sa face et sa couche (1, 2…). */
  n: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Où écrire le numéro : au centre, ou au-dessus de la baie quand le centre tombe dedans. */
  lx: number;
  ly: number;
  /** Feuille neuve ou chute réemployée. */
  reused: boolean;
  /** « feuille 4 », « chute S12.5-C-1 ». */
  source: string;
}

const pieceNumber = (q: PlatePiece) => Number(q.id.slice(q.id.lastIndexOf('.') + 1));

const sourceOf = (q: PlatePiece) =>
  !q.from ? '—' : 'sheet' in q.from ? `feuille ${q.from.sheet}` : `chute ${q.from.offcut}`;

/** Plaques d'une face et d'une couche. */
export function platesOf(
  r: PartitionResult,
  face: Face,
  layer: number,
  openings: readonly ElevationOpening[] = [],
): ElevationPlate[] {
  return r.plates
    .filter((q) => q.face === face && q.layer === layer)
    .map((q) => {
      const y1 = q.y0 + q.height;
      const lx = (q.x0 + q.x1) / 2;
      let ly = (q.y0 + y1) / 2;
      // le centre tombe dans une baie : le numéro passe au-dessus de sa tête, au milieu de la bande de plaque
      const o = openings.find((x) => lx >= x.x0 && lx <= x.x1 && ly < x.height);
      if (o) ly = (o.height + y1) / 2;
      return {
        n: pieceNumber(q),
        x0: q.x0,
        x1: q.x1,
        y0: q.y0,
        y1,
        lx,
        ly,
        reused: !!q.from && 'offcut' in q.from,
        source: sourceOf(q),
      };
    })
    .sort((a, b) => a.n - b.n);
}

export interface CutLine {
  face: Face;
  layer: number;
  n: number;
  width: number;
  height: number;
  area: number;
  source: string;
}

/** Fiche de coupe des plaques d'une cloison, dans l'ordre : face, couche, pièce. */
export function cutList(r: PartitionResult): CutLine[] {
  return [...r.plates]
    .sort((a, b) => a.face.localeCompare(b.face) || a.layer - b.layer || pieceNumber(a) - pieceNumber(b))
    .map((q) => ({
      face: q.face,
      layer: q.layer,
      n: pieceNumber(q),
      width: q.width,
      height: q.height,
      area: q.area,
      source: sourceOf(q),
    }));
}

const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

/** « Face A · couche 1 · pièce 3 : 1 200 × 2 490 mm, chute S12.5-C-1 ». */
export function cutText(c: CutLine, layers = 1): string {
  const layer = layers > 1 ? ` · couche ${c.layer}` : '';
  return `Face ${c.face.toUpperCase()}${layer} · pièce ${c.n} : ${fr(c.width)} × ${fr(c.height)} mm, ${c.source}`;
}

export interface StudSummary {
  role: StudRole;
  count: number;
  length: number;
}

/** Montants regroupés par rôle et longueur. */
export function studSummary(r: PartitionResult): StudSummary[] {
  const m = new Map<string, StudSummary>();
  for (const s of r.studs) {
    const k = `${s.role}:${s.length}`;
    const cur = m.get(k) ?? { role: s.role, count: 0, length: s.length };
    cur.count++;
    m.set(k, cur);
  }
  return [...m.values()];
}

export const ROLE_LABEL: Record<StudRole, string> = {
  grid: 'Montants de trame',
  start: 'Montants de départ',
  end: 'Montants d’arrivée',
  corner: 'Montants d’angle',
  jamb: 'Montants de baie',
  junction: 'Montants de liaison',
  cripple: 'Montants courts',
};
