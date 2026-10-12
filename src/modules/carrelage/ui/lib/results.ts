/**
 * Rapport du carrelage pour l'écran Résultats commun : par pose touchée, pièces posées et coupes exactes sur la
 * portée, carreaux à commander. Les chutes du carrelage resservent dans tout le projet : la commande d'un carreau
 * est celle du projet entier dès qu'il sert à plusieurs poses (docs/NAVIGATION.md §7).
 */
import { poseBeyond } from '../../../../core/coverage/scope';
import type { PoseReport, ResultInput } from '../../../types';
import type { ProjectResult } from '../../core';
import { carrelageView } from '../../state/data';
import { scopePieces, scopeSurfaces } from '../../state/results';
import { errorText, productName, warningText } from './messages';

const fr = (v: number) => v.toLocaleString('fr-FR');
const plural = (n: number, one: string, many: string) => `${fr(n)} ${n > 1 ? many : one}`;

export function tilingReport(input: ResultInput<ProjectResult>): PoseReport[] {
  const { project, result, scope } = input;
  const view = carrelageView(project);
  if (!view) return [];
  const inScope = scopePieces(view, result, scope);
  return scopeSurfaces(view, scope).map((si): PoseReport => {
    const s = view.surfaces[si]!;
    const sr = result.surfaces[si];
    if (!sr?.ok)
      return {
        pose: s.id,
        figures: [],
        order: [],
        orderNote: null,
        alerts: sr ? [errorText(sr.error)] : [],
        ok: false,
      };
    const mine = result.pieces.map((pc, i) => ({ pc, i })).filter((x) => x.pc.surface === si && inScope.has(x.i));
    const cuts = mine.filter((x) => !x.pc.full);
    const reused = cuts.filter((x) => result.plan.reused[x.i]).length;
    const thin = mine.filter((x) => x.pc.thin).length;
    const groups = result.plan.groups
      .map((g, gi) => ({ g, o: result.orders[gi]! }))
      .filter(({ g }) => g.zones.some((z) => z.surface === si));
    const shared = groups.some(({ g }) => g.zones.some((z) => z.surface !== si));
    return {
      pose: s.id,
      figures: [
        { label: 'Carreaux posés', value: fr(mine.length) },
        { label: 'Coupes', value: fr(cuts.length), status: 'cut' },
        { label: 'Dans les chutes', value: fr(reused), status: 'reuse' },
        { label: 'Coupes fines', value: fr(thin), ...(thin ? { status: 'thin' as const } : {}) },
      ],
      order: groups.map(
        ({ g, o }) =>
          `${plural(o.order, 'carreau', 'carreaux')} ${productName(g.label)}${o.boxes ? ` (${plural(o.boxes, 'carton', 'cartons')})` : ''}`,
      ),
      orderNote: shared
        ? 'Pour tout le projet : ce carreau sert à plusieurs poses, les chutes passent de l’une à l’autre.'
        : poseBeyond(project, s.id, scope)
          ? 'Pour toute la pose, y compris hors de cette pièce.'
          : null,
      alerts: [...new Set(sr.value.warnings.map((w) => warningText(w, s)))],
      ok: true,
    };
  });
}
