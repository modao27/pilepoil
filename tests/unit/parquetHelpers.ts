/** Aides des tests du parquet : entrées types et vérification des invariants (docs/parquet/SPEC.md §4.7). */
import { expect } from 'vitest';
import { intersection, regionArea, union } from '../../src/core/geometry/boolean';
import { signedArea } from '../../src/core/geometry/polygon';
import type { Polygon } from '../../src/core/geometry/types';
import { DEFAULT_ACCESSORIES, RULES_BY_KIND } from '../../src/modules/parquet/core/defaults';
import type {
  BoardSpec,
  LayoutResult,
  LayoutSpec,
  ParquetResult,
  ParquetSpec,
} from '../../src/modules/parquet/core/types';

export const LAMINATE: BoardSpec = {
  id: 'stratifie',
  lengths: [1285],
  lengthMix: null,
  width: 192,
  thickness: 8,
  handed: false,
  boardsPerPack: 9,
};

export const rect = (w: number, h: number, x = 0, y = 0): Polygon => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Une pose sur une pièce, stratifié, coupe perdue, règles du stratifié (jeu 8 mm). */
export function spec(outline: Polygon, o: Partial<LayoutSpec> = {}, obstacles: Polygon[] = []): ParquetSpec {
  return {
    layouts: [
      {
        id: 'L1',
        rooms: [{ id: 'R', outline, obstacles, openings: [] }],
        passages: [],
        board: LAMINATE,
        pattern: { kind: 'random-stagger' },
        angle: 0,
        referenceDirection: [1, 0],
        axis: [0, 0],
        offset: [0, 0],
        method: 'floating',
        rules: { ...RULES_BY_KIND.laminate },
        breaks: [],
        zone: [],
        seed: 1,
        ...o,
      },
    ],
    settings: { reuseOffcuts: true, kerf: 3, marginPct: 5 },
    accessories: DEFAULT_ACCESSORIES,
  };
}

const area = (p: Polygon) => Math.abs(signedArea(p));

/** Invariants du §4.7 sur une pose (les règles : respectées ou alerte correspondante). */
export function expectInvariants(l: LayoutResult, s: LayoutSpec, kerf: number): void {
  const layable = regionArea(l.layable);
  expect(layable).toBeGreaterThan(0);
  // aires : somme des pièces = surface posable (< 0,1 %)
  const sum = l.pieces.reduce((t, p) => t + area(p.polygon), 0);
  expect(Math.abs(sum - layable) / layable).toBeLessThan(1e-3);
  // aucun chevauchement : l'union des pièces a la même aire que leur somme
  const all = l.pieces.reduce<Polygon[]>((u, p) => union(u, [p.polygon]), []);
  expect(Math.abs(regionArea(all) - sum) / sum).toBeLessThan(1e-3);
  // aucune pièce hors de la surface posable
  for (const p of l.pieces) {
    // tolérance : 0,1 % ou 5 mm² (arrondi des booléens au 1/100 mm, sensible sur les toutes petites pièces)
    const outside = area(p.polygon) - regionArea(intersection([p.polygon], l.layable));
    expect(outside, p.id).toBeLessThan(Math.max(area(p.polygon) * 1e-3, 5));
  }
  // identifiants uniques
  expect(new Set(l.pieces.map((p) => p.id)).size).toBe(l.pieces.length);
  // chaque pièce tient dans sa lame ; somme des pièces d'une lame ≤ aire de la lame (SPEC §4.7). Une pièce qui
  // enjambe un petit obstacle donne deux bandes taillées dans le même morceau de lame : l'aire les compte juste.
  const byId = new Map(l.pieces.map((p) => [p.id, p]));
  const width = s.board!.width;
  for (const b of l.boards) {
    const pieces = b.pieces.map((id) => byId.get(id)!);
    expect(pieces.every(Boolean)).toBe(true);
    const used = pieces.reduce((t, p) => t + area(p.polygon), 0);
    // arrondi des booléens au 1/100 mm sur des pièces tournées : 1e-4
    expect(used, `lame ${b.index}`).toBeLessThanOrEqual(b.length * width * (1 + 1e-4));
    // en longueur (pose droite) : morceaux distincts et traits de scie ; en 2D (motifs), l'aire suffit
    if (pieces.some((p) => p.row == null)) continue;
    const runs = new Map(pieces.map((p) => [p.id.replace(/-\d+$/, ''), p.length]));
    const len = [...runs.values()].reduce((t, x) => t + x, 0) + kerf * Math.max(0, runs.size - 1);
    expect(len, `lame ${b.index} (longueur)`).toBeLessThanOrEqual(b.length + 1e-6);
  }
  for (const p of l.pieces) {
    expect(p.length).toBeGreaterThan(0);
    if ('board' in p.source) expect(p.length).toBeLessThanOrEqual(l.boards[p.source.board]!.length + 0.02);
  }
  // règles : coupe mini respectée, sinon alerte cut-too-short pour la pièce
  const short = new Set(l.warnings.flatMap((w) => (w.code === 'cut-too-short' ? [w.piece] : [])));
  // (coupe mini : règle de la pose droite ; les motifs signalent les toutes petites pièces, tiny-piece)
  for (const p of l.pieces)
    if (p.row != null && p.length < s.rules.minCutLength - 1e-6)
      expect(short.has(p.id), `${p.id} ${p.length}`).toBe(true);
  // au moins une lame dès qu'il y a une surface
  expect(l.boards.length).toBeGreaterThanOrEqual(1);
}

export function rows(l: LayoutResult) {
  const out = new Map<number, LayoutResult['pieces']>();
  for (const p of l.pieces) out.set(p.row!, [...(out.get(p.row!) ?? []), p]);
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([, ps]) => ps);
}

/** Largeur d'un rang (étendue en y des pièces, pose à 0°). */
export function rowWidth(ps: LayoutResult['pieces']): number {
  const ys = ps.flatMap((p) => p.polygon.map((q) => q[1]));
  return Math.max(...ys) - Math.min(...ys);
}

/** Abscisses des joints intérieurs d'un rang (pose à 0°, de gauche à droite). */
export function joints(ps: LayoutResult['pieces']): number[] {
  const xs = ps
    .map((p) => [Math.min(...p.polygon.map((q) => q[0])), Math.max(...p.polygon.map((q) => q[0]))] as const)
    .sort((a, b) => a[0] - b[0]);
  return xs.slice(1).map((x) => x[0]);
}

export const totalBoards = (r: ParquetResult) => r.totals.boards;
