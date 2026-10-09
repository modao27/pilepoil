/**
 * Maillages 3D du parquet (docs/parquet/SPEC.md §5) : sol des pièces avec chaque lame (teinte légèrement
 * variée, joint fin sur un fond sombre, photo de la lame orientée lame par lame), murs bas ouverts aux portes,
 * plinthes. Repère three.js : x = x du plan, z = y du plan, y vers le haut ; mètres. Lit le résultat du
 * moteur, n'écrit rien.
 */
import { Color, ShapeUtils, Vector2 } from 'three';
import { offset } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import type { MeshData, SceneFrame, Vec3 } from '../../../render/scene3d/types';
import type { ParquetResult, ParquetSpec } from '../core/types';

export interface ParquetLook {
  /** Couleur de la lame (CSS). */
  color: string;
  /** Photo de la lame (URL), ou null. */
  photo: string | null;
  /** Longueur et largeur de la lame, mm (texture : une photo par lame). */
  length: number;
  width: number;
}

export interface ParquetMeshInput {
  spec: ParquetSpec;
  result: ParquetResult;
  /** Aspect de chaque pose, par identifiant. */
  looks: Record<string, ParquetLook>;
}

/** Hauteur des murs bas, épaisseur des murs, joint entre lames, mm. */
const WALL_H = 300;
const WALL_T = 72;
const SEAM = 0.8;
/** Le dessus des lames, au-dessus du fond sombre des joints, m. */
const FLOOR_Y = 0.003;
const PLINTH_T = 12;

const m = (v: number) => v / 1000;
const UP: Vec3 = [0, 1, 0];

/** Cadre de la scène : toutes les pièces des poses, vue de pièce. */
export function parquetFrame(spec: ParquetSpec): SceneFrame {
  const pts = spec.layouts.flatMap((l) => l.rooms.flatMap((r) => r.outline));
  if (!pts.length) return { kind: 'room', bounds: { x: [0, 1], z: [0, 1], h: m(WALL_H) } };
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  return {
    kind: 'room',
    bounds: { x: [m(Math.min(...xs)), m(Math.max(...xs))], z: [m(Math.min(...ys)), m(Math.max(...ys))], h: m(WALL_H) },
  };
}

class Builder {
  private readonly tmp = new Color();
  readonly meshes = new Map<string, MeshData>();

  mesh(key: string, photo: string | null = null, shadows = { cast: false, receive: true }): MeshData {
    let d = this.meshes.get(key);
    if (!d) {
      d = {
        key,
        photo,
        positions: [],
        normals: [],
        colors: [],
        uvs: [],
        castShadow: shadows.cast,
        receiveShadow: shadows.receive,
      };
      this.meshes.set(key, d);
    }
    return d;
  }

  /** Couleur CSS sRGB → linéaire, multipliée par k. */
  rgb(css: string, k = 1): [number, number, number] {
    this.tmp.setStyle(css);
    return [Math.min(1, this.tmp.r * k), Math.min(1, this.tmp.g * k), Math.min(1, this.tmp.b * k)];
  }

  /** Triangle tourné vers la normale n. */
  tri(d: MeshData, a: Vec3, b: Vec3, c: Vec3, n: Vec3, col: [number, number, number], uv?: [Point, Point, Point]) {
    const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    const vs = flip ? [a, c, b] : [a, b, c];
    const us = uv ? (flip ? [uv[0], uv[2], uv[1]] : uv) : null;
    vs.forEach((v, i) => {
      d.positions.push(...v);
      d.normals.push(...n);
      d.colors.push(...col);
      if (us) d.uvs.push(...us[i]!);
    });
  }

  quad(d: MeshData, a: Vec3, b: Vec3, c: Vec3, e: Vec3, n: Vec3, col: [number, number, number]) {
    this.tri(d, a, b, c, n, col);
    this.tri(d, a, c, e, n, col);
  }

  /** Polygone horizontal à la hauteur y (vers le haut), UV facultatives (fonction du point du plan). */
  floor(d: MeshData, ring: Polygon, y: number, col: [number, number, number], uv?: (p: Point) => Point) {
    const contour = ring.map((p) => new Vector2(p[0], p[1]));
    for (const [i, j, k] of ShapeUtils.triangulateShape(contour, [])) {
      const [p, q, r] = [ring[i!]!, ring[j!]!, ring[k!]!];
      const v = (s: Point): Vec3 => [m(s[0]), y, m(s[1])];
      this.tri(d, v(p), v(q), v(r), UP, col, uv ? [uv(p), uv(q), uv(r)] : undefined);
    }
  }

