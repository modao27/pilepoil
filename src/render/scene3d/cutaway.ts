/**
 * Maquette du projet « façon maison de poupée » (docs/NAVIGATION.md §7) : repérage des murs pour la coupe,
 * pièce sous un point, sol extérieur, menuiseries. Repère three.js : x = x du plan, z = y du plan ; mètres.
 * Lit le plan, n'écrit rien ; aucun module n'a à étiqueter ses maillages.
 */
import { Color } from 'three';
import { pointInPolygon } from '../../core/geometry/polygon';
import type { Point } from '../../core/geometry/types';
import type { Id, Plan, PlanRoom } from '../../core/plan/types';
import { outwardNormal, wallBands, wallDirection, wallLength } from '../../core/plan/walls';
import { exposed } from './envelope';
import type { MeshData, SceneFrame, Vec3 } from './types';
import { brand } from '../../ui/brand';

/** Hauteur de coupe des murs en mode « bas » et « coupés », m. */
export const CUT_HEIGHT = 0.4;
/** Épaisseur de revêtement comptée dans un mur côté pièce (carreau, colle, plinthe), mm. */
const LINING = 60;

const m = (v: number) => v / 1000;
const abs = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];

interface WallZone {
  /** Début du mur (repère du plan, mm), direction, normale extérieure. */
  a: Point;
  u: Point;
  out: Point;
  /** Étendue le long du mur et dans son épaisseur (revêtement compris), mm. */
  s0: number;
  s1: number;
  d0: number;
  d1: number;
  /** Parties contre une pièce voisine (cloison), abscisses le long du mur : toujours coupées en mode « coupés ». */
  shared: [number, number][];
}

function wallZones(plan: Plan, rooms: readonly Id[]): WallZone[] {
  const zones: WallZone[] = [];
  for (const room of plan.rooms.filter((r) => rooms.includes(r.id))) {
    const bands = wallBands(room);
    room.walls.forEach((wall, i) => {
      const len = wallLength(room, i);
      if (len < 1 || !bands[i]) return;
      const a = abs(room, room.outline[i]!);
      const u = wallDirection(room, i);
      const out = outwardNormal(u);
      const along = (p: Point) => {
        const q = abs(room, p);
        return (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1];
      };
      const xa = along(bands[i]![3]!),
        xb = along(bands[i]![2]!);
      const xs = [0, len, xa, xb];
      // parties de la face extérieure qui touchent une autre pièce : complément des parties exposées
      const shared: [number, number][] = [];
      let from = xa;
      for (const [e0, e1] of exposed(plan, rooms, room, i, xa, xb)) {
        if (e0 - from > 1) shared.push([from, e0]);
        from = e1;
      }
      if (xb - from > 1) shared.push([from, xb]);
      zones.push({
        shared,
        a,
        u,
        out,
        s0: Math.min(...xs) - 1,
        s1: Math.max(...xs) + 1,
        d0: -LINING,
        d1: wall.thickness + 5,
      });
    });
  }
  return zones;
}

/**
 * Normale extérieure (x, z) du mur auquel appartient chaque triangle, d'après son centre au sol ; (0, 0) hors
 * des murs, doublée pour une cloison entre deux pièces. Deux valeurs par sommet, pour l'attribut `wallNormal`.
 */
