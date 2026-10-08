import { area } from '../geometry/polygon';
import { pattern } from '../patterns/registry';
import { groutKg } from '../rules/consumables';
import { glueAdvice, type GlueAdvice } from '../rules/glue';
import type { Piece, SurfaceSpec } from '../types';

/** Encollage et joint d'une zone. */
export interface ZoneGlue {
  surface: number;
  zone: number;
  advice: GlueAdvice;
  /** m² carrelés (pièces posées). */
  m2: number;
  /** Colle en kg, marge comprise. */
  kg: number;
  /** Joint en kg, marge comprise. */
  jointKg: number;
  groutColor: string;
  /** Nombre de pièces posées. */
  n: number;
  /** Plus grand côté du carreau posé. */
  long: number;
}

/** Encollage par zone d'une surface (carreaux principaux uniquement, pas les cabochons). */
export function surfaceGlue(s: SurfaceSpec, surface: number, pieces: Piece[], margin: number): ZoneGlue[] {
  const out: ZoneGlue[] = [];
  s.zones.forEach((z, i) => {
    const zp = pieces.filter((p) => p.zone === i && p.kind === 'main');
    const first = zp[0];
    if (!first) return;
    const advice = glueAdvice(first.tA, first.fw, first.fh, s.kind);
    const m2 = zp.reduce((t, p) => t + (p.parts ? p.parts.reduce((u, q) => u + area(q), 0) : p.pw * p.ph), 0) / 1e6;
    const A = Math.max(z.tile.width, z.tile.height),
      Bm = pattern(z.pattern).regular ? A : Math.min(z.tile.width, z.tile.height);
    out.push({
      surface,
      zone: i,
      advice,
      m2,
      kg: Math.ceil(m2 * advice.kgPerM2 * (1 + margin / 100)),
      jointKg: groutKg(m2, A, Bm, z.tile.thickness, s.joint, margin),
      groutColor: z.groutColor,
      n: zp.length,
      long: Math.max(first.fw, first.fh),
    });
  });
  return out;
}
