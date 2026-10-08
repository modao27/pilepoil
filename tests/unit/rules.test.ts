import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/core/project';
import { groutKg } from '../../src/core/rules/consumables';
import { glueAdvice } from '../../src/core/rules/glue';
import { edgeLengths } from '../../src/core/shopping/items';
import { orderLine } from '../../src/core/shopping/order';
import type { ProductGroup, ProjectSpec, SurfaceSpec } from '../../src/core/types';
import { surface, zone } from './fixtures';

/** Carreau carré de S cm². */
const sq = (S: number): [number, number, number] => {
  const c = Math.sqrt(S * 100);
  return [S * 100, c, c];
};

describe('encollage (table DOMAIN)', () => {
  it.each<[number, 'wall' | 'floor', string, boolean]>([
    [50, 'wall', 'U3', false],
    [500, 'wall', 'U6', false],
    [1100, 'floor', 'U9', false],
    [1100, 'wall', 'U9', true],
    [2200, 'floor', 'U9', true],
    [3600, 'wall', 'U9', true],
    [3600, 'floor', 'U9-or-DL20', true],
    [3601, 'wall', 'DL20', true],
    [10000, 'floor', 'DL20', true],
  ])('%i cm² en %s : %s, double %s', (S, kind, notch, dbl) => {
    const g = glueAdvice(...sq(S), kind);
    expect(g.notch).toBe(notch);
    expect(g.double).toBe(dbl);
  });

  it('hors DTU au-delà de 3 600 cm² en mur et 10 000 cm² en sol', () => {
    expect(glueAdvice(...sq(3601), 'wall').notes).toContain('beyond-dtu');
    expect(glueAdvice(...sq(10000), 'floor').notes).toContain('large-format');
    expect(glueAdvice(...sq(10001), 'floor').notes).toContain('beyond-dtu');
  });

  it('consommation : base + 1,5 kg/m² en double encollage', () => {
    expect(glueAdvice(...sq(40), 'wall').kgPerM2).toBe(2);
    expect(glueAdvice(...sq(300), 'wall').kgPerM2).toBe(3);
    expect(glueAdvice(...sq(2000), 'wall').kgPerM2).toBe(6);
    expect(glueAdvice(...sq(5000), 'floor').kgPerM2).toBe(9);
  });

  it('format allongé (rapport ≥ 3, long ≥ 600) : double encollage', () => {
    const g = glueAdvice(600 * 80, 600, 80, 'wall');
    expect(g.double).toBe(true);
    expect(g.notes).toContain('elongated');
    expect(glueAdvice(600 * 150, 600, 150, 'floor').notes).toContain('elongated');
    expect(glueAdvice(450 * 100, 450, 100, 'wall').double).toBe(false);
  });
});

describe('joint', () => {
  it('(L + l)/(L × l) × épaisseur × joint × 1,6', () => {
    expect(groutKg(1, 300, 300, 10, 3, 0)).toBeCloseTo((600 / 90000) * 10 * 3 * 1.6, 12);
    expect(groutKg(1, 300, 300, 0, 3, 0)).toBeCloseTo((600 / 90000) * 9 * 3 * 1.6, 12);
    expect(groutKg(1, 300, 300, 10, 3, 10)).toBeCloseTo((600 / 90000) * 10 * 3 * 1.6 * 1.1, 12);
  });
});

describe('quantités', () => {
  const g = (o: Partial<ProductGroup>): ProductGroup => ({
    key: 'k',
    shape: 'rect',
    tileWidth: 600,
    tileHeight: 300,
    tileArea: 180000,
    label: { shape: 'rect', size: [600, 300] },
    color: '#fff',
    m2PerBox: 1.44,
    kind: 'main',
    zones: [],
    full: 20,
    cuts: [1, 2, 3, 4],
    tiles: [
      { n: 1, pieces: [1, 2] },
      { n: 2, pieces: [3, 4] },
    ],
    ...o,
  });

  it('nécessaires, à commander avec marge, cartons', () => {
    expect(orderLine(g({}), 10)).toEqual({ posed: 24, needed: 22, order: 25, m2: 4.5, boxes: 4, buyM2: 5.76 });
  });
  it('cartons pile : pas de carton en trop par erreur d’arrondi', () => {
    expect(orderLine(g({ full: 8, tiles: [], cuts: [] }), 0).boxes).toBe(1);
  });
  it('vendu à la pièce', () => {
    expect(orderLine(g({ m2PerBox: 0 }), 0)).toMatchObject({ boxes: 0, buyM2: 22 * 0.18 });
  });
});

describe('projet', () => {
  const proj = (surfaces: SurfaceSpec[], o: Partial<ProjectSpec> = {}): ProjectSpec => ({
    surfaces,
    settings: { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20, orientation: 'free' },
    room: null,
    ...o,
  });

  it('à commander ≥ nécessaires ≥ 1', () => {
    const R = computeProject(proj([surface({ width: 100, height: 100 })]));
    expect(R.metrics.needed).toBeGreaterThanOrEqual(1);
    expect(R.metrics.order).toBeGreaterThanOrEqual(R.metrics.needed);
  });

  it('une surface en erreur est ignorée dans les totaux', () => {
    const ok = computeProject(proj([surface()]));
    const R = computeProject(proj([surface(), surface({ width: 0 })]));
    expect(R.surfaces[1]!.ok).toBe(false);
    expect(R.metrics).toEqual(ok.metrics);
  });

  it('achats : carreaux, colle, joint par couleur, croisillons, primaire', () => {
    const R = computeProject(
      proj([
        surface({
          zones: [zone({ unit: 'rows', size: 2, groutColor: '#FFFFFF' }, { width: 300, height: 300 }), zone()],
        }),
      ]),
    );
    expect(R.shopping.map((s) => s.kind)).toEqual([
      'tile',
      'tile',
      'adhesive',
      'grout',
      'grout',
      'spacers',
      'clips',
      'primer',
    ]);
    expect(R.shopping.find((s) => s.kind === 'grout')!.key).toBe('joint|#ffffff');
  });

  it('profilés et silicone : angles, menuiseries, baignoire, pièce', () => {
    const wall = surface({
      height: 2000,
      corners: [
        { x: 1000, type: 'out', angle: 90, covered: true },
        { x: 2000, type: 'in', angle: 90, covered: false },
      ],
      openings: [
        {
          type: 'window',
          x: 0,
          sill: 1000,
          width: 1000,
          height: 500,
          covered: true,
          revealDepth: 0,
          reveals: { L: true, R: true, T: true, B: false },
          projection: 0,
        },
      ],
    });
    const floor = surface({ kind: 'floor', width: 3000, height: 2000 });
    const E = edgeLengths(proj([wall, floor], { room: { length: 3000, width: 2000, walls: { A: 0, floor: 1 } } }));
    expect(E.profile).toBeCloseTo(2 + 3, 9);
    expect(E.silicone).toBeCloseTo(2 + 3 + 10, 9);
  });
});
