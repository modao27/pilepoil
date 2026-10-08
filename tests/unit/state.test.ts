import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import { reduce } from '../../src/modules/carrelage/state/actions';
import {
  createCorner,
  createOpening,
  createProject,
  createSurface,
  createTile,
  createZone,
} from '../../src/modules/carrelage/state/factories';
import { HISTORY_LIMIT, initHistory, record, redo, undo } from '../../src/state/history';
import { toProjectSpec, tileSpec } from '../../src/modules/carrelage/state/selectors';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import { createProjectStore, type ProjectState } from '../../src/state/store';
import { projectFromV1 } from '../../src/storage/migrations';

const tile = createTile();
const make = () => createProject([createSurface(tile.id)], {}, 1000);

describe('réducteur', () => {
  it('ne modifie jamais son entrée et garde la référence si rien ne change', () => {
    const p = make();
    const frozen = JSON.stringify(p);
    const s = p.surfaces[0]!;
    const q = reduce(p, {
      type: 'carrelage/zone/update',
      surfaceId: s.id,
      zoneId: s.zones[0]!.id,
      patch: { angle: 45 },
    });
    expect(JSON.stringify(p)).toBe(frozen);
    expect(q.surfaces[0]!.zones[0]!.angle).toBe(45);
    expect(q.surfaces[0]!.openings).toBe(s.openings);
    expect(
      reduce(p, { type: 'carrelage/zone/update', surfaceId: s.id, zoneId: s.zones[0]!.id, patch: { angle: 0 } }),
    ).toBe(p);
    expect(reduce(p, { type: 'carrelage/surface/update', surfaceId: 'inconnu', patch: { width: 1 } })).toBe(p);
  });

  it('zones : ajout, déplacement, suppression (jamais la dernière, plinthe reportée)', () => {
    let p = make();
    const s = p.surfaces[0]!,
      z0 = s.zones[0]!,
      z1 = createZone(tile.id);
    p = reduce(p, { type: 'carrelage/zone/add', surfaceId: s.id, zone: z1 });
    p = reduce(p, {
      type: 'carrelage/surface/update',
      surfaceId: s.id,
      patch: { plinth: { length: 1000, height: 80, zoneId: z0.id } },
    });
    p = reduce(p, { type: 'carrelage/zone/move', surfaceId: s.id, zoneId: z1.id, to: 0 });
    expect(p.surfaces[0]!.zones.map((z) => z.id)).toEqual([z1.id, z0.id]);
    p = reduce(p, { type: 'carrelage/zone/remove', surfaceId: s.id, zoneId: z0.id });
    expect(p.surfaces[0]!.plinth!.zoneId).toBe(z1.id);
    expect(reduce(p, { type: 'carrelage/zone/remove', surfaceId: s.id, zoneId: z1.id })).toBe(p);
  });

  it('ouvertures et angles', () => {
    let p = make();
    const sid = p.surfaces[0]!.id,
      o = createOpening('door'),
      c = createCorner();
    p = reduce(p, { type: 'carrelage/opening/add', surfaceId: sid, opening: o });
    p = reduce(p, { type: 'carrelage/opening/update', surfaceId: sid, openingId: o.id, patch: { x: 50 } });
    p = reduce(p, { type: 'carrelage/corner/add', surfaceId: sid, corner: c });
    expect(p.surfaces[0]!.openings[0]).toMatchObject({ type: 'door', x: 50, width: 830 });
    p = reduce(p, { type: 'carrelage/opening/remove', surfaceId: sid, openingId: o.id });
    p = reduce(p, { type: 'carrelage/corner/remove', surfaceId: sid, cornerId: c.id });
    expect(p.surfaces[0]!.openings).toEqual([]);
    expect(p.surfaces[0]!.corners).toEqual([]);
  });

  it('supprimer une surface la retire de la pièce', () => {
    let p = make();
    const s2 = createSurface(tile.id, { name: 'Sol', kind: 'floor' });
    p = reduce(p, { type: 'carrelage/surface/add', surface: s2 });
    p = reduce(p, {
      type: 'carrelage/room',
      room: {
        length: 2000,
        width: 1500,
        height: 2500,
        tiledHeight: 2000,
        walls: { A: p.surfaces[0]!.id, floor: s2.id },
      },
    });
    p = reduce(p, { type: 'carrelage/surface/remove', surfaceId: s2.id });
    expect(p.room!.walls).toEqual({ A: p.surfaces[0]!.id });
    p = reduce(p, { type: 'carrelage/surface/add', surface: s2 });
    p = reduce(p, { type: 'carrelage/surface/remove', surfaceId: p.surfaces[0]!.id });
    expect(p.room).toBeNull();
  });

  it('prix : saisie et effacement', () => {
    let p = reduce(make(), { type: 'carrelage/price', key: 'colle', value: 18.5 });
    expect(p.prices).toEqual({ colle: 18.5 });
    p = reduce(p, { type: 'carrelage/price', key: 'colle', value: null });
    expect(p.prices).toEqual({});
  });
});

