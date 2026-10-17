/**
 * Rapport de la maçonnerie pour l'écran Résultats commun : un rapport par mur (`pose` est l'identifiant du mur), au
 * niveau projet seulement (les murs saisis ne sont pas rattachés à une pièce).
 */
import type { PoseReport, ResultInput } from '../../../types';
import type { MaconnerieResult } from '../../core/types';
import { maconnerieData } from '../../state/spec';
import { alertText } from './messages';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

export function maconnerieReport(input: ResultInput<MaconnerieResult>): PoseReport[] {
  const { project, result, scope } = input;
  if (scope.kind !== 'project') return [];
  const walls = maconnerieData(project)?.walls ?? [];
  return result.walls.map((r): PoseReport => {
    const w = walls.find((x) => x.id === r.id);
    const base = {
      pose: r.id,
      title: w?.name ?? 'Mur',
      href: `#/p/${project.id}/m/maconnerie`,
      order: [],
      orderNote: 'Quantités à commander : pour tous les murs du projet',
      alerts: r.alerts.map(alertText),
    };
    if (!r.ok) return { ...base, figures: [], ok: false };
    return {
      ...base,
      figures: [
        { label: 'Surface', value: `${fr(r.area, 2)} m²` },
        { label: 'Éléments', value: `${r.elements}` },
        { label: 'Coupés', value: `${r.cut}`, status: 'cut' },
        { label: 'Rangs', value: `${r.courses}` },
      ],
      ok: true,
    };
  });
}
