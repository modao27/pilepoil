/** Fonctions du contrat de module (docs/BOITE.md §2) propres au carrelage, hors écrans. */
import { zoneRegion } from '../../../core/coverage/geometry';
import { floorSpans, spansAtFloor, type WallBase } from '../../../core/coverage/wallBase';
import type { Id, Plan } from '../../../core/plan/types';
import type { Project } from '../../../state/model';
import type { CarrelagePose, Tile } from './model';
import type { ShoppingGroup, ShoppingLine } from '../../../core/shopping/types';
import type { Libraries, ModuleError, ModuleSummary } from '../../types';
import { count, m2 } from '../../../ui/lib/format';
import type { ProjectResult, ProjectSpec, ShoppingItem } from '../core';
import { shoppingLabel } from '../ui/lib/labels';
import type { Action } from './actions';
import { itemPrice } from './pricing';
import { carrelageData, carrelageView, type CarrelageData } from './data';
import { createData, newId } from './factories';
import { CARRELAGE_ID } from './ids';
import { newPoseSettings } from './poses';
import { toProjectSpec } from './selectors';

/** Données initiales quand on active le carrelage : aucune pose (elles naissent des zones). */
export function create(_plan: Plan): CarrelageData {
  return createData();
}

/** Réglages d'une nouvelle pose : ceux de `like`, sinon une bande du premier carreau de la bibliothèque. */
export function createPose(project: Project, libraries: Libraries, like?: string): CarrelagePose {
  return newPoseSettings(carrelageData(project), (libraries.tiles ?? []) as readonly Tile[], newId, like);
}

/** Projet → entrée du moteur ; bibliothèque de carreaux sous `libraries.tiles`. */
export function toSpec(project: Project, libraries: Libraries): { spec: ProjectSpec } | { errors: ModuleError[] } {
  const view = carrelageView(project);
  if (!view) return { errors: [{ code: 'carrelage/absent' }] };
  if (!view.surfaces.length) return { errors: [{ code: 'carrelage/empty' }] };
  return { spec: toProjectSpec(view, (libraries.tiles ?? []) as readonly Tile[]).spec };
}

/**
 * Pied des murs (contrat `wallBases`) : sol carrelé avec plinthe carrelée (non peignable) ou sans plinthe, sur tous
 * les murs de la pièce, portes retirées ; mur carrelé là où sa zone touche le sol.
 */
export function wallBases(project: Project): WallBase[] {
  const d = carrelageData(project);
  if (!d) return [];
  const out: WallBase[] = [];
  const mine = new Set(project.poses.filter((p) => p.module === CARRELAGE_ID).map((p) => p.id));
  const floors = new Map<Id, CarrelagePose['plinth']>();
  for (const z of project.zones) {
    const t = mine.has(z.pose) ? d.poses[z.pose] : undefined;
    if (!t) continue;
    if (z.surface.wall == null) {
      const before = floors.get(z.surface.room);
      floors.set(z.surface.room, before?.length ? before : t.plinth);
      continue;
    }
    const region = zoneRegion(project.plan, z);
    if (!region?.length) continue;
    const top = Math.max(...region.flat().map((p) => p[1]));
    for (const [from, to] of spansAtFloor(region))
      out.push({
        room: z.surface.room,
        wall: z.surface.wall,
        from,
        to,
        kind: 'tiled',
        height: top,
        paintable: false,
        module: CARRELAGE_ID,
      });
  }
  for (const [roomId, plinth] of floors) {
    const r = project.plan.rooms.find((x) => x.id === roomId);
    if (!r) continue;
    const on = !!plinth && plinth.length > 0;
    r.walls.forEach((w, i) => {
      for (const [from, to] of floorSpans(r, i))
        out.push({
          room: r.id,
          wall: w.id,
          from,
          to,
          kind: on ? 'skirting' : 'bare',
          height: on ? plinth.height : 0,
          paintable: false,
          module: CARRELAGE_ID,
        });
    });
  }
  return out;
}

/** « 46 carreaux, 12,4 m² » ; alertes : coupes fines et surfaces en erreur. */
export function summary(result: ProjectResult): ModuleSummary {
  const m = result.metrics;
  return {
    text: `${count(m.order, 'carreau', 'carreaux')}, ${m2(m.m2)}`,
    alerts: m.thin + result.surfaces.filter((s) => !s.ok).length,
  };
}