  /** Pavé le long d'un segment du plan : de a à b, épaisseur vers n (mm), du sol à h (m). Pas de dessous. */
  slab(d: MeshData, a: Point, b: Point, n: Point, t: number, h: number, col: [number, number, number]) {
    const P = (p: Point, k: number, y: number): Vec3 => [m(p[0] + n[0] * k), y, m(p[1] + n[1] * k)];
    const dir: Point = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dir[0], dir[1]);
    const u: Point = [dir[0] / len, dir[1] / len];
    const inner: Vec3 = [-n[0], 0, -n[1]],
      outer: Vec3 = [n[0], 0, n[1]];
    this.quad(d, P(a, 0, 0), P(b, 0, 0), P(b, 0, h), P(a, 0, h), inner, col);
    this.quad(d, P(a, t, 0), P(b, t, 0), P(b, t, h), P(a, t, h), outer, col);
    this.quad(d, P(a, 0, h), P(b, 0, h), P(b, t, h), P(a, t, h), UP, this.rgb('#ffffff', 0.95));
    this.quad(d, P(a, 0, 0), P(a, t, 0), P(a, t, h), P(a, 0, h), [-u[0], 0, -u[1]], col);
    this.quad(d, P(b, 0, 0), P(b, t, 0), P(b, t, h), P(b, 0, h), [u[0], 0, u[1]], col);
  }
}

/** Valeur dans [0, 1[ tirée de l'identifiant (teinte de chaque lame, stable). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

/** Plus longue arête du polygone : direction de la lame (texture orientée lame par lame). */
function boardAxis(poly: Polygon): { u: Point; v: Point } {
  let best = 0,
    u: Point = [1, 0];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) {
      best = l;
      u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    }
  });
  return { u, v: [-u[1], u[0]] };
}

export function buildParquetMeshes(input: ParquetMeshInput): MeshData[] {
  const { spec, result, looks } = input;
  const B = new Builder();

  /* ---------- sol : fond sombre (joints), puis chaque lame ---------- */
  const base = B.mesh('seams');
  for (const l of result.layouts)
    for (const ring of l.layable) if (signedArea(ring) > 0) B.floor(base, ring, 0, B.rgb('#2b2119'));

  for (const l of result.layouts) {
    const look = looks[l.id] ?? { color: '#c9a77c', photo: null, length: 1000, width: 100 };
    const d = B.mesh(`floor:${l.id}`, look.photo);
    for (const p of l.pieces) {
      const k = 0.88 + 0.18 * hash01(p.id) - (p.variant === 'B' ? 0.03 : 0);
      const col = look.photo ? B.rgb('#ffffff', k) : B.rgb(look.color, k);
      const rings = offset([signedArea(p.polygon) < 0 ? [...p.polygon].reverse() : p.polygon], -SEAM).filter(
        (r) => signedArea(r) > 0,
      );
      const { u, v } = boardAxis(p.polygon);
      const u0 = Math.min(...p.polygon.map((q) => q[0] * u[0] + q[1] * u[1])),
        v0 = Math.min(...p.polygon.map((q) => q[0] * v[0] + q[1] * v[1]));
      const uv = look.photo
        ? (q: Point): Point => [
            (q[0] * u[0] + q[1] * u[1] - u0) / look.length,
            (q[0] * v[0] + q[1] * v[1] - v0) / look.width,
          ]
        : undefined;
      for (const r of rings.length ? rings : [p.polygon]) B.floor(d, r, FLOOR_Y, col, uv);
    }
  }

  /* ---------- murs bas et plinthes, ouverts aux portes et baies ---------- */
  const walls = B.mesh('walls', null, { cast: true, receive: true });
  const plinths = B.mesh('plinths', null, { cast: true, receive: true });
  const skirting = spec.accessories.skirting;
  const seen = new Set<string>();
  for (const room of spec.layouts.flatMap((l) => l.rooms)) {
    if (seen.has(room.id)) continue;
    seen.add(room.id);
    const o = room.outline;
    const s = signedArea(o) > 0 ? 1 : -1;
    o.forEach((a, i) => {
      const b = o[(i + 1) % o.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1) return;
      const u: Point = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      const n: Point = [u[1] * s, -u[0] * s]; // vers l'extérieur de la pièce
      // portes et baies sur ce mur (leurs deux bouts sur sa droite) : intervalles sans mur ni plinthe
      const along = (p: Point) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
      const across = (p: Point) => Math.abs((p[0] - a[0]) * u[1] - (p[1] - a[1]) * u[0]);
      const realGaps = room.openings
        .filter((x) => x.kind !== 'window' && x.segment.every((p) => across(p) < 1))
        .map((x): [number, number] => {
          const [p, q] = x.segment.map(along) as [number, number];
          return [Math.max(0, Math.min(p, q)), Math.min(len, Math.max(p, q))];
        })
        .sort((x, y) => x[0] - y[0]);
      let from = 0;
      const pieces: [number, number][] = [];
      for (const [g0, g1] of realGaps) {
        if (g0 - from > 1) pieces.push([from, g0]);
        from = Math.max(from, g1);
      }
      if (len - from > 1) pieces.push([from, len]);
      for (const [t0, t1] of pieces) {
        const p0: Point = [a[0] + u[0] * t0, a[1] + u[1] * t0],
          p1: Point = [a[0] + u[0] * t1, a[1] + u[1] * t1];
        B.slab(walls, p0, p1, n, WALL_T, m(WALL_H), B.rgb('#d9dde0'));
        if (skirting.enabled) {
          const inward: Point = [-n[0], -n[1]];
          // plinthe contre le mur, côté pièce : du mur vers l'intérieur
          B.slab(plinths, p1, p0, inward, PLINTH_T, m(skirting.height), B.rgb('#f3f1ec'));
        }
      }
    });
  }
  return [...B.meshes.values()].filter((d) => d.positions.length);
}
