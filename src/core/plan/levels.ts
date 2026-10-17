/**
 * Niveaux de sol et hauteurs propres des murs (docs/niveaux/SPEC.md). Millimètres. Tout est facultatif : un plan sans
 * niveau ni hauteur propre se comporte exactement comme avant (sol à 0, murs à la hauteur de la pièce).
 */
import type { Id, Passage, Plan, PlanRoom, Wall } from './types';

/** Différence de niveau à partir de laquelle un passage a une marche, mm (en dessous : sol continu). */
export const STEP_MIN = 5;

/** Niveau du sol fini de la pièce, par rapport au niveau 0 du plan. */
export const roomFloor = (room: Pick<PlanRoom, 'floor'>): number => room.floor ?? 0;

/**
 * Hauteur d'un mur depuis le sol de sa pièce : sa hauteur propre si elle est valable (de 0 exclu à la hauteur de la
 * pièce), sinon la hauteur de la pièce.
 */
export function wallHeight(room: Pick<PlanRoom, 'height'>, wall: Pick<Wall, 'height'>): number {
  const h = wall.height;
  return h != null && h > 0 && h < room.height ? h : room.height;
}

/** Hauteur du mur `wallId` d'une pièce (hauteur de la pièce si le mur n'existe pas). */
export function wallHeightOf(room: PlanRoom, wallId: Id): number {
  const wall = room.walls.find((w) => w.id === wallId);
  return wall ? wallHeight(room, wall) : room.height;
}

/** Marche entre les deux pièces d'un passage : niveau de la pièce `b` moins celui de `a` (signée, 0 si sol continu). */
export function passageStep(plan: Plan, p: Pick<Passage, 'a' | 'b'>): number {
  const a = plan.rooms.find((r) => r.id === p.a.room),
    b = plan.rooms.find((r) => r.id === p.b.room);
  if (!a || !b) return 0;
  const step = roomFloor(b) - roomFloor(a);
  return Math.abs(step) >= STEP_MIN ? step : 0;
}

/** Les deux pièces ont-elles le même niveau de sol (à moins de `STEP_MIN`) ? */
export const sameLevel = (a: Pick<PlanRoom, 'floor'>, b: Pick<PlanRoom, 'floor'>): boolean =>
  Math.abs(roomFloor(a) - roomFloor(b)) < STEP_MIN;

/** Conseil de finition d'une marche : sol continu, barre de rattrapage ou nez de marche (texte dit par l'interface). */
export type StepAdvice = 'flat' | 'bar' | 'nosing';

/** Moins de `STEP_MIN` : sol plat ; jusqu'à 20 mm : barre de rattrapage ; au-delà : nez de marche. */
export function stepAdvice(step: number): StepAdvice {
  const h = Math.abs(step);
  return h < STEP_MIN ? 'flat' : h <= 20 ? 'bar' : 'nosing';
}
