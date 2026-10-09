/**
 * Motifs de pose partagés (docs/BOITE.md §10) : cellules d'un réseau, sans dépendre d'un module.
 * Le carrelage les utilise avec joint ; le parquet (bâton rompu, point de Hongrie) avec joint 0.
 */
import type { BBox, Point, Polygon } from '../geometry/types';

/** Points de départ d'un motif (repère local, cellules sans joint) [geo]. */
export interface PatternGeo {
  /** Départ « angle de zone ». */
  tl: Point;
  /** Départ « centré sur carreau ». */
  ctr: Point;
  /** Départ « centré sur joint ». */
  jn: Point;
  /** Côté du cabochon (octogone). */
  s?: number;
  /** Nombre de lames et pas (vannerie). */
  n?: number;
  p?: number;
}

/** Cellule = carreau + joint, avant rétraction de joint/2. */
export interface Cell {
  p: Polygon;
  /** Parité : alternance de couleur, colonne gauche/droite de la Hongrie. */
  par: number;
  kind: 'main' | 'cab';
}

/** Id : identifiant du motif (liste propre à chaque module, par exemple `PatternId` du carrelage). */
export interface PatternModule<Id extends string = string> {
  id: Id;
  /** Nom court du bouton. */
  label: string;
  /** Nom dans une phrase (« décalé ½ »). */
  name: string;
  /** Tracés SVG sur une grille 34 × 24. */
  icon: string;
  /** Forme du produit : rect, ou forme propre au motif. */
  shape: 'rect' | 'hex' | 'octo' | 'chevron';
  /** Carreau régulier donné par sa seule largeur a (hexagone, octogone). */
  regular: boolean;
  /** Épaisseur de rangée = a, quel que soit le sens des zones [rowT]. */
  rowIsA: boolean;
  /** a et b : côtés horizontal et vertical à 0°, j : joint. */
  geo(a: number, b: number, j: number): PatternGeo;
  /** Cellules dont la boîte touche bb (repère local). */
  generate(a: number, b: number, j: number, bb: BBox, g: PatternGeo): Cell[];
  /**
   * Fenêtre de recherche de l'optimiseur en x et y [zonePeriod]. C'est la période exacte du motif,
   * sauf pour les bâtons rompus (réseau oblique) et le décalé aléatoire (non périodique en y).
   */
  period(a: number, b: number, j: number): [number, number];
}

/** Collecteur qui écarte les cellules hors de la boîte. */
export function collector(bb: BBox): { out: Cell[]; push: (p: Polygon, par?: number, kind?: Cell['kind']) => void } {
  const [minX, maxX, minY, maxY] = bb;
  const out: Cell[] = [];
  const push = (p: Polygon, par = 0, kind: Cell['kind'] = 'main') => {
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (const q of p) {
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[1] > y1) y1 = q[1];
    }
    if (x0 > maxX || x1 < minX || y0 > maxY || y1 < minY) return;
    out.push({ p, par, kind });
  };
  return { out, push };
}

export const ICON_FRAME = '<rect x="1" y="1" width="32" height="22"/>';

/** Départs des motifs rectangulaires simples. */
export function rectGeo(a: number, b: number, j: number): PatternGeo {
  return { tl: [j / 2, j / 2], ctr: [(a + j) / 2, (b + j) / 2], jn: [0, 0] };
}
