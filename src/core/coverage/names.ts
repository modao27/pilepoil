/** Noms des poses et de leurs emplacements. Pur. */
import type { Id, Plan } from '../plan/types';
import { wallIndex } from '../plan/walls';
import type { Pose, Zone } from './types';

/** « Pose n » : premier numéro libre parmi les poses du projet. */
export function nextPoseName(poses: readonly Pose[]): string {
  const names = new Set(poses.map((p) => p.name));
  let n = poses.length + 1;
  while (names.has(`Pose ${n}`)) n++;
  return `Pose ${n}`;
}

/** « 1 », « 1 et 2 », « 1, 2 et 4 ». */
const list = (n: number[]) => (n.length < 2 ? String(n[0]) : `${n.slice(0, -1).join(', ')} et ${n.at(-1)}`);

/**
 * Où se trouve une pose : « Cuisine, sol », « Cuisine, murs 1 et 2 », « Entrée + Couloir, sol ». `room` : seulement
 * ce qu'elle couvre dans cette pièce. Chaîne vide si la pose n'a plus de zone.
 */
export function poseWhere(plan: Plan, zones: readonly Zone[], pose: Id, room?: Id): string {
  const mine = zones.filter((z) => z.pose === pose && (!room || z.surface.room === room));
  const parts = plan.rooms.flatMap((r) => {
    const zs = mine.filter((z) => z.surface.room === r.id);
    if (!zs.length) return [];
    const walls = [...new Set(zs.flatMap((z) => (z.surface.wall ? [wallIndex(r, z.surface.wall) + 1] : [])))]
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
    const what = [
      zs.some((z) => z.surface.wall == null) ? 'sol' : '',
      walls.length ? `mur${walls.length > 1 ? 's' : ''} ${list(walls)}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    return [{ name: r.name, what }];
  });
  if (parts.length > 1 && parts.every((p) => p.what === 'sol')) return `${parts.map((p) => p.name).join(' + ')}, sol`;
  return parts.map((p) => `${p.name}, ${p.what}`).join(' ; ');
}
