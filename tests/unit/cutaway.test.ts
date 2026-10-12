/** Maquette du projet : murs en volume, repérage des murs pour la coupe, pièce touchée, menuiseries, terrain. */
import { describe, expect, it } from 'vitest';
import type { Plan } from '../../src/core/plan/types';
import { buildJoinery, buildSite, pickRoom, roomRing, tagWalls } from '../../src/render/scene3d/cutaway';
import { buildEnvelope, planFrame } from '../../src/render/scene3d/envelope';
import type { MeshData } from '../../src/render/scene3d/types';
import { rect, withOpening } from './planFixtures';

/** Pièce 3 × 2 m en (1 m, 2 m), 2,5 m sous plafond ; sur le mur 2 (x = 4 m) une porte ou une fenêtre. */
function plan(kind: 'door' | 'window' = 'door'): Plan {
  const room = withOpening(rect('r', 3000, 2000, { height: 2500 }), 1, {
    kind,
    offset: 500,
    width: 800,
    sill: kind === 'door' ? 0 : 1000,
    height: kind === 'door' ? 2000 : 1100,
  });
  return { rooms: [{ ...room, origin: [1000, 2000] }], passages: [] };
}

type Tri = { p: [number, number, number][]; n: [number, number, number]; tag: [number, number] };
const tris = (m: MeshData): Tri[] => {
  const out: Tri[] = [];
  for (let i = 0; i < m.positions.length / 9; i++) {
    const at = (a: number[], k: number) => [a[i * 9 + 3 * k]!, a[i * 9 + 3 * k + 1]!, a[i * 9 + 3 * k + 2]!];
    out.push({
      p: [0, 1, 2].map((k) => at(m.positions, k)) as Tri['p'],
      n: at(m.normals, 0).map((v) => v + 0) as Tri['n'],
      tag: m.wallNormals ? [m.wallNormals[i * 6]! + 0, m.wallNormals[i * 6 + 1]! + 0] : [0, 0],
    });
  }
  return out;
};

