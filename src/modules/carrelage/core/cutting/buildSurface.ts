import { hash } from '../../../../core/hash';
import { buildPlinth } from '../layout/plinth';
import { buildReveals, type RevealGeometry } from '../layout/reveals';
import { layoutZones, type ZoneLayout } from '../layout/zones';
import { pattern } from '../patterns/registry';
import type { Piece, ProductLabel, RawPiece, SurfaceError, SurfaceSpec, SurfaceWarning, ZoneSpec } from '../types';
import { buildZone, type ZoneBuild } from './buildZone';

/** Au-delà, le calcul est refusé (affichage et temps de calcul). */
export const MAX_TILES = 20000;

export interface SurfaceBuild {
  pieces: Piece[];
  zones: (ZoneBuild | null)[];
  layout: ZoneLayout;
  reveals: RevealGeometry[];
  warnings: SurfaceWarning[];
}

export type SurfaceResult = { ok: true; value: SurfaceBuild } | { ok: false; error: SurfaceError };

/** Vérifie les dimensions et estime le nombre de carreaux. */
export function validateSurface(s: SurfaceSpec, lay: ZoneLayout): SurfaceError | null {
  if (!(s.width > 0 && s.height > 0 && s.joint >= 0)) return { code: 'invalid-surface' };
  if (!s.zones.length) return { code: 'no-zone' };
  for (let i = 0; i < s.zones.length; i++) {
    const t = s.zones[i]!.tile;
    if (!(t.width > 0 && t.height > 0)) return { code: 'invalid-tile', zone: i };
  }
  let est = 0;
  lay.rects.forEach((r, i) => {
    const z = s.zones[i]!,
      a = z.tile.width,
      b = z.tile.height;
    const cA = pattern(z.pattern).regular ? (a + s.joint) ** 2 * 0.8 : (a + s.joint) * (b + s.joint);
    est += (r.w * r.h) / cA;
  });
  return est > MAX_TILES ? { code: 'too-many-tiles', estimate: est } : null;
}

/** Calcule toutes les pièces d'une surface [buildSurface]. surface = indice dans le projet. */
export function buildSurface(s: SurfaceSpec, surface = 0): SurfaceResult {
  const lay = layoutZones(s);
  const error = validateSurface(s, lay);
  if (error) return { ok: false, error };

  const raw: RawPiece[] = [];
  const zones = s.zones.map((z, i) => buildZone(s, z, i, lay.rects[i]!, raw));
  const built = zones.map((z) => z != null);
  const warnings: SurfaceWarning[] = [];
  if (lay.over > 0.5) warnings.push({ code: 'zones-overflow', amount: lay.over });
  if (lay.left > 0.5) warnings.push({ code: 'zones-gap', amount: lay.left });
  const reveals = buildReveals(s, lay, built, raw, warnings);
  buildPlinth(s, built, raw, warnings);

  const pieces = raw.map((pc, i) => finishPiece(pc, i, s, zones[pc.zone]!, surface));
  return { ok: true, value: { pieces, zones, layout: lay, reveals, warnings } };
}

/** Couleur (mélange), produit, clé de regroupement et carton. */
function finishPiece(pc: RawPiece, i: number, s: SurfaceSpec, zb: ZoneBuild, surface: number): Piece {
  const z = s.zones[pc.zone]!;
  const color =
    z.mix === 'solid' || pc.reveal || pc.plinth
      ? z.tile.color
      : z.mix === 'alternate'
        ? pc.par
          ? z.colorB
          : z.tile.color
        : (hash(i) >>> 3) % 2
          ? z.colorB
          : z.tile.color;
  return {
    ...pc,
    surface,
    color,
    label: productLabel(pc, z, zb, s.joint),
    m2PerBox: pc.kind === 'main' ? z.tile.m2PerBox : 0,
    orientation: z.tile.orientation,
    key:
      pc.shape +
      (pc.shape === 'chevron' ? pc.par : '') +
      '|' +
      Math.round(pc.tW) +
      'x' +
      Math.round(pc.tH) +
      '|' +
      (pc.shape === 'rect' ? '' : z.tile.width + 'x' + z.tile.height) +
      '|' +
      color.toLowerCase(),
  };
}

function productLabel(pc: RawPiece, z: ZoneSpec, zb: ZoneBuild, j: number): ProductLabel {
  const a = z.tile.width,
    b = z.tile.height;
  switch (pc.shape) {
    case 'cab':
      return { shape: 'cab', size: [zb.g.s! - j, zb.g.s! - j] };
    case 'hex':
    case 'octo':
      return { shape: pc.shape, size: [a, a] };
    case 'chevron':
      return { shape: 'chevron', size: [Math.max(a, b), Math.min(a, b)] };
    default:
      return { shape: 'rect', size: [pc.tW, pc.tH] };
  }
}
