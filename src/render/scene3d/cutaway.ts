/**
 * Maquette du projet « façon maison de poupée » (docs/NAVIGATION.md §7) : repérage des murs pour la coupe,
 * pièce sous un point, sol extérieur, menuiseries. Repère three.js : x = x du plan, z = y du plan ; mètres.
 * Lit le plan, n'écrit rien ; aucun module n'a à étiqueter ses maillages.
 */
import { Color, ShapeUtils, Vector2 } from 'three';
import { difference } from '../../core/geometry/boolean';
import { pointInPolygon, signedArea } from '../../core/geometry/polygon';
import { components } from '../../core/geometry/rings';
import type { Point } from '../../core/geometry/types';
import type { Id, Plan, PlanRoom } from '../../core/plan/types';
import { roomFloor } from '../../core/plan/levels';
import { outwardNormal, wallBands, wallDirection, wallLength } from '../../core/plan/walls';
import { exposed } from './envelope';
import type { MeshData, SceneFrame, Vec3 } from './types';
import { brand } from '../../ui/brand';

/** Hauteur de coupe des murs en mode « bas » et « coupés », m. */
export const CUT_HEIGHT = 0.4;
/** Épaisseur de revêtement comptée dans un mur côté pièce (carreau, colle, plinthe), mm. */
const LINING = 60;
/**
 * Profondeur comptée derrière la face extérieure, mm : un module dessine ses embrasures et tableaux à sa propre
 * profondeur (120 mm par défaut au carrelage, plus pour un tableau profond), parfois plus que le mur.
 */
const BEYOND = 300;

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
  /** Bouts de cloison à l'intérieur du mur (abscisses) : les triangles y sont coupés. */
  ends: number[];
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
      const ends = shared.flat().filter((e) => e > Math.min(...xs) + 1 && e < Math.max(...xs) - 1);
      zones.push({
        shared,
        ends,
        a,
        u,
        out,
        s0: Math.min(...xs) - 1,
        s1: Math.max(...xs) + 1,
        d0: -LINING,
        d1: wall.thickness + BEYOND,
      });
    });
  }
  return zones;
}

/** Sommet d'un triangle : position (m), normale, couleur, UV. */
interface Vert {
  p: Vec3;
  n: Vec3;
  c: Vec3;
  uv: [number, number];
}

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i]! - v) * t);
function mix(a: Vert, b: Vert, t: number): Vert {
  return {
    p: lerp(a.p, b.p, t) as Vec3,
    n: a.n,
    c: lerp(a.c, b.c, t) as Vec3,
    uv: lerp(a.uv, b.uv, t) as [number, number],
  };
}

/** Polygone coupé par la droite f = 0 : les parties f ≤ 0 et f ≥ 0 (Sutherland–Hodgman). */
function split(poly: Vert[], f: (v: Vert) => number): Vert[][] {
  const side = (keep: (x: number) => boolean) => {
    const out: Vert[] = [];
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const fa = f(a),
        fb = f(b);
      if (keep(fa)) out.push(a);
      if (keep(fa) !== keep(fb) && fa !== fb) out.push(mix(a, b, fa / (fa - fb)));
    });
    return out;
  };
  return [side((x) => x <= 0), side((x) => x > 0)].filter((q) => q.length >= 3);
}

/** Le mur auquel revient un point (repère du plan, mm) d'une face de normale n, et son abscisse le long du mur. */
function zoneOf(zones: readonly WallZone[], cx: number, cz: number, n: Vec3): { w: WallZone; s: number } | null {
  // le mur dont le point est côté pièce (revêtement) passe avant celui dont il traverse l'épaisseur : contre
  // une cloison, le carreau d'une pièce est aussi dans l'épaisseur du mur de la voisine
  let best: { w: WallZone; s: number } | null = null,
    bestScore = Infinity;
  for (const w of zones) {
    const dx = cx - w.a[0],
      dz = cz - w.a[1];
    const s = dx * w.u[0] + dz * w.u[1],
      dd = dx * w.out[0] + dz * w.out[1];
    if (s < w.s0 || s > w.s1 || dd < w.d0 || dd > w.d1) continue;
    // une face parallèle au mur (parement, face extérieure, bout d'angle) lui revient avant un mur voisin
    const facing = Math.abs(n[0] * w.out[0] + n[2] * w.out[1]) > 0.9;
    const score = (dd <= 0.5 ? -dd : 1000 + dd) + (facing ? 0 : 500);
    if (score < bestScore) {
      best = { w, s };
      bestScore = score;
    }
  }
  return best;
}

/**
 * Normale extérieure (x, z) du mur auquel appartient chaque triangle, d'après son centre au sol ; (0, 0) hors
 * des murs, doublée pour une cloison entre deux pièces. Deux valeurs par sommet, pour l'attribut `wallNormal`.
 * Un triangle à cheval sur le bout d'une cloison (pièce voisine plus courte) est coupé à cet endroit : le
 * carreau est tranché net au bout de la cloison au lieu d'être masqué en entier ou de travers.
 */
