/**
 * Bâton rompu et point de Hongrie (docs/parquet/SPEC.md §4.3) : cellules du motif (core/patterns, joint 0)
 * tournées et placées sur l'axe, découpées par la surface posable, variantes A/B, réemploi des chutes en 2D
 * sans rotation ni miroir. Pur et déterministe.
 */
import { difference, intersection, offset } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { BBox, Point, Polygon, Segment } from '../../../core/geometry/types';
import { chevronCells } from '../../../core/patterns/chevron';
import { herring } from '../../../core/patterns/herring';
import type { Cell } from '../../../core/patterns/types';
import { components, keyhole } from './rings';
import type { BoardUse, LaidPiece, Offcut, ParquetWarning, PlacedLayout } from './types';

const EPS = 1e-6;
/** Pièce plus petite : ignorée (arrondi des booléens). */
const MIN_AREA = 1;

export interface PatternInput {
  layout: PlacedLayout;
  /** Surface posable, repère du plan. */
  layable: Polygon[];
  kerf: number;
  reuseOffcuts: boolean;
}

export interface PatternOutput {
  pieces: LaidPiece[];
  boards: BoardUse[];
  offcuts: Offcut[];
  warnings: ParquetWarning[];
}

/** Placement du motif : repère local des cellules → plan (rotation autour de l'origine, puis translation). */
export interface Placement {
  c: number;
  s: number;
  origin: Point;
}

/**
 * Rotation de base pour que l'axe du motif suive le mur de référence à 0° : le bâton rompu de core/patterns
 * a son axe sur la diagonale (1, 1), le point de Hongrie a ses colonnes (son axe) verticales.
 */
export function placement(l: PlacedLayout): Placement {
  const base = l.pattern.kind === 'herringbone' ? -45 : -90;
  const ref = (Math.atan2(l.referenceDirection[1], l.referenceDirection[0]) * 180) / Math.PI;
  const a = ((ref + l.angle + base) * Math.PI) / 180;
  return { c: Math.cos(a), s: Math.sin(a), origin: [l.axis[0] + l.offset[0], l.axis[1] + l.offset[1]] };
}

const toPlan = (p: Placement, q: Point): Point => [
  p.origin[0] + q[0] * p.c - q[1] * p.s,
  p.origin[1] + q[0] * p.s + q[1] * p.c,
];
const toLocal = (p: Placement, q: Point): Point => {
  const x = q[0] - p.origin[0],
    y = q[1] - p.origin[1];
  return [x * p.c + y * p.s, -x * p.s + y * p.c];
};

/** Cellules du motif couvrant la surface, repère du plan. */
export function patternCells(l: PlacedLayout, layable: Polygon[]): Cell[] {
  const board = l.board!;
  const pl = placement(l);
  const local = layable.flat().map((q) => toLocal(pl, q));
  const xs = local.map((q) => q[0]),
    ys = local.map((q) => q[1]);
  const bb: BBox = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const L = board.lengths[0]!,
    W = board.width;
  if (l.pattern.kind === 'chevron') {
    // point de Hongrie : x = 0 est une limite de colonnes, axe de symétrie (pointes des lames)
    return chevronCells(L, W, 0, bb, l.pattern.endAngle).map((c) => ({ ...c, p: c.p.map((q) => toPlan(pl, q)) }));
  }
  // bâton rompu : symétrie glissée d'axe y = x + W/2 − L dans le repère du réseau ; décalé de (0, L − W/2)
  // pour que l'axe passe par le point d'axe (les lames A et B sont alors symétriques par rapport à l'axe)
  const dy = L - W / 2;
  const cells = herring.generate(L, W, 0, [bb[0], bb[1], bb[2] - dy, bb[3] - dy], herring.geo(L, W, 0));
  return cells.map((c) => ({ ...c, p: c.p.map((q) => toPlan(pl, [q[0], q[1] + dy])) }));
}

/**
 * Repère de la lame d'une cellule : origine et direction de son long côté (premier ou deuxième côté de la
 * cellule). Rotation seule : une pièce garde son sens, sans miroir (les lames A et B ne s'échangent pas).
 */
function boardFrame(cell: Polygon): { o: Point; c: number; s: number } {
  const len = (i: number) => Math.hypot(cell[i + 1]![0] - cell[i]![0], cell[i + 1]![1] - cell[i]![1]);
  const i = len(0) >= len(1) - EPS ? 0 : 1;
  const a = cell[i]!,
    b = cell[i + 1]!;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { o: a, c: (b[0] - a[0]) / l, s: (b[1] - a[1]) / l };
}
const toBoard = (f: ReturnType<typeof boardFrame>, q: Point): Point => {
  const x = q[0] - f.o[0],
    y = q[1] - f.o[1];
  return [x * f.c + y * f.s, -x * f.s + y * f.c];
};

