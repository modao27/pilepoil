/** Enveloppe 3D commune des pièces (murs nus, embrasures, dessus des murs, sol brut) et outils de scène. */
import { describe, expect, it } from 'vitest';
import { signedArea } from '../../src/core/geometry/polygon';
import { bareWall, buildEnvelope, mergeMeshes, planFrame, translateMeshes } from '../../src/render/scene3d/envelope';
import type { MeshData } from '../../src/render/scene3d/types';
import type { Plan } from '../../src/core/plan/types';
import { rect, withOpening } from './planFixtures';

/** Pièce 3 × 2 m, 2,5 m sous plafond, placée en (1 m, 2 m), porte de 80 cm sur le mur 2 (x = 3 m). */
function plan(): Plan {
  const room = withOpening(rect('r', 3000, 2000, { height: 2500 }), 1, {
    kind: 'door',
    offset: 500,
    width: 800,
    sill: 0,
    height: 2000,
  });
  return { rooms: [{ ...room, origin: [1000, 2000] }], passages: [] };
}

const triangles = (m: MeshData) => {
  const out: [number, number, number][][] = [];
  for (let i = 0; i < m.positions.length; i += 9)
    out.push([0, 1, 2].map((k) => [m.positions[i + 3 * k]!, m.positions[i + 3 * k + 1]!, m.positions[i + 3 * k + 2]!]));
  return out;
};

describe('enveloppe des pièces', () => {
  const meshes = buildEnvelope(plan(), ['r']);
  const plaster = meshes.find((m) => m.key === 'plaster')!;
  const ground = meshes.find((m) => m.key === 'ground')!;

  it('deux maillages : plâtre (murs, embrasures, dessus) et sol brut, au repère du plan', () => {
    expect(meshes.map((m) => m.key)).toEqual(['plaster', 'ground']);
    for (const m of meshes) {
      expect(m.positions.length % 9).toBe(0);
      expect(m.normals.length).toBe(m.positions.length);
      expect(m.colors.length).toBe(m.positions.length);
    }
    const ys = new Set(ground.positions.filter((_, i) => i % 3 === 1));
    expect([...ys]).toEqual([-0.001]);
    const xs = ground.positions.filter((_, i) => i % 3 === 0);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([1, 4]);
  });

  it('mur 2 ouvert à la porte : aucun triangle du plan du mur entre z = 2,5 et 3,3 m sous 2 m de haut', () => {
    for (const t of triangles(plaster)) {
      // face intérieure du mur 2 : x = 4 m sur ses trois sommets
      if (!t.every((p) => Math.abs(p[0] - 4) < 1e-9)) continue;
      const cz = t.reduce((s, p) => s + p[2], 0) / 3,
        cy = t.reduce((s, p) => s + p[1], 0) / 3;
      expect(cz > 2.5 && cz < 3.3 && cy < 2).toBe(false);
    }
  });

  it('embrasure sur l’épaisseur du mur (72 mm) et dessus des murs à 2,5 m', () => {
    const xs = plaster.positions.filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs)).toBeCloseTo(4.072, 9);
    const tops = triangles(plaster).filter((t) => t.every((p) => p[1] === 2.5));
    expect(tops.length).toBeGreaterThanOrEqual(8);
  });

  it('mur revêtu sur toute sa largeur : laissé au module, embrasure comprise', () => {
    const skip = buildEnvelope(plan(), ['r'], new Map([['r-w1', [[0, 2000]] as [number, number][]]])).find(
      (m) => m.key === 'plaster',
    )!;
    const onWall = (m: MeshData) => triangles(m).filter((t) => t.every((p) => Math.abs(p[0] - 4) < 1e-9)).length;
    expect(onWall(plaster)).toBeGreaterThan(0);
    expect(onWall(skip)).toBe(0);
    expect(skip.positions.length).toBeLessThan(plaster.positions.length);
  });

  it('mur revêtu en partie (crédence de 50 cm) : le plâtre couvre le reste du mur, sans recouvrement', () => {
    const area = (spans: [number, number][]) =>
      bareWall(2000, 2500, [], spans).reduce(
        (t, c) => t + Math.abs(signedArea(c.outer)) - c.holes.reduce((u, h) => u + Math.abs(signedArea(h)), 0),
        0,
      );
    expect(area([])).toBeCloseTo(2000 * 2500, 0);
    expect(area([[500, 1000]])).toBeCloseTo(1500 * 2500, 0);
    expect(area([[0, 2000]])).toBeCloseTo(0, 0);
    // une baie dans la partie nue reste un trou
    const withDoor = bareWall(2000, 2500, [[1200, 1800, 0, 2000]], [[0, 1000]]);
    const a = withDoor.reduce(
      (t, c) => t + Math.abs(signedArea(c.outer)) - c.holes.reduce((u, h) => u + Math.abs(signedArea(h)), 0),
      0,
    );
    expect(a).toBeCloseTo(1000 * 2500 - 600 * 2000, 0);
  });

  it('pièce absente de la liste : rien', () => {
    expect(buildEnvelope(plan(), [])).toEqual([]);
  });

  it('cadre : boîte des pièces et la plus grande hauteur', () => {
    expect(planFrame(plan(), ['r'])).toEqual({ kind: 'room', bounds: { x: [1, 4], z: [2, 4], h: 2.5 } });
  });
});

describe('outils de scène', () => {
  const mesh = (key: string, n: number, photo: string | null = null): MeshData => ({
    key,
    photo,
    positions: Array.from({ length: 9 * n }, (_, i) => i),
    normals: new Array<number>(9 * n).fill(0),
    colors: new Array<number>(9 * n).fill(1),
    uvs: photo ? new Array<number>(6 * n).fill(0.5) : [],
    castShadow: false,
    receiveShadow: true,
  });

  it('fusion : un maillage par matériau, sommets mis bout à bout', () => {
    const out = mergeMeshes([mesh('a', 1), mesh('b', 2), mesh('a', 3), mesh('a', 1, 'u')]);
    expect(out.map((m) => [m.key, m.photo, m.positions.length])).toEqual([
      ['a', null, 36],
      ['b', null, 18],
      ['a', 'u', 9],
    ]);
  });

  it('fusion avec photo : une paire d’UV par sommet, même si l’un n’en avait pas', () => {
    const noUv = { ...mesh('a', 1, 'u'), uvs: [] };
    const [m] = mergeMeshes([mesh('a', 2, 'u'), noUv]);
    expect(m!.uvs.length).toBe((m!.positions.length / 3) * 2);
  });

  it('déplacement au sol : x et z seulement', () => {
    const [m] = translateMeshes([mesh('a', 1)], 1, 2);
    expect(m!.positions.slice(0, 6)).toEqual([1, 1, 4, 4, 4, 7]);
  });
});
