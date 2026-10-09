/**
 * Moteur du parquet (docs/parquet/SPEC.md §4) : surface posable, pose de chaque pose, totaux, empreinte.
 * Déterministe : même entrée → même résultat. En P1 : pose droite seulement.
 */
import { difference, intersection, offset, regionArea, union } from '../../../core/geometry/boolean';
import { pointInPolygon, signedArea } from '../../../core/geometry/polygon';
import type { Polygon } from '../../../core/geometry/types';
import { fingerprint } from '../../../core/hash';
import { selfIntersecting } from '../../../core/plan/validate';
import { appliedThresholds, breakBand, fractioning, halfPlane, passageBand } from './fractioning';
import { layingFrame, ringFromFrame, ringToFrame } from './frame';
import { axisOptions } from './axis';
import { layPattern } from './patterned';
import { computeSkirting } from './skirting';
import { layStraight } from './straight';
import type { LayoutResult, LayoutSpec, ParquetError, ParquetResult, ParquetSpec } from './types';

/** Garde-fou : au-delà, le calcul est refusé (SPEC §6). */
export const MAX_PIECES = 20000;

/** `axisOptions: false` : sans les propositions d'axe des motifs (optimisation : axe déjà choisi). */
export function computeParquet(spec: ParquetSpec, o: { axisOptions?: boolean } = {}): ParquetResult {
  const layouts = spec.layouts.map((l) => computeLayout(l, spec, o.axisOptions ?? true));
  // poses qui se recouvrent (même pièce dans deux poses sans zones séparées) : alerte sur la seconde
  layouts.forEach((b, j) => {
    for (const a of layouts.slice(0, j))
      if (a.layable.length && b.layable.length && regionArea(intersection(a.layable, b.layable)) > 1e4)
        b.warnings.push({ code: 'layout-overlap', layout: a.id });
  });
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
    skirting: computeSkirting(spec),
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

function computeLayout(l: LayoutSpec, spec: ParquetSpec, proposals: boolean): LayoutResult {
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

  const base = layableSurface(l);
  const layable = cutSurface(l, base);
  if (!layable.length)
    return empty(
      l,
      l.rooms.map((r) => ({ code: 'invalid-room', room: r.id })),
    );
  const meanLen = l.board.lengths.reduce((t, x) => t + x, 0) / l.board.lengths.length;
  const estimate = Math.ceil((regionArea(layable) / (meanLen * l.board.width)) * 1.2);
  if (estimate > MAX_PIECES) return empty(l, [{ code: 'too-many-pieces', estimate }], layable);

  const frame = layingFrame(l.referenceDirection, l.angle);
  const opts = { kerf: spec.settings.kerf, reuseOffcuts: spec.settings.reuseOffcuts };
  const options = motif && (proposals || typeof l.axis === 'string') ? axisOptions(l, layable) : undefined;
  let out;
  if (motif) {
    // proposition choisie ; « porte principale » sans porte : centre de la pièce
    const axis = typeof l.axis === 'string' ? (options!.find((o) => o.kind === l.axis) ?? options![0]!).point : l.axis;
    out = layPattern({ layout: { ...l, axis }, layable, ...opts });
  } else {
    out = layStraight({ layout: l, region: layable.map((r) => ringToFrame(frame, r)), frame, ...opts });
  }

  // pièce de chaque élément : celle qui contient son centre
  const roomOf = (poly: Polygon) => {
    const c = centre(poly);
    return l.rooms.find((r) => pointInPolygon(c, r.outline))?.id ?? l.rooms[0]!.id;
  };
  for (const p of out.pieces) p.room = roomOf(p.polygon);
  const split = fractioning(l, layable, frame);
  const warnings = [
    ...out.warnings.map((w) => (w.code === 'edge-row-narrow' ? { ...w, room: l.rooms[0]!.id } : w)),
    ...split.warnings,
  ];

  return {
    id: l.id,
    layable,
    pieces: out.pieces,
    boards: out.boards,
    offcuts: out.offcuts,
    thresholds: [...appliedThresholds(l, base), ...split.thresholds],
    ...(options ? { axisOptions: options } : {}),
    warnings,
    errors: [],
  };
}

/**
 * Surface posable avant seuils (SPEC §4.1) : chaque pièce réduite du jeu périphérique, moins ses obstacles
 * agrandis du jeu, réunie aux autres pièces de la pose par la bande de chaque passage.
 */
export function layableSurface(l: LayoutSpec): Polygon[] {
  const gap = l.rules.expansionGap;
  let all: Polygon[] = [];
  for (const r of l.rooms) {
    const inner = offset([oriented(r.outline)], -gap);
    const holes = r.obstacles.flatMap((o) => offset([oriented(o)], gap));
    all = union(all, holes.length ? difference(inner, holes) : inner);
  }
  const outline = (id: string) => l.rooms.find((r) => r.id === id)?.outline;
  const bands = l.passages.map((p) => passageBand(p, outline(p.a), gap));
  return bands.length && all.length ? union(all, bands) : all;
}

/** Surface coupée le long des seuils posés (un jeu de chaque côté), puis limitée à la zone de la pose. */
function cutSurface(l: LayoutSpec, base: Polygon[]): Polygon[] {
  const gap = l.rules.expansionGap;
  let s = l.breaks.length
    ? difference(
        base,
        l.breaks.map((b) => breakBand(b, gap)),
      )
    : base;
  for (const b of l.zone) s = intersection(s, [halfPlane(b, gap)]);
  return s;
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
