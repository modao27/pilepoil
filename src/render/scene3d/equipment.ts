/**
 * Équipements fixes du plan en 3D (WC, lavabo, receveur, baignoire, évier, lave-linge, poteau, conduit, îlot) : un
 * volume simple et net par type, à la hauteur d'un modèle courant (`core/plan/equipment.ts`). Chaque élément est tourné
 * pour que son dos soit contre le mur le plus proche. Repère three.js : x = x du plan, z = y du plan, y vers le haut ;
 * mètres. Lit le plan, n'écrit rien. Les maillages ne sont pas repérés comme murs : ils ne sont jamais coupés.
 */
import { EQUIPMENT } from '../../core/plan/equipment';
import type { Point } from '../../core/geometry/types';
import type { Id, Obstacle, Plan, PlanRoom } from '../../core/plan/types';
import { emptyMesh, linear } from './envelope';
import type { MeshData, Vec3 } from './types';

const m = (v: number) => v / 1000;

type RGB = [number, number, number];

/** Couleurs des matières. */
const COLOR = {
  porcelain: linear('#f3f3ef'),
  seat: linear('#e4e4df'),
  water: linear('#c9d4d6'),
  dark: linear('#4b4f52'),
  chrome: linear('#b9c0c4'),
  wood: linear('#cdbb9d'),
  worktop: linear('#8c8f91'),
  steel: linear('#c7cbce'),
  concrete: linear('#bcb7ad'),
  duct: linear('#d9d3c7'),
  machine: linear('#ecece8'),
  other: linear('#a9a9a9'),
};

/** Face d'un volume local : repère (x le long du mur, y vers le haut, z du dos vers l'avant) → monde. */
interface Frame {
  at(x: number, y: number, z: number): Vec3;
  /** Direction locale (sans translation) → monde. */
  dir(x: number, y: number, z: number): Vec3;
  /** Largeur (le long du mur) et profondeur (du dos vers l'avant), mm. */
  width: number;
  depth: number;
}

/** Côté de la boîte le plus proche d'un mur de la pièce : le dos de l'équipement. */
type Back = '-x' | '+x' | '-y' | '+y';

function distanceToWalls(room: PlanRoom, p: Point): number {
  let best = Infinity;
  room.outline.forEach((a, i) => {
    const b = room.outline[(i + 1) % room.outline.length]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)));
  });
  return best;
}

export function backSide(room: PlanRoom, box: { x0: number; x1: number; y0: number; y1: number }): Back {
  const cx = (box.x0 + box.x1) / 2,
    cy = (box.y0 + box.y1) / 2;
  const sides: [Back, Point][] = [
    ['-y', [cx, box.y0]],
    ['+x', [box.x1, cy]],
    ['+y', [cx, box.y1]],
    ['-x', [box.x0, cy]],
  ];
  return sides.reduce((best, s) => (distanceToWalls(room, s[1]) < distanceToWalls(room, best[1]) ? s : best))[0];
}

function frameOf(room: PlanRoom, box: { x0: number; x1: number; y0: number; y1: number }, back: Back): Frame {
  const [ox, oy] = room.origin;
  const wx = box.x1 - box.x0,
    wy = box.y1 - box.y0;
  // x local → direction monde (le long du mur), z local → direction monde (du dos vers l'avant)
  const [width, depth] = back === '-y' || back === '+y' ? [wx, wy] : [wy, wx];
  const origin: Point =
    back === '-y'
      ? [box.x0, box.y0]
      : back === '+y'
        ? [box.x1, box.y1]
        : back === '-x'
          ? [box.x0, box.y1]
          : [box.x1, box.y0];
  const ex: Point = back === '-y' ? [1, 0] : back === '+y' ? [-1, 0] : back === '-x' ? [0, -1] : [0, 1];
  const ez: Point = back === '-y' ? [0, 1] : back === '+y' ? [0, -1] : back === '-x' ? [1, 0] : [-1, 0];
  return {
    at: (x, y, z) => [m(ox + origin[0] + ex[0] * x + ez[0] * z), m(y), m(oy + origin[1] + ex[1] * x + ez[1] * z)],
    dir: (x, y, z) => [ex[0] * x + ez[0] * z, y, ex[1] * x + ez[1] * z],
    width,
    depth,
  };
}

