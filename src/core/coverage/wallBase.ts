/**
 * Pied des murs (docs/BOITE.md §2, « ce que les modules disent des autres ») : ce qu'un revêtement de sol ou de mur
 * met au bas d'un mur, pour que les autres outils en tiennent compte sans s'importer. Un sol revêtu dit, mur par mur,
 * s'il a une plinthe (`skirting`, et si on peut la peindre) ou non (`bare`) ; un mur carrelé jusqu'au sol le dit
 * (`tiled`). La peinture retire la bande des plinthes et ne compte que les plinthes peignables ; le parquet ne pose
 * pas de plinthe le long d'un mur carrelé. Pur ; intervalles le long du mur depuis son point i, mm.
 */
import { intersection } from '../geometry/boolean';
import type { Polygon } from '../geometry/types';
import type { Id, PlanRoom } from '../plan/types';
import { wallLength } from '../plan/walls';

export type Span = [number, number];

export interface WallBase {
  room: Id;
  wall: Id;
  from: number;
  to: number;
  /** Plinthe ; sol revêtu sans plinthe ; mur carrelé depuis le sol. */
  kind: 'skirting' | 'bare' | 'tiled';
  /** Hauteur de la plinthe, ou du carrelage depuis le sol ; 0 pour `bare`. */
  height: number;
  /** Une plinthe qu'on peut peindre (bois, MDF) ; false pour une plinthe carrelée. */
  paintable: boolean;
  /** Module qui le dit. */
  module: string;
}

/** Ce que la coquille rassemble des modules et passe à chaque `toSpec`. */
export interface ProjectContext {
  wallBases: readonly WallBase[];
}

export const NO_CONTEXT: ProjectContext = { wallBases: [] };

const EPS = 0.5;

/** Le mur i au sol, moins les ouvertures qui descendent au sol (portes, portes-fenêtres) : intervalles triés. */
export function floorSpans(room: PlanRoom, i: number): Span[] {
  const wall = room.walls[i]?.id;
  const len = wallLength(room, i);
  const gaps = room.openings
    .filter((o) => o.wall === wall && o.kind !== 'window')
    .map((o): Span => [Math.max(0, o.offset), Math.min(len, o.offset + o.width)]);
  return subtractSpans([[0, len]], gaps);
}

/** Intervalles `spans` privés de `cuts`, triés, sans morceau plus court que 0,5 mm. */
export function subtractSpans(spans: readonly Span[], cuts: readonly Span[]): Span[] {
  let out = spans.map(([a, b]): Span => [Math.min(a, b), Math.max(a, b)]);
  for (const [c0, c1] of cuts) {
    const lo = Math.min(c0, c1),
      hi = Math.max(c0, c1);
    out = out.flatMap(([a, b]): Span[] => {
      if (hi <= a || lo >= b) return [[a, b]];
      return [...(lo - a > EPS ? [[a, lo] as Span] : []), ...(b - hi > EPS ? [[hi, b] as Span] : [])];
    });
  }
  return out.filter(([a, b]) => b - a > EPS).sort((x, y) => x[0] - y[0]);
}

/** Intervalles où une région de mur (repère du mur, y vers le haut) touche le sol. */
export function spansAtFloor(region: Polygon[]): Span[] {
  const strip: Polygon = [
    [-1, 0],
    [1e7, 0],
    [1e7, 1],
    [-1, 1],
  ];
  const parts = intersection(region, [strip]);
  const spans = parts
    .map((p): Span => [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))])
    .sort((a, b) => a[0] - b[0]);
  // fusion des morceaux qui se touchent
  const out: Span[] = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s[0] <= last[1] + EPS) last[1] = Math.max(last[1], s[1]);
    else if (s[1] - s[0] > EPS) out.push([s[0], s[1]]);
  }
  return out;
}

/** Faits connus pour le pied d'un mur. Aucun : le sol de la pièce n'est pas revêtu dans l'application. */
export const basesOf = (ctx: ProjectContext, room: Id, wall: Id): WallBase[] =>
  ctx.wallBases.filter((b) => b.room === room && b.wall === wall);
