import { describe, expect, it } from 'vitest';
import { ICON_FILES, iconSvg } from '../../src/pwa/icon';

/** Rectangles des carreaux (le premier rect est le fond). */
function tiles(svg: string) {
  return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => {
    const [x, y, w, h] = m.slice(1).map(Number) as [number, number, number, number];
    return { x, y, w, h };
  });
}

describe('icônes', () => {
  it('maskable : tous les carreaux dans la zone sûre (cercle de 80 % du côté)', () => {
    const f = ICON_FILES.find((i) => i.name.includes('maskable'))!;
    const size = f.options.size;
    const c = size / 2;
    for (const t of tiles(iconSvg(f.options))) {
      for (const [x, y] of [
        [t.x, t.y],
        [t.x + t.w, t.y],
        [t.x, t.y + t.h],
        [t.x + t.w, t.y + t.h],
      ] as const) {
        expect(Math.hypot(x - c, y - c)).toBeLessThanOrEqual(0.4 * size);
      }
    }
  });

  it('sept carreaux sans chevauchement, dans l’icône', () => {
    for (const f of ICON_FILES) {
      const ts = tiles(iconSvg(f.options));
      expect(ts).toHaveLength(7);
      for (const t of ts) {
        expect(t.x).toBeGreaterThanOrEqual(0);
        expect(t.x + t.w).toBeLessThanOrEqual(f.options.size + 0.01);
      }
      for (let i = 0; i < ts.length; i++)
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i]!,
            b = ts[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap).toBe(false);
        }
    }
  });
});
