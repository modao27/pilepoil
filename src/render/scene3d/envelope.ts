/**
 * Enveloppe 3D commune des pièces du plan (docs/NAVIGATION.md §7) : sol brut, murs en plâtre à pleine hauteur
 * ouverts aux portes et fenêtres (embrasures sur l'épaisseur du mur), dessus des murs. Les revêtements viennent
 * des modules, posés dessus ; les murs revêtus (`skip`) sont dessinés par leur module.
 * Repère three.js : x = x du plan, z = y du plan, y vers le haut ; mètres. Lit le plan, n'écrit rien.
 */
import { Color, ShapeUtils, Vector2 } from 'three';
import { difference, offset } from '../../core/geometry/boolean';
import { components } from '../../core/geometry/rings';
import type { Point } from '../../core/geometry/types';
import type { Id, Plan, PlanRoom } from '../../core/plan/types';
import { outwardNormal, PASSAGE_TOLERANCE, wallBands, wallDirection, wallLength } from '../../core/plan/walls';
import type { MeshData, SceneFrame, Vec3 } from './types';

const PLASTER = '#ebe7e0',
  GROUND = '#cfc6b8';
/** Le sol brut juste sous les revêtements (aucun scintillement avec une chape posée à 0). */
const GROUND_Y = -0.001;

const m = (v: number) => v / 1000;

function linear(css: string): [number, number, number] {
  const c = new Color().setStyle(css);
  return [c.r, c.g, c.b];
}

function emptyMesh(key: string, castShadow = false): MeshData {
  return { key, photo: null, positions: [], normals: [], colors: [], uvs: [], castShadow, receiveShadow: true };
}

/** Triangle tourné vers la normale n. */
function tri(d: MeshData, a: Vec3, b: Vec3, c: Vec3, n: Vec3, col: [number, number, number]) {
  const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
    cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
    cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const vs = cx * n[0] + cy * n[1] + cz * n[2] < 0 ? [a, c, b] : [a, b, c];
  for (const v of vs) {
    d.positions.push(...v);
    d.normals.push(...n);
    d.colors.push(...col);
    d.uvs.push(0, 0);
  }
}

/** Polygone avec trous dans un repère 2D, placé en 3D par `map`. */
function shape(
  d: MeshData,
  outer: Point[],
  holes: Point[][],
  map: (p: Point) => Vec3,
  n: Vec3,
  col: [number, number, number],
) {
  const v = (p: Point) => new Vector2(p[0], p[1]);
  const all = [...outer, ...holes.flat()];
  for (const [a, b, c] of ShapeUtils.triangulateShape(
    outer.map(v),
    holes.map((h) => h.map(v)),
  ))
    tri(d, map(all[a!]!), map(all[b!]!), map(all[c!]!), n, col);
}

function quad(d: MeshData, q: Vec3[], n: Vec3, col: [number, number, number]) {
  tri(d, q[0]!, q[1]!, q[2]!, n, col);
  tri(d, q[0]!, q[2]!, q[3]!, n, col);
}

const abs = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];

