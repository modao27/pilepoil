/**
 * Projet créé par l'assistant : une pièce du plan (rectangle, L ou U), le sol et les murs cochés carrelés avec le
 * même carreau et le même motif.
 */
import type { PatternId } from '../core';
import { lRoom, rectRoom, uRoom } from '../../../core/plan/factories';
import type { PlanRoom } from '../../../core/plan/types';
import { PROJECT_SCHEMA, type Id, type Project } from '../../../state/model';
import { createData, createFloorTiling, createRoomTiling, createWallTiling, createZone, newId } from './factories';
import type { WallTiling } from './model';
import { CARRELAGE_ID, CARRELAGE_SCHEMA } from './data';

export interface LayoutChoice {
  tileId: Id;
  tileUpright: boolean;
  pattern: PatternId;
  angle: number;
  joint: number;
}

/** Forme de la pièce et ses cotes (mm), comme la création rapide du plan. */
export type RoomForm =
  | { kind: 'rect'; length: number; width: number }
  | { kind: 'l'; length: number; width: number; cutLength: number; cutWidth: number }
  | { kind: 'u'; length: number; width: number; arm: number; depth: number };

export interface WizardInput extends LayoutChoice {
  form: RoomForm;
  /** Hauteur sous plafond. */
  height: number;
  /** Hauteur carrelée des murs (bornée par la hauteur sous plafond). */
  tiledHeight: number;
  floor: boolean;
  /** Murs carrelés, par indice dans le contour (mur 1 = 0). */
  walls: readonly number[];
  /** Nom du projet ; par défaut « Pièce 400 × 300 ». */
  name?: string;
  roomName?: string;
}

const cm = (mm: number) => Math.round(mm / 10);

/** Pièce du plan pour une forme : contour en sens horaire, mur 1 en haut. */
export function formRoom(form: RoomForm, o: { name: string; height: number }, id: () => Id = newId): PlanRoom {
  if (form.kind === 'l') return lRoom(form.length, form.width, form.cutLength, form.cutWidth, o, id);
  if (form.kind === 'u') return uRoom(form.length, form.width, form.arm, form.depth, o, id);
  return rectRoom(form.length, form.width, o, id);
}

/** Cotes cohérentes : un retrait plus petit que la pièce. */
export function validForm(f: RoomForm): boolean {
  if (!(f.length > 0 && f.width > 0)) return false;
  if (f.kind === 'l') return f.cutLength > 0 && f.cutWidth > 0 && f.cutLength < f.length && f.cutWidth < f.width;
  if (f.kind === 'u') return f.arm > 0 && f.depth > 0 && 2 * f.arm < f.length && f.depth < f.width;
  return true;
}

export function createWizardProject(i: WizardInput, now = Date.now()): Project {
  const room = formRoom(i.form, { name: i.roomName?.trim() || 'Pièce', height: i.height });
  const layout = {
    joint: i.joint,
    zones: [createZone(i.tileId, { tileUpright: i.tileUpright, pattern: i.pattern, angle: i.angle })],
  };
  const walls: Record<Id, WallTiling> = {};
  for (const k of i.walls) {
    const w = room.walls[k];
    if (w)
      walls[w.id] = createWallTiling(i.tileId, {
        ...layout,
        zones: layout.zones.map((z) => ({ ...z, id: newId() })),
        tiledHeight: i.tiledHeight >= i.height ? null : i.tiledHeight,
      });
  }
  const floor = i.floor ? createFloorTiling(i.tileId, layout) : null;
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: newId(),
    name: i.name?.trim() || `Pièce ${cm(i.form.length)} × ${cm(i.form.width)}`,
    createdAt: now,
    updatedAt: now,
    plan: { rooms: [room], passages: [] },
    modules: {
      [CARRELAGE_ID]: {
        schemaVersion: CARRELAGE_SCHEMA,
        data: createData({ rooms: { [room.id]: createRoomTiling({ floor, walls }) } }),
      },
    },
  };
}
