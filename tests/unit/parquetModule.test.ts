import { describe, expect, it } from 'vitest';
import { intersection, regionArea } from '../../src/core/geometry/boolean';
import type { Segment } from '../../src/core/geometry/types';
import { lRoom, rectRoom } from '../../src/core/plan/factories';
import { module as parquet } from '../../src/modules/parquet';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { ParquetResult } from '../../src/modules/parquet/core/types';
import { createPoseSettings, type ParquetData, type ParquetPose } from '../../src/modules/parquet/state/model';
import {
  addPoseAction,
  layoutsOf,
  newPoseSettings,
  splitPoseAction,
  toggleRoomAction,
} from '../../src/modules/parquet/state/poses';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import { parquetProject } from './parquetHelpers';

let n = 0;
const id = () => 'i' + ++n;
const libraries = { boards: BOARD_TEMPLATES };

/** Séjour et Cuisine (non reliées), une pose sur le Séjour. */
function project(): Project {
  const a = rectRoom(4000, 3000, { name: 'Séjour', origin: [1000, 500] }, id);
  const b = lRoom(5000, 4000, 2000, 2000, { name: 'Cuisine', origin: [6000, 0] }, id);
  return parquetProject({ rooms: [a, b], passages: [] }, [{ id: 'L1', rooms: [a.id] }]);
}

const data = (p: Project) => p.modules.parquet!.data as ParquetData;
const specOf = (p: Project) => {
  const r = parquet.toSpec(p, libraries);
  if (!('spec' in r)) throw new Error(JSON.stringify(r));
  return r.spec;
};
const update = (p: Project, patch: Partial<ParquetPose>, poseId = 'L1') =>
  reduceProject(p, { type: 'parquet/pose/update', poseId, patch } as never);

