/**
 * Maquette 3D d'une portée (pose, pièce, projet) : enveloppe des pièces, menuiseries, revêtements des modules
 * calculés, murs repérés pour la coupe, terrain. Partagée par Résultats, la Vue 3D et l'aperçu du projet.
 * Les fonctions three.js sont chargées à la demande (`loadModel3D`).
 */
import { scopeRooms, scopeWallSpans, type ResultScope } from '../../core/coverage/scope';
import type { Libraries, ResultExports } from '../../modules/types';
import type { MeshData, SceneFrame } from '../../render/scene3d/types';
import type { Project } from '../../state/model';

export interface Model3DLibs {
  envelope: typeof import('../../render/scene3d/envelope');
  cutaway: typeof import('../../render/scene3d/cutaway');
  equipment: typeof import('../../render/scene3d/equipment');
}

export const loadModel3D = (): Promise<Model3DLibs> =>
  Promise.all([
    import('../../render/scene3d/envelope'),
    import('../../render/scene3d/cutaway'),
    import('../../render/scene3d/equipment'),
  ]).then(([envelope, cutaway, equipment]) => ({ envelope, cutaway, equipment }));

/** Revêtements d'un module calculé : le projet calculé, son résultat, ses exports (maillages). */
export interface ModelEntry {
  module: string;
  project: Project;
  result: unknown;
  exports: ResultExports;
}

export const EMPTY_FRAME: SceneFrame = { kind: 'room', bounds: { x: [0, 1], z: [0, 1], h: 2.5 } };

export function modelFrame(libs: Model3DLibs, p: Project, scope: ResultScope): SceneFrame {
  return libs.envelope.planFrame(p.plan, scopeRooms(p.plan, p, scope));
}

export function modelMeshes(
  libs: Model3DLibs,
  p: Project,
  scope: ResultScope,
  entries: readonly ModelEntry[],
  libraries: Libraries,
): MeshData[] {
  const { envelope, cutaway, equipment } = libs;
  const rooms = scopeRooms(p.plan, p, scope);
  // parties de murs revêtues par un module calculé : il les dessine (plâtre compris) ; le reste est dans l'enveloppe
  const drawn = new Set(entries.filter((e) => !e.exports.overlay).map((e) => e.module));
  const covered = {
    zones: p.zones.filter((z) => drawn.has(p.poses.find((x) => x.id === z.pose)?.module ?? '')),
    poses: p.poses,
  };
  const skip = scopeWallSpans(p.plan, covered, scope);
  const merged = envelope.mergeMeshes([
    ...envelope.buildEnvelope(p.plan, rooms, skip),
    ...cutaway.buildJoinery(p.plan, rooms),
    cutaway.buildSections(p.plan, rooms),
    ...entries.flatMap((e) => e.exports.meshes({ project: e.project, libraries, result: e.result, scope })),
  ]);
  // les équipements ne passent pas par tagWalls : posés contre un mur, ils ne seraient pas coupés avec lui
  return [
    ...cutaway.tagWalls(merged, p.plan, rooms),
    cutaway.buildSite(envelope.planFrame(p.plan, rooms)),
    ...equipment.buildEquipment(p.plan, rooms),
  ];
}