export function tagWalls(meshes: readonly MeshData[], plan: Plan, rooms: readonly Id[]): MeshData[] {
  const zones = wallZones(plan, rooms);
  return meshes.map((d) => {
    const n = d.positions.length / 9;
    const tags = new Array<number>(n * 6).fill(0);
    for (let t = 0; t < n; t++) {
      const p = d.positions;
      const k = t * 9;
      const cx = ((p[k]! + p[k + 3]! + p[k + 6]!) / 3) * 1000,
        cz = ((p[k + 2]! + p[k + 5]! + p[k + 8]!) / 3) * 1000;
      const nx = d.normals[k]!,
        nz = d.normals[k + 2]!;
      // le mur dont le point est côté pièce (revêtement) passe avant celui dont il traverse l'épaisseur : contre
      // une cloison, le carreau d'une pièce est aussi dans l'épaisseur du mur de la voisine
      let best: WallZone | null = null,
        bestScore = Infinity,
        bestS = 0;
      for (const w of zones) {
        const dx = cx - w.a[0],
          dz = cz - w.a[1];
        const s = dx * w.u[0] + dz * w.u[1],
          dd = dx * w.out[0] + dz * w.out[1];
        if (s < w.s0 || s > w.s1 || dd < w.d0 || dd > w.d1) continue;
        // une face parallèle au mur (parement, face extérieure, bout d'angle) lui revient avant un mur voisin
        const facing = Math.abs(nx * w.out[0] + nz * w.out[1]) > 0.9;
        const score = (dd <= 0.5 ? -dd : 1000 + dd) + (facing ? 0 : 500);
        if (score < bestScore) {
          best = w;
          bestScore = score;
          bestS = s;
        }
      }
      if (!best) continue;
      // cloison : normale doublée, la scène la coupe quel que soit le côté de la caméra
      const f = best.shared.some(([a, b]) => bestS >= a && bestS <= b) ? 2 : 1;
      for (let v = 0; v < 3; v++) {
        tags[t * 6 + v * 2] = best.out[0] * f;
        tags[t * 6 + v * 2 + 1] = best.out[1] * f;
      }
    }
    return { ...d, wallNormals: tags };
  });
}

/** Pièce (parmi `rooms`) qui contient le point du plan `p` (mm), ou null. */
export function pickRoom(plan: Plan, rooms: readonly Id[], p: Point): Id | null {
  const room = plan.rooms.find(
    (r) =>
      rooms.includes(r.id) &&
      r.outline.length >= 3 &&
      pointInPolygon(
        p,
        r.outline.map((q) => abs(r, q)),
      ),
  );
  return room?.id ?? null;
}

/** Contour d'une pièce dans le repère de la scène (x, z en m). */
export function roomRing(plan: Plan, id: Id): [number, number][] | null {
  const r = plan.rooms.find((x) => x.id === id);
  return r ? r.outline.map((q) => abs(r, q)).map((q): [number, number] => [m(q[0]), m(q[1])]) : null;
}

function linear(css: string): [number, number, number] {
  const c = new Color().setStyle(css);
  return [c.r, c.g, c.b];
}

function mesh(key: string, o: Partial<MeshData> = {}): MeshData {
  return {
    key,
    photo: null,
    positions: [],
    normals: [],
    colors: [],
    uvs: [],
    castShadow: false,
    receiveShadow: true,
    ...o,
  };
}

/** Quadrilatère plan, tourné vers la normale n (les faces arrière sont dessinées en coupe par la scène). */
function quad(d: MeshData, q: Vec3[], n: Vec3, col: [number, number, number]) {
  const [a, b, c] = q as [Vec3, Vec3, Vec3];
  const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
    cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
    cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const order = cx * n[0] + cy * n[1] + cz * n[2] < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
  for (const i of order) {
    d.positions.push(...q[i]!);
    d.normals.push(...n);
    d.colors.push(...col);
    d.uvs.push(0, 0);
  }
}

/** Boîte alignée sur les axes du mur : les six faces, normales vers l'extérieur. */
function box(
  d: MeshData,
  at: (x: number, y: number, z: number) => Vec3,
  x: [number, number],
  y: [number, number],
  z: [number, number],
  u: Vec3,
  out: Vec3,
  col: [number, number, number],
) {
  const [x0, x1] = x,
    [y0, y1] = y,
    [z0, z1] = z;
  const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];
  quad(d, [at(x0, y0, z0), at(x1, y0, z0), at(x1, y1, z0), at(x0, y1, z0)], neg(out), col);
  quad(d, [at(x0, y0, z1), at(x1, y0, z1), at(x1, y1, z1), at(x0, y1, z1)], out, col);
  quad(d, [at(x0, y1, z0), at(x1, y1, z0), at(x1, y1, z1), at(x0, y1, z1)], [0, 1, 0], col);
  quad(d, [at(x0, y0, z0), at(x1, y0, z0), at(x1, y0, z1), at(x0, y0, z1)], [0, -1, 0], col);
  quad(d, [at(x0, y0, z0), at(x0, y1, z0), at(x0, y1, z1), at(x0, y0, z1)], neg(u), col);
  quad(d, [at(x1, y0, z0), at(x1, y1, z0), at(x1, y1, z1), at(x1, y0, z1)], u, col);
}

