import { describe, expect, it } from 'vitest';
import { reduce } from '../../src/modules/carrelage/state/actions';
import {
  createBand,
  createData,
  createPoseSettings,
  createReservation,
  createTile,
} from '../../src/modules/carrelage/state/factories';
import type { CarrelageData } from '../../src/modules/carrelage/state/data';
import { HISTORY_LIMIT, initHistory, record, redo, undo } from '../../src/state/history';
import { tileSpec } from '../../src/modules/carrelage/state/selectors';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import { createProjectStore, type ProjectState } from '../../src/state/store';
import { rect, tiledProject, tilePose } from './planFixtures';

const tile = createTile();
const room = rect('r', 3000, 2000);
/** Deux poses : sol (F) et mur 1 (W). */
const make = (): CarrelageData =>
  createData({ poses: { F: createPoseSettings(tile.id), W: createPoseSettings(tile.id) } });

describe('réducteur du carrelage', () => {
  it('ne modifie jamais son entrée et garde la référence si rien ne change', () => {
    const p = make();
    const frozen = JSON.stringify(p);
    const z = p.poses.F!.bands[0]!;
    const q = reduce(p, { type: 'carrelage/band/update', poseId: 'F', bandId: z.id, patch: { angle: 45 } });
    expect(JSON.stringify(p)).toBe(frozen);
    expect(q.poses.F!.bands[0]!.angle).toBe(45);
    expect(q.poses.W).toBe(p.poses.W);
    expect(reduce(p, { type: 'carrelage/band/update', poseId: 'F', bandId: z.id, patch: { angle: 0 } })).toBe(p);
    expect(reduce(p, { type: 'carrelage/pose/update', poseId: 'inconnue', patch: { joint: 1 } })).toBe(p);
  });

  it('les réglages d’une pose arrivent et partent avec elle (événements du projet)', () => {
    let p = make();
    p = reduce(p, { type: 'pose/added', poseId: 'N', settings: createPoseSettings(tile.id, { joint: 5 }) });
    expect(p.poses.N!.joint).toBe(5);
    expect(reduce(p, { type: 'pose/added', poseId: 'N', settings: createPoseSettings('x') })).toBe(p);
    p = reduce(p, { type: 'pose/removed', poseId: 'N' });
    expect(Object.keys(p.poses)).toEqual(['F', 'W']);
  });

  it('bandes : ajout, déplacement, suppression (jamais la dernière, plinthe reportée)', () => {
    let p = make();
    const z0 = p.poses.F!.bands[0]!,
      z1 = createBand(tile.id);
    p = reduce(p, { type: 'carrelage/band/add', poseId: 'F', band: z1 });
    p = reduce(p, {
      type: 'carrelage/pose/update',
      poseId: 'F',
      patch: { plinth: { length: 1000, height: 80, bandId: z0.id } },
    });
    p = reduce(p, { type: 'carrelage/band/move', poseId: 'F', bandId: z1.id, to: 0 });
    expect(p.poses.F!.bands.map((z) => z.id)).toEqual([z1.id, z0.id]);
    p = reduce(p, { type: 'carrelage/band/remove', poseId: 'F', bandId: z0.id });
    expect(p.poses.F!.plinth!.bandId).toBe(z1.id);
    expect(reduce(p, { type: 'carrelage/band/remove', poseId: 'F', bandId: z1.id })).toBe(p);
  });

  it('modèle de bandes : toutes remplacées, plinthe reportée', () => {
    const p = reduce(make(), {
      type: 'carrelage/pose/update',
      poseId: 'F',
      patch: { plinth: { length: 1000, height: 80, bandId: 'x' } },
    });
    const bands = [createBand(tile.id, { unit: 'rows', size: 3 }), createBand(tile.id, { pattern: 'herring' })];
    const q = reduce(p, { type: 'carrelage/band/replaceAll', poseId: 'F', bands, split: 'v' });
    expect(q.poses.F).toMatchObject({ split: 'v', plinth: { bandId: bands[0]!.id } });
  });

  it('réservations et finitions des ouvertures du plan', () => {
    let p = make();
    const r = createReservation('socket', { room: 'r', wall: 'r-w0' }, { x: 500 });
    p = reduce(p, { type: 'carrelage/reservation/add', poseId: 'W', reservation: r });
    p = reduce(p, { type: 'carrelage/reservation/update', poseId: 'W', reservationId: r.id, patch: { x: 800 } });
    expect(p.poses.W!.reservations).toMatchObject([{ id: r.id, x: 800, type: 'socket', surface: { wall: 'r-w0' } }]);
    p = reduce(p, { type: 'carrelage/opening/finish', poseId: 'W', openingId: 'o1', patch: { revealDepth: 150 } });
    expect(p.poses.W!.openings.o1).toEqual({
      covered: true,
      revealDepth: 150,
      reveals: { left: true, right: true, top: true, bottom: false },
    });
    p = reduce(p, { type: 'carrelage/reservation/remove', poseId: 'W', reservationId: r.id });
    expect(p.poses.W!.reservations).toEqual([]);
  });

  it('prix : saisie et effacement ; remplacement de toutes les données', () => {
    let p = reduce(make(), { type: 'carrelage/price', key: 'colle', value: 18.5 });
    expect(p.prices).toEqual({ colle: 18.5 });
    p = reduce(p, { type: 'carrelage/price', key: 'colle', value: null });
    expect(p.prices).toEqual({});
    expect(reduce(make(), { type: 'carrelage/replace', data: createData() })).toEqual(createData());
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
    const doc = tiledProject(
      [room],
      [tilePose('F', { room: 'r', wall: null }, createPoseSettings(tile.id))],
      {},
      { name: 'Nouveau projet', updatedAt: 1000 },
    );
    const store = createProjectStore(doc, reduceProject, {
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
});
