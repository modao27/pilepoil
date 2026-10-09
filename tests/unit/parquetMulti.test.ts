/**
 * Plusieurs pièces et fractionnement (docs/parquet/SPEC.md §4.1, §4.4) : R7 (deux pièces reliées par une porte
 * étroite), R8 (pièce trop longue en pose flottante), seuils posés, poses séparées dans une même pièce.
 */
import { describe, expect, it } from 'vitest';
import { intersection, regionArea } from '../../src/core/geometry/boolean';
import type { Polygon } from '../../src/core/geometry/types';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { LaidPiece, LayoutResult, LayoutSpec, ParquetSpec } from '../../src/modules/parquet/core/types';
import { expectInvariants, rect, spec } from './parquetHelpers';

/**
 * R7 : deux pièces 4000 × 3000 côte à côte, mur de 72 mm entre elles, porte de 830 mm (y de 1000 à 1830).
 * Le passage est la bande 830 × 72 entre les deux portes ; seuil proposé au milieu du mur, x = 4036.
 */
function r7(o: Partial<LayoutSpec> = {}): ParquetSpec {
  const s = spec(rect(4000, 3000), o);
  const l = s.layouts[0]!;
  l.rooms = [
    {
      id: 'A',
      outline: rect(4000, 3000),
      obstacles: [],
      openings: [
        {
          segment: [
            [4000, 1000],
            [4000, 1830],
          ],
          kind: 'door',
        },
      ],
    },
    {
      id: 'B',
      outline: rect(4000, 3000, 4072, 0),
      obstacles: [],
      openings: [
        {
          segment: [
            [4072, 1830],
            [4072, 1000],
          ],
          kind: 'door',
        },
      ],
    },
  ];
  l.passages = [
    {
      id: 'P1',
      a: 'A',
      b: 'B',
      segment: [
        [4000, 1000],
        [4000, 1830],
      ],
      width: 830,
      depth: 72,
    },
  ];
  return s;
}

const inside = (p: LaidPiece, room: Polygon) => regionArea(intersection([p.polygon], [room]));

/** Pose droite à 0° : toutes les pièces d'un même rang ont le même bord haut et bas (hors rangs de bord). */
function expectRowsAligned(l: LayoutResult) {
  const byRow = new Map<number, Set<string>>();
  for (const p of l.pieces) {
    if (p.row == null || p.ripped) continue;
    const ys = p.polygon.map((q) => q[1]);
    const key = `${Math.min(...ys).toFixed(1)}:${Math.max(...ys).toFixed(1)}`;
    byRow.set(p.row, (byRow.get(p.row) ?? new Set()).add(key));
  }
  expect(byRow.size).toBeGreaterThan(10);
  for (const keys of byRow.values()) expect(keys.size).toBe(1);
}

describe('R7 : deux pièces 4000 × 3000 reliées par une porte de 830', () => {
  const s = r7();
  const l = computeParquet(s).layouts[0]!;
  const A = rect(4000, 3000),
    B = rect(4000, 3000, 4072, 0);

  it('une seule pose, invariants verts', () => {
    expect(l.errors).toEqual([]);
    expectInvariants(l, s.layouts[0]!, 3);
    // surface posable : deux pièces réduites du jeu + la bande du passage (830 − 2 × 8) × (72 + 2 × 8)
    expect(regionArea(l.layable)).toBeCloseTo(2 * 3984 * 2984 + 814 * 88, -2);
  });

  it('alerte narrow-passage et seuil proposé au milieu du mur', () => {
    expect(l.warnings).toContainEqual({ code: 'narrow-passage', passage: 'P1', width: 830 });
    expect(l.thresholds).toEqual([
      {
        segment: [
          [4036, 1000],
          [4036, 1830],
        ],
        passage: 'P1',
        status: 'proposed',
        reason: 'narrow-passage',
      },
    ]);
  });

  it('rangs continus : des lames traversent la porte, mêmes rangs des deux côtés', () => {
    const across = l.pieces.filter((p) => inside(p, A) > 1 && inside(p, B) > 1);
    expect(across.length).toBeGreaterThan(0);
    expectRowsAligned(l);
  });

  it('seuil posé : deux morceaux séparés par un jeu, même repère, plus d’alerte', () => {
    const t = r7({ breaks: [l.thresholds[0]!.segment] });
    const lb = computeParquet(t).layouts[0]!;
    expectInvariants(lb, t.layouts[0]!, 3);
    expect(lb.layable).toHaveLength(2);
    expect(lb.warnings.filter((w) => w.code === 'narrow-passage')).toEqual([]);
    expect(lb.thresholds).toEqual([{ segment: l.thresholds[0]!.segment, passage: 'P1', status: 'applied' }]);
    expect(lb.pieces.filter((p) => inside(p, A) > 1 && inside(p, B) > 1)).toEqual([]);
    // jeu de chaque côté du seuil : rien entre x = 4028 et x = 4044
    expect(regionArea(intersection(lb.layable, [rect(16, 3000, 4028, 0)]))).toBeLessThan(1);
    expectRowsAligned(lb);
  });

  it('pose collée : ni alerte ni seuil proposé', () => {
    const lg = computeParquet(r7({ method: 'glued' })).layouts[0]!;
    expect(lg.warnings.filter((w) => w.code === 'narrow-passage')).toEqual([]);
    expect(lg.thresholds).toEqual([]);
  });

  it('bâton rompu : le motif traverse la porte', () => {
    const t = r7({
      board: { id: 'b', lengths: [600], lengthMix: null, width: 100, thickness: 10, handed: true, boardsPerPack: 12 },
      pattern: { kind: 'herringbone' },
      axis: 'room-center',
    });
    const lh = computeParquet(t).layouts[0]!;
    expect(lh.errors).toEqual([]);
    expectInvariants(lh, t.layouts[0]!, 3);
    expect(lh.pieces.filter((p) => inside(p, A) > 1 && inside(p, B) > 1).length).toBeGreaterThan(0);
  });
});

