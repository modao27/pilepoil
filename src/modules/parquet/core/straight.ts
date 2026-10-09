/**
 * Pose droite (docs/parquet/SPEC.md §4.2, sans l'optimisation) : rangs, équilibrage, segments, remplissage 1D
 * avec stock de chutes, décalage régulier, longueurs mixtes. Tout se fait dans le repère de pose (x le long des
 * lames, y en travers), puis les pièces reviennent au repère du plan. Pur et déterministe.
 */
import { intersection } from '../../../core/geometry/boolean';
import { signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon, Segment } from '../../../core/geometry/types';
import { seededRandom } from '../../../core/hash';
import { ringFromFrame, toFrame, type Frame } from './frame';
import { components, keyhole, type Component } from './rings';
import type { BoardUse, LaidPiece, LayoutSpec, Offcut, ParquetWarning } from './types';

const EPS = 1e-6;
/** Tolérance de longueur pour réemployer une chute en décalage régulier (SPEC §4.2.5). */
const REGULAR_TOLERANCE = 2;

export interface StraightInput {
  layout: LayoutSpec;
  /** Surface posable dans le repère de pose (anneaux). */
  region: Polygon[];
  frame: Frame;
  kerf: number;
  reuseOffcuts: boolean;
}

export interface StraightOutput {
  pieces: LaidPiece[];
  boards: BoardUse[];
  offcuts: Offcut[];
  warnings: ParquetWarning[];
}

/** Bande d'un rang : [y0, y1] dans le repère de pose, et ses segments (composantes de bande ∩ surface). */
interface Row {
  index: number;
  y0: number;
  y1: number;
  segments: { a: number; b: number; shape: Component }[];
}

/** Morceau de lame posé dans un segment : abscisses dans le repère de pose et provenance. */
interface Placed {
  x: number;
  len: number;
  source: { board: number } | { offcut: string };
}

