/**
 * Projet → entrée du moteur de la maçonnerie : cloisons maçonnées du plan (qui ont passé la validation des travaux)
 * puis murs saisis. Une cloison est mise dans son repère : x le long de l'axe depuis le point a, y depuis le sol ;
 * ses portes et baies sont des trous. Pur ; mm.
 */
import { pointInPolygon } from '../../../core/geometry/polygon';
import { deriveSite } from '../../../core/plan/derive';
import type { Id, Partition } from '../../../core/plan/types';
import { absOutline, partitionFrame } from '../../../core/plan/works';
import type { Project } from '../../../state/model';
import type { Libraries, ModuleError } from '../../types';
import type { MaconnerieSpec, Material, Rect, WallSpec, ZoneSpec } from '../core/types';
import { defaultBuild, MACONNERIE_ID, type MaconnerieData, type WallBuild } from './model';

/** Hauteur quand rien n'est connu. */
const DEFAULT_HEIGHT = 2500;

export const maconnerieData = (p: Project): MaconnerieData | undefined =>
  p.modules[MACONNERIE_ID]?.data as MaconnerieData | undefined;

export const materialsOf = (l: Libraries): readonly Material[] => (l.materials ?? []) as readonly Material[];

/** Cloisons maçonnées du plan, dans l'ordre du plan. */
export const masonryPartitions = (p: Project): Partition[] =>
  p.site.partitions.filter((q) => q.construction === 'masonry');

/** Pièces touchées par la cloison : un de leurs murs est une de ses faces, ou elle y est un muret (obstacle). */
export const roomsOfPartition = (project: Project, id: Id) =>
  project.plan.rooms.filter(
    (r) => r.walls.some((w) => w.of?.partition === id) || r.obstacles.some((o) => o.id.startsWith(`${id}~low`)),
  );

/** Noms des pièces touchées par la cloison (triés, sans doublon). */
export function partitionRooms(project: Project, id: Id): string[] {
  return [...new Set(roomsOfPartition(project, id).map((r) => r.name))].sort();
}

/** « Cloison 2 · Chambre / Couloir » : numéro dans le plan (comme l'éditeur de plan), pièces voisines. */
export function partitionTitle(project: Project, id: Id): string {
  const n = project.site.partitions.findIndex((q) => q.id === id) + 1;
  const rooms = partitionRooms(project, id);
  return `Cloison ${n}${rooms.length ? ' · ' + rooms.join(' / ') : ''}`;
}

/** Réglage d'une cloison maçonnée (valeurs par défaut s'il n'y en a pas). */
export const partitionBuild = (d: MaconnerieData | undefined, id: Id): WallBuild =>
  d && Object.hasOwn(d.partitions, id) ? d.partitions[id]! : defaultBuild();

/** Matériau de base : celui choisi, sinon le premier de l'épaisseur de la cloison. Choisi puis supprimé : undefined. */
export function baseMaterial(b: WallBuild, materials: readonly Material[], thickness?: number): Material | undefined {
  if (b.material) return materials.find((m) => m.id === b.material);
  return thickness == null ? undefined : materials.find((m) => Math.abs(m.thickness - thickness) < 1);
}

/** Hauteur d'une cloison : celle du plan, sinon la plus basse des pièces voisines ou de la pièce qui la contient. */
export function partitionHeight(project: Project, q: Partition): number {
  if (q.height != null) return q.height;
  const rooms = project.plan.rooms.filter((r) => r.walls.some((w) => w.of?.partition === q.id));
  if (rooms.length) return Math.min(...rooms.map((r) => r.height));
  const f = partitionFrame(q);
  const mid: [number, number] = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2];
  const under = project.site.existing.rooms.filter((r) => pointInPolygon(mid, absOutline(r)));
  return under.length ? Math.min(...under.map((r) => r.height)) : DEFAULT_HEIGHT;
}

/** Zones prêtes pour le calcul ; erreur si un matériau manque. */
function zonesOf(b: WallBuild, materials: readonly Material[], ref: Id, errors: ModuleError[]): ZoneSpec[] {
  const out: ZoneSpec[] = [];
  for (const z of b.zones) {
    const m = materials.find((x) => x.id === z.material);
    if (!m) errors.push({ code: 'maconnerie/zone-material', ref });
    else if (!(z.width > 0 && z.height > 0)) errors.push({ code: 'maconnerie/zone-size', ref });
    else out.push({ ...z, material: m, joint: z.joint ?? m.laying.jointH.def });
  }
  return out;
}

export function toSpec(project: Project, libraries: Libraries): { spec: MaconnerieSpec } | { errors: ModuleError[] } {
  const d = maconnerieData(project);
  if (!d) return { errors: [{ code: 'maconnerie/no-wall' }] };
  const failed = new Set(
    deriveSite(project.site)
      .issues.filter((i) => i.severity === 'error')
      .map((i) => i.id),
  );
  const parts = masonryPartitions(project).filter((q) => !failed.has(q.id));
  if (!parts.length && !d.walls.length) return { errors: [{ code: 'maconnerie/no-wall' }] };

  const materials = materialsOf(libraries);
  const errors: ModuleError[] = [];
  const walls: WallSpec[] = [];
  const push = (
    id: Id,
    name: string,
    length: number,
    height: number,
    b: WallBuild,
    material: Material | undefined,
    holes: Rect[],
  ) => {
    if (!material) return errors.push({ code: 'maconnerie/no-material', ref: id });
    if (!(length > 0 && height > 0)) return errors.push({ code: 'maconnerie/size', ref: id });
    walls.push({
      id,
      name,
      length,
      height,
      material,
      joint: b.joint ?? material.laying.jointH.def,
      zones: zonesOf(b, materials, id, errors),
      holes,
    });
  };

  for (const q of parts) {
    const b = partitionBuild(d, q.id);
    push(
      q.id,
      partitionTitle(project, q.id),
      partitionFrame(q).length,
      partitionHeight(project, q),
      b,
      baseMaterial(b, materials, q.thickness),
      q.openings.filter((o) => !failed.has(o.id)).map((o) => ({ x: o.offset, y: 0, width: o.width, height: o.height })),
    );
  }
  for (const w of d.walls) push(w.id, w.name, w.length, w.height, w, baseMaterial(w, materials), []);
  return errors.length ? { errors } : { spec: { walls, margin: d.settings.margin } };
}
