/** Maillages 3D du parquet : sol, joints, murs bas ouverts aux portes, plinthes, peu de matériaux. */
import { describe, expect, it } from 'vitest';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { ParquetSpec } from '../../src/modules/parquet/core/types';
import { buildParquetMeshes, parquetFrame } from '../../src/modules/parquet/render/meshes';
import { rect, spec } from './parquetHelpers';

function r7(): ParquetSpec {
  const s = spec(rect(4000, 3000));
  const l = s.layouts[0]!;
  l.rooms = [
    {
      id: 'A',
      outline: rect(4000, 3000),
      obstacles: [],
      openings: [
        {
          segment: [
            [4000, 1000],
            [4000, 1830],
          ],
          kind: 'door',
        },
      ],
    },
    {
      id: 'B',
      outline: rect(4000, 3000, 4072, 0),
      obstacles: [],
      openings: [
        {
          segment: [
            [4072, 1830],
            [4072, 1000],
          ],
          kind: 'door',
        },
      ],
    },
  ];
  l.passages = [
    {
      id: 'P1',
      a: 'A',
      b: 'B',
      segment: [
        [4000, 1000],
        [4000, 1830],
      ],
      width: 830,
      depth: 72,
    },
  ];
  return s;
}

const looks = { L1: { color: '#c9a77c', photo: null, length: 1285, width: 192 } };

describe('3D du parquet', () => {
  const s = r7();
  const r = computeParquet(s);
  const meshes = buildParquetMeshes({ spec: s, result: r, looks });

  it('quatre maillages : joints, sol de la pose, murs, plinthes (peu d’appels de dessin)', () => {
    expect(meshes.map((m) => m.key)).toEqual(['seams', 'floor:L1', 'walls', 'plinths']);
    for (const m of meshes) {
      expect(m.positions.length % 9).toBe(0);
      expect(m.normals.length).toBe(m.positions.length);
      expect(m.colors.length).toBe(m.positions.length);
    }
  });

  it('chaque lame est dessinée (au moins un triangle par pièce), au-dessus des joints', () => {
    const floor = meshes.find((m) => m.key === 'floor:L1')!;
    expect(floor.positions.length / 9).toBeGreaterThanOrEqual(r.layouts[0]!.pieces.length * 2);
    const ys = new Set(floor.positions.filter((_, i) => i % 3 === 1));
    expect([...ys]).toEqual([0.003]);
  });

  it('les normales du sol montent ; les triangles sont tournés vers elles', () => {
    const floor = meshes.find((m) => m.key === 'floor:L1')!;
    for (let i = 0; i < floor.positions.length; i += 9) {
      const p = floor.positions;
      const ax = p[i + 3]! - p[i]!,
        az = p[i + 5]! - p[i + 2]!,
        bx = p[i + 6]! - p[i]!,
        bz = p[i + 8]! - p[i + 2]!;
      // composante y du produit vectoriel (a × b) : positive pour une face vers le haut
      expect(az * bx - ax * bz).toBeGreaterThanOrEqual(-1e-12);
    }
  });

  it('mur ouvert à la porte : aucun mur entre z = 1,0 et 1,83 m sur la cloison x = 4 m', () => {
    const w = meshes.find((m) => m.key === 'walls')!;
    for (let i = 0; i < w.positions.length; i += 3) {
      const [x, , z] = [w.positions[i]!, w.positions[i + 1]!, w.positions[i + 2]!];
      if (x > 4.0005 && x < 4.0715) expect(z <= 1.0 + 1e-6 || z >= 1.83 - 1e-6).toBe(true);
    }
  });

  it('plinthes décochées : pas de maillage de plinthes ; cadre de la scène sur les deux pièces', () => {
    const t = { ...s, accessories: { ...s.accessories, skirting: { ...s.accessories.skirting, enabled: false } } };
    expect(buildParquetMeshes({ spec: t, result: r, looks }).map((m) => m.key)).not.toContain('plinths');
    expect(parquetFrame(s).bounds).toEqual({ x: [0, 8.072], z: [0, 3], h: 0.3 });
  });

  it('photo de la lame : UV dans la lame, de 0 à 1', () => {
    const m = buildParquetMeshes({ spec: s, result: r, looks: { L1: { ...looks.L1, photo: 'blob:x' } } }).find(
      (x) => x.key === 'floor:L1',
    )!;
    expect(m.photo).toBe('blob:x');
    expect(m.uvs.length).toBe((m.positions.length / 3) * 2);
    for (const v of m.uvs) {
      expect(v).toBeGreaterThanOrEqual(-1e-6);
      expect(v).toBeLessThanOrEqual(1 + 1e-6);
    }
  });
});
