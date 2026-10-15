/** Fonctions du contrat de module (docs/BOITE.md §2) propres à la peinture, hors écrans. */
import { surfacePolygon, zoneRegion } from '../../../core/coverage/geometry';
import { basesOf, NO_CONTEXT, type ProjectContext } from '../../../core/coverage/wallBase';
import { regionArea } from '../../../core/geometry/boolean';
import type { PlanRoom } from '../../../core/plan/types';
import { wallIndex, wallLength } from '../../../core/plan/walls';
import type { ShoppingLine } from '../../../core/shopping/types';
import type { Project } from '../../../state/model';
import type { Libraries, ModuleError, ModuleSummary } from '../../types';
import { projectNeeds } from '../core/aggregate';
import type { Paint } from '../core/paint';
import type {
  ConsumableLine,
  PaintPoseSettings,
  PaintSpec,
  PeintureResult,
  PeintureSpec,
  SpecPaint,
  SpecZone,
} from '../core/types';
import type { Action } from './actions';
import { createPeintureData, PEINTURE_ID, type PeintureData } from './model';
import { layoutsOf, newPoseSettings, paintsOf, peintureData } from './poses';

export { peintureData };

export const create = (): PeintureData => createPeintureData();

/** Réglages d'une nouvelle pose (contrat de module). */
export const createPose = (project: Project, libraries: Libraries, like?: string): PaintPoseSettings =>
  newPoseSettings(peintureData(project), paintsOf(libraries), like);

/** Ce que le moteur lit d'un produit de la bibliothèque. */
const specPaint = (p: Paint): SpecPaint => ({
  id: p.id,
  name: p.name,
  role: p.role,
  ...(p.tint ? { tint: p.tint } : {}),
  uses: p.uses,
  yield: p.yield,
  coats: p.coats,
  packs: p.packs,
});

const usedPaints = (s: PaintPoseSettings): string[] =>
  [s.finish, s.primer, s.filler, s.woodwork.finish, s.woodwork.primer].filter((x): x is string => !!x);

/** Projet → entrée du moteur : zones de murs de chaque pose dans le repère du mur, produits de la bibliothèque. */
export function toSpec(
  project: Project,
  libraries: Libraries,
  context: ProjectContext = NO_CONTEXT,
): { spec: PeintureSpec } | { errors: ModuleError[] } {
  const d = peintureData(project);
  if (!d) return { errors: [{ code: 'peinture/absent' }] };
  const paints = paintsOf(libraries);
  const poses = layoutsOf(project)
    .map((l) => {
      const zones: SpecZone[] = [];
      const wallLengths: Record<string, number> = {};
      const rooms = new Set<PlanRoom>();
      for (const z of l.zones) {
        const room = project.plan.rooms.find((r) => r.id === z.surface.room);
        const i = room && z.surface.wall ? wallIndex(room, z.surface.wall) : -1;
        const region = zoneRegion(project.plan, z);
        if (!room || i < 0 || !region?.length) continue;
        const wall = z.surface.wall!;
        rooms.add(room);
        // pied du mur dit par le revêtement du sol (parquet, carrelage) ; rien : réglage manuel en secours
        const floor = basesOf(context, room.id, wall).filter((b) => b.kind !== 'tiled');
        wallLengths[wall] = wallLength(room, i);
        zones.push({
          id: z.id,
          room: room.id,
          wall,
          region,
          openings: room.openings
            .filter((o) => o.wall === wall)
            .map((o) => ({
              id: o.id,
              kind: o.kind,
              offset: o.offset,
              width: o.width,
              sill: o.sill,
              height: o.height,
            })),
          ...(floor.length
            ? {
                skirtings: floor
                  .filter((b) => b.kind === 'skirting')
                  .map((b) => ({ from: b.from, to: b.to, height: b.height, paintable: b.paintable })),
              }
            : {}),
        });
      }
      if (!zones.length) return null;
      const floorArea = [...rooms].reduce(
        (sum, r) => sum + Math.abs(regionArea(surfacePolygon(project.plan, { room: r.id, wall: null }) ?? [])),
        0,
      );
      const used = new Set(usedPaints(l.settings));
      const spec: PaintSpec = {
        zones,
        wallLengths,
        floorArea,
        paints: Object.fromEntries(paints.filter((p) => used.has(p.id)).map((p) => [p.id, specPaint(p)])),
        prices: d.prices,
        settings: l.settings,
      };
      return { id: l.id, spec };
    })
    .filter((p): p is { id: string; spec: PaintSpec } => !!p);
  if (!poses.length) return { errors: [{ code: 'peinture/no-wall' }] };
  return { spec: { poses } };
}

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

