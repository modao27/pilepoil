/**
 * Export PDF A4 de la peinture : pour chaque pose de la portée, ses réglages, les murs (brut, ouvertures, net),
 * les produits et les pots à acheter, les boiseries, les fournitures et les alertes. Lit les résultats, n'écrit
 * rien. Une pièce : seuls ses murs sont détaillés ; les quantités à commander restent celles de la pose.
 */
import { Doc, euro, figures, fr, MUTED, THIN } from '../../../../ui/lib/pdf/doc';
import type { ResultInput } from '../../../types';
import type { Paint } from '../../core/paint';
import type { PeintureResult } from '../../core/types';
import { layoutsOf } from '../../state/poses';
import { alertText, ROLE_LABEL, SUPPORT_LABEL } from './messages';

const CONSUMABLE = {
  masking: 'Ruban de masquage',
  sheet: 'Bâche de protection',
  roller: 'Rouleau et bac',
  brush: 'Brosse à rechampir',
} as const;

export function writePeintureResults(d: Doc, input: ResultInput<PeintureResult>): void {
  const { project, result, scope } = input;
  const paints = (input.libraries.paints ?? []) as readonly Paint[];
  const layouts = layoutsOf(project).filter((l) =>
    scope.kind === 'pose'
      ? l.id === scope.pose
      : scope.kind === 'room'
        ? l.zones.some((z) => z.surface.room === scope.room)
        : true,
  );
  const poses = layouts.flatMap((l) => {
    const r = result.poses.find((p) => p.id === l.id)?.result;
    return r ? [{ layout: l, r }] : [];
  });
  if (!poses.length) return;
  const roomName = (id: string) => project.plan.rooms.find((x) => x.id === id)?.name ?? 'Pièce';
  const wallLabel = (room: string, wall: string) => {
    const r = project.plan.rooms.find((x) => x.id === room);
    return `${roomName(room)}, mur ${r ? r.walls.findIndex((w) => w.id === wall) + 1 : '?'}`;
  };
  const paintName = (id: string) => paints.find((p) => p.id === id)?.name ?? 'Peinture';

  d.page();
  d.text('Peinture', 16, { bold: true, gap: 2 });
  for (const { layout, r } of poses) {
    d.room(40);
    const where = [...new Set(layout.zones.map((z) => roomName(z.surface.room)))].join(', ');
    d.text(`${layout.name} · ${where}`, 13, { bold: true, gap: 1 });
    const s = layout.settings;
    d.text(
      `${SUPPORT_LABEL[s.support]} · ${s.coats} couche${s.coats > 1 ? 's' : ''} de finition · perte ${fr(s.margin * 100)} %`,
      9.5,
      { color: MUTED, gap: 2 },
    );
    for (const a of r.alerts) d.text(`• ${alertText(a)}`, 9, { color: THIN, gap: 0.5 });
    if (!r.areas.net) continue;

    const zones = r.zones.filter((z) => scope.kind !== 'room' || z.room === scope.room);
    figures(d, [
      [
        'Surface à peindre',
        `${fr(
          zones.reduce((t, z) => t + z.net, 0),
          1,
        )} m²`,
      ],
      [
        'Ouvertures déduites',
        `${fr(
          zones.reduce((t, z) => t + z.openings, 0),
          2,
        )} m²`,
      ],
      ...(zones.some((z) => z.skirting)
        ? ([
            [
              'Plinthes déduites',
              `${fr(
                zones.reduce((t, z) => t + z.skirting, 0),
                2,
              )} m²`,
            ],
          ] as [string, string][])
        : []),
      ...(r.woodwork.total ? ([['Boiseries', `${fr(r.woodwork.total, 1)} m²`]] as [string, string][]) : []),
    ]);
    d.table(
      [
        { label: 'Mur', w: 76 },
        { label: 'Brut', w: 34, align: 'right' },
        { label: 'Déduit', w: 34, align: 'right' },
        { label: 'Net', w: 38, align: 'right' },
      ],
      zones.map((z) => [
        wallLabel(z.room, z.wall),
        `${fr(z.gross, 2)} m²`,
        `${fr(z.openings + z.skirting, 2)} m²`,
        `${fr(z.net, 2)} m²`,
      ]),
    );

    if (r.products.length) {
      d.text(`À commander pour toute la pose${scope.kind === 'room' ? ' (pas seulement la pièce)' : ''}`, 11, {
        bold: true,
        gap: 1,
      });
      d.table(
        [
          { label: 'Produit', w: 70 },
          { label: 'Besoin', w: 30, align: 'right' },
          { label: 'Pots', w: 48, align: 'right' },
          { label: 'Prix', w: 34, align: 'right' },
        ],
        r.products.map((p) => {
          const kg = p.role === 'filler' ? 'kg' : 'L';
          return [
            `${paintName(p.paint)} (${p.target === 'woodwork' ? 'boiseries, ' : ''}${ROLE_LABEL[p.role].toLowerCase()})`,
            `${fr(p.need / 1000, 1)} ${kg}`,
            p.packs.map((k) => `${k.count} × ${fr(k.size, 2)} ${kg}`).join(' + ') || 'aucun pot',
            p.cost == null ? '' : euro(p.cost),
          ];
        }),
        r.cost == null ? {} : { foot: ['Total', '', '', euro(r.cost)] },
      );
    }
    if (r.consumables.length)
      d.text(`Fournitures : ${r.consumables.map((c) => `${CONSUMABLE[c.id]} × ${c.quantity}`).join(' · ')}`, 9.5, {
        color: MUTED,
        gap: 3,
      });
  }
}
