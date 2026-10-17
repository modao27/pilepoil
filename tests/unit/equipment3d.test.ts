/** Équipements fixes en 3D : un volume par type, à la hauteur d'un modèle courant, dos contre le mur (PLAN N5). */
import { describe, expect, it } from 'vitest';
import { EQUIPMENT, equipmentHeight } from '../../src/render/scene3d/equipment-info';
import { backSide, buildEquipment } from '../../src/render/scene3d/equipment';
import type { Obstacle, Plan } from '../../src/core/plan/types';
import { rect } from './planFixtures';

const room = rect('a', 4000, 3000, { height: 2500 });
const sq = (x: number, y: number, w: number, h: number): Obstacle['outline'] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const planWith = (o: Obstacle): Plan => ({ rooms: [{ ...room, obstacles: [o] }], passages: [] });
const spans = (plan: Plan) => {
  const [mesh] = buildEquipment(plan, ['a']);
  const p = mesh!.positions;
  const axis = (k: number) => p.filter((_, i) => i % 3 === k);
  return {
    x: [Math.min(...axis(0)), Math.max(...axis(0))],
    y: [Math.min(...axis(1)), Math.max(...axis(1))],
    z: [Math.min(...axis(2)), Math.max(...axis(2))],
    mesh: mesh!,
  };
};

describe('équipements en 3D', () => {
  it.each(Object.keys(EQUIPMENT) as Obstacle['kind'][])('%s : un volume dans son emprise, à sa hauteur', (kind) => {
    const info = EQUIPMENT[kind];
    const o: Obstacle = { id: 'o', kind, outline: sq(1000, 1000, info.width, info.depth) };
    const s = spans(planWith(o));
    const h = equipmentHeight(o, room) / 1000;
    // dans l'emprise (les robinets, le hublot et le plan débordent de quelques centimètres)
    expect(s.x[0]).toBeGreaterThanOrEqual(0.97);
    expect(s.x[1]).toBeLessThanOrEqual((1000 + info.width) / 1000 + 0.03);
    expect(s.z[0]).toBeGreaterThanOrEqual(0.97);
    expect(s.z[1]).toBeLessThanOrEqual((1000 + info.depth) / 1000 + 0.03);
    // du sol à la hauteur du modèle, robinet ou abattant compris (jamais plus de 20 cm au-dessus)
    expect(s.y[0]).toBe(0);
    expect(s.y[1]).toBeGreaterThanOrEqual(h - 0.001);
    expect(s.y[1]).toBeLessThanOrEqual(h + 0.2);
    expect(s.mesh.positions.length / 9).toBeGreaterThan(10);
    // normales unitaires
    for (let i = 0; i < s.mesh.normals.length; i += 3) {
      const n = Math.hypot(s.mesh.normals[i]!, s.mesh.normals[i + 1]!, s.mesh.normals[i + 2]!);
      expect(n).toBeGreaterThan(0.99);
      expect(n).toBeLessThan(1.01);
    }
  });

  it('hauteurs de modèles courants (Leroy Merlin)', () => {
    expect(EQUIPMENT.toilet.height).toBe(780);
    expect(EQUIPMENT.basin.height).toBe(840);
    expect(EQUIPMENT.shower.height).toBe(50);
    expect(EQUIPMENT.bath.height).toBe(580);
    expect(EQUIPMENT.sink.height).toBe(900);
    expect(EQUIPMENT.washer.height).toBe(850);
    // poteau et conduit : du sol au plafond de la pièce
    expect(equipmentHeight({ kind: 'post' }, room)).toBe(2500);
    expect(equipmentHeight({ kind: 'duct' }, { height: 2700 })).toBe(2700);
  });

  it('le dos est contre le mur le plus proche', () => {
    const near = (x: number, y: number, w = 400, h = 700) => ({ x0: x, x1: x + w, y0: y, y1: y + h });
    expect(backSide(room, near(1000, 0))).toBe('-y');
    expect(backSide(room, near(1000, 2300))).toBe('+y');
    expect(backSide(room, near(0, 1000, 700, 400))).toBe('-x');
    expect(backSide(room, near(3300, 1000, 700, 400))).toBe('+x');
  });

  it('un WC contre le mur du haut a son réservoir côté mur, la cuvette vers la pièce', () => {
    const o: Obstacle = { id: 'w', kind: 'toilet', outline: sq(1000, 0, 400, 700) };
    const [mesh] = buildEquipment(planWith(o), ['a']);
    const p = mesh!.positions;
    // sommets du haut du réservoir (y ≈ 0,78 m) : tous dans le premier tiers de la profondeur, côté mur (z petit)
    const tank = [];
    for (let i = 0; i < p.length; i += 3) if (p[i + 1]! > 0.77 && p[i + 1]! < 0.79) tank.push(p[i + 2]!);
    expect(tank.length).toBeGreaterThan(0);
    expect(Math.max(...tank)).toBeLessThan(0.4);
  });
});
