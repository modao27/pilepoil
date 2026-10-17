import { describe, expect, it } from 'vitest';
import { createMaterial, templateMaterials, validateMaterial } from '../../src/modules/maconnerie/core/defaults';

describe('matériaux de maçonnerie', () => {
  const templates = templateMaterials();

  it('les modèles types sont valides, à identifiants uniques', () => {
    expect(templates.length).toBeGreaterThanOrEqual(20);
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    for (const t of templates) expect(validateMaterial(t), t.name).toEqual([]);
  });

  it('une brique de verre ne se coupe pas, joints alignés, armature prévue', () => {
    const glass = templates.filter((t) => t.family === 'pave-verre');
    expect(glass.length).toBeGreaterThanOrEqual(5);
    for (const g of glass) {
      expect(g.laying.cutAllowed).toBe(false);
      expect(g.laying.bond).toBe('stack');
      expect(g.laying.reinforcement).not.toBeNull();
    }
  });

  it('un matériau sans nom ou aux joints dans le désordre est refusé', () => {
    const m = createMaterial('x', 0, { name: ' ' });
    expect(validateMaterial(m)).toContain('name');
    m.name = 'a';
    m.laying.jointH = { min: 5, def: 3, max: 10 };
    expect(validateMaterial(m)).toContain('joint');
  });
});
