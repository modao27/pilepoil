/** Rapport de la peinture pour l'écran Résultats commun : surface nette et commande, par pose. */
import { layoutsOf } from '../../state/poses';
import type { PoseReport, ResultInput } from '../../../types';
import type { PeintureResult } from '../../core/types';
import { alertText } from './messages';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

export function peintureReport(input: ResultInput<PeintureResult>): PoseReport[] {
  const { project, result, scope } = input;
  const layouts = layoutsOf(project).filter((l) =>
    scope.kind === 'pose'
      ? l.id === scope.pose
      : scope.kind === 'room'
        ? l.zones.some((z) => z.surface.room === scope.room)
        : true,
  );
  return layouts.flatMap((l): PoseReport[] => {
    const r = result.poses.find((x) => x.id === l.id)?.result;
    if (!r) return [];
    const alerts = r.alerts.map(alertText);
    // surface exacte sur la portée : les zones de la pièce, ou toute la pose
    const zones = scope.kind === 'room' ? r.zones.filter((z) => z.room === scope.room) : r.zones;
    const net = zones.reduce((t, z) => t + z.net, 0);
    const openings = zones.reduce((t, z) => t + z.openings, 0);
    const skirting = zones.reduce((t, z) => t + z.skirting, 0);
    if (!r.areas.net) return [{ pose: l.id, figures: [], order: [], orderNote: null, alerts, ok: false }];
    return [
      {
        pose: l.id,
        figures: [
          { label: 'Surface à peindre', value: `${fr(net)} m²` },
          { label: 'Ouvertures déduites', value: `${fr(openings)} m²` },
          ...(skirting ? [{ label: 'Plinthes déduites', value: `${fr(skirting)} m²` }] : []),
          ...(r.woodwork.total ? [{ label: 'Boiseries', value: `${fr(r.woodwork.total)} m²` }] : []),
        ],
        order: r.products.map((p) => {
          const kg = p.role === 'filler';
          const packs = p.packs.map((k) => `${k.count} × ${fr(k.size, 2)} ${kg ? 'kg' : 'L'}`).join(' + ');
          return `${fr(p.need / 1000)} ${kg ? 'kg' : 'L'}${packs ? ` (${packs})` : ''}`;
        }),
        orderNote: 'Pour toute la pose',
        alerts,
        ok: true,
      },
    ];
  });
}
