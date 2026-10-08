import { describe, expect, it } from 'vitest';
import type { ProjectSpec } from '../../src/core';
import {
  cameraFor,
  frameAt,
  roomLayout,
  surfaceLayout,
  wallFrames,
  wallPoint,
} from '../../src/render/scene3d/placement';
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

describe('pièce', () => {
  const spec: ProjectSpec = {
    surfaces: [
      surface({ width: 3000, height: 2000 }),
      surface({ width: 2000, height: 2000 }),
      surface({ width: 3000, height: 2000 }),
      surface({ kind: 'floor', width: 3000, height: 2000 }),
    ],
    settings,
    room: { length: 3000, width: 2000, walls: { A: 0, B: 1, C: 2, floor: 3 } },
  };

  it('les murs se suivent autour du sol, normales vers l’intérieur', () => {
    const lay = roomLayout(spec, 2500)!;
    expect(lay.room).toEqual({ length: 3, width: 2, height: 2.5, missing: ['D'] });
    const walls = lay.instances.filter((i) => i.kind === 'wall');
    const end = (i: (typeof walls)[number]) => {
      const fr = i.frames.at(-1)!;
      return [fr.base[0] + fr.dir[0] * fr.len, fr.base[1] + fr.dir[1] * fr.len];
    };
    expect(end(walls[0]!)).toEqual(walls[1]!.frames[0]!.base);
    expect(end(walls[1]!)).toEqual(walls[2]!.frames[0]!.base);
    const centre = [1.5, 1];
    for (const w of walls) {
      const fr = w.frames[0]!;
      const toCentre = [centre[0]! - fr.base[0], centre[1]! - fr.base[1]];
      expect(toCentre[0]! * fr.n[0] + toCentre[1]! * fr.n[2]).toBeGreaterThan(0);
    }
  });

  it('caméra : cible au centre de la pièce, au-dessus pour la plongée', () => {
    const lay = roomLayout(spec, 2500)!;
    const c = cameraFor(lay, 'haut');
    expect(c.target[0]).toBeCloseTo(1.5, 12);
    expect(c.position[1]).toBeGreaterThan(3);
    expect(cameraFor(surfaceLayout(spec, 3), 'face').target[1]).toBe(0);
  });
});
