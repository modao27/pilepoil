/**
 * Fiche de coupe (docs/parquet/SPEC.md §5) : pièces dans l'ordre de pose, par pose, pièce et rang (pose
 * droite) ou ligne le long de l'axe (motifs) ; lames entières qui se suivent regroupées. Pur ; le texte est
 * produit par l'interface.
 */
import { signedArea } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import type { LaidPiece, ParquetResult } from './types';

export type SheetItem =
  | { kind: 'full'; from: number; to: number; count: number; variant: 'A' | 'B' | null; ids: string[] }
  | {
      kind: 'cut';
      n: number;
      id: string;
      variant: 'A' | 'B' | null;
      /** Longueur à couper (repère lame). */
      length: number;
      /** Lame neuve gardée sur toute sa longueur (recoupée en largeur seulement, ou contournement). */
      wholeLength: boolean;
      /** Coupée en largeur : largeur posée. */
      width: number | null;
      cutType: LaidPiece['cutType'];
      /** Coupe en biais : longueurs des deux rives (la plus longue d'abord). */
      edges: [number, number] | null;
      source: LaidPiece['source'];
      /** Chute utilisée : la pièce qui l'a produite (groupe de la fiche et numéro). */
      origin: { group: number; n: number } | null;
      rest: { id: string; length: number }[];
    };

export interface SheetGroup {
  layout: string;
  room: string;
  /** row : rang de pose droite ; line : ligne le long de l'axe (motifs). */
  kind: 'row' | 'line';
  index: number;
  items: SheetItem[];
}

export function cuttingSheet(r: ParquetResult, roomOrder: Record<string, string[]> = {}): SheetGroup[] {
  const out: SheetGroup[] = [];
  for (const l of r.layouts) {
    const groups = new Map<string, { room: string; kind: 'row' | 'line'; index: number; pieces: LaidPiece[] }>();
    for (const p of l.pieces) {
      const kind = p.row != null ? 'row' : 'line';
      const index = p.row ?? p.line ?? 0;
      const key = `${p.room}|${kind}|${index}`;
      const g = groups.get(key) ?? { room: p.room, kind, index, pieces: [] };
      g.pieces.push(p);
      groups.set(key, g);
    }
    const rooms = roomOrder[l.id] ?? [];
    const rank = (room: string) => (rooms.includes(room) ? rooms.indexOf(room) : rooms.length);
    const sorted = [...groups.values()].sort(
      (a, b) => rank(a.room) - rank(b.room) || (a.room < b.room ? -1 : a.room > b.room ? 1 : 0) || a.index - b.index,
    );
    for (const g of sorted)
      out.push({
        layout: l.id,
        room: g.room,
        kind: g.kind,
        index: g.index,
        items: itemsOf(g.pieces, (i) => l.boards[i]?.length ?? Infinity),
      });
  }
  // provenance des chutes : la pièce dont la coupe les a mises au stock
  const producer = new Map<string, { group: number; n: number }>();
  out.forEach((g, gi) => {
    for (const it of g.items)
      if (it.kind === 'cut') for (const c of it.rest) producer.set(c.id, { group: gi, n: it.n });
  });
  for (const g of out)
    for (const it of g.items)
      if (it.kind === 'cut' && 'offcut' in it.source) it.origin = producer.get(it.source.offcut) ?? null;
  return out;
}

/** Numérotation dans l'ordre de pose (ordre des pièces du moteur) ; lames entières consécutives regroupées. */
function itemsOf(pieces: LaidPiece[], boardLength: (index: number) => number): SheetItem[] {
  const items: SheetItem[] = [];
  pieces.forEach((p, i) => {
    const n = i + 1;
    const last = items.at(-1);
    if (p.cutType === 'full') {
      if (last?.kind === 'full' && last.to === n - 1 && last.variant === p.variant) {
        last.to = n;
        last.count++;
        last.ids.push(p.id);
      } else items.push({ kind: 'full', from: n, to: n, count: 1, variant: p.variant, ids: [p.id] });
      return;
    }
    items.push({
      kind: 'cut',
      n,
      id: p.id,
      variant: p.variant,
      length: p.length,
      wholeLength: 'board' in p.source && Math.abs(p.length - boardLength(p.source.board)) < 0.01,
      width: p.ripped ? Math.round((Math.abs(signedArea(p.polygon)) / Math.max(p.length, 1e-6)) * 10) / 10 : null,
      cutType: p.cutType,
      edges: p.cutType === 'angled' ? rives(p.polygon) : null,
      source: p.source,
      origin: null,
      rest: p.rest ?? [],
    });
  });
  return items;
}

/**
 * Rives d'une pièce coupée en biais : dans le repère de sa plus longue arête, longueurs des arêtes les plus
 * hautes et les plus basses parallèles à celle-ci. null si la pièce n'en a pas deux.
 */
export function rives(poly: Polygon): [number, number] | null {
  let best = 0,
    u: Point = [1, 0];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length]!;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d > best) {
      best = d;
      u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    }
  });
  const v: Point = [-u[1], u[0]];
  const par = poly
    .map((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const d: Point = [b[0] - a[0], b[1] - a[1]];
      const len = Math.hypot(d[0], d[1]);
      const cross = Math.abs(d[0] * u[1] - d[1] * u[0]);
      return { len, h: a[0] * v[0] + a[1] * v[1], parallel: len > 1 && cross / len < 1e-3 };
    })
    .filter((e) => e.parallel)
    .sort((a, b) => a.h - b.h);
  if (par.length < 2) return null;
  const lo = par[0]!,
    hi = par.at(-1)!;
  if (Math.abs(hi.h - lo.h) < 1) return null;
  const pair = [Math.round(lo.len * 10) / 10, Math.round(hi.len * 10) / 10].sort((a, b) => b - a);
  return [pair[0]!, pair[1]!];
}