describe('R8 : pièce 12000 × 5000 en stratifié flottant', () => {
  const s = spec(rect(12000, 5000));
  const l = computeParquet(s).layouts[0]!;

  it('alerte fractioning-needed, seuil proposé au milieu de la longueur', () => {
    expect(l.warnings).toContainEqual({ code: 'fractioning-needed', length: 11984, width: 4984 });
    expect(l.thresholds).toEqual([
      {
        segment: [
          [6000, 8],
          [6000, 4992],
        ],
        passage: null,
        status: 'proposed',
        reason: 'fractioning',
      },
    ]);
  });

  it('seuil posé : deux morceaux de 6 m, plus d’alerte', () => {
    const t = spec(rect(12000, 5000), { breaks: [l.thresholds[0]!.segment] });
    const lb = computeParquet(t).layouts[0]!;
    expectInvariants(lb, t.layouts[0]!, 3);
    expect(lb.layable).toHaveLength(2);
    expect(lb.warnings.filter((w) => w.code === 'fractioning-needed')).toEqual([]);
  });

  it('pose collée ou clouée : pas d’alerte', () => {
    for (const method of ['glued', 'nailed'] as const) {
      const lg = computeParquet(spec(rect(12000, 5000), { method })).layouts[0]!;
      expect(lg.warnings.filter((w) => w.code === 'fractioning-needed')).toEqual([]);
    }
  });

  it('à 90°, longueur et largeur prises dans le sens des lames', () => {
    const l90 = computeParquet(spec(rect(12000, 5000), { angle: 90 })).layouts[0]!;
    // lames en travers : 4984 de long, 11984 de large > 8000
    expect(l90.warnings).toContainEqual({ code: 'fractioning-needed', length: 4984, width: 11984 });
  });
});

describe('deux poses séparées dans une même pièce', () => {
  const line: [[number, number], [number, number]] = [
    [6000, 0],
    [6000, 5000],
  ];
  const two = (zoneA: LayoutSpec['zone'], zoneB: LayoutSpec['zone']): ParquetSpec => {
    const s = spec(rect(12000, 5000), { zone: zoneA });
    s.layouts.push({ ...s.layouts[0]!, id: 'L2', zone: zoneB, angle: 90 });
    return s;
  };

  it('chaque pose garde un côté de la ligne, avec un jeu de chaque côté', () => {
    const s = two([{ line, side: 1 }], [{ line, side: -1 }]);
    const [a, b] = computeParquet(s).layouts;
    expectInvariants(a!, s.layouts[0]!, 3);
    expectInvariants(b!, s.layouts[1]!, 3);
    expect(regionArea(intersection(a!.layable, b!.layable))).toBe(0);
    expect(regionArea(a!.layable) + regionArea(b!.layable)).toBeCloseTo(11984 * 4984 - 16 * 4984, -2);
    // seuil posé compté une fois (côté 1)
    expect(a!.thresholds).toEqual([
      {
        segment: [
          [6000, 8],
          [6000, 4992],
        ],
        passage: null,
        status: 'applied',
      },
    ]);
    expect(b!.thresholds).toEqual([]);
    expect([...a!.warnings, ...b!.warnings].filter((w) => w.code === 'layout-overlap')).toEqual([]);
  });

  it('deux poses sur la même surface : alerte layout-overlap', () => {
    const [, b] = computeParquet(two([], [])).layouts;
    expect(b!.warnings).toContainEqual({ code: 'layout-overlap', layout: 'L1' });
  });
});