export function layPattern(input: PatternInput): PatternOutput {
  const { layout, layable, kerf } = input;
  const board = layout.board!;
  const cells = patternCells(layout, layable);
  const warnings: ParquetWarning[] = [];

  /* ---------- découpage : cellule ∩ surface posable ---------- */
  interface Cut {
    id: string;
    line: number;
    variant: 'A' | 'B';
    polygon: Polygon;
    /** Pièce dans le repère de sa lame. */
    local: Polygon;
    /** Lame entière dans ce repère (rectangle ou parallélogramme). */
    blank: Polygon;
    area: number;
    cellArea: number;
    full: boolean;
    newEdges: number;
  }
  // ordre stable : le long de l'axe, puis en travers
  const pl = placement(layout);
  const ordered = cells
    .map((c) => ({ c, k: toLocal(pl, centre(c.p)) }))
    .sort((p, q) => (Math.abs(p.k[1] - q.k[1]) > 1 ? p.k[1] - q.k[1] : p.k[0] - q.k[0]));
  const lines = new Map<number, number>();
  const cuts: Cut[] = [];
  let lineOf = -1,
    lastY = -Infinity,
    n = 0;
  for (const { c, k } of ordered) {
    if (k[1] - lastY > 1) {
      lineOf++;
      lastY = k[1];
      n = 0;
    }
    const parts = components(intersection([c.p], layable)).filter((p) => Math.abs(signedArea(keyhole(p))) > MIN_AREA);
    if (!parts.length) continue;
    const frame = boardFrame(c.p);
    const blank = c.p.map((q) => toBoard(frame, q));
    const cellArea = Math.abs(signedArea(c.p));
    const variant = c.par ? 'B' : 'A';
    const base = `${layout.id}-${String(lineOf).padStart(2, '0')}-${String(n++).padStart(2, '0')}-${variant}`;
    parts.forEach((part, i) => {
      const ring = keyhole(part);
      const area = Math.abs(signedArea(ring));
      cuts.push({
        id: i ? `${base}-${i}` : base,
        line: lineOf,
        variant,
        polygon: ring,
        local: ring.map((q) => toBoard(frame, q)),
        blank,
        area,
        cellArea,
        full: parts.length === 1 && !part.holes.length && area >= cellArea * 0.999,
        newEdges: part.holes.length ? 2 : countNewEdges(part.outer, c.p),
      });
    });
    lines.set(lineOf, (lines.get(lineOf) ?? 0) + parts.length);
  }

  /* ---------- lames et chutes (2D, sans rotation ni miroir) ---------- */
  const boards: BoardUse[] = [];
  let stock: (Offcut & { shape: Polygon })[] = [];
  let seq = 0;
  const source = new Map<string, LaidPiece['source']>();
  const boardOf = new Map<string, number>();
  const rests = new Map<string, { id: string; length: number }[]>();
  const keep = (boardIndex: number, variant: 'A' | 'B', rest: Polygon[], piece: string) => {
    if (!input.reuseOffcuts) return;
    for (const r of components(rest)) {
      const ring = keyhole(r);
      // assez grand pour une coupe utile : au moins la coupe mini en longueur
      const xs = ring.map((q) => q[0]);
      if (Math.max(...xs) - Math.min(...xs) < layout.rules.minCutLength * 0.5) continue;
      if (Math.abs(signedArea(ring)) < board.width * 50) continue;
      const id = `${layout.id}-C-${String(++seq).padStart(3, '0')}`;
      const length = Math.max(...xs) - Math.min(...xs);
      stock.push({ id, board: boardIndex, variant, length, polygon: ring, shape: ring });
      rests.set(piece, [...(rests.get(piece) ?? []), { id, length: round2(length) }]);
    }
  };
  /** Translation qui place la pièce dans la chute (le long de la lame), sinon null. */
  const fit = (piece: Polygon, shape: Polygon): Polygon | null => {
    const px = piece.map((q) => q[0]),
      sx = shape.map((q) => q[0]);
    for (const dx of [Math.min(...sx) - Math.min(...px), Math.max(...sx) - Math.max(...px), 0]) {
      const moved = piece.map((q): Point => [q[0] + dx, q[1]]);
      const out = difference([moved], [shape]).reduce((t, r) => t + Math.abs(signedArea(r)), 0);
      if (out < 1) return moved;
    }
    return null;
  };
  // lames entières d'abord (une lame chacune), puis les coupes de la plus grande à la plus petite
  const order = [...cuts].sort((a, b) => Number(b.full) - Number(a.full) || b.area - a.area || (a.id < b.id ? -1 : 1));
  for (const c of order) {
    if (!c.full && input.reuseOffcuts) {
      const candidates = stock
        .filter((o) => o.variant === c.variant)
        .sort((a, b) => signedArea(a.shape) - signedArea(b.shape));
      let used = false;
      for (const o of candidates) {
        const moved = fit(c.local, o.shape);
        if (!moved) continue;
        stock = stock.filter((x) => x !== o);
        keep(o.board, c.variant, difference([o.shape], offset([moved], kerf)), c.id);
        source.set(c.id, { offcut: o.id });
        boardOf.set(c.id, o.board);
        used = true;
        break;
      }
      if (used) continue;
    }
    // longueur de la lame : de pointe à pointe (point de Hongrie), sa longueur pour une lame droite
    const bx = c.blank.map((q) => q[0]);
    const b: BoardUse = {
      index: boards.length,
      variant: c.variant,
      length: round2(Math.max(...bx) - Math.min(...bx)),
      pieces: [],
    };
    boards.push(b);
    source.set(c.id, { board: b.index });
    boardOf.set(c.id, b.index);
    if (!c.full) keep(b.index, c.variant, difference([c.blank], offset([c.local], kerf)), c.id);
  }

  /* ---------- pièces ---------- */
  const pieces: LaidPiece[] = cuts.map((c) => {
    const xs = c.local.map((q) => q[0]);
    const length = Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100;
    const cutType: LaidPiece['cutType'] = c.full
      ? 'full'
      : c.newEdges === 1
        ? straightCut(c.local)
          ? 'straight'
          : 'angled'
        : 'complex';
    if (!c.full) {
      const width = c.area / Math.max(length, EPS);
      if (c.area < c.cellArea * 0.15 || width < 20)
        warnings.push({ code: 'tiny-piece', piece: c.id, area: Math.round(c.area) });
    }
    boards[boardOf.get(c.id)!]!.pieces.push(c.id);
    return {
      id: c.id,
      room: '',
      row: null,
      line: c.line,
      polygon: c.polygon,
      variant: c.variant,
      length,
      cutType,
      cuts: newEdgesOf(c.local, c.blank),
      source: source.get(c.id)!,
      ripped: false,
      ...(rests.has(c.id) ? { rest: rests.get(c.id) } : {}),
    };
  });

  return { pieces, boards, offcuts: stock.map(({ shape: _, ...o }) => o), warnings };
}

