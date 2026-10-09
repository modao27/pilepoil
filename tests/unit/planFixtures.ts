/** Projets de test : pièces du plan, zones et poses, réglages carrelage, vue. */
import { lRoom, rectRoom } from '../../src/core/plan/factories';
import type { PlanRoom, WallOpening } from '../../src/core/plan/types';
import { carrelageView, CARRELAGE_SCHEMA, type CarrelageData } from '../../src/modules/carrelage/state/data';
import { createBand, createData, createPoseSettings } from '../../src/modules/carrelage/state/factories';
import type { CarrelagePose } from '../../src/modules/carrelage/state/model';
import type { Cut, Pose, SurfaceRef, Zone } from '../../src/core/coverage/types';
import type { PatternId } from '../../src/modules/carrelage/core';
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

/** Une pose de carrelage sur une surface : la pose, sa zone (toute la surface, ou coupée) et ses réglages. */
export interface TiledPose {
  pose: Pose;
  zone: Zone;
  settings: CarrelagePose;
}

export function tilePose(
  id: string,
  surface: SurfaceRef,
  settings: CarrelagePose,
  o: { cuts?: Cut[]; name?: string } = {},
): TiledPose {
  return {
    pose: { id, module: 'carrelage', name: o.name ?? id },
    zone: { id: `${id}-z`, surface, cuts: o.cuts ?? [], pose: id },
    settings,
  };
}

/** Projet avec ces pièces et ces poses de carrelage (zones dans le projet, réglages dans le module). */
export function tiledProject(
  rooms: PlanRoom[],
  items: TiledPose[],
  data: Partial<CarrelageData> = {},
  o: Partial<Project> = {},
): Project {
  return planProject(
    rooms,
    { ...data, poses: Object.fromEntries(items.map((t) => [t.pose.id, t.settings])) },
    { zones: items.map((t) => t.zone), poses: items.map((t) => t.pose), ...o },
  );
}

/** Choix de pose de l'ancien assistant : carreau, sens, motif, angle, joint. */
export interface LayoutChoice {
  tileId: string;
  tileUpright: boolean;
  pattern: PatternId;
  angle: number;
  joint: number;
}

const settingsOf = (c: LayoutChoice) =>
  createPoseSettings(c.tileId, {
    joint: c.joint,
    bands: [createBand(c.tileId, { tileUpright: c.tileUpright, pattern: c.pattern, angle: c.angle })],
  });

/** Mur seul de largeur × hauteur : premier mur d'une pièce largeur × 2 m, hauteur sous plafond = hauteur. */
export function wallOnly(c: LayoutChoice, width: number, height: number, now = 0): Project {
  const room = rect('r', width, 2000, { height });
  const p = tiledProject([room], [tilePose('t1', { room: 'r', wall: 'r-w0' }, settingsOf(c))]);
  return { ...p, id: `mur-${now}`, name: `Pièce ${width / 10} × 200`, createdAt: now, updatedAt: now };
}

/** Sol seul longueur × largeur. */
export function floorOnly(c: LayoutChoice, length: number, width: number, now = 0): Project {
  const room = rect('r', length, width);
  const p = tiledProject([room], [tilePose('t1', { room: 'r', wall: null }, settingsOf(c))]);
  return { ...p, id: `sol-${now}`, name: `Pièce ${length / 10} × ${width / 10}`, createdAt: now, updatedAt: now };
}

/** Vue carrelage d'un projet de test (le carrelage y est toujours activé). */
export const view = (p: Project) => carrelageView(p)!;
