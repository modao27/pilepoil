/** Fonctions du contrat de module (docs/BOITE.md §2) propres aux cloisons, hors écrans. */
import type { ShoppingLine } from '../../../core/shopping/types';
import type { ModuleSummary } from '../../types';
import type { CloisonsResult, ConsumableLine, PlateType } from '../core/types';
import type { Action } from './actions';
import { CLOISONS_ID, createCloisonsData, type CloisonsData } from './model';

export { cloisonsData, toSpec } from './spec';

export const create = (): CloisonsData => createCloisonsData();

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

export const PLATE_LABEL: Record<PlateType, string> = {
  standard: 'standard',
  hydro: 'hydrofuge',
  phonic: 'phonique',
  fire: 'coupe-feu',
};

const INSULATION_LABEL = {
  'glass-wool': 'Laine de verre',
  'rock-wool': 'Laine de roche',
  'wood-fibre': 'Fibre de bois',
};

const CONSUMABLE: Record<
  ConsumableLine['key'],
  { label: string; unit: ShoppingLine['unit']; detail: (c: ConsumableLine) => string }
> = {
  screw25: { label: 'Vis à plaque 25 mm', unit: 'box', detail: (c) => `${fr(c.need, 0)} vis` },
  screw35: { label: 'Vis à plaque 35 mm', unit: 'box', detail: (c) => `${fr(c.need, 0)} vis` },
  jointTape: { label: 'Bande à joint', unit: 'roll', detail: (c) => `${fr(c.need)} m` },
  jointCompound: { label: 'Enduit à joint', unit: 'bag', detail: (c) => `${fr(c.need)} kg` },
  resilientStrip: { label: 'Bande résiliente', unit: 'roll', detail: (c) => `${fr(c.need)} m` },
  fixing: { label: 'Chevilles et vis de fixation', unit: 'box', detail: (c) => `${fr(c.need, 0)} fixations` },
  cornerBead: { label: 'Cornière d’angle', unit: 'bar', detail: (c) => `${fr(c.need)} m` },
  woodInsert: { label: 'Tasseau de renfort', unit: 'm', detail: (c) => `${fr(c.need)} m` },
};

/**
 * Lignes d'achat (docs/cloisons/SPEC.md §5) : rails, montants, plaques et isolant dans le groupe `structure`, le reste
 * en consommables. Prix saisis dans le projet seulement (pas de bibliothèque de plaques).
 */
export function shopping(r: CloisonsResult, d: CloisonsData): ShoppingLine[] {
  const lines: ShoppingLine[] = [];
  const price = (key: string) => (d.prices[key] != null && d.prices[key]! > 0 ? d.prices[key]! : null);
  const add = (l: Omit<ShoppingLine, 'module' | 'unitPrice'> & { key: string }) =>
    lines.push({ module: CLOISONS_ID, unitPrice: price(l.key), ...l });

  for (const [width, bars] of Object.entries(r.totals.rails))
    add({
      key: `${CLOISONS_ID}:rail:${width}`,
      group: 'structure',
      label: `Rail R${width} — barre de ${fr(d.settings.railBar / 1000, 2)} m`,
      quantity: bars.bars.length,
      unit: 'bar',
    });
  for (const [key, bars] of Object.entries(r.totals.studs)) {
    const [width, length] = key.split(':');
    add({
      key: `${CLOISONS_ID}:stud:${key}`,
      group: 'structure',
      label: `Montant M${width} — barre de ${fr(Number(length) / 1000, 2)} m`,
      quantity: bars.bars.length,
      unit: 'bar',
    });
  }
  for (const lot of r.totals.plates)
    for (const [format, n] of Object.entries(lot.purchased)) {
      const [length, width] = format.split('x');
      const used = lot.sheets[format] ?? 0;
      add({
        key: `${CLOISONS_ID}:plate:${lot.type}:${lot.thickness}:${format}`,
        group: 'structure',
        label: `Plaque de plâtre ${PLATE_LABEL[lot.type]} ${fr(lot.thickness, 1)} mm — ${length} × ${width}`,
        quantity: n,
        unit: 'piece',
        detail: `${used} plaque${used > 1 ? 's' : ''} + ${fr(d.settings.plateMargin * 100, 0)} %`,
      });
    }
  for (const [kind, ins] of Object.entries(r.totals.insulation) as [
    keyof typeof INSULATION_LABEL,
    NonNullable<CloisonsResult['totals']['insulation']['glass-wool']>,
  ][])
    add({
      key: `${CLOISONS_ID}:insulation:${kind}`,
      group: 'structure',
      label: `${INSULATION_LABEL[kind]} — ${fr(d.settings.insulationPack.m2, 2)} m² par ${ins.unit === 'roll' ? 'rouleau' : 'paquet'}`,
      quantity: ins.packs,
      unit: ins.unit,
      detail: `${fr(ins.area)} m² + ${fr(d.settings.insulationMargin * 100, 0)} %`,
    });
  for (const c of r.totals.consumables)
    add({
      key: `${CLOISONS_ID}:${c.key}`,
      group: 'consumable',
      label: CONSUMABLE[c.key].label,
      quantity: c.packs,
      unit: CONSUMABLE[c.key].unit,
      detail: CONSUMABLE[c.key].detail(c),
    });
  return lines;
}

/** « 3 cloisons, 14 plaques » ; alertes : celles du calcul. */
export function summary(r: CloisonsResult): ModuleSummary {
  const ok = r.partitions.filter((p) => p.ok);
  const plates = r.totals.plates.reduce((t, l) => t + Object.values(l.purchased).reduce((a, b) => a + b, 0), 0);
  return {
    text: `${ok.length} cloison${ok.length > 1 ? 's' : ''}, ${plates} plaque${plates > 1 ? 's' : ''}`,
    alerts: r.alerts.length,
  };
}

export const priceAction = (key: string, value: number | null): Action => ({ type: 'cloisons/price', key, value });