/** Baies d'un mur dans son repère (x le long du mur, y depuis le sol), rognées au mur, mm. */
function wallHoles(room: PlanRoom, i: number): [number, number, number, number][] {
  const w = room.walls[i];
  const len = wallLength(room, i);
  if (!w) return [];
  return room.openings
    .filter((o) => o.wall === w.id)
    .map((o): [number, number, number, number] => [
      Math.max(1, o.offset),
      Math.min(len - 1, o.offset + o.width),
      Math.max(0, o.sill),
      Math.min(room.height - 1, o.sill + o.height),
    ])
    .filter(([x0, x1, y0, y1]) => x1 > x0 && y1 > y0);
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/**
 * Plâtre nu d'un mur (repère du mur, x le long, y depuis le sol) : le mur entier, moins les baies et les parties
 * dessinées par un module (`spans`, du sol au plafond). Composants : contour et trous, prêts à trianguler.
 */
export function bareWall(
  len: number,
  height: number,
  holes: readonly [number, number, number, number][],
  spans: readonly [number, number][] = [],
): { outer: Point[]; holes: Point[][] }[] {
  const cut = [
    ...holes.map(([x0, x1, y0, y1]) => rect(x0, y0, x1, y1)),
    ...spans.map(([x0, x1]) => rect(Math.max(0, x0), -1, Math.min(len, x1), height + 1)),
  ];
  if (!spans.length)
    return [{ outer: rect(0, 0, len, height), holes: holes.map(([x0, x1, y0, y1]) => rect(x0, y0, x1, y1).reverse()) }];
  return components(difference([rect(0, 0, len, height)], cut));
}

/**
 * Parties de la face extérieure du mur i (abscisses le long du mur, de xa à xb) qui ne touchent aucune autre pièce
 * de `rooms` : une bande de 2 mm juste derrière la face, moins les autres pièces et leurs murs.
 */
export function exposed(
  plan: Plan,
  rooms: readonly Id[],
  room: PlanRoom,
  i: number,
  xa: number,
  xb: number,
): [number, number][] {
  if (xb - xa <= 1) return [];
  const t = room.walls[i]?.thickness ?? 0;
  const a = abs(room, room.outline[i]!);
  const u = wallDirection(room, i);
  const out = outwardNormal(u);
  const at = (x: number, d: number): Point => [a[0] + u[0] * x + out[0] * d, a[1] + u[1] * x + out[1] * d];
  // les autres pièces, agrandies de la tolérance du plan (deux pièces à moins d'un centimètre sont collées, comme
  // pour un passage), et leurs murs tels quels (un bout d'angle peut tomber dans l'épaisseur d'un mur voisin)
  const near = plan.rooms.filter((r) => r.id !== room.id && rooms.includes(r.id) && r.outline.length >= 3);
  if (!near.length) return [[xa, xb]];
  const inside = offset(
    near.map((r) => r.outline.map((q) => abs(r, q))),
    PASSAGE_TOLERANCE,
  );
  const walls = near.flatMap((r) => wallBands(r).map((ring) => ring.map((q) => abs(r, q))));
  const strip = [at(xa, t + 1), at(xb, t + 1), at(xb, t + 3), at(xa, t + 3)];
  const along = (q: Point) => (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1];
  // l'une après l'autre : les bandes des murs ne tournent pas dans le sens des contours (elles s'annuleraient)
  return components(difference(difference([strip], inside), walls))
    .map((c): [number, number] => {
      const xs = c.outer.map(along);
      return [Math.max(xa, Math.min(...xs)), Math.min(xb, Math.max(...xs))];
    })
    .filter(([s0, s1]) => s1 - s0 > 1)
    .sort((p, q) => p[0] - q[0]);
}

/** La baie est-elle dans une partie de mur dessinée par un module (qui dessine aussi son embrasure) ? */
const drawnBy = (spans: readonly [number, number][], x0: number, x1: number) =>
  spans.some(([a, b]) => (x0 + x1) / 2 >= a && (x0 + x1) / 2 <= b);

/**
 * Enveloppe des pièces `rooms` : sol brut, murs nus, embrasures, dessus des murs. `skip` : parties de murs
 * dessinées par un module (intervalles le long du mur, mm), laissées vides ici.
 * Deux maillages au plus (plâtre, sol) : peu d'appels de dessin.
 */
export function buildEnvelope(
  plan: Plan,
  rooms: readonly Id[],
  skip: ReadonlyMap<Id, readonly [number, number][]> = new Map(),
): MeshData[] {
  const plaster = emptyMesh('plaster', true),
    ground = emptyMesh('ground');
  const P = linear(PLASTER),
    G = linear(GROUND);
  for (const room of plan.rooms.filter((r) => rooms.includes(r.id))) {
    const n = room.outline.length;
    if (n < 3) continue;
    const h = room.height;
    const bands = wallBands(room);
    shape(
      ground,
      room.outline.map((p) => abs(room, p)),
      [],
      (p) => [m(p[0]), GROUND_Y, m(p[1])],
      [0, 1, 0],
      G,
    );

    for (let i = 0; i < n; i++) {
      const wall = room.walls[i];
      const len = wallLength(room, i);
      if (!wall || len < 1) continue;
      const a = abs(room, room.outline[i]!);
      const u = wallDirection(room, i);
      const out = outwardNormal(u);
      const inward: Vec3 = [-out[0], 0, -out[1]];
      /** Point du mur (x le long, y depuis le sol, `depth` mm dans l'épaisseur) → 3D. */
      const W = (x: number, y: number, depth = 0): Vec3 => [
        m(a[0] + u[0] * x + out[0] * depth),
        m(y),
        m(a[1] + u[1] * x + out[1] * depth),
      ];
      const spans = skip.get(wall.id) ?? [];
      const holes = wallHoles(room, i);
      for (const c of bareWall(len, h, holes, spans)) shape(plaster, c.outer, c.holes, (p) => W(p[0], p[1]), inward, P);
      // embrasures : les côtés de chaque baie sur l'épaisseur du mur
      const t = wall.thickness;
      if (t <= 0) continue;
      // face extérieure, d'un angle à l'autre : le mur devient un volume (sa tranche se voit à la coupe)
      const rel = room.outline[i]!;
      const alongOf = (p: Point) => (p[0] - rel[0]) * u[0] + (p[1] - rel[1]) * u[1];
      const xa = alongOf(bands[i]![3]!),
        xb = alongOf(bands[i]![2]!);
      // sauf contre une pièce voisine : sa propre cloison est déjà là (sinon deux faces au même endroit)
      for (const [s0, s1] of exposed(plan, rooms, room, i, xa, xb)) {
        const inside = holes.filter(([x0, x1]) => x0 > s0 && x1 < s1);
        shape(
          plaster,
          rect(s0, 0, s1, h),
          inside.map(([x0, x1, y0, y1]) => rect(x0, y0, x1, y1).reverse()),
          (p) => W(p[0], p[1], t),
          [out[0], 0, out[1]],
          P,
        );
      }
      const along: Vec3 = [u[0], 0, u[1]];
      for (const [x0, x1, y0, y1] of holes) {
        if (drawnBy(spans, x0, x1)) continue;
        quad(plaster, [W(x0, y0), W(x0, y1), W(x0, y1, t), W(x0, y0, t)], along, P);
        quad(plaster, [W(x1, y0), W(x1, y1), W(x1, y1, t), W(x1, y0, t)], [-along[0], 0, -along[2]], P);
        quad(plaster, [W(x0, y1), W(x1, y1), W(x1, y1, t), W(x0, y1, t)], [0, -1, 0], P);
        if (y0 > 0) quad(plaster, [W(x0, y0), W(x1, y0), W(x1, y0, t), W(x0, y0, t)], [0, 1, 0], P);
      }
    }
    // dessus des murs, avec leur épaisseur
    for (const c of wallBands(room)) {
      const q = c.map((p): Vec3 => {
        const s = abs(room, p);
        return [m(s[0]), m(h), m(s[1])];
      });
      quad(plaster, q, [0, 1, 0], P);
    }
  }
  return [plaster, ground].filter((d) => d.positions.length);
}

/** Cadre de la scène : boîte des pièces `rooms` (repère du plan) et la plus grande hauteur. */
export function planFrame(plan: Plan, rooms: readonly Id[]): SceneFrame {
  const rs = plan.rooms.filter((r) => rooms.includes(r.id));
  const pts = rs.flatMap((r) => r.outline.map((p) => abs(r, p)));
  if (!pts.length) return { kind: 'room', bounds: { x: [0, 1], z: [0, 1], h: 2.5 } };
  const xs = pts.map((p) => p[0]),
    zs = pts.map((p) => p[1]);
  return {
    kind: 'room',
    bounds: {
      x: [m(Math.min(...xs)), m(Math.max(...xs))],
      z: [m(Math.min(...zs)), m(Math.max(...zs))],
      h: m(Math.max(...rs.map((r) => r.height))),
    },
  };
}

/** Maillages déplacés de (dx, dz) m au sol (repère d'une pièce → repère du plan). */
export function translateMeshes(meshes: readonly MeshData[], dx: number, dz: number): MeshData[] {
  if (!dx && !dz) return [...meshes];
  return meshes.map((d) => ({
    ...d,
    positions: d.positions.map((v, i) => (i % 3 === 0 ? v + dx : i % 3 === 2 ? v + dz : v)),
  }));
}

/**
 * Fusionne les maillages de même matériau (clé, photo, ombres) : un appel de dessin par matériau, quel que soit
 * le nombre de pièces et de modules. L'ordre de première apparition est gardé.
 */
export function mergeMeshes(meshes: readonly MeshData[]): MeshData[] {
  const out = new Map<string, MeshData>();
  for (const d of meshes) {
    if (!d.positions.length) continue;
    const id = `${d.key}|${d.photo ?? ''}|${d.castShadow}|${d.receiveShadow}|${d.opacity ?? 1}`;
    const into = out.get(id);
    if (!into) {
      out.set(id, {
        ...d,
        positions: d.positions.slice(),
        normals: d.normals.slice(),
        colors: d.colors.slice(),
        uvs: d.uvs.slice(),
      });
      continue;
    }
    // UV : une paire par sommet de chaque côté, même si l'un des maillages n'en a pas
    const pad = (x: MeshData) => (x.uvs.length ? x.uvs : new Array<number>((x.positions.length / 3) * 2).fill(0));
    // concat : des centaines de milliers de valeurs, trop pour push(...)
    into.uvs = pad(into).concat(pad(d));
    into.positions = into.positions.concat(d.positions);
    into.normals = into.normals.concat(d.normals);
    into.colors = into.colors.concat(d.colors);
  }
  return [...out.values()];
}
