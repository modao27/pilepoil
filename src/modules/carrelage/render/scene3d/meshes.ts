/**
 * Construction des maillages 3D (données brutes : positions, normales, couleurs, UV), sans WebGL.
 * Tout est regroupé par matériau pour limiter les appels de dessin (une pièce de 15 m² ≈ 15 maillages).
 * Lit les résultats du moteur, n'écrit rien.
 */
import { Color, ShapeUtils, Vector2 } from 'three';
import {
  hash,
  type OpeningSpec,
  type Piece,
  type Point,
  type ProjectResult,
  type ProjectSpec,
  type SurfaceSpec,
} from '../..';
import { frameAt, wallPoint, type SceneLayout, type Vec3, type WallFrame } from './placement';

export interface MeshData {
  /** Clé de regroupement (matériau). */
  key: string;
  /** Photo (URL) des carreaux, ou null : couleur seule. */
  photo: string | null;
  positions: number[];
  normals: number[];
  /** Couleurs linéaires par sommet (r, g, b). */
  colors: number[];
  uvs: number[];
  castShadow: boolean;
  receiveShadow: boolean;
}

export interface MeshInput {
  spec: ProjectSpec;
  result: ProjectResult;
  layout: SceneLayout;
  /** Variation de teinte des carreaux (0 à 0,14). */
  shade: number;
  /** Photo du carreau d'une zone, et retournements aléatoires permis. */
  photo: (surface: number, zone: number) => { url: string; flip: boolean } | null;
}

/** Hauteurs et couleurs reprises de legacy. */
const PLASTER = '#ebe7e0',
  FLOOR_BASE = '#bdb6ab',
  GROUND = '#cfc6b8',
  WHITE = '#f3f3f0';
const LIFT_TILE = 0.002,
  LIFT_GROUT = 0.001;

class Builder {
  readonly meshes = new Map<string, MeshData>();
  private readonly tmp = new Color();

  mesh(key: string, o: Partial<Pick<MeshData, 'photo' | 'castShadow' | 'receiveShadow'>> = {}): MeshData {
    let m = this.meshes.get(key);
    if (!m) {
      m = {
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
      this.meshes.set(key, m);
    }
    return m;
  }

  /** Couleur CSS sRGB → linéaire, multipliée par k (variation de teinte). */
  rgb(css: string, k = 1): [number, number, number] {
    this.tmp.setStyle(css);
    return [Math.min(1, this.tmp.r * k), Math.min(1, this.tmp.g * k), Math.min(1, this.tmp.b * k)];
  }

  /** Triangle orienté selon la normale voulue. */
  tri(m: MeshData, a: Vec3, b: Vec3, c: Vec3, n: Vec3, col: [number, number, number], uv?: [Point, Point, Point]) {
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2],
      vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    const order = dot >= 0 ? [0, 1, 2] : [0, 2, 1];
    const P = [a, b, c],
      U = uv ?? [
        [0, 0],
        [0, 0],
        [0, 0],
      ];
    for (const i of order) {
      m.positions.push(...P[i]!);
      m.normals.push(...n);
      m.colors.push(...col);
      m.uvs.push(...U[i]!);
    }
  }

  /** Polygone convexe (éventail). */
  convex(m: MeshData, pts: Vec3[], n: Vec3, col: [number, number, number], uvs?: Point[]) {
    for (let i = 1; i < pts.length - 1; i++) {
      this.tri(m, pts[0]!, pts[i]!, pts[i + 1]!, n, col, uvs ? [uvs[0]!, uvs[i]!, uvs[i + 1]!] : undefined);
    }
  }

