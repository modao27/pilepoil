/**
 * Plinthes (docs/parquet/SPEC.md §4.5) : chaque mur des pièces posées, moins les portes et les baies, autour
 * des obstacles si l'option est cochée ; coupes d'onglet aux angles ; barres optimisées (core/cutting/bars).
 * Pur, repère du plan, mm.
 */
import { cutBars } from '../../../core/cutting/bars';
import type { Point } from '../../../core/geometry/types';
import type { ParquetSpec, SkirtingPiece, SkirtingResult } from './types';

const EPS = 0.5;
const round2 = (v: number) => Math.round(v * 100) / 100;

export function computeSkirting(spec: ParquetSpec): SkirtingResult {
  const sk = spec.accessories.skirting;
  if (!sk.enabled) return { bars: 0, pieces: [], plan: [], offcuts: [] };
  // pièces de toutes les poses, une seule fois (une pièce peut être partagée par deux poses séparées)
  const seen = new Set<string>();
  const rooms = spec.layouts.flatMap((l) => l.rooms).filter((r) => !seen.has(r.id) && !!seen.add(r.id));
  const pieces: SkirtingPiece[] = [];
  for (const room of rooms) {
    const n = room.outline.length;
    for (let i = 0; i < n; i++) {
      const a = room.outline[i]!,
        b = room.outline[(i + 1) % n]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < EPS) continue;
      // ouvertures au sol sur ce mur : intervalles à retirer
      const gaps = room.openings
        .filter((o) => o.kind !== 'window')
        .map((o) => [along(a, b, o.segment[0]), along(a, b, o.segment[1])] as const)
        .filter(([s, t]) => s != null && t != null)
        .map(([s, t]) => [Math.max(0, Math.min(s!, t!)), Math.min(len, Math.max(s!, t!))] as [number, number])
        .sort((x, y) => x[0] - y[0]);
      let start = 0,
        k = 0;
      const push = (from: number, to: number) => {
        if (to - from < EPS) return;
        // onglet aux bouts qui touchent un angle du mur ; coupe droite contre une porte
        const mitres = (from < EPS ? 1 : 0) + (to > len - EPS ? 1 : 0);
        pieces.push({ id: `${room.id}-M${i + 1}-${++k}`, room: room.id, wall: i, length: round2(to - from), mitres });
      };
      for (const [s, t] of gaps) {
        push(start, s);
        start = Math.max(start, t);
      }
      push(start, len);
    }
    if (sk.aroundObstacles)
      room.obstacles.forEach((o, j) => {
        o.forEach((p, e) => {
          const q = o[(e + 1) % o.length]!;
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          if (len >= EPS)
            pieces.push({
              id: `${room.id}-O${j + 1}-${e + 1}`,
              room: room.id,
              wall: -1,
              length: round2(len),
              mitres: 2,
            });
        });
      });
  }
  const r = cutBars({
    pieces,
    barLength: sk.barLength,
    kerf: spec.settings.kerf,
    mitreAllowance: sk.mitreAllowance,
  });
  return { bars: r.bars.length, pieces, plan: r.bars, offcuts: r.offcuts };
}

/** Abscisse de p le long du mur [a, b] s'il est sur sa droite (à 1 mm près), sinon null. */
function along(a: Point, b: Point, p: Point): number | null {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len;
  const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
  return d < 1 && t > -1 && t < len + 1 ? t : null;
}
