/** Module maçonnerie : moteur (murs composés), entrée moteur depuis le plan, réducteur, migration, achats. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Partition } from '../../src/core/plan/types';
import {
  computeMaconnerie,
  computeWall,
  courseCount,
  freeSegments,
  GLASS_BORDER,
  glassLayout,
  segmentPieces,
} from '../../src/modules/maconnerie/core/compute';
import { templateMaterials } from '../../src/modules/maconnerie/core/defaults';
import type { Material, WallSpec, ZoneSpec } from '../../src/modules/maconnerie/core/types';
import { reduce } from '../../src/modules/maconnerie/state/actions';
import {
  createMaconnerieData,
  MACONNERIE_ID,
  MACONNERIE_MIGRATIONS,
  MACONNERIE_SCHEMA,
  type MaconnerieData,
  type MasonryWall,
} from '../../src/modules/maconnerie/state/model';
import { shopping, summary } from '../../src/modules/maconnerie/state/module';
import { toSpec } from '../../src/modules/maconnerie/state/spec';
import { usesMaterial } from '../../src/modules/maconnerie/state/usage';
import { usesSystem } from '../../src/modules/cloisons/state/usage';
import { hydrate, siteOf, type Project } from '../../src/state/model';
import { rect } from './planFixtures';

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
  zones: [],
  holes: [],
  ...o,
});
const zone = (o: Partial<ZoneSpec> & { material: Material }): ZoneSpec => ({
  id: 'z',
  x: 0,
  y: 0,
  width: 1000,
  height: 1000,
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
    // 2 coupes par rang décalé (5 sous le dernier), plus tout le dernier rang recoupé en hauteur (7)
    expect(r.cut).toBe(17);
    expect(r.area).toBeCloseTo(7.5);
    expect(r.binderKg).toBeCloseTo(281.25);
    expect(r.weightKg).toBeCloseTo(1326);
    expect(r.alerts).toEqual([]);
  });

  it('une zone de briques de verre sur trois rangs : la base s’interrompt, la zone se compte à part', () => {
    const z = zone({ material: verre, x: 1000, y: 5 * 212, width: 1000, height: 3 * 212 - 12, joint: 15 });
    const r = computeWall(wall({ material: parpaing, zones: [z] }));
    // rangs 5 à 7 : 4 éléments au lieu de 6 (droit), 6 au lieu de 7 (décalés)
    expect(r.elements).toBe(74);
    expect(r.cut).toBe(21);
    expect(r.area).toBeCloseTo(7.5 - 0.624);
    expect(r.zones[0]).toMatchObject({ elements: 8, glass: { cols: 4, rows: 2 } });
    // 2 rangs de verre laissent 11,45 cm de bordure en hauteur
    expect(r.alerts.map((a) => [a.code, a.zone])).toContainEqual(['glass-not-cuttable', 'z']);
  });

  it('une porte interrompt les rangs qu’elle traverse', () => {
    const r = computeWall(wall({ material: parpaing, holes: [{ x: 1000, y: 0, width: 1000, height: 2120 - 12 }] }));
    // 10 rangs sur la porte : 4 au lieu de 6, 6 au lieu de 7 ; puis 2 rangs entiers
    expect(r.elements).toBe(78 - 5 * 2 - 5 * 1);
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

  it('alertes : zone hors du mur, zones qui se chevauchent, zone sur une porte', () => {
    const codes = computeWall(
      wall({
        material: parpaing,
        holes: [{ x: 0, y: 0, width: 900, height: 2000 }],
        zones: [
          zone({ id: 'a', material: parpaing, x: 2500, width: 1000 }),
          zone({ id: 'b', material: parpaing, x: 2600, width: 300 }),
          zone({ id: 'c', material: parpaing, x: 500, width: 300 }),
        ],
      }),
    ).alerts.map((a) => `${a.code}:${a.zone}`);
    expect(codes).toEqual(expect.arrayContaining(['zone-outside:a', 'zone-overlap:b', 'zone-on-opening:c']));
  });

  it('totaux par matériau, base et zones, marge arrondie au-dessus', () => {
    const r = computeMaconnerie({
      walls: [
        wall({ material: parpaing, zones: [zone({ material: verre, x: 1000, y: 1000, width: 950, height: 950 })] }),
        wall({ id: 'w2', material: parpaing, length: 1000, height: 200 }),
      ],
      margin: 0.05,
    });
    expect(r.totals.map((t) => t.material)).toEqual([parpaing.id, verre.id]);
    expect(r.totals[1]!.elements).toBe(r.walls[0]!.zones[0]!.elements);
    expect(r.totals[0]!.purchased).toBe(Math.ceil(r.totals[0]!.elements * 1.05));
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

  it('un rang couvre son segment sans un élément de trop, ni plus de coupes que d’éléments', () => {
    fc.assert(
      fc.property(span, dim, joint, fc.boolean(), (L, l, j, shifted) => {
        const pitch = l + j;
        const offset = shifted ? pitch / 2 : 0;
        const { pieces, cut } = segmentPieces(0, L, l, pitch, offset);
        expect(pieces * pitch).toBeGreaterThanOrEqual(L - pitch);
        expect(pieces * pitch).toBeLessThanOrEqual(L + 2 * pitch);
        expect(cut).toBeLessThanOrEqual(Math.min(2, pieces));
      }),
    );
  });

  it('segments libres : dans [0, L], sans chevauchement, hors des intervalles bloqués', () => {
    fc.assert(
      fc.property(span, fc.array(fc.tuple(fc.integer({ min: -500, max: 10500 }), dim), { maxLength: 5 }), (L, bs) => {
        const blocked = bs.map(([a, w]): [number, number] => [a, a + w]);
        const free = freeSegments(L, blocked);
        free.forEach(([s, e], i) => {
          expect(s).toBeGreaterThanOrEqual(0);
          expect(e).toBeLessThanOrEqual(L);
          if (i) expect(s).toBeGreaterThanOrEqual(free[i - 1]![1]);
          for (const [a, b] of blocked) expect(e <= a + 1e-6 || s >= b - 1e-6).toBe(true);
        });
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
        expect((g.cols + 1) * l + g.cols * j + 2 * GLASS_BORDER.min).toBeGreaterThan(L);
      }),
    );
  });

  it('une zone dans le mur : surfaces additives, au plus un élément de plus par rang', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: 0, max: 1500 }),
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 100, max: 1000 }),
        (x, y, w, h) => {
          const plain = computeWall(wall({ material: parpaing }));
          const r = computeWall(
            wall({ material: parpaing, zones: [zone({ material: parpaing, x, y, width: w, height: h })] }),
          );
          expect(r.area + r.zones[0]!.area).toBeCloseTo(plain.area, 6);
          // au plus un élément de plus par rang : celui que la zone coupe en deux morceaux
          expect(r.elements).toBeLessThanOrEqual(plain.elements + plain.courses);
          expect(r.cut).toBeLessThanOrEqual(r.elements);
        },
      ),
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

describe('cloisons maçonnées du plan', () => {
  const room = rect('a', 4000, 3000, { name: 'Séjour' });
  const cloison = (o: Partial<Partition> = {}): Partition => ({
    id: 'q',
    a: [2000, 0],
    b: [2000, 3000],
    thickness: 200,
    align: 'center',
    openings: [],
    construction: 'masonry',
    ...o,
  });
  const project = (partitions: Partition[], data: MaconnerieData | null = createMaconnerieData()): Project =>
    hydrate({
      schemaVersion: 4,
      id: 'p',
      name: 'Maison',
      createdAt: 0,
      updatedAt: 0,
      site: { ...siteOf({ rooms: [room], passages: [] }), partitions, demolitions: [] },
      zones: [],
      poses: [],
      modules: data ? { [MACONNERIE_ID]: { schemaVersion: MACONNERIE_SCHEMA, data } } : {},
    });
  const libraries = { materials: T };

  it('longueur, hauteur de la pièce, porte en trou, matériau de l’épaisseur par défaut', () => {
    const q = cloison({ openings: [{ id: 'o', kind: 'door', offset: 500, width: 900, height: 2040 }] });
    const r = toSpec(project([q]), libraries);
    if ('errors' in r) throw new Error(JSON.stringify(r.errors));
    const w = r.spec.walls[0]!;
    expect(w).toMatchObject({ id: 'q', length: 3000, height: room.height, joint: 12 });
    expect(w.material.thickness).toBe(200);
    expect(w.holes).toEqual([{ x: 500, y: 0, width: 900, height: 2040 }]);
    expect(w.name).toMatch(/^Cloison 1/);
  });

  it('une cloison en plaques n’est pas maçonnée ; une maçonnée n’est pas aux cloisons', () => {
    const p = project([cloison({ construction: undefined })]);
    expect(toSpec(p, libraries)).toEqual({ errors: [{ code: 'maconnerie/no-wall' }] });
    expect(usesSystem(project([cloison({ thickness: 72 })]), 'modele-72-48', { systems: [] })).toBe(false);
  });

  it('hauteur propre, zone sans matériau bloquante, matériau utilisé', () => {
    const d = createMaconnerieData();
    d.partitions.q = {
      material: verre.id,
      joint: null,
      zones: [{ id: 'z', x: 0, y: 0, width: 100, height: 100, material: null, joint: null }],
    };
    const p = project([cloison({ height: 1000 })], d);
    expect(toSpec(p, libraries)).toEqual({ errors: [{ code: 'maconnerie/zone-material', ref: 'q' }] });
    expect(usesMaterial(p, verre.id, libraries)).toBe(true);
    expect(usesMaterial(p, parpaing.id, libraries)).toBe(false);
    d.partitions.q.zones = [];
    const r = toSpec(project([cloison({ height: 1000 })], d), libraries);
    expect('spec' in r && r.spec.walls[0]!.height).toBe(1000);
  });
});

describe('données et achats de la maçonnerie', () => {
  const w: MasonryWall = {
    id: 'a',
    name: 'Mur',
    length: 3000,
    height: 2500,
    material: parpaing.id,
    joint: null,
    zones: [],
  };

  it('migration 1 → 2 : zones vides, pas de cloison', () => {
    const v1 = { walls: [{ id: 'a', name: 'Mur' }], settings: { margin: 0.05, binderBag: 25 }, prices: {} };
    expect(MACONNERIE_MIGRATIONS[2]!(v1)).toEqual({
      ...v1,
      partitions: {},
      walls: [{ id: 'a', name: 'Mur', zones: [] }],
    });
  });

  it('réducteur : murs, zones d’un mur saisi et d’une cloison, sans effet renvoie la même donnée', () => {
    let d = reduce(createMaconnerieData(), { type: 'maconnerie/wall/add', wall: w });
    expect(reduce(d, { type: 'maconnerie/wall/update', id: 'a', patch: { length: 3000 } })).toBe(d);
    d = reduce(d, { type: 'maconnerie/wall/update', id: 'a', patch: { length: 4000 } });
    expect(d.walls[0]!.length).toBe(4000);
    const z = { id: 'z', x: 0, y: 0, width: 500, height: 500, material: verre.id, joint: null };
    d = reduce(d, { type: 'maconnerie/zone/add', target: { wall: 'a' }, zone: z });
    d = reduce(d, { type: 'maconnerie/zone/update', target: { wall: 'a' }, id: 'z', patch: { x: 100 } });
    expect(d.walls[0]!.zones).toEqual([{ ...z, x: 100 }]);
    d = reduce(d, { type: 'maconnerie/zone/add', target: { partition: 'q' }, zone: z });
    d = reduce(d, { type: 'maconnerie/build/update', target: { partition: 'q' }, patch: { material: parpaing.id } });
    expect(d.partitions.q).toEqual({ material: parpaing.id, joint: null, zones: [z] });
    d = reduce(d, { type: 'maconnerie/zone/remove', target: { partition: 'q' }, id: 'z' });
    expect(d.partitions.q!.zones).toEqual([]);
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
