import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  computeMaconnerie,
  computeWall,
  courseCount,
  GLASS_BORDER,
  glassLayout,
  rowPieces,
} from '../../src/modules/maconnerie/core/compute';
import { templateMaterials } from '../../src/modules/maconnerie/core/defaults';
import type { Material, WallSpec } from '../../src/modules/maconnerie/core/types';
import { reduce } from '../../src/modules/maconnerie/state/actions';
import { createMaconnerieData, type MasonryWall } from '../../src/modules/maconnerie/state/model';
import { shopping, summary } from '../../src/modules/maconnerie/state/module';

const T = templateMaterials();
const byName = (n: string): Material => T.find((m) => m.name === n)!;
const parpaing = byName('Parpaing creux 20×20×50');
const verre = byName('Brique de verre 19×19×8');

const wall = (o: Partial<WallSpec> & { material: Material }): WallSpec => ({
  id: 'w',
  name: 'Mur',
  length: 3000,
  height: 2500,
  joint: o.material.laying.jointH.def,
  ...o,
});

describe('moteur maçonnerie : cas chiffrés', () => {
  it('parpaing 20×20×50, mur de 3 × 2,5 m, joint 12 mm, pose à demi-longueur', () => {
    const r = computeWall(wall({ material: parpaing }));
    expect(r.ok).toBe(true);
    expect(r.courses).toBe(12);
    // 6 rangs droits de 6 éléments, 6 rangs décalés de 7
    expect(r.elements).toBe(78);
    // 2 coupes par rang décalé, plus le dernier rang recoupé en hauteur
    expect(r.cut).toBe(19);
    expect(r.area).toBeCloseTo(7.5);
    expect(r.binderKg).toBeCloseTo(281.25);
    expect(r.weightKg).toBeCloseTo(1326);
    expect(r.alerts).toEqual([]);
  });

  it('briques de verre 19×19 : 95 cm donne 4 × 4 briques, bordures de 8 cm', () => {
    const r = computeWall(wall({ material: verre, length: 950, height: 950, joint: 10 }));
    expect(r.glass).toMatchObject({ cols: 4, rows: 4, borderX: 80, borderY: 80, reinforcement: 9500 });
    expect(r.elements).toBe(16);
    expect(r.cut).toBe(0);
    expect(r.alerts.map((a) => a.code)).toEqual(['binder-unknown']);
  });

  it('briques de verre : une ouverture de 1 m laisse 10,5 cm de bordure, on propose 87 cm', () => {
    const r = computeWall(wall({ material: verre, length: 1000, height: 950, joint: 10 }));
    const a = r.alerts.find((x) => x.code === 'glass-not-cuttable');
    expect(a?.params).toMatchObject({ cols: 4, width: 870 });
  });

  it('panneau de verre trop grand, joint hors plage, mur trop petit', () => {
    expect(computeWall(wall({ material: verre, length: 6000, height: 6000 })).alerts.map((a) => a.code)).toContain(
      'panel-area-exceeds-max',
    );
    expect(computeWall(wall({ material: parpaing, joint: 30 })).alerts.map((a) => a.code)).toContain(
      'joint-out-of-range',
    );
    const small = computeWall(wall({ material: verre, length: 200, height: 200 }));
    expect(small.ok).toBe(false);
    expect(small.alerts[0]?.code).toBe('too-small');
  });

  it('totaux par matériau, marge arrondie au-dessus', () => {
    const r = computeMaconnerie({
      walls: [wall({ material: parpaing }), wall({ id: 'w2', material: parpaing, length: 1000, height: 200 })],
      margin: 0.05,
    });
    expect(r.totals).toHaveLength(1);
    expect(r.totals[0]!.elements).toBe(80);
    expect(r.totals[0]!.purchased).toBe(84);
  });
});

