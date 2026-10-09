import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import { createBand, createPoseSettings, createTile } from '../../src/modules/carrelage/state/factories';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import {
  compareValue,
  glueRows,
  pieceCutText,
  projectDescription,
  shoppingLabel,
} from '../../src/modules/carrelage/ui/lib/labels';
import { rect, tiledProject, tilePose, view, withOpening } from './planFixtures';

const tile = createTile({ name: '60 × 30 cm' });

describe('libellés des résultats', () => {
  // mur 1 : 3 m × 2,4 m, fenêtre du plan avec tableaux de 15 cm ; mur 2 : 2 m
  const room = withOpening(rect('r', 3000, 2000, { height: 2400 }), 0, { offset: 1000, sill: 900 });
  const w0 = createPoseSettings(tile.id, {
    bands: [createBand(tile.id, { pattern: 'half' })],
    openings: {
      'r-o0': { covered: true, revealDepth: 150, reveals: { left: true, right: true, top: true, bottom: false } },
    },
  });
  const p = view(
    tiledProject(
      [room],
      [
        tilePose('W0', { room: 'r', wall: 'r-w0' }, w0),
        tilePose('W1', { room: 'r', wall: 'r-w1' }, createPoseSettings(tile.id)),
      ],
    ),
  );
  const R = computeProject(toProjectSpec(p, [tile]).spec);

  it('liste d’achat comme legacy', () => {
    const labels = R.shopping.map((it) => shoppingLabel(it, R.plan.groups));
    expect(labels[0]).toMatchObject({ label: '60 × 30 cm', unit: '€/m²', dot: '#d8cfc2' });
    expect(labels[0]!.qty).toMatch(/^\d+ cartons \(\d+,\d+ m²\)$/);
    expect(labels.find((l) => l.label.startsWith('Mortier-colle'))!.qty).toMatch(/sacs de 25 kg/);
    expect(labels.find((l) => l.label === 'Mortier de joint')!.unit).toBe('€/sac');
    expect(labels.find((l) => l.label.startsWith('Silicone'))!.qty).toMatch(/cartouche/);
  });

  it('encollage par bande, nom de surface si plusieurs', () => {
    const rows = glueRows(p, R);
    expect(rows[0]).toMatchObject({
      where: 'Pièce, mur 1, Bande 1',
      tile: '60 × 30 cm',
      size: expect.stringMatching(/^1\s800 cm²$/),
      notch: 'U9 (9 mm)',
      mode: 'Double',
    });
  });

  it('pièces du plan de découpe', () => {
    const reveal = R.pieces.find((x) => x.reveal)!;
    expect(pieceCutText(reveal, p)).toMatch(
      /^(biais |encoche )?[\d,]+ × [\d,]+ \(F1 (tableau gauche|tableau droit|linteau)\) \[Pièce, mur 1\]$/,
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