  /** Polygone quelconque avec trous, défini dans un repère 2D puis placé en 3D par map. */
  shape(
    m: MeshData,
    outer: Point[],
    holes: Point[][],
    map: (p: Point) => Vec3,
    n: Vec3,
    col: [number, number, number],
  ) {
    const v = (p: Point) => new Vector2(p[0], p[1]);
    const contour = outer.map(v),
      hs = holes.map((h) => h.map(v));
    const all = [...outer, ...holes.flat()];
    for (const [a, b, c] of ShapeUtils.triangulateShape(contour, hs)) {
      this.tri(m, map(all[a!]!), map(all[b!]!), map(all[c!]!), n, col);
    }
  }
}

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Trous des ouvertures (hors prises) dans une boîte [x0, x1] × [y0, y1] (repère surface, mm). */
function holesIn(s: SurfaceSpec, x0: number, x1: number, y0: number, y1: number): Point[][] {
  return s.openings
    .filter((o) => o.type !== 'socket')
    .map((o) => ({
      a: Math.max(o.x, x0 + 0.5),
      b: Math.min(o.x + o.width, x1 - 0.5),
      c: Math.max(s.height - o.sill - o.height, y0 + 0.5),
      d: Math.min(s.height - o.sill, y1 - 0.5),
    }))
    .filter((h) => h.b > h.a && h.d > h.c)
    .map((h) => rect(h.a, h.c, h.b, h.d).reverse());
}

/** Coordonnées image (s, t) d'un point dans le repère de photo (o, u, v) de la pièce. */
function photoUV(q: Point, o: Point, u: Point, v: Point): Point {
  const e1x = u[0] - o[0],
    e1y = u[1] - o[1],
    e2x = v[0] - o[0],
    e2y = v[1] - o[1];
  const det = e1x * e2y - e1y * e2x || 1;
  const s = ((q[0] - o[0]) * e2y - (q[1] - o[1]) * e2x) / det,
    t = (e1x * (q[1] - o[1]) - e1y * (q[0] - o[0])) / det;
  return [s, 1 - t];
}

export function buildMeshes(input: MeshInput): MeshData[] {
  const B = new Builder();
  const { spec, result, layout } = input;
  const room = layout.room;

  /* sol de contexte */
  const hasFloor = layout.instances.some((i) => i.kind === 'floor');
  if (room && !hasFloor) {
    B.convex(
      B.mesh('ground'),
      [
        [0, 0, 0],
        [room.length, 0, 0],
        [room.length, 0, room.width],
        [0, 0, room.width],
      ],
      [0, 1, 0],
      B.rgb(GROUND),
    );
  } else if (!room && !hasFloor) {
    const { x, z } = layout.bounds;
    B.convex(
      B.mesh('ground'),
      [
        [x[0] - 1.5, 0, z[0] - 1.5],
        [x[1] + 1.5, 0, z[0] - 1.5],
        [x[1] + 1.5, 0, z[1] + 3.2],
        [x[0] - 1.5, 0, z[1] + 3.2],
      ],
      [0, 1, 0],
      B.rgb(GROUND),
    );
  }

  /* murs non carrelés de la pièce */
  if (room) {
    const defs = {
      A: { base: [0, 0], dir: [1, 0], len: room.length },
      B: { base: [room.length, 0], dir: [0, 1], len: room.width },
      C: { base: [room.length, room.width], dir: [-1, 0], len: room.length },
      D: { base: [0, room.width], dir: [0, -1], len: room.width },
    } as const;
    for (const k of room.missing) {
      const d = defs[k],
        e = [d.base[0] + d.dir[0] * d.len, d.base[1] + d.dir[1] * d.len];
      B.convex(
        B.mesh('plaster'),
        [
          [d.base[0], 0, d.base[1]],
          [e[0]!, 0, e[1]!],
          [e[0]!, room.height, e[1]!],
          [d.base[0], room.height, d.base[1]],
        ],
        [-d.dir[1], 0, d.dir[0]],
        B.rgb(PLASTER),
      );
    }
  }

  for (const inst of layout.instances) {
    const s = spec.surfaces[inst.surface]!;
    const r = result.surfaces[inst.surface];
    const build = r?.ok ? r.value : null;
    const floor = inst.kind === 'floor';
    const frames = inst.kind === 'wall' ? inst.frames : null;
    /** Point de la surface (mm, y vers le bas) → 3D, `lift` m vers la pièce. */
    const M3 =
      (fr: WallFrame | null) =>
      (p: Point, lift = 0): Vec3 =>
        fr ? wallPoint(fr, p[0], (s.height - p[1]) / 1000, -lift) : [p[0] / 1000, lift, p[1] / 1000];
    const normalOf = (fr: WallFrame | null): Vec3 => (fr ? fr.n : [0, 1, 0]);
    const segments: (WallFrame | null)[] = frames ?? [null];

    for (const fr of segments) {
      const x0 = fr ? fr.x0 : 0,
        x1 = fr ? fr.x1 : s.width;
      const map = M3(fr),
        n = normalOf(fr);

      /* support : plâtre (murs) ou chape (sol), avec les trous des ouvertures */
      let ext: [number, number, number, number];
      if (floor) ext = [0, 0, s.width, s.height];
      else if (room) ext = [x0, -(Math.max(room.height * 1000, s.height) - s.height), x1, s.height];
      else ext = [fr!.k === 0 ? x0 - 1200 : x0, -600, fr!.last ? x1 + 1200 : x1, s.height];
      B.shape(
        B.mesh(floor ? 'floorbase' : 'plaster'),
        rect(...ext),
        holesIn(s, ext[0], ext[2], ext[1], ext[3]),
        (p) => map(p),
        n,
        B.rgb(floor ? FLOOR_BASE : PLASTER),
      );

      if (!build) continue;

      /* joints : fond de chaque zone */
      build.layout.rects.forEach((rc, zi) => {
        const a0 = Math.max(rc.x, x0),
          a1 = Math.min(rc.x + rc.w, x1);
        if (rc.h <= 0 || a1 <= a0) return;
        const col = s.zones[zi]!.groutColor;
        B.shape(
          B.mesh('grout|' + col.toLowerCase()),
          rect(a0, rc.y, a1, rc.y + rc.h),
          holesIn(s, a0, a1, rc.y, rc.y + rc.h),
          (p) => map(p, LIFT_GROUT),
          n,
          B.rgb(col),
        );
      });

      /* carreaux */
      build.pieces.forEach((pc, i) => {
        if (!pc.parts || pc.reveal) return;
        if (fr) {
          const cx = pc.parts[0]!.reduce((t, q) => t + q[0], 0) / pc.parts[0]!.length;
          if (frameAt(frames!, cx) !== fr) return;
        }
        tilePiece(B, input, inst.surface, pc, i, (p) => map(p, LIFT_TILE), n);
      });
    }

    /* ouvertures */
    s.openings.forEach((o, ri) => {
      if (frames) wallOpening(B, input, s, o, ri, frames, build?.pieces ?? [], room);
      else floorOpening(B, s, o);
    });
  }

  return [...B.meshes.values()].filter((m) => m.positions.length);
}