/** Normale géométrique (sens des sommets) d'un triangle. */
const winding = (t: Tri) => {
  const [a, b, c] = t.p;
  return [
    (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
    (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
  ];
};
const facesItsNormal = (t: Tri) => {
  const w = winding(t);
  return w[0] * t.n[0] + w[1] * t.n[1] + w[2] * t.n[2] > 0;
};

describe('murs en volume', () => {
  const plaster = buildEnvelope(plan(), ['r']).find((m) => m.key === 'plaster')!;
  const outer = tris(plaster).filter((t) => t.p.every((q) => Math.abs(q[0] - 4.072) < 1e-9));

  it('face extérieure du mur 2 sur l’épaisseur (x = 4,072 m), tournée vers l’extérieur, ouverte à la porte', () => {
    expect(outer.length).toBeGreaterThan(0);
    for (const t of outer) {
      expect(t.n).toEqual([1, 0, 0]);
      expect(facesItsNormal(t)).toBe(true);
      const cz = t.p.reduce((s, q) => s + q[2], 0) / 3,
        cy = t.p.reduce((s, q) => s + q[1], 0) / 3;
      expect(cz > 2.5 && cz < 3.3 && cy < 2).toBe(false);
    }
  });

  it('les faces extérieures vont d’un angle extérieur à l’autre (épaisseur comprise)', () => {
    const zs = outer.flatMap((t) => t.p.map((q) => q[2]));
    expect(Math.min(...zs)).toBeCloseTo(2 - 0.072, 9);
    expect(Math.max(...zs)).toBeCloseTo(4 + 0.072, 9);
  });
});

describe('repérage des murs', () => {
  const p = plan();
  const tagged = tagWalls(buildEnvelope(p, ['r']), p, ['r']);

  it('une normale de mur par sommet : celle du mur extérieur, (0, 0) au sol', () => {
    for (const m of tagged) expect(m.wallNormals!.length).toBe((m.positions.length / 3) * 2);
    const ground = tris(tagged.find((m) => m.key === 'ground')!);
    const centre = ground.filter((t) => t.tag[0] === 0 && t.tag[1] === 0);
    expect(centre.length).toBeGreaterThan(0);
    const plaster = tris(tagged.find((m) => m.key === 'plaster')!);
    const wall2 = plaster.filter((t) => t.p.every((q) => Math.abs(q[0] - 4.072) < 1e-9));
    for (const t of wall2) expect(t.tag).toEqual([1, 0]);
    const wall1 = plaster.filter((t) => t.p.every((q) => Math.abs(q[2] - 2) < 1e-9));
    expect(wall1.length).toBeGreaterThan(0);
    for (const t of wall1) {
      expect(t.tag[0]).toBeCloseTo(0, 9);
      expect(t.tag[1]).toBe(-1);
    }
  });

  it('un revêtement posé contre le mur (3 cm côté pièce) est rattaché au mur', () => {
    const tile: MeshData = {
      key: 'tile',
      photo: null,
      positions: [3.97, 0.5, 2.5, 3.97, 2, 2.5, 3.97, 2, 3],
      normals: [-1, 0, 0, -1, 0, 0, -1, 0, 0],
      colors: new Array(9).fill(1),
      uvs: [],
      castShadow: false,
      receiveShadow: true,
    };
    const [t] = tris(tagWalls([tile], p, ['r'])[0]!);
    expect(t!.tag).toEqual([1, 0]);
  });
});

describe('pièce touchée', () => {
  const p = plan();
  it('le point du plan dans le contour (repère du plan) donne la pièce, sinon rien', () => {
    expect(pickRoom(p, ['r'], [2500, 3000])).toBe('r');
    expect(pickRoom(p, ['r'], [500, 500])).toBeNull();
    expect(pickRoom(p, [], [2500, 3000])).toBeNull();
  });
  it('contour en mètres au repère de la scène', () => {
    expect(roomRing(p, 'r')).toEqual([
      [1, 2],
      [4, 2],
      [4, 4],
      [1, 4],
    ]);
    expect(roomRing(p, 'x')).toBeNull();
  });
});

describe('menuiseries et terrain', () => {
  it('porte : cadre (montants et traverse) sans vitre ni seuil', () => {
    const j = buildJoinery(plan('door'), ['r']);
    expect(j.map((m) => m.key)).toEqual(['joinery']);
    // trois boîtes de six faces, deux triangles par face
    expect(j[0]!.positions.length / 9).toBe(3 * 6 * 2);
    for (const t of tris(j[0]!)) expect(facesItsNormal(t)).toBe(true);
  });

  it('fenêtre : cadre complet et vitre translucide au milieu du mur', () => {
    const j = buildJoinery(plan('window'), ['r']);
    expect(j.map((m) => m.key)).toEqual(['joinery', 'glass']);
    expect(j[0]!.positions.length / 9).toBe(4 * 6 * 2);
    const glass = j[1]!;
    expect(glass.opacity).toBeLessThan(1);
    const xs = new Set(glass.positions.filter((_, i) => i % 3 === 0));
    expect([...xs]).toEqual([4.036]);
  });

  it('terrain sauge : la boîte du plan élargie d’un mètre, sous le sol brut', () => {
    const site = buildSite(planFrame(plan(), ['r']));
    const xs = site.positions.filter((_, i) => i % 3 === 0),
      ys = site.positions.filter((_, i) => i % 3 === 1),
      zs = site.positions.filter((_, i) => i % 3 === 2);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 5]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([1, 5]);
    expect(Math.max(...ys)).toBeLessThan(-0.001);
    for (const t of tris(site)) expect(facesItsNormal(t)).toBe(true);
  });
});

describe('cloison entre deux pièces', () => {
  /** A : 3 × 2 m en (0, 0) ; B : 2 × 2 m contre le mur 2 de A, de l'autre côté de sa cloison (72 mm). */
  const twin = (): Plan => ({
    rooms: [
      { ...rect('a', 3000, 2000, { height: 2500 }), origin: [0, 0] },
      { ...rect('b', 2000, 2000, { height: 2500 }), origin: [3072, 0] },
    ],
    passages: [],
  });
  const tile = (x: number, nx: number): MeshData => ({
    key: 'tile',
    photo: null,
    positions: [x, 0.5, 0.5, x, 2, 0.5, x, 2, 1],
    normals: [nx, 0, 0, nx, 0, 0, nx, 0, 0],
    colors: new Array(9).fill(1),
    uvs: [],
    castShadow: false,
    receiveShadow: true,
  });

  it('une seule face sur la cloison côté B : celle de B, pas la face extérieure de A par-dessus', () => {
    // surface des triangles sur le plan x = 3,072 m tournés vers +x, en face de B (z entre 0 et 2 m)
    const area = (m: MeshData) =>
      tris(m)
        .filter((t) => {
          const cz = t.p.reduce((v, q) => v + q[2], 0) / 3;
          return t.p.every((q) => Math.abs(q[0] - 3.072) < 1e-9) && t.n[0] === 1 && cz > 0 && cz < 2;
        })
        .reduce((sum, t) => {
          const [a, b, c] = t.p;
          return sum + Math.abs((b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1])) / 2;
        }, 0);
    // B présente : sa face intérieure seule (2 m × 2,5 m) ; A seule : sa face extérieure entière, angles compris
    // (2,144 m × 2,5 m, en deux triangles dont le centre est en face de B)
    expect(area(buildEnvelope(twin(), ['a', 'b']).find((m) => m.key === 'plaster')!)).toBeCloseTo(5, 6);
    expect(area(buildEnvelope(twin(), ['a']).find((m) => m.key === 'plaster')!)).toBeCloseTo(2.144 * 2.5, 6);
    // bout de la cloison de A à l'angle de façade (z entre -72 mm et 0) : dans l'épaisseur du mur de façade de B
    const end = tris(buildEnvelope(twin(), ['a', 'b']).find((m) => m.key === 'plaster')!).filter(
      (t) => t.p.every((q) => Math.abs(q[0] - 3.072) < 1e-9 && q[2] <= 0 && q[2] >= -0.072) && t.n[0] === 1,
    );
    expect(end).toEqual([]);
  });

  it('chaque carreau va au mur de sa pièce, marqué cloison (normale doublée)', () => {
    const p = twin();
    // carreau de A à 2 mm de sa face (x = 2,998, tourné vers A) ; carreau de B à 2 mm de la sienne (x = 3,074)
    const [inA, inB] = tagWalls([tile(2.998, -1), tile(3.074, 1)], p, ['a', 'b']);
    expect(tris(inA!)[0]!.tag).toEqual([2, 0]);
    expect(tris(inB!)[0]!.tag).toEqual([-2, 0]);
    // bout d'angle de la façade de A (z = -72 mm, entre x = 3 et 3,072 m, tourné vers -z) : à la façade, pas à la
    // cloison qu'il touche
    const corner: MeshData = {
      ...tile(0, 0),
      positions: [3.01, 0.5, -0.072, 3.06, 0.5, -0.072, 3.06, 2, -0.072],
      normals: [0, 0, -1, 0, 0, -1, 0, 0, -1],
    };
    expect(tris(tagWalls([corner], p, ['a', 'b'])[0]!)[0]!.tag).toEqual([0, -1]);
    // côté d'un tableau carrelé plus profond que le mur (à 150 mm de la face, tourné le long du mur) : coupé avec lui
    const reveal: MeshData = {
      ...tile(0, 0),
      positions: [3.15, 0.5, 0.8, 3.15, 2, 0.8, 3.15, 2, 1],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    };
    expect(Math.abs(tris(tagWalls([reveal], p, ['a', 'b'])[0]!)[0]!.tag[0])).toBe(2);
    // B posée à 5 mm de la cloison (moins que la tolérance du plan) : toujours une cloison
    const gap: Plan = { ...p, rooms: [p.rooms[0]!, { ...p.rooms[1]!, origin: [3077, 0] }] };
    expect(tris(tagWalls([tile(2.998, -1)], gap, ['a', 'b'])[0]!)[0]!.tag).toEqual([2, 0]);
    // pièce seule : mur extérieur ordinaire
    expect(tris(tagWalls([tile(2.998, -1)], p, ['a'])[0]!)[0]!.tag).toEqual([1, 0]);
  });
});
