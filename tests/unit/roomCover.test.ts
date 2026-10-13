/**
 * Écran Pièce (PLAN N3) : revêtir une surface, continuer une pose voisine, retirer une zone (la pose se sépare si
 * elle ne se suit plus), changer le revêtement d'une zone, découper un sol, régler la hauteur d'une zone de mur.
 * Communs à tous les modules.
 */
import { describe, expect, it } from 'vitest';
import type { Cut, SurfaceRef, Zone } from '../../src/core/coverage';
import type { Plan } from '../../src/core/plan/types';
import { carrelageData } from '../../src/modules/carrelage/state/data';
import { createPoseSettings, createTile } from '../../src/modules/carrelage/state/factories';
import { wallHeightCuts } from '../../src/modules/carrelage/state/poses';
import { moduleById } from '../../src/modules/registry';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import type { Project } from '../../src/state/model';
import { reduceProject } from '../../src/state/project';
import {
  continuable,
  continueAction,
  contourAction,
  cutAction,
  modulesFor,
  newPoseAction,
  removeZoneAction,
  spanAction,
  switchAction,
  zonesOn,
} from '../../src/ui/room/cover';
import { ids, planProject, rect, view } from './planFixtures';
import { rectPoly } from '../../src/core/geometry/polygon';
import { regionArea } from '../../src/core/geometry/boolean';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { ParquetSpec } from '../../src/modules/parquet/core/types';

const tile = createTile({ length: 300, width: 300 });
const libraries = { tiles: [tile], boards: BOARD_TEMPLATES };
const carrelage = moduleById('carrelage')!;
const parquet = moduleById('parquet')!;
const floor: SurfaceRef = { room: 'r', wall: null };
const wall = (i: number): SurfaceRef => ({ room: 'r', wall: `r-w${i}` });
const plan = (): Plan => ({ rooms: [rect('r', 3000, 2000, { height: 2500 })], passages: [] });

/** Projet avec le carrelage : poses[id] = zones (surface, lignes). */
function project(poses: Record<string, { ref: SurfaceRef; cuts?: Cut[] }[]> = {}): Project {
  const zones: Zone[] = Object.entries(poses).flatMap(([pose, zs]) =>
    zs.map((z, k) => ({ id: `${pose}-z${k}`, surface: z.ref, cuts: z.cuts ?? [], pose })),
  );
  const p = plan();
  return planProject(
    p.rooms,
    { poses: Object.fromEntries(Object.keys(poses).map((id) => [id, createPoseSettings(tile.id)])) },
    { plan: p, zones, poses: Object.keys(poses).map((id) => ({ id, module: 'carrelage', name: id })) },
  );
}

const apply = (p: Project, r: ReturnType<typeof newPoseAction>) => {
  if ('error' in r) throw new Error(r.error.code);
  return reduceProject(p, r.action);
};

describe('revêtir une surface', () => {
  it('modules proposés : carrelage et parquet au sol, carrelage seul au mur', () => {
    expect(modulesFor(floor).map((m) => m.id)).toEqual(['carrelage', 'parquet']);
    expect(modulesFor(wall(0)).map((m) => m.id)).toEqual(['carrelage', 'peinture']);
  });

  it('nouvelle pose de carrelage : « Pose 1 », une zone sur tout le sol, réglages au module', () => {
    const p = project();
    const q = apply(p, newPoseAction(p, libraries, carrelage, floor, ids('n')));
    expect(q.poses).toEqual([{ id: 'n0', module: 'carrelage', name: 'Pose 1' }]);
    expect(q.zones).toEqual([{ id: 'n1', surface: floor, cuts: [], pose: 'n0' }]);
    expect(view(q).surfaces[0]).toMatchObject({ id: 'n0', kind: 'floor', width: 3000, height: 2000 });
    expect(carrelageData(q)!.poses.n0!.bands[0]!.tileId).toBe(tile.id);
    // sol déjà revêtu : refus expliqué
    expect(newPoseAction(q, libraries, parquet, floor, ids('m'))).toEqual({
      error: { code: 'zone-overlap', zone: 'n1' },
    });
  });

  it('parquet absent du projet : ajouté avec la première pose', () => {
    const p = project();
    const q = apply(p, newPoseAction(p, libraries, parquet, floor, ids('w')));
    expect(Object.keys(q.modules)).toEqual(['carrelage', 'parquet']);
    expect(q.poses.map((x) => x.module)).toEqual(['parquet']);
    expect(parquet.toSpec(q, libraries)).toHaveProperty('spec');
  });

  it('mur voisin : la pose peut continuer, en reprenant la hauteur de la zone voisine', () => {
    const p = project({ A: [{ ref: wall(0), cuts: wallHeightCuts(plan(), wall(0), 1200) }] });
    expect(continuable(p, wall(1), carrelage).map((x) => x.id)).toEqual(['A']);
    expect(continuable(p, wall(2), carrelage)).toEqual([]);
    expect(continuable(p, floor, carrelage)).toEqual([]);
    const q = reduceProject(p, continueAction(p, wall(1), 'A', ids('n')));
    const [s] = view(q).surfaces;
    expect(s!.name).toBe('Pièce, murs 1 et 2');
    expect([s!.width, s!.height]).toEqual([5000, 1200]);
  });
});

