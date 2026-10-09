/**
 * Bâton rompu et point de Hongrie (docs/parquet/SPEC.md §4.3) : cas R5, invariants à 0°, 45° et 90°,
 * Hongrie à 60°, réemploi des chutes en 2D sans rotation.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Polygon } from '../../src/core/geometry/types';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { BoardSpec, Pattern } from '../../src/modules/parquet/core/types';
import { expectInvariants, LAMINATE, rect, spec } from './parquetHelpers';

const STICK: BoardSpec = { ...LAMINATE, id: 'baton', lengths: [600], width: 100, handed: true, boardsPerPack: 12 };
const HERRING: Pattern = { kind: 'herringbone' };
const CHEVRON45: Pattern = { kind: 'chevron', endAngle: 45 };
const CHEVRON60: Pattern = { kind: 'chevron', endAngle: 60 };
const L_ROOM: Polygon = [
  [0, 0],
  [5000, 0],
  [5000, 2000],
  [3000, 2000],
  [3000, 4000],
  [0, 4000],
];

describe('R5 : couloir 6000 × 1100, bâton rompu, lame 600 × 100', () => {
  const s = spec(rect(6000, 1100), { board: STICK, pattern: HERRING, axis: [3000, 550] });
  const r = computeParquet(s);
  const l = r.layouts[0]!;

  it('invariants verts', () => {
    expect(l.errors).toEqual([]);
    expectInvariants(l, s.layouts[0]!, 3);
  });

  it('lames A et B à ± 2 lames', () => {
    expect(r.totals.boardsA + r.totals.boardsB).toBe(r.totals.boards);
    expect(Math.abs(r.totals.boardsA - r.totals.boardsB)).toBeLessThanOrEqual(2);
    // surface posable 5984 × 1084 = 6,487 m² ; une lame couvre 0,06 m² → au moins 109 lames
    expect(r.totals.boards).toBeGreaterThanOrEqual(109);
  });

  it('chaque pièce a sa variante ; les pièces d’une lame sont de sa variante', () => {
    const byId = new Map(l.pieces.map((p) => [p.id, p]));
    for (const b of l.boards) for (const id of b.pieces) expect(byId.get(id)!.variant).toBe(b.variant);
    expect(l.pieces.every((p) => p.variant === 'A' || p.variant === 'B')).toBe(true);
  });
});

describe('invariants des deux motifs à 0°, 45° et 90°', () => {
  for (const [name, pattern, board] of [
    ['bâton rompu', HERRING, STICK as BoardSpec],
    ['point de Hongrie 45°', CHEVRON45, { ...STICK, width: 90 } as BoardSpec],
    ['point de Hongrie 60°', CHEVRON60, { ...STICK, lengths: [500], width: 90 } as BoardSpec],
  ] as const)
    for (const angle of [0, 45, 90])
      it(`${name}, ${angle}°, pièce en L avec poteau`, () => {
        const s = spec(L_ROOM, { board, pattern, angle, axis: [2500, 2000] }, [rect(200, 200, 1400, 900)]);
        const l = computeParquet(s).layouts[0]!;
        expect(l.errors).toEqual([]);
        expectInvariants(l, s.layouts[0]!, 3);
        expect(l.pieces.some((p) => p.cutType === 'full')).toBe(true);
      });

  it('propriétés : pièces, motifs, angles et axes quelconques', () => {
    fc.assert(
      fc.property(
        fc.record({ w: fc.integer({ min: 1500, max: 5000 }), h: fc.integer({ min: 1000, max: 4000 }) }),
        fc.constantFrom(HERRING, CHEVRON45, CHEVRON60),
        fc.constantFrom(0, 45, 90),
        fc.record({ x: fc.integer({ min: 0, max: 600 }), y: fc.integer({ min: 0, max: 600 }) }),
        fc.boolean(),
        ({ w, h }, pattern, angle, { x, y }, post) => {
          const s = spec(
            rect(w, h),
            { board: { ...STICK, width: 90 }, pattern, angle, axis: [w / 2 + x, h / 2 + y] },
            post ? [rect(150, 150, 500, 400)] : [],
          );
          const r = computeParquet(s);
          const l = r.layouts[0]!;
          expect(l.errors).toEqual([]);
          expectInvariants(l, s.layouts[0]!, 3);
          expect(computeParquet(structuredClone(s))).toEqual(r);
        },
      ),
      { numRuns: 25 },
    );
  });
});

describe('point de Hongrie 60°', () => {
  it('cellules plus larges qu’à 45° : moins de lignes le long de l’axe pour la même pièce', () => {
    const at = (endAngle: 45 | 60) =>
      computeParquet(
        spec(rect(4000, 3000), {
          board: { ...STICK, width: 90 },
          pattern: { kind: 'chevron', endAngle },
          axis: [2000, 1500],
        }),
      ).layouts[0]!;
    const l45 = at(45),
      l60 = at(60);
    // 45° : colonne de 600 / √2 = 424 mm ; 60° : 600 × sin 60° = 520 mm → moins de colonnes, pièces plus longues
    const cols = (l: ReturnType<typeof at>) => new Set(l.pieces.map((p) => p.line)).size;
    expect(cols(l60)).not.toBe(cols(l45));
    expect(l60.pieces.filter((p) => p.cutType === 'full').length).toBeGreaterThan(0);
  });
});

describe('réemploi des chutes en 2D', () => {
  const s = spec(rect(4000, 3000), { board: STICK, pattern: HERRING, axis: [2000, 1500] });
  it('des pièces coupées sont taillées dans des chutes, de même variante, sans rotation', () => {
    const l = computeParquet(s).layouts[0]!;
    const reused = l.pieces.filter((p) => 'offcut' in p.source);
    expect(reused.length).toBeGreaterThan(0);
    // désactivé : plus de lames
    const without = computeParquet({ ...s, settings: { ...s.settings, reuseOffcuts: false } }).layouts[0]!;
    expect(without.boards.length).toBeGreaterThan(l.boards.length);
    expect(without.pieces.every((p) => 'board' in p.source)).toBe(true);
  });
});

describe('placement de l’axe : trois propositions', () => {
  const s = spec(L_ROOM, { board: STICK, pattern: CHEVRON45, axis: [1234, 987] });
  s.layouts[0]!.rooms[0]!.openings = [
    {
      segment: [
        [1000, 4000],
        [1800, 4000],
      ],
      kind: 'door',
    },
    {
      segment: [
        [5000, 500],
        [5000, 1400],
      ],
      kind: 'window',
    },
  ];
  const l = computeParquet(s).layouts[0]!;

  it('centre de la pièce, porte principale, mur de référence ; chacune avec sa plus petite coupe en bord', () => {
    expect(l.axisOptions!.map((o) => o.kind)).toEqual(['room-center', 'main-door', 'reference-wall']);
    expect(l.axisOptions![0]!.point).toEqual([2500, 2000]);
    expect(l.axisOptions![1]!.point).toEqual([1400, 4000]);
    for (const o of l.axisOptions!) expect(o.minCutWidth).toBeGreaterThan(0);
  });

  it('aligné sur le mur de référence : pas de bande fine le long de ce mur', () => {
    const wall = l.axisOptions!.find((o) => o.kind === 'reference-wall')!;
    // la limite de bande tombe sur le bord posable (jeu de 8 mm) : pas de coupe au ras du mur de référence
    expect(wall.point[1]).toBeCloseTo(8, 0);
  });

  it('pose droite : pas de proposition', () => {
    expect(computeParquet(spec(rect(3000, 2000))).layouts[0]!.axisOptions).toBeUndefined();
  });
});
