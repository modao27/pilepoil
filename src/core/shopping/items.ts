import {
  GROUT_BAG_KG,
  LEVELING_CLIPS,
  PRIMER_L_PER_M2,
  PROFILE_BAR_M,
  SILICONE_M_PER_CARTRIDGE,
  SPACERS,
} from '../rules/consumables';
import { GLUE_BAG_KG } from '../rules/glue';
import type { ProductGroup, ProjectSpec, RoomWall } from '../types';
import type { ZoneGlue } from './glue';
import { orderLine } from './order';

/** Unité de prix : le prix saisi est multiplié par `mult`. */
export type PriceUnit = 'm2' | 'piece' | 'bag' | 'sachet' | 'litre' | 'bar' | 'cartridge';

export type ShoppingItem =
  | {
      kind: 'tile';
      key: string;
      group: number;
      boxes: number;
      buyM2: number;
      order: number;
      m2: number;
      unit: PriceUnit;
      mult: number;
    }
  | { kind: 'adhesive'; key: 'colle'; flexible: boolean; bags: number; kg: number; unit: PriceUnit; mult: number }
  | { kind: 'grout'; key: string; color: string; bags: number; kg: number; unit: PriceUnit; mult: number }
  | { kind: 'spacers'; key: 'crois'; joint: number; bags: number; unit: PriceUnit; mult: number }
  | { kind: 'clips'; key: 'cales'; bags: number; unit: PriceUnit; mult: number }
  | { kind: 'primer'; key: 'primaire'; litres: number; unit: PriceUnit; mult: number }
  | { kind: 'profiles'; key: 'profil'; bars: number; meters: number; unit: PriceUnit; mult: number }
  | { kind: 'silicone'; key: 'silicone'; cartridges: number; meters: number; unit: PriceUnit; mult: number };

/**
 * Liste d'achat du projet [shoppingItems]. Les clés sont celles de legacy (prix enregistrés).
 * Taille des croisillons : joint de la première surface (legacy : surface active).
 */
export function shoppingItems(project: ProjectSpec, groups: ProductGroup[], glue: ZoneGlue[]): ShoppingItem[] {
  const margin = project.settings.margin;
  const items: ShoppingItem[] = [];
  groups.forEach((g, gi) => {
    const o = orderLine(g, margin);
    items.push({
      kind: 'tile',
      key: 'tile|' + g.key,
      group: gi,
      boxes: o.boxes,
      buyM2: o.buyM2,
      order: o.order,
      m2: o.m2,
      unit: 'm2',
      mult: o.buyM2,
    });
  });
  if (glue.length) {
    const kg = glue.reduce((t, x) => t + x.kg, 0),
      flexible = glue.some((x) => x.advice.S > 2200 || (x.advice.double && x.advice.S > 1100));
    const bags = Math.ceil(kg / GLUE_BAG_KG);
    items.push({ kind: 'adhesive', key: 'colle', flexible, bags, kg, unit: 'bag', mult: bags });
    const byGrout = new Map<string, number>();
    for (const x of glue) {
      const c = x.groutColor.toLowerCase();
      byGrout.set(c, (byGrout.get(c) ?? 0) + x.jointKg);
    }
    for (const [color, kg2] of byGrout) {
      const b = Math.ceil(kg2 / GROUT_BAG_KG - 1e-9) || 1;
      items.push({ kind: 'grout', key: 'joint|' + color, color, bags: b, kg: kg2, unit: 'bag', mult: b });
    }
    const small = glue.filter((x) => x.long < SPACERS.maxLong).reduce((t, x) => t + x.n, 0),
      big = glue.filter((x) => x.long >= SPACERS.maxLong).reduce((t, x) => t + x.n, 0);
    const joint = project.surfaces[0]?.joint ?? 0;
    if (small && joint >= 1) {
      const n = Math.ceil((small * SPACERS.perTile) / SPACERS.perBag);
      items.push({ kind: 'spacers', key: 'crois', joint, bags: n, unit: 'sachet', mult: n });
    }
    if (big) {
      const n = Math.ceil((big * LEVELING_CLIPS.perTile) / LEVELING_CLIPS.perBag);
      items.push({ kind: 'clips', key: 'cales', bags: n, unit: 'sachet', mult: n });
    }
    const m2all = glue.reduce((t, x) => t + x.m2, 0),
      litres = Math.ceil(m2all * PRIMER_L_PER_M2);
    items.push({ kind: 'primer', key: 'primaire', litres, unit: 'litre', mult: litres });
  }
  const { profile, silicone } = edgeLengths(project);
  if (profile > 0) {
    const n = Math.ceil((profile * (1 + margin / 100)) / PROFILE_BAR_M);
    items.push({ kind: 'profiles', key: 'profil', bars: n, meters: profile, unit: 'bar', mult: n });
  }
  if (silicone > 0) {
    const n = Math.ceil(silicone / SILICONE_M_PER_CARTRIDGE);
    items.push({ kind: 'silicone', key: 'silicone', cartridges: n, meters: silicone, unit: 'cartridge', mult: n });
  }
  return items;
}

/**
 * Mètres de profilés (arêtes recouvertes) et de silicone (angles rentrants, menuiseries, baignoire,
 * périmètre sol/murs), sur toutes les surfaces, même en erreur.
 */
export function edgeLengths(project: ProjectSpec): { profile: number; silicone: number } {
  let prof = 0,
    sil = 0;
  for (const S of project.surfaces) {
    const Hm = S.height / 1000;
    if (S.kind !== 'floor') {
      for (const f of S.corners) {
        if (f.type === 'out' && f.covered) prof += Hm;
        if (f.type === 'in') sil += Hm;
      }
    }
    if (S.junctionsCovered) prof += (Math.max(0, S.zones.length - 1) * (S.split === 'h' ? S.width : S.height)) / 1000;
    for (const r of S.openings) {
      if (r.type === 'window' || r.type === 'door') {
        const per = (2 * r.height + r.width + (r.type === 'window' ? r.width : 0)) / 1000;
        if (r.covered) prof += per;
        sil += per;
      }
      if (r.type === 'tub') sil += (r.width + (S.kind === 'floor' ? r.width + 2 * r.height : 0)) / 1000;
    }
  }
  const R = project.room;
  if (R) {
    const surf = (k: RoomWall | 'floor') => {
      const i = R.walls[k];
      return i != null ? project.surfaces[i] : undefined;
    };
    const walls = (['A', 'B', 'C', 'D'] as const).filter((k) => surf(k));
    for (const [p, q] of [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'A'],
    ] as const) {
      const a = surf(p),
        b = surf(q);
      if (a && b) sil += Math.min(a.height, b.height) / 1000;
    }
    if (surf('floor') && walls.length) sil += (2 * (R.length + R.width)) / 1000;
  }
  return { profile: prof, silicone: sil };
}
