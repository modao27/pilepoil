/**
 * Systèmes utilisés par un projet (bibliothèque `systems`) : celui choisi pour chaque cloison, ou à défaut celui que le
 * calcul prend (même épaisseur, sinon le premier). Léger : chargé avec le manifeste du module.
 */
import type { Id, Partition } from '../../../core/plan/types';
import type { Project } from '../../../state/model';
import type { Libraries } from '../../types';
import type { PartitionSystem } from '../core/types';
import { CLOISONS_ID, type CloisonsData, type PartitionSettings } from './model';

/**
 * Système d'une cloison : celui qu'on a choisi, sinon le premier de même épaisseur, sinon le premier. Un système
 * choisi puis retiré de la bibliothèque n'est pas remplacé en silence : undefined (le moteur le signale).
 */
export function systemFor(
  s: PartitionSettings | undefined,
  q: Pick<Partition, 'thickness'>,
  systems: readonly PartitionSystem[],
): PartitionSystem | undefined {
  if (s?.system) return systems.find((x) => x.id === s.system);
  return systems.find((x) => Math.abs(x.thickness - q.thickness) < 1) ?? systems[0];
}

/** Le système `id` sert-il à une cloison du projet ? */
export function usesSystem(project: Project, id: Id, libraries: Libraries): boolean {
  const d = project.modules[CLOISONS_ID]?.data as CloisonsData | undefined;
  if (!d) return false;
  const systems = (libraries.systems ?? []) as readonly PartitionSystem[];
  return project.site.partitions.some((q) => {
    const own = Object.hasOwn(d.partitions, q.id) ? d.partitions[q.id] : undefined;
    return (own?.system ?? systemFor(own, q, systems)?.id) === id;
  });
}
