/**
 * Calcul d'une pose de peinture (docs/peinture/SPEC.md §3) : surface nette, couches, litres, pots, boiseries,
 * consommables, alertes. Pur et déterministe, repère du mur, mm ; résultats en m², mL (g pour un enduit).
 */
import { FILLER_RATE, MASKING_ROLL, SHEET_AREA, SUPPORT_YIELD } from './defaults';
import { choosePacks } from './packs';
import { framePerimeter, measureZone, openingsIn, skirtingLength } from './surface';
import type {
  ConsumableLine,
  PaintAlert,
  PaintProduct,
  PaintResult,
  PaintRole,
  PaintSpec,
  SpecPaint,
  PaintTarget,
  PeintureResult,
  PeintureSpec,
  ZoneArea,
  PaintUse,
} from './types';

const M2 = 1_000_000;
const ceilMl = (litres: number) => Math.ceil(litres * 1000 - 1e-6);

const noSurface = (): PaintResult => ({
  areas: { gross: 0, openings: 0, net: 0 },
  zones: [],
  woodwork: { skirtingLength: 0, skirting: 0, frames: 0, doors: 0, total: 0 },
  products: [],
  consumables: [],
  cost: null,
  alerts: [{ code: 'no-surface' }],
});

export function computePaint(spec: PaintSpec): PaintResult {
  const s = spec.settings;
  const alerts: PaintAlert[] = [];
  const products: PaintProduct[] = [];

  // surface des murs
  const zoneAreas: ZoneArea[] = [];
  let gross = 0,
    deductedArea = 0,
    overlap = false;
  for (const z of spec.zones) {
    const m = measureZone(z, s.openings);
    gross += m.gross;
    deductedArea += m.openings;
    overlap ||= m.overlap;
    zoneAreas.push({
      id: z.id,
      room: z.room,
      wall: z.wall,
      gross: m.gross / M2,
      openings: m.openings / M2,
      net: Math.max(0, m.gross - m.openings) / M2,
    });
  }
  const netMm2 = Math.max(0, gross - deductedArea);
  if (netMm2 <= 0) return noSurface();
  if (overlap) alerts.push({ code: 'opening-overlap' });

  // boiseries, sur les mêmes zones ; une ouverture n'est comptée qu'une fois par mur
  const w = s.woodwork;
  let skirtLen = 0,
    framesMm2 = 0,
    doorsMm2 = 0;
  const seen = new Set<string>();
  const wallsSeen = new Set<string>();
  let openingPerimeter = 0;
  for (const z of spec.zones) {
    wallsSeen.add(z.wall);
    if (w.skirting) skirtLen += skirtingLength(z);
    for (const o of openingsIn(z)) {
      const key = `${z.wall}:${o.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      openingPerimeter += 2 * (o.width + o.height);
      if (w.frames) framesMm2 += framePerimeter(o) * w.frameWidth;
      if (w.doors && o.kind === 'door') doorsMm2 += o.width * o.height * w.doorFaces;
    }
  }
  const skirtMm2 = skirtLen * w.skirtingHeight;
  const woodMm2 = skirtMm2 + framesMm2 + doorsMm2;

  const paintOf = (id: string | null): SpecPaint | undefined => (id ? spec.paints[id] : undefined);
  const k = SUPPORT_YIELD[s.support];

  /** Produit d'une couche de produit sur une surface ; null (avec alerte) si le produit est inutilisable. */
  const add = (
    target: PaintTarget,
    role: PaintRole,
    id: string | null,
    surfaceMm2: number,
    coats: number,
    coef: number,
    use: PaintUse | null,
  ): void => {
    const paint = paintOf(id);
    if (!paint) {
      if (role === 'finish') alerts.push({ code: 'no-product', target });
      return;
    }
    if (paint.role !== role || (use && !paint.uses.includes(use)))
      alerts.push({ code: 'product-use-mismatch', paint: paint.id, target });
    let need: number;
    if (role === 'filler') {
      need = Math.ceil((surfaceMm2 / M2) * FILLER_RATE[s.fillerState] * (1 + s.margin) * 1000 - 1e-6);
      if (need <= 0) return;
    } else {
      if (!(paint.yield > 0)) {
        alerts.push({ code: 'missing-yield', paint: paint.id, target });
        return;
      }
      need = ceilMl((((surfaceMm2 / M2) * coats) / (paint.yield * coef)) * (1 + s.margin));
    }
    const choice = choosePacks(need, paint.packs);
    if (!choice) alerts.push({ code: 'no-pack', paint: paint.id, target });
    products.push({
      key: `${target}:${role}`,
      paint: paint.id,
      role,
      target,
      surface: surfaceMm2 / M2,
      coats: role === 'filler' ? 1 : coats,
      need,
      packs: choice?.packs ?? [],
      purchased: choice?.purchased ?? 0,
      surplus: choice ? choice.purchased - need : 0,
      cost: choice?.cost ?? null,
    });
  };

  // murs : enduit, apprêt, finition
  if (s.filler && s.fillerState !== 'good') add('walls', 'filler', s.filler, netMm2, 1, 1, null);
  if (s.primer) add('walls', 'primer', s.primer, netMm2, 1, k, null);
  else if (s.support !== 'painted') alerts.push({ code: 'primer-missing', target: 'walls' });
  add('walls', 'finish', s.finish, netMm2, s.coats, k, 'walls');
  const finish = paintOf(s.finish);
  if (finish?.tint === 'dark' && s.support === 'painted') alerts.push({ code: 'dark-tint-coat', paint: finish.id });

  // boiseries : coefficient de support 1
  if (woodMm2 > 0) {
    if (w.primer) add('woodwork', 'primer', w.primer, woodMm2, 1, 1, null);
    add('woodwork', 'finish', w.finish, woodMm2, w.coats, 1, 'woodwork');
  }

  // consommables
  const c = s.consumables;
  const lengths = [...wallsSeen].reduce((sum, id) => sum + (spec.wallLengths[id] ?? 0), 0);
  const consumables: ConsumableLine[] = [];
  const line = (id: ConsumableLine['id'], quantity: number) =>
    consumables.push({ id, quantity, unitPrice: spec.prices[`peinture:consumable:${id}`] ?? null });
  if (c.masking) line('masking', Math.ceil((lengths + openingPerimeter) / MASKING_ROLL - 1e-9));
  if (c.sheet && spec.floorArea > 0) line('sheet', Math.ceil(spec.floorArea / SHEET_AREA - 1e-9));
  if (c.roller) line('roller', 1);
  if (c.brush) line('brush', 1);

  const unpriced = products.some((p) => p.cost == null);
  const cost = unpriced
    ? null
    : products.reduce((sum, p) => sum + p.cost!, 0) +
      consumables.reduce((sum, l) => sum + (l.unitPrice == null ? 0 : l.unitPrice * l.quantity), 0);

  return {
    areas: { gross: gross / M2, openings: deductedArea / M2, net: netMm2 / M2 },
    zones: zoneAreas,
    woodwork: {
      skirtingLength: skirtLen / 1000,
      skirting: skirtMm2 / M2,
      frames: framesMm2 / M2,
      doors: doorsMm2 / M2,
      total: woodMm2 / M2,
    },
    products,
    consumables,
    cost: cost == null ? null : Math.round(cost * 100) / 100,
    alerts,
  };
}

/** Toutes les poses de peinture du projet. */
export function computePeinture(spec: PeintureSpec): PeintureResult {
  return { poses: spec.poses.map((p) => ({ id: p.id, result: computePaint(p.spec) })) };
}