/** Quadrilatère tourné vers la normale n. */
function quad(d: MeshData, q: Vec3[], n: Vec3, col: RGB) {
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

function triangle(d: MeshData, a: Vec3, b: Vec3, c: Vec3, n: Vec3, col: RGB) {
  const cx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
    cy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
    cz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (const v of cx * n[0] + cy * n[1] + cz * n[2] < 0 ? [a, c, b] : [a, b, c]) {
    d.positions.push(...v);
    d.normals.push(...n);
    d.colors.push(...col);
    d.uvs.push(0, 0);
  }
}

/** Boîte dans le repère local (mm) : les six faces, normales vers l'extérieur. */
function box(
  d: MeshData,
  f: Frame,
  [x0, x1]: [number, number],
  [y0, y1]: [number, number],
  [z0, z1]: [number, number],
  col: RGB,
) {
  const P = f.at;
  const N = f.dir;
  quad(d, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], N(0, 0, -1), col);
  quad(d, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], N(0, 0, 1), col);
  quad(d, [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)], N(-1, 0, 0), col);
  quad(d, [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], N(1, 0, 0), col);
  quad(d, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], [0, 1, 0], col);
  quad(d, [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [0, -1, 0], col);
}

const SEGMENTS = 28;

/** Prisme elliptique vertical de y0 à y1 (flancs et dessus), centre (cx, cz), rayons (rx, rz), mm. */
function ellipse(
  d: MeshData,
  f: Frame,
  [cx, cz]: [number, number],
  [rx, rz]: [number, number],
  [y0, y1]: [number, number],
  col: RGB,
  top = true,
) {
  const pt = (k: number): [number, number] => {
    const a = (k / SEGMENTS) * Math.PI * 2;
    return [cx + rx * Math.cos(a), cz + rz * Math.sin(a)];
  };
  /** Normale unitaire d'un flanc, du centre vers l'extérieur de l'ellipse. */
  const outward = (nx: number, nz: number): Vec3 => {
    const [wx, , wz] = f.dir(nx, 0, nz);
    const len = Math.hypot(wx, wz) || 1;
    return [wx / len, 0, wz / len];
  };
  for (let k = 0; k < SEGMENTS; k++) {
    const [ax, az] = pt(k),
      [bx, bz] = pt(k + 1);
    const mid = ((k + 0.5) / SEGMENTS) * Math.PI * 2;
    quad(
      d,
      [f.at(ax, y0, az), f.at(bx, y0, bz), f.at(bx, y1, bz), f.at(ax, y1, az)],
      outward(Math.cos(mid) / rx, Math.sin(mid) / rz),
      col,
    );
    if (top) triangle(d, f.at(cx, y1, cz), f.at(ax, y1, az), f.at(bx, y1, bz), [0, 1, 0], col);
  }
}

/** Disque vertical sur la face avant (z = zf), centre (cx, cy), rayon r, tourné vers l'avant. */
function frontDisc(d: MeshData, f: Frame, [cx, cy]: [number, number], r: number, zf: number, col: RGB) {
  for (let k = 0; k < SEGMENTS; k++) {
    const a = (k / SEGMENTS) * Math.PI * 2,
      b = ((k + 1) / SEGMENTS) * Math.PI * 2;
    triangle(
      d,
      f.at(cx, cy, zf),
      f.at(cx + r * Math.cos(a), cy + r * Math.sin(a), zf),
      f.at(cx + r * Math.cos(b), cy + r * Math.sin(b), zf),
      f.dir(0, 0, 1),
      col,
    );
  }
}

/** Robinet : colonne chromée et bec vers l'avant, posés sur un plan à la hauteur y, au fond (z) et au milieu (x). */
function tap(d: MeshData, f: Frame, x: number, y: number, z: number) {
  box(d, f, [x - 12, x + 12], [y, y + 140], [z - 12, z + 12], COLOR.chrome);
  box(d, f, [x - 8, x + 8], [y + 120, y + 140], [z - 12, z + 110], COLOR.chrome);
}

