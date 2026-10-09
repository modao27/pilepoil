/**
 * Plan 2D en SVG d'une surface calculée : lit les pièces, n'écrit rien.
 * Mode « tiles » : couleurs des carreaux sur fond de joint. Mode « status » : statuts de coupe
 * (entière, coupée, taillée dans une chute, coupe fine) selon docs/UX.md.
 */
import type { CutPlan, Piece, Polygon, SurfaceSpec } from '../core';

export type PlanMode = 'tiles' | 'status';
export type PieceStatus = 'full' | 'cut' | 'reuse' | 'thin';

export interface PlanShape {
  d: string;
  /** Couleur de carreau (mode tiles) ou statut (mode status). */
  fill: string;
  status: PieceStatus;
}

export interface PlanDrawing {
  viewBox: string;
  width: number;
  height: number;
  shapes: PlanShape[];
  /** Ouvertures découpées (fenêtres, portes…), en pointillés. */
  holes: string[];
  /** Contour de la surface (sol d'une pièce : contour et obstacles, à remplir en evenodd), sinon le rectangle. */
  outline: string;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export function pathOf(polys: Polygon[]): string {
  return polys.map((p) => 'M' + p.map((q) => fmt(q[0]) + ' ' + fmt(q[1])).join('L') + 'Z').join('');
}

export function pieceStatus(p: Piece, reused: boolean): PieceStatus {
  if (p.full) return 'full';
  if (p.thin) return 'thin';
  return reused ? 'reuse' : 'cut';
}

/**
 * pieces : pièces de la surface ; offset : indice de la première pièce de la surface dans le plan de découpe
 * du projet (pour savoir si une coupe vient d'une chute).
 */
export function planDrawing(s: SurfaceSpec, pieces: Piece[], plan: CutPlan | null = null, offset = 0): PlanDrawing {
  const shapes: PlanShape[] = [];
  pieces.forEach((p, i) => {
    if (!p.parts) return;
    shapes.push({ d: pathOf(p.parts), fill: p.color, status: pieceStatus(p, !!plan?.reused[offset + i]) });
  });
  const holes = s.openings
    .filter((o) => o.type !== 'socket')
    .map((o) => {
      const y = s.height - o.sill - o.height;
      return `M${fmt(o.x)} ${fmt(y)}h${fmt(o.width)}v${fmt(o.height)}h${fmt(-o.width)}Z`;
    });
  const outline = s.outline ? pathOf(s.outline) : `M0 0H${fmt(s.width)}V${fmt(s.height)}H0Z`;
  return { viewBox: `0 0 ${fmt(s.width)} ${fmt(s.height)}`, width: s.width, height: s.height, shapes, holes, outline };
}