export function tagWalls(meshes: readonly MeshData[], plan: Plan, rooms: readonly Id[]): MeshData[] {
  const zones = wallZones(plan, rooms);
  return meshes.map((d) => {
    const out: MeshData = { ...d, positions: [], normals: [], colors: [], uvs: [], wallNormals: [] };
    const hasUv = d.uvs.length > 0;
    const vert = (i: number): Vert => ({
      p: [d.positions[i * 3]!, d.positions[i * 3 + 1]!, d.positions[i * 3 + 2]!],
      n: [d.normals[i * 3]!, d.normals[i * 3 + 1]!, d.normals[i * 3 + 2]!],
      c: [d.colors[i * 3]!, d.colors[i * 3 + 1]!, d.colors[i * 3 + 2]!],
      uv: hasUv ? [d.uvs[i * 2]!, d.uvs[i * 2 + 1]!] : [0, 0],
    });
    const emit = (tri: Vert[], tag: [number, number]) => {
      for (const v of tri) {
        out.positions.push(...v.p);
        out.normals.push(...v.n);
        out.colors.push(...v.c);
        if (hasUv) out.uvs.push(...v.uv);
        out.wallNormals!.push(...tag);
      }
    };
    const tagOf = (tri: Vert[]): [number, number] => {
      const cx = ((tri[0]!.p[0] + tri[1]!.p[0] + tri[2]!.p[0]) / 3) * 1000,
        cz = ((tri[0]!.p[2] + tri[1]!.p[2] + tri[2]!.p[2]) / 3) * 1000;
      const z = zoneOf(zones, cx, cz, tri[0]!.n);
      if (!z) return [0, 0];
      // cloison : normale doublée, la scène la coupe quel que soit le côté de la caméra
      const f = z.w.shared.some(([a, b]) => z.s >= a && z.s <= b) ? 2 : 1;
      return [z.w.out[0] * f, z.w.out[1] * f];
    };
    for (let t = 0; t < d.positions.length / 9; t++) {
      const tri = [vert(t * 3), vert(t * 3 + 1), vert(t * 3 + 2)];
      const cx = ((tri[0]!.p[0] + tri[1]!.p[0] + tri[2]!.p[0]) / 3) * 1000,
        cz = ((tri[0]!.p[2] + tri[1]!.p[2] + tri[2]!.p[2]) / 3) * 1000;
      const z = zoneOf(zones, cx, cz, tri[0]!.n);
      const ends = z ? z.w.ends : [];
      if (!z || !ends.length) {
        emit(tri, tagOf(tri));
        continue;
      }
      // abscisse le long du mur de ce triangle, mm ; coupe aux bouts de cloison qu'il chevauche
      const along = (v: Vert) => (v.p[0] * 1000 - z.w.a[0]) * z.w.u[0] + (v.p[2] * 1000 - z.w.a[1]) * z.w.u[1];
      let polys: Vert[][] = [tri];
      for (const e of ends) polys = polys.flatMap((q) => split(q, (v) => along(v) - e));
      for (const q of polys)
        for (let i = 1; i < q.length - 1; i++) {
          const part = [q[0]!, q[i]!, q[i + 1]!];
          emit(part, tagOf(part));
        }
    }
    return out;
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
      const dy = roomFloor(room);
      const at = (x: number, y: number, z: number): Vec3 => [
        m(a[0] + u[0] * x + out[0] * z),
        m(y + dy),
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

/**
 * Dessus de coupe des murs de `rooms`, à la hauteur de coupe : l'épaisseur de chaque mur en charbon, moins les
 * baies qui traversent cette hauteur (portes). La scène ne le montre que là où le mur est coupé.
 */
export function buildSections(plan: Plan, rooms: readonly Id[]): MeshData {
  const sec = mesh('section', { section: true, receiveShadow: false });
  const C = linear(brand.charbon);
  const cutMm = CUT_HEIGHT * 1000;
  for (const room of plan.rooms.filter((r) => rooms.includes(r.id))) {
    // la coupe est à 40 cm au-dessus du sol de chaque pièce
    const y = CUT_HEIGHT + m(roomFloor(room));
    const bands = wallBands(room);
    room.walls.forEach((wall, i) => {
      const band = bands[i];
      if (!band || wall.thickness <= 0 || room.height <= cutMm) return;
      const a = abs(room, room.outline[i]!);
      const u = wallDirection(room, i);
      const out = outwardNormal(u);
      const at = (x: number, d: number): Point => [a[0] + u[0] * x + out[0] * d, a[1] + u[1] * x + out[1] * d];
      const holes = room.openings
        .filter((o) => o.wall === wall.id && o.sill <= cutMm && o.sill + o.height > cutMm)
        .map((o) => [
          at(o.offset, -1),
          at(o.offset + o.width, -1),
          at(o.offset + o.width, wall.thickness + 1),
          at(o.offset, wall.thickness + 1),
        ]);
      // bande dans le sens des contours (aire > 0), sinon elle passerait pour un trou
      const raw = band.map((q) => abs(room, q));
      const ring = signedArea(raw) < 0 ? raw.reverse() : raw;
      for (const c of components(holes.length ? difference([ring], holes) : [ring])) {
        const v = (p: Point) => new Vector2(p[0], p[1]);
        const all = [...c.outer, ...c.holes.flat()];
        for (const t of ShapeUtils.triangulateShape(
          c.outer.map(v),
          c.holes.map((h) => h.map(v)),
        ))
          for (const k of t) {
            sec.positions.push(m(all[k]![0]), y, m(all[k]![1]));
            sec.normals.push(0, 1, 0);
            sec.colors.push(...C);
            sec.uvs.push(0, 0);
          }
      }
    });
  }
  return sec;
}

/** Sol extérieur sauge : la boîte du plan élargie de `margin` m, juste sous le sol brut. */
export function buildSite(frame: SceneFrame, margin = 1, ground = 0): MeshData {
  const site = mesh('site');
  const { x, z } = frame.bounds;
  // juste sous le sol le plus bas du plan
  const y = Math.min(0, ground) - 0.004;
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
