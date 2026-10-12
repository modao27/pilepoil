/**
 * Pièces voisines (docs/PLAN.md N3) : murs de deux pièces qui se font face de part et d'autre d'une cloison,
 * placement d'une nouvelle pièce contre un mur, porte et passage entre deux voisines en une action. Pur ; mm,
 * repère du plan.
 */
import type { Point, Polygon } from '../geometry/types';
import type { PlanAction } from './reduce';
import type { Id, Plan, PlanRoom, WallOpening } from './types';
import { outwardNormal, PASSAGE_TOLERANCE, wallDirection, wallLength, wallSegment } from './walls';

/** Mur de la pièce `room` en vis-à-vis du mur de `other`, de l'autre côté de sa cloison. */
export interface FacingWalls {
  a: { room: Id; wall: Id };
  b: { room: Id; wall: Id };
  /** Partie commune, en abscisses le long du mur a (depuis son début), mm. */
  from: number;
  to: number;
}

const dot = (u: Point, v: Point) => u[0] * v[0] + u[1] * v[1];
const plus = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];

/** Mur i dans le repère du plan : début, direction, longueur, normale extérieure, épaisseur. */
function wallOf(r: PlanRoom, i: number) {
  const [a] = wallSegment(r, i);
  const u = wallDirection(r, i);
  return { start: plus(r, a), u, len: wallLength(r, i), n: outwardNormal(u), t: r.walls[i]!.thickness };
}

/**
 * Murs en vis-à-vis : directions opposées, écartés de l'épaisseur du mur a (à 1 cm près), avec une partie
 * commune d'au moins 1 mm. Une paire par couple de murs ; a est le mur de la pièce placée en premier dans le plan.
 * `room` : seulement les paires qui la concernent.
 */
export function facingWalls(plan: Plan, room?: Id): FacingWalls[] {
  const out: FacingWalls[] = [];
  plan.rooms.forEach((ra, ka) =>
    plan.rooms.slice(ka + 1).forEach((rb) => {
      if (room && ra.id !== room && rb.id !== room) return;
      ra.walls.forEach((wa, i) => {
        const A = wallOf(ra, i);
        if (!A.len) return;
        rb.walls.forEach((wb, j) => {
          const B = wallOf(rb, j);
          if (!B.len || dot(A.u, B.u) > -1 + 1e-6) return;
          const gap = dot([B.start[0] - A.start[0], B.start[1] - A.start[1]], A.n);
          if (Math.abs(gap - A.t) > PASSAGE_TOLERANCE) return;
          const s0 = dot([B.start[0] - A.start[0], B.start[1] - A.start[1]], A.u);
          const from = Math.max(0, s0 - B.len),
            to = Math.min(A.len, s0);
          if (to - from >= 1) out.push({ a: { room: ra.id, wall: wa.id }, b: { room: rb.id, wall: wb.id }, from, to });
        });
      });
    }),
  );
  return out;
}

/**
 * Origine d'une nouvelle pièce (contour en repère de pièce) pour qu'un de ses murs soit contre le mur `wall` de
 * `room`, de l'autre côté de sa cloison, alignée sur le début de ce mur. Le mur choisi est le plus long de sens
 * opposé. null si la pièce n'a aucun mur dans ce sens (mur en biais).
 */
export function placeAgainst(plan: Plan, target: { room: Id; wall: Id }, outline: Polygon): Point | null {
  const r = plan.rooms.find((x) => x.id === target.room);
  const i = r ? r.walls.findIndex((w) => w.id === target.wall) : -1;
  if (!r || i < 0) return null;
  const A = wallOf(r, i);
  const n = outline.length;
  let best = -1,
    bestLen = 0;
  for (let j = 0; j < n; j++) {
    const p = outline[j]!,
      q = outline[(j + 1) % n]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len > bestLen && dot([(q[0] - p[0]) / len, (q[1] - p[1]) / len], A.u) < -1 + 1e-6) {
      best = j;
      bestLen = len;
    }
  }
  if (best < 0) return null;
  // la fin du mur choisi (il va dans l'autre sens) se pose au début du mur cible, de l'autre côté de la cloison
  const end = outline[(best + 1) % n]!;
  const at: Point = [A.start[0] + A.n[0] * A.t, A.start[1] + A.n[1] * A.t];
  return [Math.round((at[0] - end[0]) * 100) / 100, Math.round((at[1] - end[1]) * 100) / 100];
}

/**
 * Porte entre deux pièces voisines : une ouverture au milieu de la partie commune de chaque mur, face à face, et
 * le passage qui les relie (actions du plan, à grouper). null si la partie commune est plus étroite que la porte.
 */
export function doorBetween(
  plan: Plan,
  f: FacingWalls,
  newId: () => Id,
  size: Pick<WallOpening, 'width' | 'height'> = { width: 830, height: 2040 },
): PlanAction[] | null {
  const ra = plan.rooms.find((r) => r.id === f.a.room),
    rb = plan.rooms.find((r) => r.id === f.b.room);
  const i = ra ? ra.walls.findIndex((w) => w.id === f.a.wall) : -1;
  const j = rb ? rb.walls.findIndex((w) => w.id === f.b.wall) : -1;
  if (!ra || !rb || i < 0 || j < 0 || f.to - f.from < size.width) return null;
  const A = wallOf(ra, i),
    B = wallOf(rb, j);
  const offset = Math.round(((f.from + f.to) / 2 - size.width / 2) * 10) / 10;
  // abscisse sur le mur b d'un point d'abscisse s sur le mur a : sB = s0 − s (sens opposés)
  const s0 = dot([B.start[0] - A.start[0], B.start[1] - A.start[1]], A.u);
  const da: WallOpening = { id: newId(), kind: 'door', wall: f.a.wall, offset, sill: 0, ...size };
  const db: WallOpening = {
    id: newId(),
    kind: 'door',
    wall: f.b.wall,
    offset: Math.round((s0 - offset - size.width) * 10) / 10,
    sill: 0,
    ...size,
  };
  return [
    { type: 'plan/opening/add', roomId: ra.id, opening: da },
    { type: 'plan/opening/add', roomId: rb.id, opening: db },
    {
      type: 'plan/passage/add',
      passage: { id: newId(), a: { room: ra.id, opening: da.id }, b: { room: rb.id, opening: db.id } },
    },
  ];
}
