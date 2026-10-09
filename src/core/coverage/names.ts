/** Noms des poses. Pur. */
import type { Pose } from './types';

/** « Pose n » : premier numéro libre parmi les poses du projet. */
export function nextPoseName(poses: readonly Pose[]): string {
  const names = new Set(poses.map((p) => p.name));
  let n = poses.length + 1;
  while (names.has(`Pose ${n}`)) n++;
  return `Pose ${n}`;
}