describe('module parquet', () => {
  it('create : aucune pose ; createPose : stratifié, règles du stratifié, ou réglages d’une autre pose', () => {
    expect(parquet.create({ rooms: [], passages: [] }).poses).toEqual({});
    const p = project();
    const fresh = parquet.createPose(p, libraries) as ParquetPose;
    expect(fresh).toMatchObject({
      boardId: 'modele-stratifie',
      method: 'floating',
      pattern: { kind: 'random-stagger' },
    });
    expect(fresh.rules.expansionGap).toBe(8);
    // lame par défaut supprimée : la première de la bibliothèque
    expect(newPoseSettings(null, [BOARD_TEMPLATES[1]!])).toMatchObject({ boardId: BOARD_TEMPLATES[1]!.id });
    const q = update(p, {
      angle: 45,
      breaks: [
        [
          [0, 0],
          [1, 1],
        ],
      ],
      offset: [5, 5],
    });
    expect(parquet.createPose(q, libraries, 'L1')).toMatchObject({ angle: 45, breaks: [], offset: [0, 0] });
  });

  it('poses vues par l’éditeur : réglages, nom, pièces', () => {
    const p = project();
    expect(layoutsOf(p)).toMatchObject([{ id: 'L1', name: 'Pose 1', rooms: [p.plan.rooms[0]!.id] }]);
  });

  it('toSpec : pièces au repère du plan, mur de référence, marge conseillée', () => {
    const p = project();
    const s = specOf(p);
    expect(s.layouts[0]!.rooms[0]!.outline[0]).toEqual([1000, 500]);
    expect(s.layouts[0]!.rooms[0]!.bounds).toEqual([]);
    expect(s.layouts[0]!.referenceDirection).toEqual([1, 0]);
    expect(s.settings.marginPct).toBe(5);
    expect(s.layouts[0]!.board).toMatchObject({ lengths: [1285], width: 192 });
    // diagonale : 10 %
    expect(specOf(update(p, { angle: 45 })).settings.marginPct).toBe(10);
  });

  it('toSpec : lame introuvable → erreur du moteur ; aucune pose → rien à calculer', () => {
    const p = project();
    expect(computeParquet(specOf(update(p, { boardId: 'x' }))).layouts[0]!.errors).toEqual([{ code: 'missing-board' }]);
    const none = reduceProject(p, { type: 'pose/remove', poseId: 'L1' });
    expect(parquet.toSpec(none, libraries)).toEqual({ errors: [{ code: 'parquet/no-room' }] });
    // réglages partis avec la pose
    expect(data(none).poses).toEqual({});
  });

  it('pièce supprimée du plan : sa zone part, la pose restée sans zone aussi, avec ses réglages', () => {
    const p = project();
    const q = reduceProject(p, { type: 'plan/room/remove', roomId: p.plan.rooms[0]!.id });
    expect([q.zones, q.poses, data(q).poses]).toEqual([[], [], {}]);
  });

  it('nouvelle pose sur une pièce ; cocher une pièce non reliée ou déjà couverte : refusé', () => {
    const p = project();
    const [a, b] = p.plan.rooms;
    expect(toggleRoomAction(p, 'L1', b!.id, true, id)).toEqual({ error: { code: 'pose-extent' } });
    const q = reduceProject(
      p,
      addPoseAction(p, b!.id, createPoseSettings(), () => 'L2'),
    );
    expect(layoutsOf(q).map((l) => [l.id, l.name, l.rooms])).toEqual([
      ['L1', 'Pose 1', [a!.id]],
      ['L2', 'Pose 2', [b!.id]],
    ]);
    expect(toggleRoomAction(q, 'L2', a!.id, true, id)).toMatchObject({ error: { code: 'zone-overlap' } });
    // décocher la dernière pièce : la pose disparaît
    const off = toggleRoomAction(q, 'L2', b!.id, false, id);
    if (!('action' in off)) throw new Error('action');
    expect(reduceProject(q, off.action).poses.map((x) => x.id)).toEqual(['L1']);
  });

  it('achats : paquets = lames × (1 + marge) / lames par paquet ; prix saisi ou de la bibliothèque', () => {
    const p = project();
    const r = computeParquet(specOf(p));
    const used = r.totals.boards;
    const lines = parquet.shopping(r, data(p), libraries, p).filter((x) => x.group === 'covering');
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
    expect(parquet.shopping(r, priced, libraries, p)[0]).toMatchObject({
      unitPrice: 21.9,
      priceFromLibrary: false,
    });
  });

  it('achats : lames A et B comptées et emballées séparément', () => {
    const p = project();
    const r = computeParquet(specOf(p));
    const handed: ParquetResult = {
      ...r,
      layouts: r.layouts.map((l) => ({ ...l, boards: l.boards.map((b, i) => ({ ...b, variant: i % 2 ? 'B' : 'A' })) })),
    };
    const d: ParquetData = { ...data(p), poses: { L1: createPoseSettings({ boardId: 'modele-baton-rompu' }) } };
    const lines = parquet.shopping(handed, d, libraries, p).filter((x) => x.group === 'covering');
    expect(lines.map((l) => l.key)).toEqual([
      'parquet:board:modele-baton-rompu:A',
      'parquet:board:modele-baton-rompu:B',
    ]);
  });

  it('liste d’achat de R1 : 7 paquets, 1 rouleau de sous-couche, 6 barres de plinthe', () => {
    const p = project();
    const r = computeParquet(specOf(p));
    expect(r.totals.boards).toBe(52);
    const lines = parquet.shopping(r, data(p), libraries, p);
    // 52 × 1,05 / 9 = 6,07 → 7 ; 11,888 × 1,05 / 15 = 0,83 → 1 ; plinthes : voir parquetSkirting (6 barres)
    expect(lines.map((x) => [x.key, x.quantity, x.unit, x.detail])).toEqual([
      ['parquet:board:modele-stratifie', 7, 'pack', '52 lames + 5 % (9 par paquet)'],
      ['parquet:underlay', 1, 'roll', '11,9 m² + 5 % de recouvrement (15 m² par rouleau)'],
      ['parquet:skirting', 6, 'bar', '14 m, barres de 2,4 m'],
    ]);
  });

  it('pose collée ou clouée : pas de sous-couche, colle ou fixations', () => {
    for (const [method, key] of [
      ['glued', 'parquet:glue'],
      ['nailed', 'parquet:fixings'],
    ] as const) {
      const p = update(project(), { method });
      const keys = parquet.shopping(computeParquet(specOf(p)), data(p), libraries, p).map((x) => x.key);
      expect(keys).toContain(key);
      expect(keys).not.toContain('parquet:underlay');
    }
  });

  it('résumé : lames, surface, perte', () => {
    const r = computeParquet(specOf(project()));
    expect(parquet.summary(r).text).toMatch(/^\d+ lames, 11,9 m², perte \d+ %$/);
  });

  it('schéma 4 : réglages par pose, sans migration des anciennes données', () => {
    expect(parquet.schemaVersion).toBe(4);
    expect(parquet.migrations).toEqual({});
  });
});