/** Volume d'un équipement dans son repère local ; `h` : hauteur voulue, mm. */
function build(body: MeshData, kind: Obstacle['kind'], f: Frame, h: number) {
  const detail = body;
  const W = f.width,
    D = f.depth;
  switch (kind) {
    case 'toilet': {
      const bowlTop = 430;
      // réservoir contre le mur, cuvette ronde devant, abattant et cuvette d'eau
      box(body, f, [W * 0.08, W * 0.92], [250, h], [0, D * 0.27], COLOR.porcelain);
      box(detail, f, [W * 0.06, W * 0.94], [h, h + 18], [0, D * 0.3], COLOR.seat);
      ellipse(body, f, [W / 2, D * 0.64], [W / 2, D * 0.36], [0, bowlTop - 30], COLOR.porcelain, false);
      ellipse(detail, f, [W / 2, D * 0.64], [W / 2, D * 0.36], [bowlTop - 30, bowlTop], COLOR.seat);
      ellipse(detail, f, [W / 2, D * 0.66], [W * 0.34, D * 0.26], [bowlTop, bowlTop + 2], COLOR.water);
      box(detail, f, [W / 2 - 22, W / 2 + 22], [h + 18, h + 26], [D * 0.08, D * 0.14], COLOR.chrome);
      break;
    }
    case 'basin': {
      // meuble sous vasque : caisson, plan blanc, vasque, robinet
      const top = h - 50;
      box(body, f, [0, W], [0, top], [0, D], COLOR.wood);
      box(detail, f, [0, W], [top, h], [0, D], COLOR.porcelain);
      ellipse(detail, f, [W / 2, D * 0.55], [W * 0.3, D * 0.3], [h, h + 2], COLOR.water);
      tap(detail, f, W / 2, h, D * 0.12);
      box(detail, f, [W * 0.04, W * 0.96], [top * 0.35, top * 0.36], [D, D + 1], COLOR.dark);
      break;
    }
    case 'shower': {
      // receveur extra-plat : bac blanc, évacuation
      box(body, f, [0, W], [0, h], [0, D], COLOR.porcelain);
      ellipse(detail, f, [W / 2, D / 2], [45, 45], [h, h + 2], COLOR.dark);
      break;
    }
    case 'bath': {
      // baignoire : cuve à bords, fond relevé, robinet à l'extrémité
      const wall = 55;
      box(body, f, [0, W], [0, h], [0, wall], COLOR.porcelain);
      box(body, f, [0, W], [0, h], [D - wall, D], COLOR.porcelain);
      box(body, f, [0, wall], [0, h], [wall, D - wall], COLOR.porcelain);
      box(body, f, [W - wall, W], [0, h], [wall, D - wall], COLOR.porcelain);
      box(detail, f, [wall, W - wall], [0, h * 0.2], [wall, D - wall], COLOR.water);
      ellipse(detail, f, [W - 150, D / 2], [24, 24], [h * 0.2, h * 0.2 + 2], COLOR.dark);
      box(detail, f, [W / 2 - 18, W / 2 + 18], [h, h + 130], [wall / 2 - 12, wall / 2 + 12], COLOR.chrome);
      break;
    }
    case 'sink': {
      // meuble de cuisine avec évier : caisson, plan, cuve inox, robinet
      const top = h - 40;
      box(body, f, [0, W], [0, top], [0, D], COLOR.wood);
      box(detail, f, [0, W], [top, h], [0, D], COLOR.worktop);
      box(detail, f, [W * 0.12, W * 0.52], [h, h + 2], [D * 0.18, D * 0.82], COLOR.steel);
      box(detail, f, [W * 0.15, W * 0.49], [h + 2, h + 3], [D * 0.24, D * 0.76], COLOR.dark);
      tap(detail, f, W * 0.55, h, D * 0.2);
      break;
    }
    case 'island': {
      const top = h - 40;
      box(body, f, [0, W], [0, top], [0, D], COLOR.wood);
      box(detail, f, [-20, W + 20], [top, h], [-20, D + 20], COLOR.worktop);
      break;
    }
    case 'washer': {
      // lave-linge à hublot : caisson, bandeau, hublot
      box(body, f, [0, W], [0, h], [0, D], COLOR.machine);
      box(detail, f, [W * 0.04, W * 0.96], [h - 85, h - 20], [D, D + 3], COLOR.seat);
      frontDisc(detail, f, [W / 2, (h - 90) / 2], W * 0.34, D + 3, COLOR.chrome);
      frontDisc(detail, f, [W / 2, (h - 90) / 2], W * 0.29, D + 5, COLOR.dark);
      frontDisc(detail, f, [W / 2, (h - 90) / 2], W * 0.24, D + 7, COLOR.water);
      break;
    }
    case 'post':
      box(body, f, [0, W], [0, h], [0, D], COLOR.concrete);
      break;
    case 'duct':
      box(body, f, [0, W], [0, h], [0, D], COLOR.duct);
      break;
    default:
      box(body, f, [0, W], [0, h], [0, D], COLOR.other);
  }
}

/** Hauteur d'un élément, mm : celle de son type, ou celle de la pièce pour un poteau ou un conduit. */
export function equipmentHeight(o: Pick<Obstacle, 'kind'>, room: Pick<PlanRoom, 'height'>): number {
  const h = EQUIPMENT[o.kind].height;
  return h === 'room' ? room.height : h;
}

/**
 * Volumes des équipements des pièces `rooms`. Un seul maillage (couleurs par sommet) : un appel de dessin. Ils ne reçoivent pas d'étiquette de mur et ne sont donc jamais coupés avec les murs.
 */
export function buildEquipment(plan: Plan, rooms: readonly Id[]): MeshData[] {
  const body = emptyMesh('equipment', true);
  for (const room of plan.rooms.filter((r) => rooms.includes(r.id)))
    for (const o of room.obstacles) {
      if (o.outline.length < 3) continue;
      const xs = o.outline.map((p) => p[0]),
        ys = o.outline.map((p) => p[1]);
      const bounds = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      if (bounds.x1 - bounds.x0 < 1 || bounds.y1 - bounds.y0 < 1) continue;
      const f = frameOf(room, bounds, backSide(room, bounds));
      build(body, o.kind, f, equipmentHeight(o, room));
    }
  return body.positions.length ? [body] : [];
}