describe('historique', () => {
  it('annuler, rétablir, futur vidé par une nouvelle action', () => {
    let h = initHistory(1);
    h = record(h, 2, null, 0);
    h = record(h, 3, null, 10);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(record(undo(h), 9, null, 20));
    expect(h.present).toBe(2);
    expect(h.future).toEqual([9]);
  });

  it('un même geste rapide fusionne en une étape', () => {
    let h = initHistory(0);
    for (let i = 1; i <= 5; i++) h = record(h, i, 'drag', i * 100);
    expect(h.past).toEqual([0]);
    h = record(h, 6, 'drag', 100 + 500 + 900);
    expect(h.past).toEqual([0, 5]);
    h = record(h, 7, 'other', 1501);
    expect(h.past).toEqual([0, 5, 6]);
  });

  it('limité à HISTORY_LIMIT étapes', () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = record(h, i, null, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe('store', () => {
  it('notifie, date les modifications, annule et enregistre', () => {
    let t = 5000;
    const saved: number[] = [];
    const store = createProjectStore(projectFromV1(make()), reduceProject, {
      now: () => t,
      onChange: (p) => saved.push(p.updatedAt),
    });
    const states: ProjectState<Project>[] = [];
    const off = store.subscribe((s) => states.push(s));
    store.dispatch({ type: 'project/rename', name: 'Salle de bain' });
    expect(store.get()).toMatchObject({ canUndo: true, canRedo: false });
    expect(store.get().project.updatedAt).toBe(5000);
    t = 6000;
    store.undo();
    expect(store.get().project.name).toBe('Nouveau projet');
    store.dispatch({ type: 'project/rename', name: 'Nouveau projet' });
    expect(states).toHaveLength(3);
    expect(saved).toEqual([5000, 1000]);
    off();
    store.redo();
    expect(states).toHaveLength(3);
  });
});

describe('passage au moteur', () => {
  it('carreau debout ou couché, hexagone', () => {
    expect(tileSpec(tile, false)).toMatchObject({ width: 600, height: 300 });
    expect(tileSpec(tile, true)).toMatchObject({ width: 300, height: 600 });
    expect(tileSpec(createTile({ shape: 'hex', length: 200, width: 200 }), true)).toMatchObject({
      width: 200,
      height: 200,
    });
  });

  it('résout carreaux, plinthe, pièce ; signale un carreau manquant', () => {
    const p = make();
    const s = p.surfaces[0]!;
    const floor = createSurface('absent', { kind: 'floor' });
    const q = {
      ...p,
      surfaces: [{ ...s, plinth: { length: 1000, height: 80, zoneId: s.zones[0]!.id } }, floor],
      room: {
        length: 3000,
        width: 2000,
        height: 2500,
        tiledHeight: 2400,
        walls: { A: s.id, floor: floor.id, B: 'supprimée' },
      },
    };
    const { spec, ids, missingTiles } = toProjectSpec(q, [tile]);
    expect(spec.room!.walls).toEqual({ A: 0, floor: 1 });
    expect(spec.surfaces[0]!.plinth).toEqual({ length: 1000, height: 80, zone: 0 });
    expect(ids.surfaces).toEqual([s.id, floor.id]);
    expect(missingTiles).toEqual([{ surfaceId: floor.id, zoneId: floor.zones[0]!.id, tileId: 'absent' }]);
    const R = computeProject(spec);
    expect(R.surfaces[0]!.ok).toBe(true);
    expect(R.surfaces[1]).toMatchObject({ ok: false, error: { code: 'invalid-tile', zone: 0 } });
  });
});
