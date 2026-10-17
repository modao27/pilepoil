/** Niveaux de sol : pose continue refusée à travers une marche, démolition refusée, niveau gardé par les pièces dérivées. */
import { describe, expect, it } from 'vitest';
import { checkZone, continuablePoses, type CoverageRules, type Zone } from '../../src/core/coverage';
import { deriveSite, planAfter } from '../../src/core/plan/derive';
import type { Passage, Plan, Site } from '../../src/core/plan/types';
import { coverageText } from '../../src/ui/lib/coverageMessages';
import { rect } from './planFixtures';

const WOOD: CoverageRules = { surfaces: ['floor'], extent: 'connected-floors' };
const passage: Passage = { id: 'p', a: { room: 'a', opening: 'oa' }, b: { room: 'b', opening: 'ob' } };
const planOf = (fa?: number, fb?: number): Plan => ({
  rooms: [
    { ...rect('a', 4000, 3000), ...(fa != null ? { floor: fa } : {}) },
    { ...rect('b', 3000, 3000), ...(fb != null ? { floor: fb } : {}) },
  ],
  passages: [passage],
});
const zone = (id: string, room: string, pose = 'P'): Zone => ({ id, surface: { room, wall: null }, cuts: [], pose });
const cov = { zones: [zone('z1', 'a')], poses: [{ id: 'P', module: 'parquet', name: 'Séjour, sol' }] };

describe('pose continue et niveaux', () => {
  it('même niveau (ou niveaux absents) : la pose continue dans la pièce reliée', () => {
    expect(checkZone(planOf(), cov, zone('z2', 'b'), WOOD)).toBeNull();
    expect(checkZone(planOf(0, 0), cov, zone('z2', 'b'), WOOD)).toBeNull();
    expect(checkZone(planOf(100, 100), cov, zone('z2', 'b'), WOOD)).toBeNull();
    expect(continuablePoses(planOf(), cov, { room: 'b', wall: null }, 'parquet', WOOD)).toHaveLength(1);
  });

  it('sous 5 mm : sol continu', () => {
    expect(checkZone(planOf(0, 4), cov, zone('z2', 'b'), WOOD)).toBeNull();
  });

  it('une marche refuse la pose continue, dans les deux sens, avec sa hauteur', () => {
    expect(checkZone(planOf(0, -150), cov, zone('z2', 'b'), WOOD)).toEqual({ code: 'level-step', step: 150 });
    expect(checkZone(planOf(200, 0), cov, zone('z2', 'b'), WOOD)).toEqual({ code: 'level-step', step: 200 });
    expect(checkZone(planOf(0, 5), cov, zone('z2', 'b'), WOOD)).toEqual({ code: 'level-step', step: 5 });
    expect(continuablePoses(planOf(0, -150), cov, { room: 'b', wall: null }, 'parquet', WOOD)).toEqual([]);
  });

  it('le refus est dit en clair, en cm', () => {
    expect(coverageText({ code: 'level-step', step: 150 })).toBe(
      'Les deux sols ne sont pas au même niveau (marche de 15 cm) : posez chaque pièce séparément.',
    );
  });

  it('une pièce seule, ou une pose sur un seul sol, n’est jamais refusée pour un niveau', () => {
    expect(checkZone(planOf(0, -150), { zones: [], poses: cov.poses }, zone('z1', 'a'), WOOD)).toBeNull();
  });
});

describe('travaux et niveaux', () => {
  const a = rect('a', 3000, 3000);
  const b = { ...rect('b', 3000, 3000), origin: [3072, 0] as [number, number] };
  const site = (ra = a, rb = b): Site => ({
    existing: { rooms: [ra, rb], passages: [] },
    partitions: [],
    demolitions: [{ id: 'd1', room: 'a', wall: 'a-w1', from: 0, to: 3000 }],
  });

  it('démolir un mur entre deux pièces de même niveau : fusion', () => {
    expect(deriveSite(site()).issues).toEqual([]);
    expect(planAfter(site({ ...a, floor: 120 }, { ...b, floor: 120 })).rooms).toHaveLength(1);
  });

  it('démolir un mur entre deux niveaux différents : refusé, les deux pièces restent', () => {
    const s = site(a, { ...b, floor: -150 });
    expect(deriveSite(s).issues.map((i) => i.code)).toEqual(['demolition/level-mismatch']);
    expect(planAfter(s).rooms).toHaveLength(2);
  });

  it('une cloison qui coupe une pièce laisse chaque moitié au niveau de la pièce d’origine', () => {
    const s: Site = {
      existing: { rooms: [{ ...a, floor: -150 }], passages: [] },
      partitions: [{ id: 'c1', a: [1500, 0], b: [1500, 3000], thickness: 72, align: 'center', openings: [] }],
      demolitions: [],
    };
    const rooms = planAfter(s).rooms;
    expect(rooms).toHaveLength(2);
    for (const r of rooms) expect(r.floor).toBe(-150);
  });

  it('sans niveau, les pièces dérivées n’en ont pas non plus (comme avant)', () => {
    const s: Site = {
      existing: { rooms: [a], passages: [] },
      partitions: [{ id: 'c1', a: [1500, 0], b: [1500, 3000], thickness: 72, align: 'center', openings: [] }],
      demolitions: [],
    };
    for (const r of planAfter(s).rooms) expect('floor' in r).toBe(false);
  });
});