/* ---------- aides ---------- */

/** Bords de la pièce qui ne sont pas sur un bord de la cellule : les coupes. */
function newEdgesOf(piece: Polygon, cell: Polygon): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < piece.length; i++) {
    const a = piece[i]!,
      b = piece[(i + 1) % piece.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) continue;
    if (onCellEdge(a, b, cell)) continue;
    out.push([
      [Math.round(a[0] * 100) / 100, Math.round(a[1] * 100) / 100],
      [Math.round(b[0] * 100) / 100, Math.round(b[1] * 100) / 100],
    ]);
  }
  return out;
}

/** Nombre de coupes : suites de bords hors des bords de la cellule. */
function countNewEdges(piece: Polygon, cell: Polygon): number {
  const flags = piece.map((a, i) => !onCellEdge(a, piece[(i + 1) % piece.length]!, cell));
  if (flags.every(Boolean)) return 2;
  let runs = 0;
  for (let i = 0; i < flags.length; i++) if (flags[i] && !flags[(i - 1 + flags.length) % flags.length]) runs++;
  return runs;
}

function onCellEdge(a: Point, b: Point, cell: Polygon): boolean {
  for (let i = 0; i < cell.length; i++) {
    const c = cell[i]!,
      d = cell[(i + 1) % cell.length]!;
    if (distToLine(a, c, d) < 0.05 && distToLine(b, c, d) < 0.05) return true;
  }
  return false;
}

function distToLine(p: Point, a: Point, b: Point): number {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return l < EPS
    ? Math.hypot(p[0] - a[0], p[1] - a[1])
    : Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / l;
}

/** Une coupe d'équerre (perpendiculaire ou parallèle à la rive) : coupe droite ; sinon en biais. */
function straightCut(local: Polygon): boolean {
  return local.every((a, i) => {
    const b = local[(i + 1) % local.length]!;
    return Math.abs(a[0] - b[0]) < 0.05 || Math.abs(a[1] - b[1]) < 0.05;
  });
}

function centre(p: Polygon): Point {
  const n = p.length;
  return [p.reduce((t, q) => t + q[0], 0) / n, p.reduce((t, q) => t + q[1], 0) / n];
}

const round2 = (v: number) => Math.round(v * 100) / 100;
