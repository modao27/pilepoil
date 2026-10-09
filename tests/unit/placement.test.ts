import { cameraFor } from '../../src/render/scene3d/camera';
import { describe, expect, it } from 'vitest';
import type { ProjectSpec } from '../../src/modules/carrelage/core';
import {
  frameOf,
  frameAt,
  roomLayout,
  surfaceLayout,
  wallFrames,
  wallPoint,
} from '../../src/modules/carrelage/render/scene3d/placement';
import { surface } from './fixtures';

const settings = { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20 };

describe('murs pliés', () => {
  it('angle rentrant à 90° : le mur tourne vers la pièce', () => {
    const s = surface({ width: 3000, corners: [{ x: 1000, type: 'in', angle: 90, covered: true }] });
    const [a, b] = wallFrames(s);
    expect(a!.len).toBeCloseTo(1, 12);
    expect(b!.base[0]).toBeCloseTo(1, 12);
    expect(b!.dir[0]).toBeCloseTo(0, 12);
    expect(b!.dir[1]).toBeCloseTo(1, 12); // vers +z, côté pièce
    expect(b!.n[0]).toBeCloseTo(-1, 12);
    expect(frameAt([a!, b!], 1500)).toBe(b);
  });

  it('angle sortant : le mur tourne vers l’extérieur', () => {
    const s = surface({ width: 3000, corners: [{ x: 1000, type: 'out', angle: 90, covered: true }] });
    expect(wallFrames(s)[1]!.dir[1]).toBeCloseTo(-1, 12);
  });

  it('point d’un mur : hauteur, profondeur derrière le plan', () => {
    const [fr] = wallFrames(surface({ width: 2000 }));
    expect(wallPoint(fr!, 1000, 1.2, 0.1)).toEqual([1, 1.2, -0.1]);
  });
});

describe('pièce du plan', () => {
  // pièce en L 4 m × 3 m (coin bas droit de 1,5 m × 1 m retiré), 2,5 m sous plafond
  const outline: [number, number][] = [
    [0, 0],
    [4000, 0],
    [4000, 2000],
    [2500, 2000],
    [2500, 3000],
    [0, 3000],
  ];
  const spec: ProjectSpec = {
    surfaces: [
      surface({ kind: 'floor', width: 4000, height: 3000 }),
      surface({ width: 4000, height: 2000 }),
      surface({ width: 2000, height: 2000 }),
      surface({ width: 1500, height: 2000 }),
    ],
    settings,
    room: null,
  };
  const shape = {
    outline,
    height: 2500,
    walls: [1, 2, 3, null, null, null],
    floor: 0,
    floorOrigin: [100, 200] as [number, number],
  };

  it('chaque mur le long de son segment, normales vers l’intérieur ; murs nus en plâtre', () => {
    const lay = roomLayout(spec, shape);
    expect(lay.instances[0]).toEqual({ surface: 0, kind: 'floor', origin: [0.1, 0.2] });
    const walls = lay.instances.filter((i) => i.kind === 'wall');
    expect(walls.map((w) => w.surface)).toEqual([1, 2, 3]);
    const end = (i: (typeof walls)[number]) => {
      const fr = i.frames.at(-1)!;
      return [fr.base[0] + fr.dir[0] * fr.len, fr.base[1] + fr.dir[1] * fr.len];
    };
    expect(end(walls[0]!)).toEqual(walls[1]!.frames[0]!.base);
    expect(end(walls[1]!)).toEqual(walls[2]!.frames[0]!.base);
    // point intérieur proche de chaque mur : du bon côté de la normale
    for (const w of walls) {
      const fr = w.frames[0]!;
      const mid = [fr.base[0] + (fr.dir[0] * fr.len) / 2, fr.base[1] + (fr.dir[1] * fr.len) / 2];
      const inside = [mid[0]! + fr.n[0] * 0.1, mid[1]! + fr.n[2] * 0.1];
      expect(inside[0]! > 0 && inside[0]! < 4 && inside[1]! > 0 && inside[1]! < 3).toBe(true);
      expect(inside[0]! > 2.5 && inside[1]! > 2).toBe(false);
    }
    expect(lay.room!.bare.map((b) => b.len)).toEqual([1, 2.5, 3]);
    expect(lay.room!.height).toBe(2.5);
    expect(lay.bounds).toEqual({ x: [0, 4], z: [0, 3], h: 2.5 });
  });

  it('caméra : cible au centre de la pièce, au-dessus pour la plongée', () => {
    const lay = roomLayout(spec, shape);
    const c = cameraFor(frameOf(lay), 'haut');
    expect(c.target[0]).toBeCloseTo(2, 12);
    expect(c.position[1]).toBeGreaterThan(3);
    expect(cameraFor(frameOf(surfaceLayout(spec, 0)), 'face').target[1]).toBe(0);
  });
});
