/** État → entrée moteur de la maçonnerie : murs saisis et matériaux de la bibliothèque. */
import type { Project } from '../../../state/model';
import type { Libraries, ModuleError } from '../../types';
import type { MaconnerieSpec, Material, WallSpec } from '../core/types';
import { MACONNERIE_ID, type MaconnerieData } from './model';

export const maconnerieData = (p: Project): MaconnerieData | undefined =>
  p.modules[MACONNERIE_ID]?.data as MaconnerieData | undefined;

export const materialsOf = (l: Libraries): readonly Material[] => (l.materials ?? []) as readonly Material[];

export function toSpec(project: Project, libraries: Libraries): { spec: MaconnerieSpec } | { errors: ModuleError[] } {
  const d = maconnerieData(project);
  if (!d?.walls.length) return { errors: [{ code: 'maconnerie/no-wall' }] };
  const materials = materialsOf(libraries);
  const errors: ModuleError[] = [];
  const walls: WallSpec[] = [];
  for (const w of d.walls) {
    const material = materials.find((m) => m.id === w.material);
    if (!material) errors.push({ code: 'maconnerie/no-material', ref: w.id, params: { wall: w.name } });
    else if (!(w.length > 0 && w.height > 0))
      errors.push({ code: 'maconnerie/size', ref: w.id, params: { wall: w.name } });
    else
      walls.push({
        id: w.id,
        name: w.name,
        length: w.length,
        height: w.height,
        material,
        joint: w.joint ?? material.laying.jointH.def,
      });
  }
  return errors.length ? { errors } : { spec: { walls, margin: d.settings.margin } };
}