/** Rayon du magasin de chaque article (docs/BOITE.md §7). */
const GROUPS: Record<ShoppingItem['kind'], ShoppingGroup> = {
  tile: 'covering',
  adhesive: 'consumable',
  grout: 'consumable',
  primer: 'consumable',
  spacers: 'tool',
  clips: 'tool',
  profiles: 'finish',
  silicone: 'finish',
};

/**
 * Liste d'achat de l'écran Résultats en lignes consolidables, à l'identique : la quantité est celle sur
 * laquelle porte le prix (m² achetés pour un carreau vendu au carton), le détail celui de l'écran.
 */
export function shopping(
  result: ProjectResult,
  data: CarrelageData,
  libraries: Libraries,
  project: Project,
): ShoppingLine[] {
  const tiles = new Map(((libraries.tiles ?? []) as readonly Tile[]).map((t) => [t.id, t]));
  const surfaces = carrelageView(project)?.surfaces ?? [];
  const priced = { prices: data.prices, surfaces };
  const groups = result.plan.groups;

  /** Carreau de la bibliothèque d'un article carreau : la vannerie pose des tailles qu'on n'achète pas à part. */
  const tileOf = (it: ShoppingItem) => {
    const ref = it.kind === 'tile' ? groups[it.group]?.zones[0] : undefined;
    return ref ? surfaces[ref.surface]?.bands[ref.zone]?.tileId : undefined;
  };
  const items = mergeTileItems(result.shopping, groups, tileOf);

  return items.map((it) => {
    const text = shoppingLabel(it, groups);
    const own = data.prices[it.key];
    const price = itemPrice(it, priced, tiles, result);
    const line: ShoppingLine = {
      module: CARRELAGE_ID,
      key: KEY_PREFIX + it.key,
      group: GROUPS[it.kind],
      label: text.label,
      quantity: it.mult,
      unit: it.unit,
      detail: text.qty,
      unitPrice: price ?? null,
      priceFromLibrary: price != null && !(own != null && own > 0),
    };
    if (text.dot) line.color = text.dot;
    return line;
  });
}

type TileItem = Extract<ShoppingItem, { kind: 'tile' }>;

/**
 * Regroupe les articles carreaux d'un même carreau de la bibliothèque (et de même nature) en un seul : les m² à
 * commander s'additionnent et les cartons sont recalculés une fois sur le total. L'article gardé est celui qui
 * demande le plus de pièces (sa clé porte le prix, son nom la ligne). Le moteur n'est pas modifié (parité).
 */
export function mergeTileItems(
  items: ShoppingItem[],
  groups: ProjectResult['plan']['groups'],
  tileOf: (it: ShoppingItem) => string | undefined,
): ShoppingItem[] {
  const buckets = new Map<string, TileItem[]>();
  for (const it of items) {
    const tile = tileOf(it);
    if (it.kind !== 'tile' || !tile) continue;
    const k = tile + '|' + groups[it.group]?.kind;
    buckets.set(k, [...(buckets.get(k) ?? []), it]);
  }
  const drop = new Set<ShoppingItem>();
  const merged = new Map<ShoppingItem, TileItem>();
  for (const members of buckets.values()) {
    if (members.length < 2) continue;
    const main = members.reduce((a, b) => (b.order > a.order ? b : a));
    const m2PerBox = groups[main.group]?.m2PerBox ?? 0;
    const m2 = members.reduce((t, x) => t + x.m2, 0);
    const boxes = m2PerBox > 0 ? Math.ceil(m2 / m2PerBox - 1e-9) : 0;
    const buyM2 = boxes ? boxes * m2PerBox : m2;
    merged.set(main, { ...main, m2, boxes, buyM2, mult: buyM2, order: members.reduce((t, x) => t + x.order, 0) });
    for (const x of members) if (x !== main) drop.add(x);
  }
  return items.filter((it) => !drop.has(it)).map((it) => merged.get(it) ?? it);
}

/**
 * Clés des lignes d'achat préfixées par le module, comme les autres outils (`carrelage:colle`) ; les prix du projet
 * restent rangés sous la clé du moteur (`colle`), inchangée pour la parité.
 */
const KEY_PREFIX = `${CARRELAGE_ID}:`;

export const priceAction = (key: string, value: number | null): Action => ({
  type: 'carrelage/price',
  key: key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : key,
  value,
});
