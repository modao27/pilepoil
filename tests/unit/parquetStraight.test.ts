/**
 * Pose droite du parquet : cas de référence R1, R2, R3, R4, R6, R9 (docs/parquet/SPEC.md §4.8).
 * Calculs attendus faits à la main avant le code (ci-dessous).
 */
import { describe, expect, it } from 'vitest';
import { regionArea } from '../../src/core/geometry/boolean';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { expectInvariants, joints, LAMINATE, rect, rows, rowWidth, spec } from './parquetHelpers';

describe('R1 : pièce 4000 × 3000, lame 1285 × 192, jeu 8, coupe perdue, if-needed', () => {
  /*
   * Surface posable : contour réduit du jeu de 8 mm de chaque côté → 3984 × 2984 mm,
   *   soit 3984 × 2984 = 11 888 256 mm² = 11,888 m².
   * Lames parallèles au mur de référence (axe x, mur de 4 m). Les rangs s'empilent en y :
   *   2984 / 192 = 15,54 → 15 rangs entiers (15 × 192 = 2880) + 2984 − 2880 = 104 mm → 16 rangs.
   *   if-needed : 104 ≥ 50 (largeur mini de rang de bord) → pas de décalage, dernier rang de 104 mm
   *   (premier rang entier de 192 mm contre le mur du haut).
   * Lames : chaque rang fait 3984 mm ; 16 × 3984 = 63 744 mm de rang ; 63 744 / 1285 = 49,6 lames au
   *   minimum (sans aucune perte). Les chutes de fin de rang ≥ 300 mm repartent en début de rang suivant ;
   *   pertes : traits de scie (3 mm), chutes < 300 mm, ajustements pour la coupe mini et le décalage des
   *   joints → attendu entre 50 et 54 lames (au plus 52 après optimisation, en P4).
   */
  const s = spec(rect(4000, 3000));
  const r = computeParquet(s);
  const l = r.layouts[0]!;

  it('surface posable 11,888 m²', () => {
    expect(regionArea(l.layable)).toBeCloseTo(11_888_256, -1);
    expect(r.totals.area).toBeCloseTo(11.888256, 4);
  });

  it('16 rangs, premier rang entier, dernier de 104 mm', () => {
    const rs = rows(l);
    expect(rs).toHaveLength(16);
    expect(rowWidth(rs[0]!)).toBeCloseTo(192, 1);
    expect(rowWidth(rs[15]!)).toBeCloseTo(104, 1);
    expect(rs.slice(0, 15).every((ps) => Math.abs(rowWidth(ps) - 192) < 0.1)).toBe(true);
    expect(rs[15]!.every((p) => p.ripped)).toBe(true);
    expect(rs[0]!.some((p) => p.ripped)).toBe(false);
  });

  it('entre 50 et 54 lames, invariants verts', () => {
    expect(r.totals.boards).toBeGreaterThanOrEqual(50);
    expect(r.totals.boards).toBeLessThanOrEqual(54);
    expectInvariants(l, s.layouts[0]!, 3);
    expect(l.errors).toEqual([]);
  });

  it('joints de rangs voisins décalés d’au moins 300 mm, sinon alerte', () => {
    const rs = rows(l);
    const flagged = new Set(l.warnings.flatMap((w) => (w.code === 'joint-offset' ? [w.row] : [])));
    for (let k = 1; k < rs.length; k++) {
      const a = joints(rs[k - 1]!),
        b = joints(rs[k]!);
      const min = Math.min(...b.map((x) => Math.min(...a.map((y) => Math.abs(x - y)))));
      if (min < 300 - 1e-6) expect(flagged.has(k), `rang ${k} : ${min}`).toBe(true);
    }
  });
});

describe('R2 : R1 avec équilibrage « always »', () => {
  /*
   * Hauteur posable 2984 mm, largeur de lame 192 : 15 rangs entiers + 104 mm.
   * always : premier et dernier rang de même largeur ; 14 rangs entiers au milieu (14 × 192 = 2688)
   *   → (2984 − 2688) / 2 = 148 mm pour chaque rang de bord. Toujours 16 rangs (1 + 14 + 1).
   */
  const s = spec(rect(4000, 3000), { rules: { ...spec(rect(1, 1)).layouts[0]!.rules, balanceEdgeRows: 'always' } });
  const l = computeParquet(s).layouts[0]!;

  it('premier et dernier rang de 148 mm, 16 rangs', () => {
    const rs = rows(l);
    expect(rs).toHaveLength(16);
    expect(rowWidth(rs[0]!)).toBeCloseTo(148, 1);
    expect(rowWidth(rs[15]!)).toBeCloseTo(148, 1);
    expectInvariants(l, s.layouts[0]!, 3);
  });
});

