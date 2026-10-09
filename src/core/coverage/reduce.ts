/**
 * Actions sur les zones et les poses d'un projet. Pur ; renvoie `cov` inchangé (même référence) si l'action est
 * sans effet ou enfreint une règle (l'interface vérifie avant avec `checkZone` pour expliquer le refus).
 * Une pose sans zone disparaît.
 */
import type { Plan, Id } from '../plan/types';
import type { Segment } from '../geometry/types';
import { checkZone, orphanZones, type Coverage } from './rules';
import type { CoverageRules, Cut, Pose, Zone } from './types';

export type CoverageAction =
  /** Nouvelle pose et ses zones ; `settings` : réglages du module (transmis au module par le projet). */
  | { type: 'pose/add'; pose: Pose; zones: Zone[]; settings: unknown }
  | { type: 'pose/rename'; poseId: Id; name: string }
  | { type: 'pose/remove'; poseId: Id }
  | { type: 'zone/add'; zone: Zone }
  | { type: 'zone/update'; zoneId: Id; cuts: Cut[] }
  /**
   * Coupe une zone par une ligne : elle garde le côté 1, la nouvelle zone le côté −1, dans la même pose ou dans
   * `pose` (nouvelle pose, avec ses réglages).
   */
  | { type: 'zone/cut'; zoneId: Id; line: Segment; newZoneId: Id; pose?: { pose: Pose; settings: unknown } }
  | { type: 'zone/remove'; zoneId: Id }
  /** Retire les zones dont la pièce ou le mur n'existe plus. */
  | { type: 'zone/prune' };

/** Règles du module d'une pose. */
export type RulesOf = (module: string) => CoverageRules | undefined;

function withoutEmptyPoses(cov: Coverage, zones: readonly Zone[]): Coverage {
  const used = new Set(zones.map((z) => z.pose));
  const poses = cov.poses.every((p) => used.has(p.id)) ? cov.poses : cov.poses.filter((p) => used.has(p.id));
  return { zones, poses };
}

/** Ajoute ou remplace des zones si toutes respectent les règles ; sinon `cov` inchangé. */
function place(plan: Plan, cov: Coverage, added: Zone[], poses: readonly Pose[], rulesOf: RulesOf): Coverage {
  const ids = new Set(added.map((z) => z.id));
  // toutes les zones en place, puis chacune vérifiée contre les autres (l'ordre d'ajout ne compte pas)
  const next: Coverage = { zones: [...cov.zones.filter((z) => !ids.has(z.id)), ...added], poses };
  for (const z of added) {
    const pose = poses.find((p) => p.id === z.pose);
    const rules = pose && rulesOf(pose.module);
    if (!rules || checkZone(plan, next, z, rules)) return cov;
  }
  // ordre stable : une zone modifiée reste à sa place
  const order = new Map(cov.zones.map((z, i) => [z.id, i]));
  const zones = [...next.zones].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  return withoutEmptyPoses({ zones, poses }, zones);
}

export function reduceCoverage(plan: Plan, cov: Coverage, a: CoverageAction, rulesOf: RulesOf): Coverage {
  switch (a.type) {
    case 'pose/add':
      if (cov.poses.some((p) => p.id === a.pose.id) || !a.zones.length) return cov;
      return place(plan, cov, a.zones, [...cov.poses, a.pose], rulesOf);
    case 'pose/rename': {
      const name = a.name.trim();
      const p = cov.poses.find((x) => x.id === a.poseId);
      if (!p || !name || p.name === name) return cov;
      return { ...cov, poses: cov.poses.map((x) => (x.id === a.poseId ? { ...x, name } : x)) };
    }
    case 'pose/remove': {
      if (!cov.poses.some((p) => p.id === a.poseId)) return cov;
      return { zones: cov.zones.filter((z) => z.pose !== a.poseId), poses: cov.poses.filter((p) => p.id !== a.poseId) };
    }
    case 'zone/add':
      if (cov.zones.some((z) => z.id === a.zone.id)) return cov;
      return place(plan, cov, [a.zone], cov.poses, rulesOf);
    case 'zone/update': {
      const z = cov.zones.find((x) => x.id === a.zoneId);
      if (!z) return cov;
      return place(plan, cov, [{ ...z, cuts: a.cuts }], cov.poses, rulesOf);
    }
    case 'zone/cut': {
      const z = cov.zones.find((x) => x.id === a.zoneId);
      if (!z || cov.zones.some((x) => x.id === a.newZoneId)) return cov;
      const kept: Zone = { ...z, cuts: [...z.cuts, { line: a.line, side: 1 }] };
      const added: Zone = {
        id: a.newZoneId,
        surface: z.surface,
        cuts: [...z.cuts, { line: a.line, side: -1 }],
        pose: a.pose?.pose.id ?? z.pose,
      };
      const poses = a.pose ? [...cov.poses, a.pose.pose] : cov.poses;
      return place(plan, cov, [kept, added], poses, rulesOf);
    }
    case 'zone/remove': {
      if (!cov.zones.some((z) => z.id === a.zoneId)) return cov;
      return withoutEmptyPoses(
        cov,
        cov.zones.filter((z) => z.id !== a.zoneId),
      );
    }
    case 'zone/prune': {
      const orphans = new Set(orphanZones(plan, cov.zones).map((z) => z.id));
      if (!orphans.size) return cov;
      return withoutEmptyPoses(
        cov,
        cov.zones.filter((z) => !orphans.has(z.id)),
      );
    }
  }
}

/** Retire les zones d'une pièce supprimée du plan (et les poses restées sans zone). */
export function removeRoom(cov: Coverage, roomId: Id): Coverage {
  if (!cov.zones.some((z) => z.surface.room === roomId)) return cov;
  return withoutEmptyPoses(
    cov,
    cov.zones.filter((z) => z.surface.room !== roomId),
  );
}

/** Poses touchées par la suppression d'une pièce : celles qui ont une zone dans la pièce. */
export function posesInRoom(cov: Coverage, roomId: Id): Pose[] {
  const ids = new Set(cov.zones.filter((z) => z.surface.room === roomId).map((z) => z.pose));
  return cov.poses.filter((p) => ids.has(p.id));
}
