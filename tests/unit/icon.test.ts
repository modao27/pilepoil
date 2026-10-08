import { describe, expect, it } from 'vitest';
import { ICON_FILES, iconSvg, LEVEL } from '../../src/pwa/icon';

/** Rectangles du dessin (le premier rect est le fond) et la bulle. */
function shapes(svg: string) {
  const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => {
    const [x, y, w, h] = m.slice(1).map(Number) as [number, number, number, number];
    return { x, y, w, h };
  });
  const b = /<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/.exec(svg)!;
  const [cx, cy, rx, ry] = b.slice(1).map(Number) as [number, number, number, number];
  return { rects, bubble: { x: cx - rx, y: cy - ry, w: 2 * rx, h: 2 * ry } };
}

const corners = (t: { x: number; y: number; w: number; h: number }) =>
  [
    [t.x, t.y],
    [t.x + t.w, t.y],
    [t.x, t.y + t.h],
    [t.x + t.w, t.y + t.h],
  ] as const;

describe('icônes', () => {
  it('maskable : tout le niveau dans la zone sûre (cercle de 80 % du côté)', () => {
    const f = ICON_FILES.find((i) => i.name.includes('maskable'))!;
    const c = f.options.size / 2;
    const { rects, bubble } = shapes(iconSvg(f.options));
    for (const t of [...rects, bubble])
      for (const [x, y] of corners(t)) expect(Math.hypot(x - c, y - c)).toBeLessThanOrEqual(0.4 * f.options.size);
  });

  it('niveau, fiole, deux repères et bulle, dans l’icône', () => {
    for (const f of ICON_FILES) {
      const { rects, bubble } = shapes(iconSvg(f.options));
      expect(rects).toHaveLength(4);
      for (const t of [...rects, bubble])
        for (const [x, y] of corners(t)) {
          expect(Math.min(x, y)).toBeGreaterThanOrEqual(0);
          expect(Math.max(x, y)).toBeLessThanOrEqual(f.options.size + 0.01);
        }
    }
  });

  it('pile-poil : bulle centrée entre les repères, dans la fiole', () => {
    const { vial, marks, bubble } = LEVEL;
    expect((marks.xs[0] + marks.xs[1]) / 2).toBeCloseTo(bubble.cx, 9);
    expect(bubble.cx - bubble.rx).toBeGreaterThan(marks.xs[0] - 0.1);
    expect(bubble.cy - bubble.ry).toBeGreaterThanOrEqual(vial.y);
    expect(bubble.cy + bubble.ry).toBeLessThanOrEqual(vial.y + vial.h);
    expect(bubble.cx).toBeCloseTo(vial.x + vial.w / 2, 9);
  });

  it('fichiers : favicon SVG et PNG aux tailles attendues', () => {
    expect(ICON_FILES.map((f) => [f.name, f.options.size])).toEqual([
      ['favicon.svg', 64],
      ['icons/icon-192.png', 192],
      ['icons/icon-512.png', 512],
      ['icons/maskable-512.png', 512],
      ['icons/apple-touch-icon-180.png', 180],
    ]);
  });
});