describe('zones', () => {
  it('retirer le mur du milieu : la pose est séparée, la suite garde les réglages', () => {
    const p = project({ U: [{ ref: wall(0) }, { ref: wall(1) }, { ref: wall(2) }] });
    const mid = zonesOn(p, wall(1))[0]!;
    const q = reduceProject(p, removeZoneAction(p, libraries, mid, ids('n')));
    expect(view(q).surfaces.map((x) => [x.name, x.parts.length])).toEqual([
      ['Pièce, mur 1', 1],
      ['Pièce, mur 3', 1],
    ]);
    expect(q.poses.map((x) => x.name)).toEqual(['U', 'Pose 2']);
    const d = carrelageData(q)!;
    const [a, b] = q.poses.map((x) => d.poses[x.id]!);
    expect(b!.bands.map((x) => x.tileId)).toEqual(a!.bands.map((x) => x.tileId));
    expect(b!.bands[0]!.id).not.toBe(a!.bands[0]!.id);
    // retirer un mur au bout : la pose continue sans lui ; la dernière zone : la pose disparaît
    const end = zonesOn(p, wall(2))[0]!;
    expect(view(reduceProject(p, removeZoneAction(p, libraries, end, ids('m')))).surfaces.map((x) => x.name)).toEqual([
      'Pièce, murs 1 et 2',
    ]);
    const one = project({ A: [{ ref: floor }] });
    const empty = reduceProject(one, removeZoneAction(one, libraries, one.zones[0]!, ids('o')));
    expect([empty.poses, carrelageData(empty)!.poses]).toEqual([[], {}]);
  });

  it('découper un sol puis passer une partie en parquet : carrelage et parquet sur le même sol', () => {
    const p = project({ A: [{ ref: floor }] });
    const line: [[number, number], [number, number]] = [
      [1000, 0],
      [1000, 2000],
    ];
    const q = reduceProject(p, cutAction(p.zones[0]!, line, ids('c')));
    expect(zonesOn(q, floor).map((z) => [z.pose, z.cuts.length])).toEqual([
      ['A', 1],
      ['A', 1],
    ]);
    const part = zonesOn(q, floor)[1]!;
    const r = switchAction(q, libraries, part, parquet, ids('s'));
    if ('error' in r) throw new Error(r.error.code);
    const s = reduceProject(q, r.action);
    expect(s.poses.map((x) => x.module)).toEqual(['carrelage', 'parquet']);
    expect(zonesOn(s, floor).map((z) => z.cuts)).toEqual([[{ line, side: 1 }], [{ line, side: -1 }]]);
    // les deux calculs tiennent : 1 m de carrelage, 2 m de parquet
    expect(view(s).surfaces[0]).toMatchObject({ width: 1000, height: 2000 });
    expect(parquet.toSpec(s, libraries)).toHaveProperty('spec');
  });

  it('hauteur d’une zone de mur : crédence de 90 à 150 cm', () => {
    const p = project({ A: [{ ref: wall(0) }] });
    const q = reduceProject(p, spanAction(p, p.zones[0]!, 900, 1500));
    expect(view(q).surfaces[0]).toMatchObject({ width: 3000, height: 600, origin: [0, 900] });
    // jusqu'au plafond et depuis le sol : plus de ligne
    expect(reduceProject(q, spanAction(q, q.zones[0]!, null, null)).zones[0]!.cuts).toEqual([]);
  });
});

describe('contour sur un sol', () => {
  it('entrée carrelée dans un séjour en parquet : trou et jeu dans le parquet, seuils sur les 4 côtés', () => {
    const p0 = project();
    const wood = apply(p0, newPoseAction(p0, libraries, parquet, floor, ids('w')));
    const entry = rectPoly(500, 500, 1200, 1000);
    const c = contourAction(wood, libraries, wood.zones[0]!, entry, ids('c'));
    if (!c) throw new Error('contour');
    const p1 = reduceProject(wood, c.action);
    expect(p1.poses.map((x) => [x.module, x.name])).toEqual([
      ['parquet', 'Pose 1'],
      ['parquet', 'Pose 2'],
    ]);
    const inner = p1.zones.find((z) => z.area)!;
    const r = switchAction(p1, libraries, inner, carrelage, ids('s'));
    if ('error' in r) throw new Error(r.error.code);
    const p2 = reduceProject(p1, r.action);
    expect(p2.poses.map((x) => x.module)).toEqual(['parquet', 'carrelage']);
    // carrelage : l'entrée seule
    const [tiles] = view(p2).surfaces;
    expect([tiles!.width, tiles!.height]).toEqual([1200, 1000]);
    // parquet : la pièce moins l'entrée, un jeu de 8 mm autour de chacun
    const spec = parquet.toSpec(p2, libraries);
    if (!('spec' in spec)) throw new Error('spec');
    const l = computeParquet(spec.spec as ParquetSpec).layouts[0]!;
    expect(regionArea(l.layable)).toBeCloseTo(2984 * 1984 - 1216 * 1016, -3);
    expect(l.thresholds.filter((t) => t.status === 'applied')).toHaveLength(4);
  });

  it('contour invalide (côtés qui se croisent, moins de 3 points) : refusé', () => {
    const p = project({ A: [{ ref: floor }] });
    const z = p.zones[0]!;
    const bow: [number, number][] = [
      [0, 0],
      [1000, 1000],
      [1000, 0],
      [0, 1000],
    ];
    expect(contourAction(p, libraries, z, bow, ids('x'))).toBeNull();
    expect(contourAction(p, libraries, z, bow.slice(0, 2), ids('y'))).toBeNull();
  });
});
