/**
 * Rapport de la maçonnerie pour l'écran Résultats commun : un rapport par mur (`pose` est l'identifiant du mur). Au
 * niveau pièce, les cloisons maçonnées qui touchent la pièce ; au niveau projet, tous les murs. Les quantités à
 * commander sont celles du projet entier.
 */
import type { PoseReport, ResultInput } from '../../../types';
import type { MaconnerieResult, WallResult } from '../../core/types';
import { maconnerieData, partitionRooms, partitionTitle, roomsOfPartition } from '../../state/spec';
import { alertText } from './messages';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

/** Murs de la portée. */
export function scopedWalls(input: ResultInput<MaconnerieResult>): WallResult[] {
  const { project, result, scope } = input;
  if (scope.kind === 'pose') return [];
  if (scope.kind === 'project') return result.walls;
  return result.walls.filter((w) => roomsOfPartition(project, w.id).some((r) => r.id === scope.room));
}

export function maconnerieReport(input: ResultInput<MaconnerieResult>): PoseReport[] {
  const { project } = input;
  const manual = maconnerieData(project)?.walls ?? [];
  return scopedWalls(input).map((r): PoseReport => {
    const own = manual.find((x) => x.id === r.id);
    const base = {
      pose: r.id,
      title: own?.name ?? partitionTitle(project, r.id).split(' · ')[0]!,
      where: own ? 'Mur saisi' : partitionRooms(project, r.id).join(' / '),
      href: `#/p/${project.id}/m/maconnerie`,
      order: [],
      orderNote: 'Quantités à commander : pour tous les murs du projet',
      alerts: r.alerts.map(alertText),
    };
    if (!r.ok) return { ...base, figures: [], ok: false };
    const elements = r.elements + r.zones.reduce((s, z) => s + z.elements, 0);
    return {
      ...base,
      figures: [
        { label: 'Surface', value: `${fr(r.area + r.zones.reduce((s, z) => s + z.area, 0), 2)} m²` },
        { label: 'Éléments', value: `${elements}` },
        { label: 'Coupés', value: `${r.cut + r.zones.reduce((s, z) => s + z.cut, 0)}`, status: 'cut' },
        { label: 'Zones', value: `${r.zones.length}` },
      ],
      ok: true,
    };
  });
}
