/**
 * Moteur du parquet (docs/parquet/SPEC.md §4) : surface posable, pose de chaque pose, totaux, empreinte.
 * Déterministe : même entrée → même résultat. En P1 : pose droite seulement.
 */
import { difference, offset, regionArea, union } from '../../../core/geometry/boolean';
import { pointInPolygon, signedArea } from '../../../core/geometry/polygon';
import type { Polygon } from '../../../core/geometry/types';
import { fingerprint } from '../../../core/hash';
import { selfIntersecting } from '../../../core/plan/validate';
import { layingFrame, ringFromFrame, ringToFrame } from './frame';
import { axisOptions } from './axis';
import { layPattern } from './patterned';
import { layStraight } from './straight';
import type { LayoutResult, LayoutSpec, ParquetError, ParquetResult, ParquetSpec } from './types';

/** Garde-fou : au-delà, le calcul est refusé (SPEC §6). */
export const MAX_PIECES = 20000;

export function computeParquet(spec: ParquetSpec): ParquetResult {
  const layouts = spec.layouts.map((l) => computeLayout(l, spec));
  const pieces = layouts.flatMap((l) => l.pieces);
  const boards = layouts.flatMap((l) => l.boards);
  const widthOf = new Map(spec.layouts.map((l) => [l.id, l.board?.width ?? 0]));
  const boardArea = layouts.reduce(
    (t, l) => t + l.boards.reduce((s, b) => s + b.length * (widthOf.get(l.id) ?? 0), 0),
    0,
  );
  const pieceArea = pieces.reduce((t, p) => t + Math.abs(signedArea(p.polygon)), 0);
  return {
    layouts,
    skirting: { bars: 0, cuts: [], offcuts: [] },
    totals: {
      area: layouts.reduce((t, l) => t + regionArea(l.layable), 0) / 1e6,
      boards: boards.length,
      boardsA: boards.filter((b) => b.variant === 'A').length,
      boardsB: boards.filter((b) => b.variant === 'B').length,
      wastePct: boardArea > 0 ? Math.round(((boardArea - pieceArea) / boardArea) * 1000) / 10 : 0,
      cuts: pieces.filter((p) => p.cutType !== 'full').length,
    },
    hash: fingerprint(spec),
  };
}

function empty(l: LayoutSpec, errors: ParquetError[], layable: Polygon[] = []): LayoutResult {
  return { id: l.id, layable, pieces: [], boards: [], offcuts: [], thresholds: [], warnings: [], errors };
}

function computeLayout(l: LayoutSpec, spec: ParquetSpec): LayoutResult {
  if (!l.board) return empty(l, [{ code: 'missing-board' }]);
  const invalid = l.rooms.filter((r) => r.outline.length < 3 || selfIntersecting(r.outline) || !signedArea(r.outline));
  if (invalid.length)
    return empty(
      l,
      invalid.map((r) => ({ code: 'invalid-room', room: r.id })),
    );
  const maxLen = Math.max(...l.board.lengths);
  const motif = l.pattern.kind === 'herringbone' || l.pattern.kind === 'chevron';
  // décalage des joints entre rangs : règle de la pose droite seulement
  if (!motif && l.rules.minCutLength + l.rules.minJointOffset > maxLen)
    return empty(l, [{ code: 'board-too-short-for-rules' }]);

  const layable = layableSurface(l);
  if (!layable.length)
    return empty(
      l,
      l.rooms.map((r) => ({ code: 'invalid-room', room: r.id })),
    );
  const meanLen = l.board.lengths.reduce((t, x) => t + x, 0) / l.board.lengths.length;
  const estimate = Math.ceil((regionArea(layable) / (meanLen * l.board.width)) * 1.2);
  if (estimate > MAX_PIECES) return empty(l, [{ code: 'too-many-pieces', estimate }], layable);

  const opts = { kerf: spec.settings.kerf, reuseOffcuts: spec.settings.reuseOffcuts };
  const options = motif ? axisOptions(l, layable) : undefined;
  let out;
  if (options) {
    // proposition choisie ; « porte principale » sans porte : centre de la pièce
    const axis = typeof l.axis === 'string' ? (options.find((o) => o.kind === l.axis) ?? options[0]!).point : l.axis;
    out = layPattern({ layout: { ...l, axis }, layable, ...opts });
  } else {
    const frame = layingFrame(l.referenceDirection, l.angle);
    out = layStraight({ layout: l, region: layable.map((r) => ringToFrame(frame, r)), frame, ...opts });
  }

  // pièce de chaque élément : celle qui contient son centre
  const roomOf = (poly: Polygon) => {
    const c = centre(poly);
    return l.rooms.find((r) => pointInPolygon(c, r.outline))?.id ?? l.rooms[0]!.id;
  };
  for (const p of out.pieces) p.room = roomOf(p.polygon);
  const warnings = out.warnings.map((w) => (w.code === 'edge-row-narrow' ? { ...w, room: l.rooms[0]!.id } : w));

  return {
    id: l.id,
    layable,
    pieces: out.pieces,
    boards: out.boards,
    offcuts: out.offcuts,
    thresholds: [],
    ...(options ? { axisOptions: options } : {}),
    warnings,
    errors: [],
  };
}

/**
 * Surface posable (SPEC §4.1) : chaque pièce réduite du jeu périphérique, moins ses obstacles agrandis du jeu,
 * puis réunion des pièces de la pose (les passages et les seuils arrivent en P3).
 */
export function layableSurface(l: LayoutSpec): Polygon[] {
  const gap = l.rules.expansionGap;
  let all: Polygon[] = [];
  for (const r of l.rooms) {
    const inner = offset([oriented(r.outline)], -gap);
    const holes = r.obstacles.flatMap((o) => offset([oriented(o)], gap));
    all = union(all, holes.length ? difference(inner, holes) : inner);
  }
  return all;
}

/** Contour dans le sens attendu (aire signée > 0). */
const oriented = (p: Polygon): Polygon => (signedArea(p) < 0 ? [...p].reverse() : p);

function centre(p: Polygon): [number, number] {
  // centre de la boîte : toujours dans une pièce de lame rectangulaire ou trapézoïdale
  const xs = p.map((q) => q[0]),
    ys = p.map((q) => q[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

export { ringFromFrame };