export function layStraight(input: StraightInput): StraightOutput {
  const { layout, region, kerf } = input;
  const board = layout.board!;
  const rules = layout.rules;
  const w = board.width;
  const rng = seededRandom(layout.seed);
  const maxLen = Math.max(...board.lengths);
  const warnings: ParquetWarning[] = [];

  const rows = buildRows(region, layout, input.frame);

  /* ---------- lames, chutes ---------- */
  const boards: BoardUse[] = [];
  let stock: Offcut[] = [];
  let offcutSeq = 0;
  /** Lame d'origine de chaque chute, y compris celles déjà consommées. */
  const stockHistory = new Map<string, number>();
  const drawLength = (): number => {
    if (board.lengths.length === 1 || !board.lengthMix) return board.lengths[0]!;
    let t = rng();
    for (let i = 0; i < board.lengths.length; i++) {
      t -= board.lengthMix[i]!;
      if (t < 0) return board.lengths[i]!;
    }
    return board.lengths.at(-1)!;
  };
  const newBoard = (length = drawLength()): BoardUse => {
    const b: BoardUse = { index: boards.length, variant: null, length, pieces: [] };
    boards.push(b);
    return b;
  };
  /** Reste d'une coupe : au stock s'il peut encore servir (≥ coupe mini). */
  const keep = (boardIndex: number, rest: number) => {
    if (!input.reuseOffcuts || rest < rules.minCutLength - EPS) return;
    const id = `${layout.id}-C-${String(++offcutSeq).padStart(2, '0')}`;
    stock.push({ id, board: boardIndex, variant: null, length: rest, polygon: null });
    stockHistory.set(id, boardIndex);
  };
  /** Prend `len` dans une chute (retirée du stock, son reste y revient) ; renvoie la provenance. */
  const fromOffcut = (o: Offcut, len: number): Placed['source'] => {
    stock = stock.filter((x) => x !== o);
    if (o.length - len > EPS) keep(o.board, o.length - len - kerf);
    return { offcut: o.id };
  };
  /** Coupe `len` dans une lame neuve de longueur `length` ; le reste va au stock. */
  const fromBoard = (len: number, length?: number): Placed['source'] => {
    // longueurs mixtes : la lame tirée doit pouvoir donner la pièce, sinon la plus courte qui le peut
    let l = length ?? drawLength();
    if (l < len - EPS) l = [...board.lengths].sort((x, y) => x - y).find((x) => x >= len - EPS) ?? maxLen;
    const b = newBoard(l);
    if (b.length - len > EPS) keep(b.index, b.length - len - kerf);
    return { board: b.index };
  };
  const sourceBoard = (s: Placed['source']): number => ('board' in s ? s.board : (stockHistory.get(s.offcut) ?? -1));

  /* ---------- décalage régulier : départ choisi pour tous les rangs ---------- */
  const regular = layout.pattern.kind === 'regular-stagger' ? layout.pattern.step : null;
  const L = maxLen;
  const originX = Math.min(...region.flatMap((r) => r.map((p) => p[0]))) + dot(layout.offset, input.frame.u);
  const phase0 = regular != null ? bestPhase(rows, L, regular, rules.minCutLength, originX) : 0;

  /* ---------- remplissage, rang par rang ---------- */
  const placedRows: { row: Row; seg: Row['segments'][number]; placed: Placed[] }[][] = [];
  let prevJoints: number[] = [];
  for (const row of rows) {
    const segs: (typeof placedRows)[number] = [];
    const joints: number[] = [];
    for (const seg of row.segments) {
      const placed =
        regular != null
          ? fillRegular(seg.a, seg.b, originX + phase0 + row.index * regular * L, L)
          : fillRandom(seg.a, seg.b, prevJoints);
      for (let i = 1; i < placed.length; i++) joints.push(placed[i]!.x);
      segs.push({ row, seg, placed });
    }
    // joints trop proches de ceux du rang précédent
    const close =
      joints.length && prevJoints.length ? Math.min(...joints.map((x) => nearest(x, prevJoints))) : Infinity;
    if (close < rules.minJointOffset - EPS)
      warnings.push({ code: 'joint-offset', row: row.index, offset: round2(close) });
    placedRows.push(segs);
    prevJoints = joints;
  }

  /** Coupe perdue : première pièce prise dans les chutes si elle respecte les règles, sinon lame neuve. */
  function fillRandom(a: number, b: number, prev: number[]): Placed[] {
    const S = b - a;
    const ok = (first: number, len: number) => {
      if (first >= S - EPS) return true;
      if (first < rules.minCutLength - EPS) return false;
      // joints du segment pour une lame de longueur fixe len
      let x = a + first;
      while (x < b - EPS) {
        if (nearest(x, prev) < rules.minJointOffset - EPS) return false;
        x += len;
      }
      const last = (S - first) % len;
      return last < EPS || len - last < EPS || last >= rules.minCutLength - EPS;
    };
    const out: Placed[] = [];
    let first: Placed | null = null;
    // 1. une chute qui convient (la plus longue d'abord : elle libère le plus de stock)
    if (input.reuseOffcuts)
      for (const o of [...stock].sort((p, q) => q.length - p.length)) {
        const len = Math.min(o.length, S);
        if (ok(len, maxLen)) {
          first = { x: a, len, source: fromOffcut(o, len) };
          break;
        }
      }
    // 2. sinon une lame neuve, entière si possible, coupée à la plus grande longueur qui respecte les règles
    if (!first) {
      const Lb = drawLength();
      let len = -1;
      for (let l = Math.min(Lb, S); l >= Math.min(rules.minCutLength, S) - EPS; l -= 1)
        if (ok(l, Lb)) {
          len = l;
          break;
        }
      // aucune longueur ne respecte le décalage des joints : coupe mini et dernière pièce seulement
      if (len < 0)
        for (let l = Math.min(Lb, S); l >= Math.min(rules.minCutLength, S) - EPS; l -= 1)
          if (ok(l, Lb) || okIgnoringJoints(l, Lb, S)) {
            len = l;
            break;
          }
      if (len < 0) len = Math.min(Lb, S);
      first = { x: a, len, source: fromBoard(len, Lb) };
    }
    out.push(first);
    fillRest(out, a + first.len, b, (need) => takeAny(need));
    return out;
  }

  function okIgnoringJoints(first: number, len: number, S: number): boolean {
    if (first >= S - EPS) return true;
    if (first < rules.minCutLength - EPS) return false;
    const last = (S - first) % len;
    return last < EPS || len - last < EPS || last >= rules.minCutLength - EPS;
  }

  /** Décalage régulier : joints imposés à originX + k × L ; chutes de la bonne longueur seulement. */
  function fillRegular(a: number, b: number, origin: number, len: number): Placed[] {
    const out: Placed[] = [];
    let x = a;
    let next = origin + Math.ceil((a + EPS - origin) / len) * len; // premier joint après a
    while (x < b - EPS) {
      const end = Math.min(next, b);
      const need = end - x;
      out.push({ x, len: need, source: takeExact(need, len) });
      x = end;
      next += len;
    }
    return out;
  }

  /** Lames entières puis dernière pièce ; la dernière fait au moins la coupe mini si on peut. */
  function fillRest(out: Placed[], start: number, b: number, takeLast: (need: number) => Placed['source']) {
    let x = start;
    while (x < b - EPS) {
      const remaining = b - x;
      const Lb = drawLength();
      if (remaining <= Lb + EPS) {
        out.push({ x, len: remaining, source: takeLast(remaining) });
        return;
      }
      // dernière pièce trop courte après cette lame : on coupe celle-ci pour laisser la coupe mini
      if (remaining - Lb < rules.minCutLength - EPS && remaining - rules.minCutLength >= rules.minCutLength - EPS) {
        const len = remaining - rules.minCutLength;
        out.push({ x, len, source: fromBoard(len, Lb) });
        x += len;
        continue;
      }
      out.push({ x, len: Lb, source: fromBoard(Lb, Lb) });
      x += Lb;
    }
  }

  /** Coupe perdue : plus petite chute assez longue, sinon lame neuve. */
  function takeAny(need: number): Placed['source'] {
    if (input.reuseOffcuts) {
      const o = stock.filter((c) => c.length >= need - EPS).sort((p, q) => p.length - q.length)[0];
      if (o) return fromOffcut(o, need);
    }
    return fromBoard(need);
  }

  /** Décalage régulier : une chute n'est prise que si elle donne la longueur voulue (± 2 mm). */
  function takeExact(need: number, len: number): Placed['source'] {
    if (need >= len - EPS) return fromBoard(need, len);
    if (input.reuseOffcuts) {
      const o = stock
        .filter((c) => c.length >= need - EPS && c.length <= need + REGULAR_TOLERANCE + EPS)
        .sort((p, q) => p.length - q.length)[0];
      if (o) return fromOffcut(o, need);
    }
    return fromBoard(need, len);
  }

  /* ---------- pièces dans le repère du plan ---------- */
  const pieces: LaidPiece[] = [];
  for (const segs of placedRows) {
    let n = 0;
    for (const { row, seg, placed } of segs) {
      for (const p of placed) {
        const id = `${layout.id}-R${pad(row.index)}-P${pad(n++)}`;
        const height = row.y1 - row.y0;
        const box: Polygon = [
          [p.x, row.y0],
          [p.x + p.len, row.y0],
          [p.x + p.len, row.y1],
          [p.x, row.y1],
        ];
        const shape = [seg.shape.outer, ...seg.shape.holes];
        const parts = components(intersection([box], shape));
        const ripped = height < w - 0.01;
        const sourceLength = 'board' in p.source ? boards[p.source.board]!.length : Infinity;
        const boardIndex = sourceBoard(p.source);
        // en général une seule partie ; plusieurs si la pièce enjambe une encoche du segment (rare)
        parts.forEach((part, k) => {
          const pid = k ? `${id}-${k}` : id;
          const ring = keyhole(part);
          const xs = part.outer.map((q) => q[0]);
          const len = parts.length === 1 ? p.len : Math.max(...xs) - Math.min(...xs);
          const isBox =
            parts.length === 1 && !part.holes.length && Math.abs(signedArea(ring)) >= p.len * height * 0.999;
          const cutType: LaidPiece['cutType'] = isBox
            ? !ripped && Math.abs(p.len - sourceLength) < EPS
              ? 'full'
              : 'straight'
            : !part.holes.length && convex(part.outer)
              ? 'angled'
              : 'complex';
          if (boardIndex >= 0) boards[boardIndex]!.pieces.push(pid);
          pieces.push({
            id: pid,
            room: '',
            row: row.index,
            line: null,
            polygon: ringFromFrame(input.frame, ring),
            variant: null,
            length: round2(len),
            cutType,
            cuts: cutsOf(ring, p.x, row.y0, p.len, w, sourceLength),
            source: p.source,
            ripped,
          });
          if (len < rules.minCutLength - EPS) warnings.push({ code: 'cut-too-short', piece: pid, length: round2(len) });
        });
      }
    }
  }
  for (const r of rows)
    if (r.y1 - r.y0 < rules.minEdgeRowWidth - EPS && r.segments.length)
      warnings.push({ code: 'edge-row-narrow', room: '', width: round2(r.y1 - r.y0) });

  return { pieces, boards, offcuts: stock, warnings };
}

