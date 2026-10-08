/** Transformation monde (mm, y vers le bas) → écran (px CSS) du plan 2D, zoom et déplacement. */
export interface View {
  /** px par mm */
  sc: number;
  ox: number;
  oy: number;
}

export interface Margins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Vue qui montre toute la surface W × H dans un cadre cw × ch, centrée, avec des marges (cotes). */
export function fitView(W: number, H: number, cw: number, ch: number, m: Margins): View {
  const aw = Math.max(1, cw - m.left - m.right),
    ah = Math.max(1, ch - m.top - m.bottom);
  const sc = Math.min(aw / Math.max(W, 1), ah / Math.max(H, 1));
  return { sc, ox: m.left + (aw - W * sc) / 2, oy: m.top + (ah - H * sc) / 2 };
}

export const toScreen = (v: View, x: number, y: number): [number, number] => [v.ox + x * v.sc, v.oy + y * v.sc];
export const toWorld = (v: View, px: number, py: number): [number, number] => [(px - v.ox) / v.sc, (py - v.oy) / v.sc];

/** Zoom de facteur f autour du point écran (px, py), borné à [min, max] fois l'échelle de base. */
export function zoomAt(v: View, f: number, px: number, py: number, base: number, min = 0.5, max = 12): View {
  const sc = Math.min(base * max, Math.max(base * min, v.sc * f));
  const k = sc / v.sc;
  return { sc, ox: px - (px - v.ox) * k, oy: py - (py - v.oy) * k };
}

export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, ox: v.ox + dx, oy: v.oy + dy });