describe('moteur maçonnerie : invariants', () => {
  const dim = fc.integer({ min: 50, max: 800 });
  const span = fc.integer({ min: 100, max: 10000 });
  const joint = fc.integer({ min: 0, max: 30 });

  it('les rangs couvrent la hauteur sans un rang de trop', () => {
    fc.assert(
      fc.property(span, dim, joint, (H, h, j) => {
        const n = courseCount(H, h, j);
        expect(n * (h + j)).toBeGreaterThanOrEqual(H + j - 1e-6);
        if (n > 1) expect((n - 1) * (h + j)).toBeLessThan(H + j);
      }),
    );
  });

  it('un rang couvre la longueur (décalage compris) sans un élément de trop', () => {
    fc.assert(
      fc.property(span, dim, joint, fc.boolean(), (L, l, j, shifted) => {
        const offset = shifted ? (l + j) / 2 : 0;
        const n = rowPieces(L, l, j, offset);
        expect(n * (l + j)).toBeGreaterThanOrEqual(L + offset + j - 1e-6);
        if (n > 1) expect((n - 1) * (l + j)).toBeLessThan(L + offset + j);
      }),
    );
  });

  it('panneau de verre : n briques + joints + 2 bordures = largeur, bordure au moins mini', () => {
    fc.assert(
      fc.property(span, span, dim, dim, joint, (L, H, l, h, j) => {
        const g = glassLayout(L, H, l, h, j);
        if (!g) return;
        expect(g.cols * l + (g.cols - 1) * j + 2 * g.borderX).toBeCloseTo(L, 6);
        expect(g.rows * h + (g.rows - 1) * j + 2 * g.borderY).toBeCloseTo(H, 6);
        expect(g.borderX).toBeGreaterThanOrEqual(GLASS_BORDER.min - 1e-6);
        // une brique de plus ne tiendrait pas
        expect((g.cols + 1) * l + g.cols * j + 2 * GLASS_BORDER.min).toBeGreaterThan(L);
      }),
    );
  });

  it('liant jamais négatif, croissant avec la surface ; ordre des murs sans effet', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(span, span), { minLength: 1, maxLength: 5 }), (dims) => {
        const walls = dims.map(([length, height], i) => wall({ id: `w${i}`, material: parpaing, length, height }));
        const a = computeMaconnerie({ walls, margin: 0.05 });
        const b = computeMaconnerie({ walls: [...walls].reverse(), margin: 0.05 });
        expect(a.totals[0]!.elements).toBe(b.totals[0]!.elements);
        expect(a.totals[0]!.binderKg).toBeCloseTo(b.totals[0]!.binderKg!, 6);
        for (const w of a.walls) expect(w.binderKg!).toBeGreaterThanOrEqual(0);
        const bigger = computeWall({ ...walls[0]!, length: walls[0]!.length + 100 });
        expect(bigger.binderKg!).toBeGreaterThan(a.walls[0]!.binderKg!);
      }),
    );
  });
});

describe('données et achats de la maçonnerie', () => {
  const w: MasonryWall = { id: 'a', name: 'Mur', length: 3000, height: 2500, material: parpaing.id, joint: null };

  it('réducteur : ajout, mise à jour, suppression, sans effet renvoie la même donnée', () => {
    let d = reduce(createMaconnerieData(), { type: 'maconnerie/wall/add', wall: w });
    expect(d.walls).toHaveLength(1);
    expect(reduce(d, { type: 'maconnerie/wall/update', id: 'a', patch: { length: 3000 } })).toBe(d);
    d = reduce(d, { type: 'maconnerie/wall/update', id: 'a', patch: { length: 4000 } });
    expect(d.walls[0]!.length).toBe(4000);
    d = reduce(d, { type: 'maconnerie/price', key: 'k', value: 2 });
    expect(d.prices).toEqual({ k: 2 });
    d = reduce(d, { type: 'maconnerie/wall/remove', id: 'a' });
    expect(d.walls).toEqual([]);
  });

  it('lignes d’achat : éléments, sacs de liant, fers des briques de verre', () => {
    const r = computeMaconnerie({
      walls: [wall({ material: parpaing }), wall({ id: 'v', material: verre, length: 950, height: 950, joint: 10 })],
      margin: 0.05,
    });
    const lines = shopping(r, { ...createMaconnerieData(), prices: { 'maconnerie:binder:mortier': 8 } });
    expect(lines.map((l) => [l.key, l.quantity])).toEqual([
      [`maconnerie:material:${parpaing.id}`, 82],
      [`maconnerie:material:${verre.id}`, 17],
      ['maconnerie:binder:mortier', 12],
      ['maconnerie:reinforcement', 10],
    ]);
    expect(lines[2]!.unitPrice).toBe(8);
    expect(summary(r).text).toBe('2 murs, 94 éléments');
  });
});
