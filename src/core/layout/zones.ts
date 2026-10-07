import { pattern } from '../patterns/registry';
import type { SurfaceSpec, ZoneSpec } from '../types';

export interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Longueur demandée (avant troncature au bord de la surface). */
  len: number;
}

export interface ZoneLayout {
  rects: ZoneRect[];
  /** Dépassement des zones au-delà de la surface (> 0 si elles débordent). */
  over: number;
  /** Longueur non carrelée quand aucune zone n'est « reste ». */
  left: number;
  total: number;
  used: number;
  /** Zones empilées (split h). */
  horiz: boolean;
}

/** Épaisseur d'une rangée de la zone dans le sens d'empilement [rowT]. */
export function rowThickness(z: ZoneSpec, split: SurfaceSpec['split']): number {
  const a = z.tile.width,
    b = z.tile.height;
  if (pattern(z.pattern).rowIsA) return a;
  const rot = z.angle === 90;
  return split === 'h' ? (rot ? a : b) : rot ? b : a;
}

/** Longueur fixe de la zone, null pour « reste » [zoneLen]. */
export function zoneLength(z: ZoneSpec, split: SurfaceSpec['split'], joint: number): number | null {
  if (z.unit === 'length') return Math.max(0, z.size);
  if (z.unit === 'rows') {
    const r = Math.max(0, Math.round(z.size));
    return r > 0 ? r * rowThickness(z, split) + (r - 1) * joint : 0;
  }
  return null;
}

/** Découpe la surface en bandes, une par zone, séparées par un joint [layout]. */
export function layoutZones(s: SurfaceSpec): ZoneLayout {
  const horiz = s.split === 'h',
    total = horiz ? s.height : s.width,
    cross = horiz ? s.width : s.height;
  let fixed = 0,
    rest = 0;
  const lens = s.zones.map((z) => {
    const l = zoneLength(z, s.split, s.joint);
    if (l == null) {
      rest++;
      return null;
    }
    fixed += l;
    return l;
  });
  const remain = total - (s.zones.length - 1) * s.joint - fixed,
    rl = rest ? Math.max(0, remain / rest) : 0;
  let pos = 0;
  const rects: ZoneRect[] = [];
  for (const l of lens) {
    const len = l == null ? rl : l,
      s0 = Math.min(pos, total),
      e0 = Math.min(pos + len, total);
    rects.push(
      horiz
        ? { x: 0, y: s0, w: cross, h: Math.max(0, e0 - s0), len }
        : { x: s0, y: 0, w: Math.max(0, e0 - s0), h: cross, len },
    );
    pos += len + s.joint;
  }
  const used = pos - s.joint;
  return { rects, over: used - total, left: rest ? 0 : total - used, total, used, horiz };
}