/* ---------- rangs ---------- */

/** Rangs de la surface : largeur de lame, équilibrés selon la règle, décalés du décalage manuel. */
function buildRows(region: Polygon[], layout: LayoutSpec, frame: Frame): Row[] {
  const w = layout.board!.width;
  const ys = region.flatMap((r) => r.map((p) => p[1]));
  const xs = region.flatMap((r) => r.map((p) => p[0]));
  const y0 = Math.min(...ys),
    y1 = Math.max(...ys);
  const x0 = Math.min(...xs) - 1,
    x1 = Math.max(...xs) + 1;
  const H = y1 - y0;
  const m = Math.floor(H / w + EPS);
  const rem = H - m * w;
  let start = y0;
  // dernier rang trop étroit (if-needed) ou toujours (always) : rangs de bord de même largeur
  if (rem > EPS && m >= 1 && (layout.rules.balanceEdgeRows === 'always' || rem < layout.rules.minEdgeRowWidth - EPS))
    start = y0 + (rem + w) / 2 - w;
  // décalage manuel en travers des rangs, ramené dans ]y0 − w, y0]
  const shift = toFrame(frame, layout.offset)[1];
  if (shift) {
    start += shift;
    start = y0 - ((((y0 - start) % w) + w) % w);
  }
  const rows: Row[] = [];
  for (let y = start; y < y1 - EPS; y += w) {
    const a = Math.max(y, y0),
      b = Math.min(y + w, y1);
    if (b - a < EPS) continue;
    const band: Polygon = [
      [x0, a],
      [x1, a],
      [x1, b],
      [x0, b],
    ];
    const comps = components(intersection([band], region));
    const segments = comps
      .map((shape) => {
        const px = shape.outer.map((p) => p[0]);
        return { a: Math.min(...px), b: Math.max(...px), shape };
      })
      .filter((s) => s.b - s.a > 0.5)
      .sort((p, q) => p.a - q.a);
    rows.push({ index: rows.length, y0: a, y1: b, segments });
  }
  return rows;
}

