/** Niveaux de sol et murs bas en 3D (T1) : sols aux bons niveaux, murs depuis leur sol, modules remontés. */
import { describe, expect, it } from 'vitest';
import { buildEquipment } from '../../src/render/scene3d/equipment';
import { buildEnvelope, planFrame } from '../../src/render/scene3d/envelope';
import { levelAt, shiftByLevel } from '../../src/render/scene3d/levels';
import type { MeshData } from '../../src/render/scene3d/types';
import type { Obstacle, Plan } from '../../src/core/plan/types';
import { rect } from './planFixtures';

const ys = (d: MeshData) => d.positions.filter((_, i) => i % 3 === 1);
const range = (v: number[]) => [Math.min(...v), Math.max(...v)];
const mesh = (key: string, pos: number[]): MeshData => ({
  key,
  photo: null,
  positions: pos,
  normals: pos.map(() => 0),
  colors: pos.map(() => 1),
  uvs: [],
  castShadow: false,
  receiveShadow: true,
});

const a = rect('a', 4000, 3000, { height: 2500 });
const b = { ...rect('b', 3000, 3000, { height: 2500 }), origin: [4072, 0] as [number, number] };
const plan = (fa?: number, fb?: number): Plan => ({
  rooms: [
    { ...a, ...(fa != null ? { floor: fa } : {}) },
    { ...b, ...(fb != null ? { floor: fb } : {}) },
  ],
  passages: [],
});

describe('enveloppe 3D et niveaux', () => {
  it('sans niveau : sol à 0 et murs jusqu’à 2,5 m', () => {
    const [plaster, ground] = buildEnvelope(plan(), ['a']);
    expect(range(ys(ground!))).toEqual([-0.001, -0.001]);
    expect(range(ys(plaster!))[0]).toBeCloseTo(0, 6);
    expect(range(ys(plaster!))[1]).toBeCloseTo(2.5, 6);
  });

  it('une pièce à −15 cm : sol à −0,151 m et murs de −0,15 à 2,35 m', () => {
    const [plaster, ground] = buildEnvelope(plan(-150), ['a']);
    expect(range(ys(ground!))[0]).toBeCloseTo(-0.151, 6);
    expect(range(ys(plaster!))[0]).toBeCloseTo(-0.15, 6);
    expect(range(ys(plaster!))[1]).toBeCloseTo(2.35, 6);
  });

  it('un mur bas ne monte qu’à sa hauteur, depuis le sol de la pièce', () => {
    const low = plan(200);
    const room = low.rooms[0]!;
    // les quatre murs à 90 cm : tout le plâtre est entre 0,2 et 1,1 m
    const all: Plan = {
      rooms: [{ ...room, walls: room.walls.map((w) => ({ ...w, height: 900 })) }],
      passages: [],
    };
    const [plaster] = buildEnvelope(all, ['a']);
    expect(range(ys(plaster!))[0]).toBeCloseTo(0.2, 6);
    expect(range(ys(plaster!))[1]).toBeCloseTo(1.1, 6);
  });

  it('cadre de la scène : la hauteur compte le niveau', () => {
    expect(planFrame(plan(), ['a', 'b']).bounds.h).toBeCloseTo(2.5, 6);
    expect(planFrame(plan(200, -100), ['a', 'b']).bounds.h).toBeCloseTo(2.7, 6);
  });
});

describe('revêtements des modules remontés du niveau de leur pièce', () => {
  // un triangle à plat dans chaque pièce (centre à (2 m, 1,5 m) dans a, (5,5 m, 1,5 m) dans b)
  const tri = (cx: number) => [cx - 0.1, 0, 1.4, cx + 0.1, 0, 1.4, cx, 0, 1.6];

  it('chaque triangle prend le niveau de sa pièce', () => {
    const p = plan(0, -150);
    const out = shiftByLevel([mesh('t', [...tri(2), ...tri(5.5)])], p, ['a', 'b']);
    const y = ys(out[0]!);
    expect(y.slice(0, 3)).toEqual([0, 0, 0]);
    expect(y.slice(3)).toEqual([-0.15, -0.15, -0.15]);
  });

  it('sans niveau, les maillages sont rendus tels quels', () => {
    const m = mesh('t', [...tri(2), ...tri(5.5)]);
    expect(shiftByLevel([m], plan(), ['a', 'b'])[0]!.positions).toEqual(m.positions);
  });

  it('niveau d’un point : celui de la pièce la plus proche', () => {
    const p = plan(120, -80);
    expect(levelAt(p, ['a', 'b'], 2000, 1500)).toBe(120);
    expect(levelAt(p, ['a', 'b'], 5500, 1500)).toBe(-80);
    // dans l'épaisseur du mur entre les deux : la pièce la plus proche l'emporte
    expect(levelAt(p, ['a', 'b'], 4020, 1500)).toBe(120);
    expect(levelAt(p, [], 2000, 1500)).toBe(0);
  });
});

describe('équipements et niveaux', () => {
  it('un WC dans une pièce à +20 cm est posé sur son sol', () => {
    const o: Obstacle = {
      id: 'o',
      kind: 'toilet',
      outline: [
        [1000, 0],
        [1400, 0],
        [1400, 700],
        [1000, 700],
      ],
    };
    const p: Plan = { rooms: [{ ...a, floor: 200, obstacles: [o] }], passages: [] };
    const [m] = buildEquipment(p, ['a']);
    expect(range(ys(m!))[0]).toBeCloseTo(0.2, 6);
    expect(range(ys(m!))[1]).toBeGreaterThan(0.2 + 0.78 - 0.001);
  });
});
