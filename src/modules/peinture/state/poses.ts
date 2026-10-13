/** Poses de peinture sur les zones de murs du projet (docs/NAVIGATION.md §4). Pur. */
import type { Zone } from '../../../core/coverage/types';
import type { Id, Project } from '../../../state/model';
import type { Libraries } from '../../types';
import type { Paint } from '../core/paint';
import type { PaintPoseSettings } from '../core/types';
import { DEFAULT_FINISH_ID, DEFAULT_WOODWORK_ID, PEINTURE_ID, defaultPoseSettings, type PeintureData } from './model';

export const peintureData = (p: Project): PeintureData | null =>
  (p.modules[PEINTURE_ID]?.data as PeintureData | undefined) ?? null;

export const paintsOf = (libraries: Libraries): readonly Paint[] => (libraries.paints ?? []) as readonly Paint[];

export interface PaintLayout {
  id: Id;
  name: string;
  settings: PaintPoseSettings;
  /** Zones de murs de la pose. */
  zones: Zone[];
}

/** Poses de peinture du projet (ordre du projet) avec leurs réglages et leurs zones de murs. */
export function layoutsOf(project: Project): PaintLayout[] {
  const d = peintureData(project);
  if (!d) return [];
  return project.poses.flatMap((p) => {
    const settings = Object.hasOwn(d.poses, p.id) ? d.poses[p.id]! : null;
    if (p.module !== PEINTURE_ID || !settings) return [];
    const zones = project.zones.filter((z) => z.pose === p.id && z.surface.wall != null);
    return [{ id: p.id, name: p.name, settings, zones }];
  });
}

/**
 * Réglages d'une nouvelle pose : ceux de la pose `like`, sinon les modèles types de la bibliothèque (blanc mat,
 * boiseries), ou la première finition venue s'ils ont été supprimés.
 */
export function newPoseSettings(data: PeintureData | null, paints: readonly Paint[], like?: Id): PaintPoseSettings {
  const base = like && data && Object.hasOwn(data.poses, like) ? data.poses[like]! : null;
  if (base) return structuredClone(base);
  const finishes = paints.filter((p) => p.role === 'finish');
  const finish = finishes.find((p) => p.id === DEFAULT_FINISH_ID) ?? finishes.find((p) => p.uses.includes('walls'));
  const woodwork =
    finishes.find((p) => p.id === DEFAULT_WOODWORK_ID) ?? finishes.find((p) => p.uses.includes('woodwork'));
  const s = defaultPoseSettings();
  return { ...s, finish: finish?.id ?? null, woodwork: { ...s.woodwork, finish: woodwork?.id ?? null } };
}
