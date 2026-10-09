/** Projets de test du carrelage bâti sur le plan : pièces du plan, réglages carrelage, vue. */
import { lRoom, rectRoom } from '../../src/core/plan/factories';
import type { PlanRoom, WallOpening } from '../../src/core/plan/types';
import { carrelageView, CARRELAGE_SCHEMA, type CarrelageData } from '../../src/modules/carrelage/state/data';
import { createData } from '../../src/modules/carrelage/state/factories';
import { createWizardProject, type LayoutChoice } from '../../src/modules/carrelage/state/templates';
import { PROJECT_SCHEMA, type Project } from '../../src/state/model';

/** Identifiants déterministes : `${prefix}0`, `${prefix}1`… */
export function ids(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}${n++}`;
}

/** Pièce rectangulaire longueur × largeur ; murs `${id}-w0`… (0 en haut, sens horaire). */
export function rect(id: string, length: number, width: number, o: { name?: string; height?: number } = {}): PlanRoom {
  const room = rectRoom(length, width, { name: o.name ?? 'Pièce', height: o.height }, ids(`${id}-`));
  return renamed(room, id);
}

/** Pièce en L : rectangle dont on retire le coin bas droit. */
export function lShape(id: string, length: number, width: number, cutL: number, cutW: number): PlanRoom {
  return renamed(lRoom(length, width, cutL, cutW, { name: 'Pièce' }, ids(`${id}-`)), id);
}

function renamed(room: PlanRoom, id: string): PlanRoom {
  return { ...room, id, walls: room.walls.map((w, i) => ({ ...w, id: `${id}-w${i}` })) };
}

/** Ajoute une porte ou fenêtre sur le mur i. */
export function withOpening(room: PlanRoom, i: number, o: Partial<WallOpening> = {}): PlanRoom {
  const opening: WallOpening = {
    id: `${room.id}-o${room.openings.length}`,
    kind: 'window',
    wall: room.walls[i]!.id,
    offset: 1000,
    width: 1000,
    sill: 900,
    height: 1200,
    ...o,
  };
  return { ...room, openings: [...room.openings, opening] };
}

export function planProject(rooms: PlanRoom[], data: Partial<CarrelageData> = {}, o: Partial<Project> = {}): Project {
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: 'p1',
    name: 'Projet',
    createdAt: 0,
    updatedAt: 0,
    plan: { rooms, passages: [] },
    zones: [],
    poses: [],
    modules: { carrelage: { schemaVersion: CARRELAGE_SCHEMA, data: createData(data) } },
    ...o,
  };
}

/** Mur seul de largeur × hauteur : premier mur d'une pièce largeur × 2 m, hauteur sous plafond = hauteur. */
export function wallOnly(c: LayoutChoice, width: number, height: number, now = 0): Project {
  const form = { kind: 'rect' as const, length: width, width: 2000 };
  return createWizardProject({ ...c, form, height, tiledHeight: height, floor: false, walls: [0] }, now);
}

/** Sol seul longueur × largeur. */
export function floorOnly(c: LayoutChoice, length: number, width: number, now = 0): Project {
  const form = { kind: 'rect' as const, length, width };
  return createWizardProject({ ...c, form, height: 2500, tiledHeight: 2500, floor: true, walls: [] }, now);
}

/** Vue carrelage d'un projet de test (le carrelage y est toujours activé). */
export const view = (p: Project) => carrelageView(p)!;
