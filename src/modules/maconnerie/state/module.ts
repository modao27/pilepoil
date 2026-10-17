/** Fonctions du contrat de module (docs/BOITE.md §2) propres à la maçonnerie, hors écrans. */
import type { ShoppingLine } from '../../../core/shopping/types';
import type { ModuleSummary } from '../../types';
import { BINDER_LABEL } from '../core/defaults';
import type { Binder, MaconnerieResult } from '../core/types';
import type { Action } from './actions';
import { MACONNERIE_ID, type MaconnerieData } from './model';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

/**
 * Lignes d'achat : éléments par matériau (marge comprise), liant en sacs, fers d'armature des briques de verre.
 * Prix saisis dans le projet seulement. Quantités indicatives (estimation).
 */
export function shopping(r: MaconnerieResult, d: MaconnerieData): ShoppingLine[] {
  const lines: ShoppingLine[] = [];
  const add = (l: Omit<ShoppingLine, 'module' | 'unitPrice'>) =>
    lines.push({ module: MACONNERIE_ID, unitPrice: d.prices[l.key] ?? null, ...l });

  for (const t of r.totals)
    add({
      key: `${MACONNERIE_ID}:material:${t.material}`,
      group: 'structure',
      label: t.name,
      quantity: t.purchased,
      unit: 'piece',
      detail: `${t.elements} élément${t.elements > 1 ? 's' : ''} + ${fr(d.settings.margin * 100, 0)} %`,
    });

  const binders = new Map<Binder, number>();
  for (const t of r.totals) if (t.binderKg) binders.set(t.binder, (binders.get(t.binder) ?? 0) + t.binderKg);
  for (const [binder, kg] of binders)
    add({
      key: `${MACONNERIE_ID}:binder:${binder}`,
      group: 'consumable',
      label: `${BINDER_LABEL[binder]} — sac de ${fr(d.settings.binderBag)} kg`,
      quantity: Math.ceil(kg / d.settings.binderBag),
      unit: 'bag',
      detail: `${fr(kg)} kg (estimation)`,
    });

  const steel = r.totals.reduce((s, t) => s + t.reinforcement, 0) / 1000;
  if (steel > 0)
    add({
      key: `${MACONNERIE_ID}:reinforcement`,
      group: 'structure',
      label: 'Fers d’armature Ø 6 mm',
      quantity: Math.ceil(steel),
      unit: 'm',
      detail: `${fr(steel)} m pour les briques de verre`,
    });
  return lines;
}

/** « 2 murs, 140 éléments ». */
export function summary(r: MaconnerieResult): ModuleSummary {
  const n = r.walls.filter((w) => w.ok).length;
  const e = r.totals.reduce((s, t) => s + t.elements, 0);
  return { text: `${n} mur${n > 1 ? 's' : ''}, ${e} élément${e > 1 ? 's' : ''}`, alerts: r.alerts.length };
}

export const priceAction = (key: string, value: number | null): Action => ({ type: 'maconnerie/price', key, value });
