/**
 * Moteur du carrelage, surfaces de forme quelconque (docs/PLAN.md C1) : sans contour, rien ne change ; avec
 * contour (sol en L, poteau, mur en pente), chaque carreau est découpé par la région réelle.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { difference, intersection, regionArea, union } from '../../src/core/geometry/boolean';
import type { Polygon } from '../../src/core/geometry/types';
import { buildSurface } from '../../src/modules/carrelage/core/cutting/buildSurface';
import { planCuts } from '../../src/modules/carrelage/core/cutting/planCuts';
import type { Piece, SurfaceSpec } from '../../src/modules/carrelage/core/types';
import { surface, tileFor, zone } from './fixtures';

const rect = (w: number, h: number, x = 0, y = 0): Polygon => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
/** Trou (aire < 0) : rectangle parcouru dans l'autre sens. */
const hole = (w: number, h: number, x: number, y: number): Polygon => rect(w, h, x, y).reverse();

function build(s: SurfaceSpec): Piece[] {
  const r = buildSurface(s);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value.pieces;
}

/** Pièce en L 4000 × 3000 moins le coin bas droit 2000 × 1500, poteau 200 × 200. */
const L_ROOM: Polygon[] = [
  [
    [0, 0],
    [4000, 0],
    [4000, 1500],
    [2000, 1500],
    [2000, 3000],
    [0, 3000],
  ],
  hole(200, 200, 800, 900),
];

/**
 * Invariants d'une surface à contour, joint nul : les pièces couvrent exactement la région, sans chevauchement
 * ni débord ; une pièce entière est entièrement dans la région.
 */
function expectCovers(pieces: Piece[], region: Polygon[]) {
  const parts = pieces.flatMap((p) => p.parts ?? []);
  const total = parts.reduce((t, p) => t + regionArea([p]), 0);
  const cover = parts.reduce((u, p) => union(u, [p]), [] as Polygon[]);
  expect(Math.abs(regionArea(cover) - total)).toBeLessThan(total * 1e-4 + 50);
  expect(Math.abs(total - regionArea(region))).toBeLessThan(regionArea(region) * 1e-4 + 50);
  expect(regionArea(difference(cover, region))).toBeLessThan(50);
}

describe('surfaces à contour', () => {
  it('sans contour ou avec le rectangle entier : même résultat qu’aujourd’hui', () => {
    for (const s of [
      surface(),
      surface({ kind: 'floor', zones: [zone({ pattern: 'grid', angle: 45 })] }),
      surface({ zones: [zone({ pattern: 'herring' }, tileFor('herring'))] }),
    ]) {
      const a = build(s);
      expect(build({ ...s, outline: [rect(s.width, s.height)] })).toEqual(a);
    }
  });

  it('sol en L avec poteau : les carreaux couvrent la pièce exactement, rien sous le poteau', () => {
    const s = surface({ kind: 'floor', width: 4000, height: 3000, joint: 0, outline: L_ROOM });
    const pieces = build(s);
    expectCovers(pieces, L_ROOM);
    const post = rect(200, 200, 800, 900);
    for (const p of pieces)
      for (const q of p.parts ?? []) expect(regionArea(intersection([q], [post]))).toBeLessThan(1);
    // le coin retiré : aucun carreau
    for (const p of pieces)
      for (const q of p.parts ?? [])
        expect(regionArea(intersection([q], [rect(2000, 1500, 2000, 1500)]))).toBeLessThan(1);
    expect(pieces.some((p) => p.full)).toBe(true);
    expect(pieces.some((p) => !p.full)).toBe(true);
  });

  it('coupes le long du contour : apparentes, ou cachées si outlineHidden', () => {
    const s = surface({ kind: 'floor', width: 4000, height: 3000, outline: L_ROOM });
    const vis = build(s).reduce((t, p) => t + p.vis.length, 0);
    const hidden = build({ ...s, outlineHidden: true }).reduce((t, p) => t + p.vis.length, 0);
    expect(vis).toBeGreaterThan(hidden);
    // bords du rectangle cachés (hiddenEdges) et contour caché, poteau compris : aucune coupe apparente
    expect(hidden).toBe(0);
  });

  it('mur sous pente : carreaux coupés en biais, aucun au-dessus de la pente', () => {
    // mur 3000 × 2400, pente de 2400 à 1200 de haut (y vers le bas : le haut du mur descend vers la droite)
    const slope: Polygon = [
      [0, 0],
      [3000, 1200],
      [3000, 2400],
      [0, 2400],
    ];
    const s = surface({ joint: 0, outline: [slope] });
    const pieces = build(s);
    expectCovers(pieces, [slope]);
    const above: Polygon = [
      [0, 0],
      [3000, 0],
      [3000, 1200],
    ];
    for (const p of pieces)
      for (const q of p.parts ?? []) expect(regionArea(intersection([q], [above]))).toBeLessThan(1);
  });

  it('avec joint : rien hors du contour, découpe et réemploi des chutes possibles', () => {
    const s = surface({ kind: 'floor', width: 4000, height: 3000, joint: 3, outline: L_ROOM });
    const pieces = build(s);
    const parts = pieces.flatMap((p) => p.parts ?? []);
    const cover = parts.reduce((u, p) => union(u, [p]), [] as Polygon[]);
    expect(regionArea(difference(cover, L_ROOM))).toBeLessThan(50);
    const plan = planCuts(pieces, { margin: 10, reuseOffcuts: true, kerf: 3, minOffcut: 50 });
    expect(plan.groups.length).toBeGreaterThan(0);
  });

  it('propriétés : pièces en L de toutes tailles, motifs et angles', () => {
    fc.assert(
      fc.property(
        fc.record({
          w: fc.integer({ min: 1500, max: 5000 }),
          h: fc.integer({ min: 1200, max: 4000 }),
          cx: fc.integer({ min: 20, max: 80 }),
          cy: fc.integer({ min: 20, max: 80 }),
        }),
        fc.constantFrom('grid', 'half', 'third', 'herring', 'hex', 'basket'),
        fc.constantFrom(0, 30, 45, 90),
        ({ w, h, cx, cy }, p, angle) => {
          const x = Math.round((w * cx) / 100),
            y = Math.round((h * cy) / 100);
          const L: Polygon[] = [
            [
              [0, 0],
              [w, 0],
              [w, y],
              [x, y],
              [x, h],
              [0, h],
            ],
          ];
          const s = surface({
            kind: 'floor',
            width: w,
            height: h,
            joint: 0,
            outline: L,
            zones: [zone({ pattern: p, angle }, tileFor(p))],
          });
          expectCovers(build(s), L);
        },
      ),
      { numRuns: 30 },
    );
  });
});
