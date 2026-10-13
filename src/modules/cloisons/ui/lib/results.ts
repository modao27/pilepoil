/**
 * Rapport des cloisons pour l'écran Résultats commun : un rapport par cloison (les cloisons n'ont pas de pose, `pose`
 * est l'identifiant de la cloison), aux niveaux projet et pièce. Les quantités à commander sont celles du projet
 * entier (chutes de plaques et barres partagées) : elles sont dans le détail et la liste d'achat.
 */
import type { Project } from '../../../../state/model';
import type { PoseReport, ResultInput } from '../../../types';
import type { CloisonsResult, PartitionResult } from '../../core/types';
import { partitionRooms, toSpec } from '../../state/spec';
import { alertText } from './messages';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

/** Cloisons de la portée : toutes (projet), celles dont une face est dans la pièce (pièce), aucune (pose). */
export function scopedPartitions(
  project: Project,
  result: CloisonsResult,
  scope: ResultInput['scope'],
): PartitionResult[] {
  if (scope.kind === 'pose') return [];
  if (scope.kind === 'project') return result.partitions;
  const room = project.plan.rooms.find((r) => r.id === scope.room);
  return result.partitions.filter((p) => room?.walls.some((w) => w.of?.partition === p.id));
}

export function cloisonsReport(input: ResultInput<CloisonsResult>): PoseReport[] {
  const { project, result, scope, libraries } = input;
  const spec = toSpec(project, libraries);
  const specs = 'spec' in spec ? spec.spec.partitions : [];
  return scopedPartitions(project, result, scope).map((p): PoseReport => {
    const s = specs.find((x) => x.id === p.id);
    const base = {
      pose: p.id,
      title: s?.name ?? 'Cloison',
      where: partitionRooms(project, p.id).join(' / '),
      href: `#/p/${project.id}/m/cloisons/c/${p.id}`,
      order: [],
      orderNote: 'Quantités à commander : pour toutes les cloisons du projet',
      alerts: p.alerts.map(alertText),
    };
    if (!p.ok || !s) return { ...base, figures: [], ok: false };
    const posed = p.plates.reduce((t, q) => t + q.area, 0) / 1e6;
    return {
      ...base,
      figures: [
        { label: 'Longueur', value: `${fr(s.length / 1000, 2)} m` },
        { label: 'Hauteur', value: `${fr(s.height / 1000, 2)} m` },
        { label: 'Plaque posée', value: `${fr(posed)} m²` },
        { label: 'Montants', value: `${p.studs.length}` },
      ],
      ok: true,
    };
  });
}