/** Cadre des baies, mm : largeur vue de face, épaisseur. */
const FRAME_W = 50,
  FRAME_T = 60;

/**
 * Menuiseries des pièces `rooms` : cadre dans chaque baie (au milieu de l'épaisseur du mur), vitre pétrole
 * translucide aux fenêtres. Portes et passages restent ouverts.
 */
export function buildJoinery(plan: Plan, rooms: readonly Id[]): MeshData[] {
  const frame = mesh('joinery', { castShadow: true }),
    glass = mesh('glass', { opacity: 0.3, receiveShadow: false });
  const F = linear('#f4f2ec'),
    G = linear(brand.petrole);
  for (const room of plan.rooms.filter((r) => rooms.includes(r.id))) {
    room.walls.forEach((wall, i) => {
      const len = wallLength(room, i);
      const a = abs(room, room.outline[i]!);
      const u = wallDirection(room, i);
      const out = outwardNormal(u);
      const at = (x: number, y: number, z: number): Vec3 => [
        m(a[0] + u[0] * x + out[0] * z),
        m(y),
        m(a[1] + u[1] * x + out[1] * z),
      ];
      const U: Vec3 = [u[0], 0, u[1]],
        O: Vec3 = [out[0], 0, out[1]];
      const mid = wall.thickness / 2;
      const z: [number, number] = [mid - FRAME_T / 2, mid + FRAME_T / 2];
      for (const o of room.openings.filter((x) => x.wall === wall.id)) {
        const x0 = Math.max(1, o.offset),
          x1 = Math.min(len - 1, o.offset + o.width);
        const y0 = Math.max(0, o.sill),
          y1 = Math.min(room.height - 1, o.sill + o.height);
        if (x1 - x0 < 3 * FRAME_W || y1 - y0 < 3 * FRAME_W) continue;
        box(frame, at, [x0, x0 + FRAME_W], [y0, y1], z, U, O, F);
        box(frame, at, [x1 - FRAME_W, x1], [y0, y1], z, U, O, F);
        box(frame, at, [x0 + FRAME_W, x1 - FRAME_W], [y1 - FRAME_W, y1], z, U, O, F);
        if (o.kind === 'door') continue;
        if (y0 > 0) box(frame, at, [x0 + FRAME_W, x1 - FRAME_W], [y0, y0 + FRAME_W], z, U, O, F);
        const g0 = o.kind === 'window' ? y0 + FRAME_W : y0;
        quad(
          glass,
          [
            at(x0 + FRAME_W, g0, mid),
            at(x1 - FRAME_W, g0, mid),
            at(x1 - FRAME_W, y1 - FRAME_W, mid),
            at(x0 + FRAME_W, y1 - FRAME_W, mid),
          ],
          O,
          G,
        );
      }
    });
  }
  return [frame, glass].filter((d) => d.positions.length);
}

/** Sol extérieur sauge : la boîte du plan élargie de `margin` m, juste sous le sol brut. */
export function buildSite(frame: SceneFrame, margin = 1): MeshData {
  const site = mesh('site');
  const { x, z } = frame.bounds;
  const y = -0.004;
  quad(
    site,
    [
      [x[0] - margin, y, z[0] - margin],
      [x[1] + margin, y, z[0] - margin],
      [x[1] + margin, y, z[1] + margin],
      [x[0] - margin, y, z[1] + margin],
    ],
    [0, 1, 0],
    linear(brand.sauge),
  );
  return site;
}