describe('plusieurs pièces (P3)', () => {
  /** R7 dans le plan : deux pièces 4000 × 3000, mur de 72, portes de 830 face à face (y de 1000 à 1830). */
  function r7(): Project {
    const a = rectRoom(4000, 3000, { name: 'Séjour' }, id);
    const b = rectRoom(4000, 3000, { name: 'Bureau', origin: [4072, 0] }, id);
    a.openings = [{ id: 'da', kind: 'door', wall: a.walls[1]!.id, offset: 1000, width: 830, sill: 0, height: 2040 }];
    b.openings = [{ id: 'db', kind: 'door', wall: b.walls[3]!.id, offset: 1170, width: 830, sill: 0, height: 2040 }];
    const plan = {
      rooms: [a, b],
      passages: [{ id: 'P1', a: { room: a.id, opening: 'da' }, b: { room: b.id, opening: 'db' } }],
    };
    return parquetProject(plan, [{ id: 'L1', rooms: [a.id, b.id] }]);
  }
  const passage: Segment = [
    [4036, 1000],
    [4036, 1830],
  ];

  it('toSpec : passage entre deux pièces de la pose, ouverture côté a, épaisseur du mur', () => {
    const s = specOf(r7());
    expect(s.layouts[0]!.passages).toEqual([
      {
        id: 'P1',
        a: expect.any(String),
        b: expect.any(String),
        segment: [
          [4000, 1000],
          [4000, 1830],
        ],
        width: 830,
        depth: 72,
      },
    ]);
    const l = computeParquet(s).layouts[0]!;
    expect(l.warnings).toContainEqual({ code: 'narrow-passage', passage: 'P1', width: 830 });
    // une seule pièce dans la pose : pas de passage
    const p = r7();
    const off = toggleRoomAction(p, 'L1', p.plan.rooms[1]!.id, false, id);
    if (!('action' in off)) throw new Error('action');
    expect(specOf(reduceProject(p, off.action)).layouts[0]!.passages).toEqual([]);
  });

  it('cocher une pièce reliée par un passage : elle rejoint la pose', () => {
    const plan = r7().plan;
    const [a, b] = plan.rooms;
    const p = parquetProject(plan, [{ id: 'L1', rooms: [a!.id] }]);
    const on = toggleRoomAction(p, 'L1', b!.id, true, () => 'z');
    if (!('action' in on)) throw new Error('action');
    expect(layoutsOf(reduceProject(p, on.action))[0]!.rooms).toEqual([a!.id, b!.id]);
  });

  it('zone limitée dans une pièce : le passage n’atteint pas la partie hors zone', () => {
    const plan = r7().plan;
    const [a, b] = plan.rooms;
    // dans le Bureau, la pose ne garde que x > 2000 (repère de la pièce) : loin de la porte
    const line: Segment = [
      [2000, 3000],
      [2000, 0],
    ];
    const p = parquetProject(plan, [{ id: 'L1', rooms: [a!.id, b!.id], cuts: { [b!.id]: [{ line, side: 1 }] } }]);
    const l = computeParquet(specOf(p)).layouts[0]!;
    expect(l.layable).toHaveLength(2);
    expect(regionArea(l.layable)).toBeCloseTo(3984 * 2984 + 1984 * 2984, -3);
  });

  it('séparer une pose au passage : le Bureau passe dans une nouvelle pose, le seuil posé devient la limite', () => {
    const p1 = update(r7(), { breaks: [passage] });
    const [a, b] = p1.plan.rooms;
    const r = splitPoseAction(p1, 'L1', passage, data(p1).poses.L1!, () => 'L2');
    if (!r) throw new Error('split');
    const p2 = reduceProject(p1, r.action);
    expect(layoutsOf(p2).map((l) => [l.id, l.name, l.rooms, l.breaks])).toEqual([
      ['L1', 'Pose 1', [a!.id], []],
      ['L2', 'Pose 2', [b!.id], []],
    ]);
    // aucune zone coupée : chaque pièce entière
    expect(p2.zones.every((z) => z.cuts.length === 0)).toBe(true);
    // ligne hors de la pose : rien à séparer
    const far: Segment = [
      [9000, 0],
      [9000, 10],
    ];
    expect(splitPoseAction(p2, 'L1', far, data(p2).poses.L1!, id)).toBeNull();
  });

  it('séparer dans une pièce : la zone est coupée, deux poses sans recouvrement, limite comptée une fois', () => {
    const p0 = r7();
    const [a] = p0.plan.rooms;
    const line: Segment = [
      [2000, 0],
      [2000, 3000],
    ];
    const r = splitPoseAction(p0, 'L1', line, data(p0).poses.L1!, () => 'L2');
    if (!r) throw new Error('split');
    const p = reduceProject(p0, r.action);
    expect(p.zones.filter((z) => z.surface.room === a!.id).map((z) => [z.pose, z.cuts])).toEqual([
      ['L1', [{ line, side: 1 }]],
      ['L2', [{ line, side: -1 }]],
    ]);
    const res = computeParquet(specOf(p));
    const [l1, l2] = res.layouts;
    expect(regionArea(intersection(l1!.layable, l2!.layable))).toBe(0);
    expect(res.layouts.flatMap((l) => l.warnings).filter((w) => w.code === 'layout-overlap')).toEqual([]);
    expect(res.layouts.flatMap((l) => l.thresholds).filter((t) => t.status === 'applied')).toHaveLength(1);
    // supprimer la pose 2 : ses réglages partent avec elle
    const p3 = reduceProject(p, { type: 'pose/remove', poseId: 'L2' });
    expect(Object.keys(data(p3).poses)).toEqual(['L1']);
  });

  it('liste d’achat de R7, seuil posé : lames, sous-couche, plinthes, barre de seuil', () => {
    const p = update(r7(), { breaks: [passage] });
    const r = computeParquet(specOf(p));
    const lines = parquet.shopping(r, data(p), libraries, p);
    expect(lines.map((x) => [x.key, x.quantity, x.unit])).toEqual([
      ['parquet:board:modele-stratifie', Math.ceil((r.totals.boards * 1.05) / 9), 'pack'],
      // 2 × 3984 × 2984 + bande du passage 814 × 88 − bande du seuil 814 × 16 = 23,835 m² × 1,05 / 15 = 1,67
      ['parquet:underlay', 2, 'roll'],
      // 4 murs de 4000 et 2 de 3000 (onglets : + 20), 4 morceaux contre la porte (1000 et 1170, + 10) :
      // 6 barres entières + [1620, 620] × 2 + [1180, 1010] × 2 + [1620] × 2 = 12 barres
      ['parquet:skirting', 12, 'bar'],
      // seuil de 830 : une barre de 93 cm
      ['parquet:threshold', 1, 'bar'],
    ]);
    expect(r.totals.area).toBeCloseTo(23.835, 2);
    expect(lines.find((x) => x.key === 'parquet:threshold')!.detail).toBe('1 seuil, barres de 93 cm');
  });
});

