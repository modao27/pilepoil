/**
 * Enveloppe 3D commune des pièces du plan (docs/NAVIGATION.md §7) : sol brut, murs en plâtre à pleine hauteur
 * ouverts aux portes et fenêtres (embrasures sur l'épaisseur du mur), dessus des murs. Les revêtements viennent
 * des modules, posés dessus ; les murs revêtus (`skip`) sont dessinés par leur module.
 * Repère three.js : x = x du plan, z = y du plan, y vers le haut ; mètres. Lit le plan, n'écrit rien.
 */
import { Color, ShapeUtils, Vector2 } from 'three';
import type { Point } from '../../core/geometry/types';
import type { Id, Plan, PlanRoom } from '../../core/plan/types';
import { outwardNormal, wallBands, wallDirection, wallLength } from '../../core/plan/walls';
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

/**
 * Enveloppe des pièces `rooms` : sol brut, murs nus (sauf ceux de `skip`), embrasures, dessus des murs.
 * Deux maillages au plus (plâtre, sol) : peu d'appels de dessin.
 */
export function buildEnvelope(plan: Plan, rooms: readonly Id[], skip: ReadonlySet<Id> = new Set()): MeshData[] {
  const plaster = emptyMesh('plaster', true),
    ground = emptyMesh('ground');
  const P = linear(PLASTER),
    G = linear(GROUND);
  for (const room of plan.rooms.filter((r) => rooms.includes(r.id))) {
    const n = room.outline.length;
    if (n < 3) continue;
    const h = room.height;
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
      const holes = wallHoles(room, i);
      if (!skip.has(wall.id)) {
        const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ];
        shape(
          plaster,
          rect(0, 0, len, h),
          holes.map(([x0, x1, y0, y1]) => rect(x0, y0, x1, y1).reverse()),
          (p) => W(p[0], p[1]),
          inward,
          P,
        );
      }
      // embrasures : les côtés de chaque baie sur l'épaisseur du mur
      const t = wall.thickness;
      if (t <= 0) continue;
      const along: Vec3 = [u[0], 0, u[1]];
      for (const [x0, x1, y0, y1] of holes) {
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
    const id = `${d.key}|${d.photo ?? ''}|${d.castShadow}|${d.receiveShadow}`;
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
