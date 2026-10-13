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
    if (!r.areas.net) return [{ pose: l.id, figures: [], order: [], orderNote: null, alerts, ok: false }];
    return [
      {
        pose: l.id,
        figures: [
          { label: 'Surface à peindre', value: `${fr(r.areas.net)} m²` },
          { label: 'Ouvertures déduites', value: `${fr(r.areas.openings)} m²` },
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
