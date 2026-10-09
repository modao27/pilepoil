import { describe, expect, it } from 'vitest';
import { computeProject, type OpeningSpec, type ProjectSpec } from '../../src/modules/carrelage/core';
import { buildMeshes, type MeshData } from '../../src/modules/carrelage/render/scene3d/meshes';
import { roomLayout, surfaceLayout } from '../../src/modules/carrelage/render/scene3d/placement';
import { surface, zone } from './fixtures';

const settings = { margin: 10, reuseOffcuts: true, kerf: 2, minOffcut: 20 };
const win: OpeningSpec = {
  type: 'window',
  x: 1000,
  sill: 900,
  width: 800,
  height: 900,
  covered: true,
  revealDepth: 150,
  reveals: { L: true, R: true, T: true, B: false },
  projection: 0,
};

function wallSpec(o: Partial<Parameters<typeof surface>[0]> = {}): ProjectSpec {
  return { surfaces: [surface({ width: 3000, height: 2000, ...o })], settings, room: null };
}
const tris = (m: MeshData) => m.positions.length / 9;

/** Chaque triangle est orienté selon sa normale (face avant visible du bon côté). */
function expectOriented(m: MeshData) {
  for (let t = 0; t < m.positions.length; t += 9) {
    const p = m.positions.slice(t, t + 9),
      n = m.normals.slice(t, t + 3);
    const u = [p[3]! - p[0]!, p[4]! - p[1]!, p[5]! - p[2]!],
      v = [p[6]! - p[0]!, p[7]! - p[1]!, p[8]! - p[2]!];
    const c = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
    expect(c[0]! * n[0]! + c[1]! * n[1]! + c[2]! * n[2]!).toBeGreaterThanOrEqual(-1e-12);
  }
}

