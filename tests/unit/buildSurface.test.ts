import { describe, expect, it } from 'vitest';
import { buildSurface } from '../../src/modules/carrelage/core/cutting/buildSurface';
import { area, bbox, pointInPolygon } from '../../src/core/geometry/polygon';
import { PATTERNS } from '../../src/modules/carrelage/core/patterns/registry';
import type { OpeningSpec, Piece, Point, SurfaceSpec, ZoneStart } from '../../src/modules/carrelage/core/types';
import { expectSame } from '../parity/compare';
import { surface, tileFor, zone } from './fixtures';

function build(s: SurfaceSpec): Piece[] {
  const r = buildSurface(s);
  if (!r.ok) throw new Error(r.error.code);
  return r.value.pieces;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

const window: OpeningSpec = {
  type: 'window',
  x: 700,
  sill: 900,
  width: 800,
  height: 700,
  covered: true,
  revealDepth: 0,
  reveals: { L: true, R: true, T: true, B: false },
  projection: 0,
};

/** Combinaisons motif × angle × départ. */
const CASES: [string, number, ZoneStart][] = [];
for (const p of PATTERNS)
  for (const angle of [0, 30, 45, 90])
    for (const start of ['corner', 'tile', 'joint'] as const) {
      CASES.push([p.id, angle, start]);
    }

describe('invariants à joint 0', () => {
  it.each(CASES)('%s %i° %s : couverture exacte, sans chevauchement, ouverture libre', (pid, angle, start) => {
    const s = surface({
      width: 2100,
      height: 1500,
      joint: 0,
      openings: [{ ...window, sill: 400 }],
      zones: [zone({ pattern: pid as never, angle, start, offsetX: 37, offsetY: 11 }, tileFor(pid as never))],
    });
    const pieces = build(s);
    const holeArea = 800 * 700;
    const sum = pieces.reduce((t, p) => t + p.parts!.reduce((u, q) => u + area(q), 0), 0);
    expect(Math.abs(sum - (2100 * 1500 - holeArea)) / (2100 * 1500 - holeArea)).toBeLessThan(0.001);

    const parts = pieces.flatMap((p) => p.parts!);
    const r = rng(11);
    for (let n = 0; n < 200; n++) {
      const q: Point = [r() * 2100, r() * 1500];
      const hits = parts.filter((p) => pointInPolygon(q, p)).length;
      const inHole = q[0] > 700 && q[0] < 1500 && q[1] > 1500 - 400 - 700 && q[1] < 1500 - 400;
      expect(hits).toBe(inHole ? 0 : 1);
    }
  });
});

describe('pièces', () => {
  it.each(PATTERNS.map((p) => p.id))('%s : toute pièce rectangulaire tient dans le carreau', (pid) => {
    for (const p of build(surface({ zones: [zone({ pattern: pid, angle: 45 }, tileFor(pid))] }))) {
      expect(area(p.parts![0]!)).toBeLessThanOrEqual(p.tA * (1 + 1e-9));
      if (p.rect) {
        expect(Math.max(p.pw, p.ph)).toBeLessThanOrEqual(p.tW + 1e-6);
        expect(Math.min(p.pw, p.ph)).toBeLessThanOrEqual(p.tH + 1e-6);
      }
    }
  });

  it('pose droite sans coupe : toutes entières', () => {
    const pieces = build(surface({ width: 1203, height: 603, zones: [zone({ pattern: 'grid' })] }));
    expect(pieces).toHaveLength(4);
    expect(pieces.every((p) => p.full && !p.thin)).toBe(true);
  });

  it('bords d’usine requis côté carreaux voisins, pas sur le bord de zone', () => {
    const pieces = build(surface({ width: 1500, height: 300, zones: [zone({ pattern: 'grid' })] }));
    const last = pieces.find((p) => !p.full)!;
    expect(last.pw).toBeCloseTo(1500 - 2 * 603, 9);
    expect(last.req).toEqual({ L: true, R: false, T: false, B: false });
  });

  it('coupe apparente sur un bord de surface non caché', () => {
    const s = surface({ width: 1500, height: 300, zones: [zone({ pattern: 'grid' })] });
    expect(build(s).some((p) => p.vis.length)).toBe(false);
    s.hiddenEdges.R = false;
    expect(build(s).filter((p) => p.vis.length)).toHaveLength(1);
  });

  it('une prise marque la pièce à percer sans retirer de carrelage', () => {
    const socket: OpeningSpec = { ...window, type: 'socket', x: 100, sill: 2000, width: 80, height: 80 };
    const pieces = build(surface({ openings: [socket], zones: [zone({ pattern: 'grid' })] }));
    expect(pieces.filter((p) => p.drill > 0)).toHaveLength(1);
    expect(pieces.every((p) => p.parts!.length === 1)).toBe(true);
  });

  it('un angle de mur sépare un carreau à cheval en deux pièces', () => {
    const s = surface({
      width: 1500,
      height: 300,
      zones: [zone({ pattern: 'grid' })],
      corners: [{ x: 900, type: 'out', angle: 90, covered: false }],
    });
    const pieces = build(s);
    const atFold = pieces.filter((p) => p.atFold);
    expect(atFold).toHaveLength(2);
    expect(atFold.every((p) => p.vis.length === 1)).toBe(true);
    const bx = atFold.map((p) => bbox(p.parts![0]!));
    expect(bx.some((b) => Math.abs(b[1] - 900) < 1e-9) && bx.some((b) => Math.abs(b[0] - 900) < 1e-9)).toBe(true);
  });

  it('un carreau coupé par une ouverture en plusieurs parties forme une encoche', () => {
    const s = surface({
      width: 1203,
      height: 603,
      zones: [zone({ pattern: 'grid' }, { width: 1200, height: 600 })],
      openings: [{ ...window, x: 500, sill: 0, width: 200, height: 300 }],
    });
    const notched = build(s).filter((p) => p.notch);
    expect(notched).toHaveLength(1);
    // régions convexes autour de l'ouverture : gauche, droite, dessus
    expect(notched[0]!.parts).toHaveLength(3);
  });
});

describe('cas limites sans exception', () => {
  it.each<[string, Partial<SurfaceSpec>, string | null]>([
    ['surface nulle', { width: 0 }, 'invalid-surface'],
    ['joint négatif', { joint: -1 }, 'invalid-surface'],
    ['dimensions non numériques', { height: NaN }, 'invalid-surface'],
    ['aucune zone', { zones: [] }, 'no-zone'],
    ['carreau nul', { zones: [zone({}, { width: 0 })] }, 'invalid-tile'],
    [
      'trop de carreaux',
      { width: 20000, height: 20000, zones: [zone({}, { width: 50, height: 50 })] },
      'too-many-tiles',
    ],
    [
      'zones qui débordent',
      { zones: [zone({ unit: 'length', size: 2000 }), zone({ unit: 'length', size: 2000 })] },
      null,
    ],
    ['ouverture hors surface', { openings: [{ ...window, x: 9000 }] }, null],
    ['angle hors surface', { corners: [{ x: -50, type: 'in', angle: 90, covered: true }] }, null],
    ['plinthe sur zone inexistante', { plinth: { length: 1000, height: 80, zone: 7 } }, null],
    ['zone de 0 rangée', { zones: [zone({ unit: 'rows', size: 0 }), zone()] }, null],
  ])('%s', (_n, o, code) => {
    const r = buildSurface(surface(o));
    if (code) expect(r.ok ? null : r.error.code).toBe(code);
    else expect(r.ok).toBe(true);
  });
});

describe('comparateur de parité', () => {
  it('détecte un écart de nombre, de longueur et de valeur', () => {
    expect(() => expectSame({ a: 1.0000001 }, { a: 1 })).not.toThrow();
    expect(() => expectSame({ a: 1.001 }, { a: 1 })).toThrow();
    expect(() => expectSame([1, 2], [1])).toThrow();
    expect(() => expectSame({ k: 'x' }, { k: 'y' })).toThrow();
  });
});