function tilePiece(B: Builder, input: MeshInput, si: number, pc: Piece, i: number, map: (p: Point) => Vec3, n: Vec3) {
  const k = 1 + ((hash(i) % 1000) / 1000 - 0.5) * 2 * input.shade;
  const ph = input.photo(si, pc.zone);
  // avec photo, la couleur sert seulement de variation de teinte (multipliée à la texture)
  const col = B.rgb(ph ? '#ffffff' : pc.color, k);
  const m = B.mesh(ph ? 'tiles|' + ph.url : 'tiles', { photo: ph?.url ?? null });
  let frame = pc.img;
  if (ph && frame && ph.flip && hash(i * 31 + 7) & 1) {
    const [o, u, v] = frame;
    frame = [[u[0] + v[0] - o[0], u[1] + v[1] - o[1]], v, u];
  }
  for (const part of pc.parts!) {
    const uvs = ph && frame ? part.map((q) => photoUV(q, frame[0], frame[1], frame[2])) : undefined;
    B.convex(m, part.map(map), n, col, uvs);
  }
}

function wallOpening(
  B: Builder,
  input: MeshInput,
  s: SurfaceSpec,
  o: OpeningSpec,
  ri: number,
  frames: WallFrame[],
  pieces: Piece[],
  room: SceneLayout['room'],
) {
  const fr = frameAt(frames, o.x + o.width / 2);
  const P = (x: number, Y: number, depth: number) => wallPoint(fr, x, Y, depth);
  const x0 = Math.max(0, o.x),
    x1 = Math.min(s.width, o.x + o.width);
  if (x1 <= x0) return;
  const dv: Vec3 = [fr.dir[0], 0, fr.dir[1]];

  if (o.type === 'socket') {
    const y0 = (o.sill - 8) / 1000,
      y1 = (o.sill + o.height + 8) / 1000;
    B.convex(
      B.mesh('fixture'),
      [P(x0 - 8, y0, -0.006), P(x1 + 8, y0, -0.006), P(x1 + 8, y1, -0.006), P(x0 - 8, y1, -0.006)],
      fr.n,
      B.rgb('#f7f7f5'),
    );
    return;
  }
  if (o.type === 'tub') {
    const pr = (o.projection || 700) / 1000,
      h = o.height / 1000;
    box(B, [P(x0, 0, 0), P(x1, 0, 0), P(x1, 0, -pr), P(x0, 0, -pr)], h, false);
    return;
  }

  const D = o.type === 'trap' ? 0.015 : o.type === 'other' ? 0.06 : (o.revealDepth > 0 ? o.revealDepth : 120) / 1000;
  const top = room ? Math.max(room.height * 1000, s.height) : s.height;
  const yb = Math.max(0, o.sill) / 1000,
    yt = Math.min(top, o.sill + o.height) / 1000;
  if (yt <= yb) return;
  const emb = (key: string) => B.mesh(key, { castShadow: true });

  /* fond */
  const back =
    o.type === 'window' ? '#a9c1cf' : o.type === 'door' ? '#7a6550' : o.type === 'trap' ? '#d9d5cd' : '#e4e0d8';
  B.convex(emb('opening|' + back), [P(x0, yb, D), P(x1, yb, D), P(x1, yt, D), P(x0, yt, D)], fr.n, B.rgb(back));
  if (o.type === 'window') {
    const frw = 45,
      frh = 0.045,
      zf = D - 0.002;
    const strips: [number, number, number, number][] = [
      [x0, yb, x0 + frw, yt],
      [x1 - frw, yb, x1, yt],
      [x0, yt - frh, x1, yt],
      [x0, yb, x1, yb + frh],
    ];
    if ((x1 - x0) / 1000 >= (yt - yb) * 0.9) strips.push([(x0 + x1) / 2 - frw / 2, yb, (x0 + x1) / 2 + frw / 2, yt]);
    for (const q of strips)
      B.convex(
        emb('frame'),
        [P(q[0], q[1], zf), P(q[2], q[1], zf), P(q[2], q[3], zf), P(q[0], q[3], zf)],
        fr.n,
        B.rgb('#f6f6f4'),
      );
  } else if (o.type === 'door') {
    const hx = x0 + (x1 - x0) * 0.86,
      hy = yb + (yt - yb) * 0.48;
    B.convex(
      emb('fixture'),
      [
        P(hx - 25, hy - 0.012, D - 0.003),
        P(hx + 25, hy - 0.012, D - 0.003),
        P(hx + 25, hy + 0.012, D - 0.003),
        P(hx - 25, hy + 0.012, D - 0.003),
      ],
      fr.n,
      B.rgb('#c9c4b8'),
    );
    if (o.covered) {
      const b2 = 55,
        z = -0.008;
      for (const q of [
        [x0 - b2, yb, x0, yt + b2 / 1000],
        [x1, yb, x1 + b2, yt + b2 / 1000],
        [x0 - b2, yt, x1 + b2, yt + b2 / 1000],
      ] as const)
        B.convex(
          emb('frame'),
          [P(q[0], q[1], z), P(q[2], q[1], z), P(q[2], q[3], z), P(q[0], q[3], z)],
          fr.n,
          B.rgb('#f4f2ec'),
        );
    }
  }

  /* côtés de l'embrasure : plâtre ou tableau carrelé */
  const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];
  const sides = {
    L: {
      n: dv,
      quad: [P(x0, yb, 0), P(x0, yt, 0), P(x0, yt, D), P(x0, yb, D)],
      map: (u: number, v: number, l: number) => P(x0 + l * 1000, yb + u, v),
    },
    R: {
      n: neg(dv),
      quad: [P(x1, yb, 0), P(x1, yt, 0), P(x1, yt, D), P(x1, yb, D)],
      map: (u: number, v: number, l: number) => P(x1 - l * 1000, yb + u, v),
    },
    T: {
      n: [0, -1, 0] as Vec3,
      quad: [P(x0, yt, 0), P(x1, yt, 0), P(x1, yt, D), P(x0, yt, D)],
      map: (u: number, v: number, l: number) => P(x0 + u * 1000, yt - l, v),
    },
    B: {
      n: [0, 1, 0] as Vec3,
      quad: [P(x0, yb, 0), P(x1, yb, 0), P(x1, yb, D), P(x0, yb, D)],
      map: (u: number, v: number, l: number) => P(x0 + u * 1000, yb + l, v),
    },
  };
  const tiled = (o.type === 'window' || o.type === 'door') && o.revealDepth > 0;
  for (const sd of ['L', 'R', 'T', 'B'] as const) {
    if (o.type === 'door' && sd === 'B') continue;
    const so = sides[sd];
    const own =
      tiled && o.reveals[sd]
        ? pieces.map((p, i) => [p, i] as const).filter(([p]) => p.reveal?.opening === ri && p.reveal.side === sd)
        : [];
    if (!own.length) {
      B.convex(emb('plaster-emb'), so.quad, so.n, B.rgb(PLASTER));
      continue;
    }
    const zi = own[0]![0].zone;
    B.convex(emb('grout|' + s.zones[zi]!.groutColor.toLowerCase()), so.quad, so.n, B.rgb(s.zones[zi]!.groutColor));
    for (const [pc, i] of own) {
      const u = pc.reveal!,
        k = 1 + ((hash(i) % 1000) / 1000 - 0.5) * 2 * input.shade;
      B.convex(
        B.mesh('tiles'),
        [
          so.map(u.u0 / 1000, u.v0 / 1000, LIFT_TILE),
          so.map(u.u1 / 1000, u.v0 / 1000, LIFT_TILE),
          so.map(u.u1 / 1000, u.v1 / 1000, LIFT_TILE),
          so.map(u.u0 / 1000, u.v1 / 1000, LIFT_TILE),
        ],
        so.n,
        B.rgb(pc.color, k),
      );
    }
  }
}