describe('chantier (P5)', () => {
  const mark = (p: Project, hash: string, ids: string[], done = true) =>
    reduceProject(p, { type: 'parquet/worksite/mark', hash, ids, done } as never);

  it('cocher et décocher des pièces, pour une empreinte de calcul', () => {
    const p0 = project();
    const p1 = mark(p0, 'h1', ['a', 'b']);
    expect(data(p1).worksite).toEqual({ resultHash: 'h1', done: ['a', 'b'] });
    const p2 = mark(p1, 'h1', ['a'], false);
    expect(data(p2).worksite).toEqual({ resultHash: 'h1', done: ['b'] });
    // sans effet : même état
    expect(mark(p2, 'h1', ['b'])).toBe(p2);
    // autre empreinte : on repart de la nouvelle
    expect(data(mark(p2, 'h2', ['c'])).worksite).toEqual({ resultHash: 'h2', done: ['c'] });
  });

  it('calcul changé : garder ce qui existe encore, ou repartir de zéro', () => {
    const p1 = mark(project(), 'h1', ['a', 'b', 'c']);
    const keep = reduceProject(p1, { type: 'parquet/worksite/rebase', hash: 'h2', valid: ['b', 'z'] } as never);
    expect(data(keep).worksite).toEqual({ resultHash: 'h2', done: ['b'] });
    const reset = reduceProject(p1, { type: 'parquet/worksite/rebase', hash: 'h2', valid: [] } as never);
    expect(data(reset).worksite).toEqual({ resultHash: 'h2', done: [] });
  });
});
