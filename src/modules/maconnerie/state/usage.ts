import type { Id } from '../../../core/plan/types';
import type { Project } from '../../../state/model';
import type { Libraries } from '../../types';
import type { Material } from '../core/types';
import { defaultBuild, MACONNERIE_ID, type MaconnerieData, type WallBuild } from './model';

/**
 * Le matériau `id` sert-il au projet : base ou zone d'un mur saisi ou d'une cloison maçonnée (y compris le matériau
 * pris par défaut, de l'épaisseur de la cloison) ? Léger : chargé avec le manifeste du module.
 */
export function usesMaterial(project: Project, id: Id, libraries: Libraries): boolean {
  const d = project.modules[MACONNERIE_ID]?.data as MaconnerieData | undefined;
  if (!d) return false;
  const inBuild = (b: WallBuild) => b.material === id || b.zones.some((z) => z.material === id);
  if (d.walls.some(inBuild)) return true;
  const materials = (libraries.materials ?? []) as readonly Material[];
  return project.site.partitions.some((q) => {
    if (q.construction !== 'masonry') return false;
    const b = Object.hasOwn(d.partitions, q.id) ? d.partitions[q.id]! : defaultBuild();
    const base = b.material ?? materials.find((m) => Math.abs(m.thickness - q.thickness) < 1)?.id;
    return base === id || b.zones.some((z) => z.material === id);
  });
}