function floorOpening(B: Builder, s: SurfaceSpec, o: OpeningSpec) {
  const y0 = (s.height - o.sill - o.height) / 1000,
    y1 = (s.height - o.sill) / 1000,
    x0 = o.x / 1000,
    x1 = (o.x + o.width) / 1000;
  if (o.type === 'tub')
    box(
      B,
      [
        [x0, 0, y0],
        [x1, 0, y0],
        [x1, 0, y1],
        [x0, 0, y1],
      ],
      0.05,
      true,
    );
  else if (o.type !== 'socket')
    B.convex(
      B.mesh('opening|#2b2b2c'),
      [
        [x0, 0.0005, y0],
        [x1, 0.0005, y0],
        [x1, 0.0005, y1],
        [x0, 0.0005, y1],
      ],
      [0, 1, 0],
      B.rgb('#2b2b2c'),
    );
}

/** Baignoire (contre un mur) ou receveur (au sol) : boîte blanche avec fond intérieur. */
function box(B: Builder, base: Vec3[], h: number, floor: boolean) {
  const m = B.mesh('fixture-box', { castShadow: true }),
    top = base.map((p): Vec3 => [p[0], h, p[2]]);
  const cen = base.reduce<Vec3>((s, p) => [s[0] + p[0] / 4, 0, s[2] + p[2] / 4], [0, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const A = base[i]!,
      C = base[(i + 1) % 4]!;
    const mid = [(A[0] + C[0]) / 2, (A[2] + C[2]) / 2],
      l = Math.hypot(mid[0]! - cen[0], mid[1]! - cen[2]) || 1;
    B.convex(m, [A, C, top[(i + 1) % 4]!, top[i]!], [(mid[0]! - cen[0]) / l, 0, (mid[1]! - cen[2]) / l], B.rgb(WHITE));
  }
  B.convex(m, top, [0, 1, 0], B.rgb('#f7f7f4'));
  const inner = top.map((p): Vec3 => [cen[0] + (p[0] - cen[0]) * 0.86, h + 0.001, cen[2] + (p[2] - cen[2]) * 0.86]);
  B.convex(m, inner, [0, 1, 0], B.rgb(floor ? '#e9ebea' : '#e6e8e8'));
}
