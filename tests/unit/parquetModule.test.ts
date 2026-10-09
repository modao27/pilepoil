import { describe, expect, it } from 'vitest';
import { lRoom, rectRoom } from '../../src/core/plan/factories';
import { module as parquet } from '../../src/modules/parquet';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { ParquetResult } from '../../src/modules/parquet/core/types';
import { createLayout, type ParquetData } from '../../src/modules/parquet/state/model';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';

let n = 0;
const id = () => 'i' + ++n;
const libraries = { boards: BOARD_TEMPLATES };

function project(): Project {
  const a = rectRoom(4000, 3000, { name: 'Séjour', origin: [1000, 500] }, id);
  const b = lRoom(5000, 4000, 2000, 2000, { name: 'Cuisine', origin: [6000, 0] }, id);
  const plan = { rooms: [a, b], passages: [] };
  return {
    schemaVersion: 2,
    id: 'p',
    name: 'Maison',
    createdAt: 0,
    updatedAt: 0,
    plan,
    modules: { parquet: { schemaVersion: 1, data: parquet.create(plan) } },
  };
}

const data = (p: Project) => p.modules.parquet!.data as ParquetData;
const specOf = (p: Project) => {
  const r = parquet.toSpec(p, libraries);
  if (!('spec' in r)) throw new Error(JSON.stringify(r));
  return r.spec;
};

describe('module parquet', () => {
  it('create : une pose sur la première pièce, stratifié, règles du stratifié', () => {
    const d = data(project());
    expect(d.layouts).toHaveLength(1);
    expect(d.layouts[0]).toMatchObject({
      boardId: 'modele-stratifie',
      method: 'floating',
      pattern: { kind: 'random-stagger' },
    });
    expect(d.layouts[0]!.rules.expansionGap).toBe(8);
    expect(parquet.create({ rooms: [], passages: [] }).layouts).toEqual([]);
  });

  it('toSpec : pièces au repère du plan, mur de référence, marge conseillée', () => {
    const p = project();
    const s = specOf(p);
    expect(s.layouts[0]!.rooms[0]!.outline[0]).toEqual([1000, 500]);
    expect(s.layouts[0]!.referenceDirection).toEqual([1, 0]);
    expect(s.settings.marginPct).toBe(5);
    expect(s.layouts[0]!.board).toMatchObject({ lengths: [1285], width: 192 });
    // diagonale : 10 %
    const diag = reduceProject(p, {
      type: 'parquet/layout/update',
      layoutId: data(p).layouts[0]!.id,
      patch: { angle: 45 },
    } as never);
    expect(specOf(diag).settings.marginPct).toBe(10);
  });

  it('toSpec : lame introuvable → erreur du moteur ; pose sans pièce → rien à calculer', () => {
    const p = project();
    const lid = data(p).layouts[0]!.id;
    const missing = reduceProject(p, {
      type: 'parquet/layout/update',
      layoutId: lid,
      patch: { boardId: 'x' },
    } as never);
    expect(computeParquet(specOf(missing)).layouts[0]!.errors).toEqual([{ code: 'missing-board' }]);
    const none = reduceProject(p, { type: 'parquet/layout/update', layoutId: lid, patch: { rooms: [] } } as never);
    expect(parquet.toSpec(none, libraries)).toEqual({ errors: [{ code: 'parquet/no-room' }] });
  });

  it('pièce supprimée du plan : retirée des poses', () => {
    const p = project();
    const room = p.plan.rooms[0]!.id;
    const q = reduceProject(p, { type: 'plan/room/remove', roomId: room });
    expect(data(q).layouts[0]!.rooms).toEqual([]);
  });

  it('achats : paquets = lames × (1 + marge) / lames par paquet ; prix saisi ou de la bibliothèque', () => {
    const p = project();
    const r = computeParquet(specOf(p));
    const used = r.totals.boards;
    const lines = parquet.shopping(r, data(p), libraries);
    expect(lines).toEqual([
      expect.objectContaining({
        key: 'parquet:board:modele-stratifie',
        group: 'covering',
        unit: 'pack',
        quantity: Math.ceil((used * 1.05) / 9),
        unitPrice: null,
      }),
    ]);
    const priced = parquet.reduce(data(p), parquet.priceAction('parquet:board:modele-stratifie', 21.9), p.plan);
    expect(parquet.shopping(r, priced, libraries)[0]).toMatchObject({ unitPrice: 21.9, priceFromLibrary: false });
  });

  it('achats : lames A et B comptées et emballées séparément', () => {
    const p = project();
    const r = computeParquet(specOf(p));
    const handed: ParquetResult = {
      ...r,
      layouts: r.layouts.map((l) => ({ ...l, boards: l.boards.map((b, i) => ({ ...b, variant: i % 2 ? 'B' : 'A' })) })),
    };
    const d: ParquetData = {
      ...data(p),
      layouts: [createLayout(data(p).layouts[0]!.id, [], { boardId: 'modele-baton-rompu' })],
    };
    const lines = parquet.shopping(handed, d, libraries);
    expect(lines.map((l) => l.key)).toEqual([
      'parquet:board:modele-baton-rompu:A',
      'parquet:board:modele-baton-rompu:B',
    ]);
  });

  it('résumé : lames, surface, perte', () => {
    const r = computeParquet(specOf(project()));
    expect(parquet.summary(r).text).toMatch(/^\d+ lames, 11,9 m², perte \d+ %$/);
  });
});