/**
 * Décalage régulier : origine des joints (dans ]0, L]) pour que les débuts et fins de rang respectent la coupe
 * mini ; à défaut, celle qui donne la plus grande des plus petites pièces. Recherche au millimètre.
 */
function bestPhase(rows: Row[], L: number, step: number, minCut: number, originX: number): number {
  let best = 0,
    bestScore = -Infinity;
  for (let phi = 0; phi < L; phi += 1) {
    let worst = Infinity;
    for (const row of rows) {
      const origin = originX + phi + row.index * step * L;
      for (const s of row.segments) {
        const firstJoint = origin + Math.ceil((s.a + EPS - origin) / L) * L;
        const first = Math.min(firstJoint, s.b) - s.a;
        const last = firstJoint >= s.b ? s.b - s.a : s.b - (origin + Math.floor((s.b - EPS - origin) / L) * L);
        worst = Math.min(worst, first, last);
      }
      if (worst <= bestScore) break;
    }
    if (worst > bestScore + EPS) {
      bestScore = worst;
      best = phi;
    }
    if (bestScore >= Math.min(minCut, L / 2) && worst >= minCut) break;
  }
  return best;
}

/* ---------- aides ---------- */

/** Coupes dans le repère de la lame : bouts coupés, coupe en largeur, coupes en biais (bords hors des rives). */
function cutsOf(ring: Polygon, x0: number, y0: number, len: number, w: number, sourceLength: number): Segment[] {
  const local = ring.map((p): Point => [p[0] - x0, p[1] - y0]);
  const out: Segment[] = [];
  for (let i = 0; i < local.length; i++) {
    const a = local[i]!,
      b = local[(i + 1) % local.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5) continue;
    const onEdge = (k: 0 | 1, v: number) => Math.abs(a[k] - v) < 0.01 && Math.abs(b[k] - v) < 0.01;
    // rives de la lame et bout d'usine (départ)
    if (onEdge(1, 0) || onEdge(1, w) || onEdge(0, 0)) continue;
    if (onEdge(0, len) && Math.abs(len - sourceLength) < EPS) continue;
    out.push([
      [round2(a[0]), round2(a[1])],
      [round2(b[0]), round2(b[1])],
    ]);
  }
  return out;
}

function convex(r: Polygon): boolean {
  let sign = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!,
      b = r[(i + 1) % r.length]!,
      c = r[(i + 2) % r.length]!;
    const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(z) < 1e-6) continue;
    if (sign && Math.sign(z) !== sign) return false;
    sign = Math.sign(z);
  }
  return true;
}

const nearest = (x: number, xs: number[]) => xs.reduce((m, y) => Math.min(m, Math.abs(x - y)), Infinity);
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1];
const pad = (n: number) => String(n).padStart(2, '0');
const round2 = (v: number) => Math.round(v * 100) / 100;