/** « 31,8 m² peints, 7 L de peinture » ; alertes : celles du calcul de chaque pose. */
export function summary(r: PeintureResult): ModuleSummary {
  const area = r.poses.reduce((t, p) => t + p.result.areas.net, 0);
  const litres = r.poses.reduce(
    (t, p) => t + p.result.products.filter((x) => x.role === 'finish').reduce((s, x) => s + x.need, 0),
    0,
  );
  return {
    text: `${fr(area)} m² à peindre, ${fr(litres / 1000)} L de finition`,
    alerts: r.poses.reduce((t, p) => t + p.result.alerts.length, 0),
  };
}

const ROLE_LABEL = { finish: '', primer: 'apprêt', filler: 'enduit' } as const;
const CONSUMABLE: Record<ConsumableLine['id'], { label: string; unit: ShoppingLine['unit'] }> = {
  masking: { label: 'Ruban de masquage', unit: 'roll' },
  sheet: { label: 'Bâche de protection', unit: 'piece' },
  roller: { label: 'Rouleau et bac', unit: 'piece' },
  brush: { label: 'Brosse à rechampir', unit: 'piece' },
};

/**
 * Lignes d'achat (SPEC §5) : les besoins d'un produit sur plusieurs poses s'additionnent avant le choix des
 * pots ; une ligne par contenance. Consommables : forfaits des poses additionnés.
 */
export function shopping(r: PeintureResult, d: PeintureData, libraries: Libraries): ShoppingLine[] {
  const paints = paintsOf(libraries);
  const byId = Object.fromEntries(paints.map((p) => [p.id, p]));
  const lines: ShoppingLine[] = [];
  for (const n of projectNeeds(
    r.poses.map((p) => p.result),
    byId,
  )) {
    const paint = byId[n.paint.id];
    const kg = n.role === 'filler';
    for (const pack of n.packs) {
      const key = `${PEINTURE_ID}:${n.paint.id}:${n.role}:${pack.size}`;
      const own = d.prices[key];
      const price = own != null && own > 0 ? own : pack.price;
      lines.push({
        module: PEINTURE_ID,
        key,
        group: 'finish',
        label: `${n.paint.name}${ROLE_LABEL[n.role] ? ' (' + ROLE_LABEL[n.role] + ')' : ''} — pot de ${fr(pack.size, 2)} ${kg ? 'kg' : 'L'}`,
        quantity: pack.count,
        unit: 'pot',
        detail: `${fr(n.need / 1000)} ${kg ? 'kg' : 'L'} pour ${fr(n.surface)} m², marge comprise`,
        unitPrice: price ?? null,
        priceFromLibrary: price != null && !(own != null && own > 0),
        ...(paint?.color ? { color: paint.color.hex } : {}),
      });
    }
  }
  const total = new Map<ConsumableLine['id'], number>();
  for (const p of r.poses) for (const c of p.result.consumables) total.set(c.id, (total.get(c.id) ?? 0) + c.quantity);
  for (const [id, quantity] of total) {
    const key = `${PEINTURE_ID}:consumable:${id}`;
    const own = d.prices[key];
    lines.push({
      module: PEINTURE_ID,
      key,
      group: 'consumable',
      label: CONSUMABLE[id].label,
      quantity,
      unit: CONSUMABLE[id].unit,
      unitPrice: own != null && own > 0 ? own : null,
    });
  }
  return lines;
}

export const priceAction = (key: string, value: number | null): Action => ({ type: 'peinture/price', key, value });
