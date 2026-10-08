import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/core';
import { createOpening, createProject, createSurface, createTile, createZone } from '../../src/state/factories';
import { toProjectSpec } from '../../src/state/selectors';
import { compareValue, glueRows, pieceCutText, projectDescription, shoppingLabel } from '../../src/ui/lib/labels';

const tile = createTile({ name: '60 × 30 cm' });

describe('libellés des résultats', () => {
  const s = createSurface(tile.id, {
    width: 3000,
    height: 2400,
    openings: [createOpening('window', { revealDepth: 150, x: 1000, sill: 900 })],
    zones: [createZone(tile.id, { pattern: 'half' })],
  });
  const p = createProject([s, { ...createSurface(tile.id), name: 'Mur B' }]);
  const R = computeProject(toProjectSpec(p, [tile]).spec);

  it('liste d’achat comme legacy', () => {
    const labels = R.shopping.map((it) => shoppingLabel(it, R.plan.groups));
    expect(labels[0]).toMatchObject({ label: '60 × 30 cm', unit: '€/m²', dot: '#d8cfc2' });
    expect(labels[0]!.qty).toMatch(/^\d+ cartons \(\d+,\d+ m²\)$/);
    expect(labels.find((l) => l.label.startsWith('Mortier-colle'))!.qty).toMatch(/sacs de 25 kg/);
    expect(labels.find((l) => l.label === 'Mortier de joint')!.unit).toBe('€/sac');
    expect(labels.find((l) => l.label.startsWith('Silicone'))!.qty).toMatch(/cartouche/);
  });

  it('encollage par zone, nom de surface si plusieurs', () => {
    const rows = glueRows(p, R);
    expect(rows[0]).toMatchObject({
      where: 'Surface 1, Zone 1',
      tile: '60 × 30 cm',
      size: expect.stringMatching(/^1\s800 cm²$/),
      notch: 'U9 (9 mm)',
      mode: 'Double',
    });
  });

  it('pièces du plan de découpe', () => {
    const reveal = R.pieces.find((x) => x.reveal)!;
    expect(pieceCutText(reveal, p)).toMatch(
      /^(biais |encoche )?[\d,]+ × [\d,]+ \(F1 (tableau gauche|tableau droit|linteau)\) \[Surface 1\]$/,
    );
  });

  it('description et comparaison', () => {
    expect(projectDescription(p, [tile])).toBe('2 surfaces, décalé ½ 60 × 30');
    expect(compareValue(10, 8, 1)).toEqual({ delta: -2, verdict: 'better' });
    expect(compareValue(10, 12, -1)).toEqual({ delta: 2, verdict: 'better' });
    expect(compareValue(3, 3, 1).verdict).toBe('same');
    expect(compareValue(3, 5, 0).verdict).toBe('same');
  });
});