describe('maillages 3D', () => {
  it('un triangle par sommet de pièce au-delà de deux, carreaux devant le mur', () => {
    const spec = wallSpec();
    const result = computeProject(spec);
    const meshes = buildMeshes({ spec, result, layout: surfaceLayout(spec, 0), shade: 0.06, photo: () => null });
    const tiles = meshes.find((m) => m.key === 'tiles')!;
    const r = result.surfaces[0]!;
    if (!r.ok) throw new Error();
    const expected = r.value.pieces.reduce((t, p) => t + p.parts!.reduce((u, q) => u + q.length - 2, 0), 0);
    expect(tris(tiles)).toBe(expected);
    for (let i = 2; i < tiles.positions.length; i += 3) expect(tiles.positions[i]).toBeCloseTo(0.002, 9);
    for (const m of meshes) expectOriented(m);
  });

  it('fenêtre : trou dans le mur, fond de l’embrasure en retrait, tableaux carrelés', () => {
    const spec = wallSpec({ openings: [win] });
    const result = computeProject(spec);
    const meshes = buildMeshes({ spec, result, layout: surfaceLayout(spec, 0), shade: 0, photo: () => null });
    const back = meshes.find((m) => m.key === 'opening|#a9c1cf')!;
    expect(back.castShadow).toBe(true);
    for (let i = 2; i < back.positions.length; i += 3) expect(back.positions[i]).toBeCloseTo(-0.15, 9);
    // pas de plâtre devant la fenêtre : aucun triangle de plâtre ne contient le centre de l'ouverture
    const plaster = meshes.find((m) => m.key === 'plaster')!;
    const cx = 1.4,
      cy = 1.35;
    for (let t = 0; t < plaster.positions.length; t += 9) {
      const p = plaster.positions;
      const xs = [p[t]!, p[t + 3]!, p[t + 6]!],
        ys = [p[t + 1]!, p[t + 4]!, p[t + 7]!];
      const inside = Math.min(...xs) < cx && Math.max(...xs) > cx && Math.min(...ys) < cy && Math.max(...ys) > cy;
      if (inside) {
        // le triangle peut englober le point par sa boîte : vérifier par coordonnées barycentriques
        const d = (xs[1]! - xs[0]!) * (ys[2]! - ys[0]!) - (xs[2]! - xs[0]!) * (ys[1]! - ys[0]!);
        const a = ((xs[1]! - cx) * (ys[2]! - cy) - (xs[2]! - cx) * (ys[1]! - cy)) / d;
        const b = ((xs[2]! - cx) * (ys[0]! - cy) - (xs[0]! - cx) * (ys[2]! - cy)) / d;
        expect(a >= 0 && b >= 0 && 1 - a - b >= 0).toBe(false);
      }
    }
    const tiles = meshes.find((m) => m.key === 'tiles')!;
    const r = result.surfaces[0]!;
    if (!r.ok) throw new Error();
    const reveal = r.value.pieces.filter((p) => p.reveal).length;
    expect(reveal).toBeGreaterThan(0);
    expect(tiles.positions.some((v, i) => i % 3 === 2 && v < -0.01)).toBe(true);
    for (const m of meshes) expectOriented(m);
  });

  it('photo : UV dans le carreau, retournements aléatoires', () => {
    const spec = wallSpec({ zones: [zone({ pattern: 'grid' })] });
    const result = computeProject(spec);
    const meshes = buildMeshes({
      spec,
      result,
      layout: surfaceLayout(spec, 0),
      shade: 0,
      photo: () => ({ url: 'blob:photo', flip: true }),
    });
    const m = meshes.find((x) => x.photo === 'blob:photo')!;
    expect(m.key).toBe('tiles|blob:photo');
    for (const v of m.uvs) {
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('pièce entière : peu de maillages, baignoire en volume qui projette une ombre', () => {
    const tub: OpeningSpec = {
      ...win,
      type: 'tub',
      x: 0,
      sill: 0,
      width: 1700,
      height: 560,
      projection: 700,
      revealDepth: 0,
    };
    const spec: ProjectSpec = {
      surfaces: [
        surface({ width: 4000, height: 2000, openings: [tub] }),
        surface({ width: 3750, height: 2000, openings: [win] }),
        surface({ width: 4000, height: 2000, openings: [{ ...win, type: 'door', sill: 0, height: 2000, width: 830 }] }),
        surface({ width: 3750, height: 2000 }),
        surface({ kind: 'floor', width: 4000, height: 3750 }),
      ],
      settings,
      room: null,
    };
    const result = computeProject(spec);
    const outline: [number, number][] = [
      [0, 0],
      [4000, 0],
      [4000, 3750],
      [0, 3750],
    ];
    const shape = {
      outline,
      height: 2500,
      walls: [0, 1, 2, 3].map((surface) => ({ surface, x: 0, y: 0 })),
      floor: 4,
      floorOrigin: [0, 0] as [number, number],
    };
    const meshes = buildMeshes({ spec, result, layout: roomLayout(spec, shape), shade: 0.06, photo: () => null });
    expect(meshes.length).toBeLessThan(20);
    const boxes = meshes.find((m) => m.key === 'fixture-box')!;
    expect(boxes.castShadow).toBe(true);
    expect(Math.max(...boxes.positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0.561, 3);
    const triangles = meshes.reduce((t, m) => t + tris(m), 0);
    expect(triangles).toBeLessThan(20000);
    for (const m of meshes) expectOriented(m);
  });

  it('sol en L avec poteau : chape au contour, sans rien dans le coin retiré ni dans le poteau', () => {
    const L: [number, number][][] = [
      [
        [0, 0],
        [4000, 0],
        [4000, 2000],
        [2500, 2000],
        [2500, 3000],
        [0, 3000],
      ],
      [
        [1000, 1000],
        [1000, 1200],
        [1200, 1200],
        [1200, 1000],
      ],
    ];
    const spec: ProjectSpec = {
      surfaces: [surface({ kind: 'floor', width: 4000, height: 3000, outline: L })],
      settings,
      room: null,
    };
    const result = computeProject(spec);
    const meshes = buildMeshes({ spec, result, layout: surfaceLayout(spec, 0), shade: 0, photo: () => null });
    const areaOf = (key: string) => {
      const m = meshes.find((x) => x.key === key)!;
      let a = 0;
      for (let i = 0; i < m.positions.length; i += 9) {
        const [x0, , z0, x1, , z1, x2, , z2] = m.positions.slice(i, i + 9) as number[];
        a += Math.abs((x1! - x0!) * (z2! - z0!) - (x2! - x0!) * (z1! - z0!)) / 2;
      }
      return a;
    };
    expect(areaOf('floorbase')).toBeCloseTo(12 - 1.5 - 0.04, 6);
    const grout = meshes.find((m) => m.key.startsWith('grout|'))!;
    const inCut = (x: number, z: number) => x > 2.5001 && z > 2.0001;
    for (let i = 0; i < grout.positions.length; i += 3)
      expect(inCut(grout.positions[i]!, grout.positions[i + 2]!)).toBe(false);
    for (const m of meshes) expectOriented(m);
  });
});