describe('R3 : R1 en décalage régulier ½', () => {
  /*
   * Décalage ½ : le motif avance d'une demi-lame à chaque rang, 1285 / 2 = 642,5 mm.
   * Les joints d'un rang sont à a + f + j × 1285 (f : longueur de la première pièce) ; ceux du rang suivant
   *   à a + f' + j × 1285 avec f' = f ± 642,5 → tout joint est à 642,5 mm (± trait de scie) du plus
   *   proche joint du rang voisin.
   * Longueur de rang 3984 = 3 × 1285 + 129. Pour une première pièce f ∈ ]129, 1285], la dernière fait
   *   (3984 − f) mod 1285 = 1414 − f. Coupe mini 300 : 300 ≤ f ≤ 1114. Le rang suivant a f' = f − 642,5
   *   (si f > 642,5) : 300 ≤ f' ≤ 1114 impose f ≥ 942,5. Donc un départ f ∈ [942,5 ; 1114] convient pour
   *   tous les rangs (les rangs pairs et impairs alternent f et f − 642,5) : aucune pièce < 300 mm, le
   *   départ s'ajuste pour y arriver.
   */
  const s = spec(rect(4000, 3000), { pattern: { kind: 'regular-stagger', step: 1 / 2 } });
  const l = computeParquet(s).layouts[0]!;

  it('joints des rangs voisins décalés de 642,5 mm (± trait de scie)', () => {
    const rs = rows(l);
    for (let k = 1; k < rs.length; k++) {
      const a = joints(rs[k - 1]!),
        b = joints(rs[k]!);
      for (const x of b) expect(Math.min(...a.map((y) => Math.abs(x - y)))).toBeCloseTo(642.5, -1);
      for (const x of b) expect(Math.abs(Math.min(...a.map((y) => Math.abs(x - y))) - 642.5)).toBeLessThanOrEqual(3);
    }
  });

  it('aucune pièce de moins de 300 mm, invariants verts', () => {
    expect(Math.min(...l.pieces.map((p) => p.length))).toBeGreaterThanOrEqual(300);
    expect(l.warnings.filter((w) => w.code === 'cut-too-short')).toEqual([]);
    expectInvariants(l, s.layouts[0]!, 3);
  });
});

describe('R4 : pièce en L 5000 × 4000 moins 2000 × 2000, poteau 200 × 200', () => {
  const L: [number, number][] = [
    [0, 0],
    [5000, 0],
    [5000, 2000],
    [3000, 2000],
    [3000, 4000],
    [0, 4000],
  ];
  const s = spec(L, {}, [rect(200, 200, 1400, 900)]);
  const l = computeParquet(s).layouts[0]!;

  it('invariants verts, aucun rang sans pièce', () => {
    expectInvariants(l, s.layouts[0]!, 3);
    const rs = rows(l);
    // 4000 − 2 × 8 = 3984 de haut → 21 rangs (20 × 192 = 3840 + 144)
    expect(rs).toHaveLength(21);
    expect(rs.every((ps) => ps.length > 0)).toBe(true);
    expect(l.errors).toEqual([]);
  });

  it('surface posable : L réduit du jeu, moins le poteau agrandi du jeu', () => {
    // L : 5000 × 4000 − 2000 × 2000 = 16 m² ; réduit de 8 mm : (4984 × 1984) + (2984 × 2000) ;
    // poteau agrandi de 8 mm de chaque côté : 216 × 216 (coins vifs)
    const expected = 4984 * 1984 + 2984 * 2000 - 216 * 216;
    expect(regionArea(l.layable)).toBeCloseTo(expected, -2);
    // les rangs qui traversent le poteau sont coupés en deux segments
    const cut = rows(l).filter((ps) => ps.some((p) => p.polygon.some((q) => Math.abs(q[0] - 1392) < 0.5)));
    expect(cut.length).toBeGreaterThan(0);
  });
});

describe('R6 : mur en biais à 30°', () => {
  // mur de droite incliné de 30° sur la verticale : de (4000, 0) à (4000 − 3000 × tan 30°, 3000)
  const x = 4000 - 3000 * Math.tan(Math.PI / 6);
  const s = spec([
    [0, 0],
    [4000, 0],
    [x, 3000],
    [0, 3000],
  ]);
  const l = computeParquet(s).layouts[0]!;

  it('pièces « angled » en bout de rang contre le mur en biais, invariants verts', () => {
    const angled = l.pieces.filter((p) => p.cutType === 'angled');
    expect(angled.length).toBeGreaterThanOrEqual(rows(l).length - 1);
    expectInvariants(l, s.layouts[0]!, 3);
  });
});

describe('R9 : lame 400 × 70, coupe mini 300, décalage mini 300', () => {
  // 300 + 300 = 600 > 400 : impossible de respecter les deux règles avec cette lame
  const s = spec(rect(3000, 2000), {
    board: { ...LAMINATE, lengths: [400], width: 70 },
    rules: { ...spec(rect(1, 1)).layouts[0]!.rules, minCutLength: 300, minJointOffset: 300 },
  });
  const l = computeParquet(s).layouts[0]!;

  it('erreur board-too-short-for-rules, aucune pièce', () => {
    expect(l.errors).toEqual([{ code: 'board-too-short-for-rules' }]);
    expect(l.pieces).toEqual([]);
  });
});

describe('erreurs', () => {
  it('lame introuvable, pièce invalide', () => {
    expect(computeParquet(spec(rect(3000, 2000), { board: null })).layouts[0]!.errors).toEqual([
      { code: 'missing-board' },
    ]);
    const crossed = computeParquet(
      spec([
        [0, 0],
        [3000, 2000],
        [3000, 0],
        [0, 2000],
      ]),
    ).layouts[0]!;
    expect(crossed.errors).toEqual([{ code: 'invalid-room', room: 'R' }]);
  });
});

describe('déterminisme', () => {
  it('même entrée → même résultat, même empreinte, mêmes identifiants', () => {
    const s = spec(rect(4000, 3000), { angle: 30 });
    const a = computeParquet(s),
      b = computeParquet(structuredClone(s));
    expect(b).toEqual(a);
    expect(a.hash).toMatch(/^[0-9a-f]{14}$/);
    expect(a.layouts[0]!.pieces[0]!.id).toBe('L1-R00-P00');
    expect(computeParquet(spec(rect(4000, 3000), { angle: 30, seed: 2 })).hash).not.toBe(a.hash);
  });
});
