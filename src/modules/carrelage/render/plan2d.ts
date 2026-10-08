/**
 * Dessin du plan 2D d'une surface sur canvas (porté de draw() de legacy, sans la perspective).
 * Mode « plan » : statuts de coupe, coupes apparentes, cotes, numéros. Mode « rendu » : couleurs, photos,
 * variation de teinte, joints. Lit les données, n'écrit jamais l'état.
 */
import { area, bbox, hash, type CutPlan, type Piece, type Polygon, type SurfaceSpec } from '../core';
import type { SurfaceBuild } from '../core';
import type { View } from '../../../render/view';

export interface PlanColors {
  sheet: string;
  paper: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  onAccent: string;
  cut: string;
  reuse: string;
  thin: string;
  font: string;
}

export interface Selection {
  zone: number;
  opening: number;
  corner: number;
  piece: number;
}

export interface DrawInput {
  surface: SurfaceSpec;
  build: SurfaceBuild;
  plan: CutPlan;
  /** Indice de la première pièce de la surface dans le plan de découpe. */
  offset: number;
  view: View;
  width: number;
  height: number;
  mode: 'plan' | 'render';
  colors: PlanColors;
  selection: Selection;
  showNumbers: boolean;
  shade: number;
  /** Photo du carreau d'une zone (déjà chargée), ou null. */
  photo: (zone: number) => CanvasImageSource | null;
  photoSize: (zone: number) => [number, number];
  /** Retournements aléatoires de la photo permis pour la zone. */
  photoFlip: (zone: number) => boolean;
  guides: { zone: number; x: number | null; y: number | null } | null;
  /** Libellé court d'une ouverture (« F1 », « Po2 »). */
  openingCode: (i: number) => string;
}

const cmTxt = (mm: number) => (mm / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function drawPlan(ctx: CanvasRenderingContext2D, d: DrawInput): void {
  const { surface: s, build, view, colors: C, mode } = d;
  const plan = mode === 'plan';
  const W = s.width,
    H = s.height,
    sc = view.sc;
  const X = (x: number) => view.ox + x * sc,
    Y = (y: number) => view.oy + y * sc;
  const pathParts = (parts: Polygon[]) => {
    ctx.beginPath();
    for (const p of parts) {
      p.forEach((q, i) => (i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))));
      ctx.closePath();
    }
  };
  const strokeOutline = (pc: Piece) => {
    ctx.beginPath();
    for (const [A, B] of pc.outline) {
      ctx.moveTo(X(A[0]), Y(A[1]));
      ctx.lineTo(X(B[0]), Y(B[1]));
    }
    ctx.stroke();
  };
  const statusFill = (pc: Piece, i: number) => {
    if (pc.full) {
      ctx.fillStyle = C.sheet;
      ctx.globalAlpha = 1;
    } else {
      const reused = d.plan.reused[d.offset + i];
      ctx.fillStyle = pc.thin ? C.thin : reused ? C.reuse : C.cut;
      ctx.globalAlpha = pc.thin ? 0.75 : reused ? 0.7 : 0.55;
    }
  };

  ctx.clearRect(0, 0, d.width, d.height);
  const lay = build.layout;
  const pieces = build.pieces;

  /* ---------- pièces ---------- */
  if (plan) {
    ctx.fillStyle = C.line;
    ctx.fillRect(X(0), Y(0), W * sc, H * sc);
    pieces.forEach((pc, i) => {
      if (!pc.parts || pc.reveal) return;
      pathParts(pc.parts);
      statusFill(pc, i);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 0.6;
      strokeOutline(pc);
    });
  } else {
    lay.rects.forEach((r, i) => {
      if (r.w <= 0 || r.h <= 0) return;
      const hj = s.joint / 2,
        x0 = Math.max(0, r.x - hj),
        y0 = Math.max(0, r.y - hj),
        x1 = Math.min(W, r.x + r.w + hj),
        y1 = Math.min(H, r.y + r.h + hj);
      ctx.fillStyle = s.zones[i]!.groutColor;
      ctx.fillRect(X(x0), Y(y0), (x1 - x0) * sc, (y1 - y0) * sc);
    });
    const thinJoint = s.joint * sc < 1;
    pieces.forEach((pc, i) => {
      if (!pc.parts || pc.reveal) return;
      drawRendered(ctx, d, pc, i, pathParts, strokeOutline, thinJoint);
    });
  }

  /* ---------- ouvertures ---------- */
  s.openings.forEach((r, ri) => {
    const x0 = Math.max(0, r.x),
      x1 = Math.min(W, r.x + r.width),
      y0 = Math.max(0, H - r.sill - r.height),
      y1 = Math.min(H, H - r.sill);
    if (x1 <= x0 || y1 <= y0) return;
    const rx = X(x0),
      ry = Y(y0),
      rw = (x1 - x0) * sc,
      rh = (y1 - y0) * sc;
    const sel = ri === d.selection.opening;
    const rvl = build.reveals.find((q) => q.opening === ri);
    const inn = rvl ? rvl.inner : [x0, y0, x1, y1];
    const ix = X(Math.max(x0, inn[0])),
      iy = Y(Math.max(y0, inn[1])),
      iw = (Math.min(x1, inn[2]) - Math.max(x0, inn[0])) * sc,
      ih = (Math.min(y1, inn[3]) - Math.max(y0, inn[1])) * sc;
    const revPieces = rvl ? pieces.map((pc, i) => [pc, i] as const).filter(([pc]) => pc.reveal?.opening === ri) : [];
    if (plan) {
      if (r.type !== 'socket') {
        ctx.fillStyle = C.sheet;
        ctx.fillRect(rx, ry, rw, rh);
      }
      if (rvl) {
        for (const sd of rvl.sides) {
          pathParts([sd.poly]);
          ctx.fillStyle = C.muted;
          ctx.globalAlpha = 0.18;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        for (const [pc, i] of revPieces) {
          pathParts(pc.parts!);
          statusFill(pc, i);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = C.muted;
          ctx.lineWidth = 0.6;
          strokeOutline(pc);
        }
      }
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      if (r.type === 'door' && s.kind !== 'floor') {
        const rad = Math.min(iw, ih);
        ctx.moveTo(ix, iy + ih);
        ctx.lineTo(ix, iy + ih - rad);
        ctx.arc(ix, iy + ih, rad, -Math.PI / 2, 0);
      } else if (r.type === 'socket') ctx.arc(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.36, 0, Math.PI * 2);
      else if (r.type === 'tub') {
        const m = Math.min(rw, rh) * 0.12;
        ctx.roundRect(rx + m, ry + m, rw - 2 * m, rh - 2 * m, Math.min(rw, rh) * 0.3);
      } else if (r.type === 'trap') {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rx, ry, rw, rh);
        ctx.clip();
        ctx.beginPath();
        for (let t = -rh; t < rw; t += 8) {
          ctx.moveTo(rx + t, ry);
          ctx.lineTo(rx + t + rh, ry + rh);
        }
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
      } else {
        ctx.moveTo(ix, iy);
        ctx.lineTo(ix + iw, iy + ih);
        ctx.moveTo(ix + iw, iy);
        ctx.lineTo(ix, iy + ih);
      }
      ctx.stroke();
      if (rvl) {
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(ix, iy, iw, ih);
      }
      ctx.strokeStyle = sel ? C.accent : C.ink;
      ctx.lineWidth = sel ? 2.5 : 1.5;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.font = `600 13px ${C.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const t1 = d.openingCode(ri),
        t2 = `${cmTxt(r.width)} × ${cmTxt(r.height)}`;
      if (iw > ctx.measureText(t2).width + 12 && ih > 40) {
        const bw = ctx.measureText(t2).width + 10,
          mx = ix + iw / 2,
          my = iy + ih / 2;
        ctx.fillStyle = C.sheet;
        ctx.fillRect(mx - bw / 2, my - 17, bw, 34);
        ctx.fillStyle = sel ? C.accent : C.ink;
        ctx.fillText(t1, mx, my - 8);
        ctx.fillText(t2, mx, my + 8);
      }
      if (sel) {
        ctx.font = `600 12px ${C.font}`;
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 1;
        const my = ry + rh / 2,
          mx = rx + rw / 2;
        if (r.x > 0) dimLabel(ctx, C, X(0), my, rx, my, cmTxt(r.x));
        if (r.sill > 0) dimLabel(ctx, C, mx, ry + rh, mx, Y(H), cmTxt(r.sill));
      }
    } else {
      if (rvl) {
        const zg = s.zones[rvl.zone]!.groutColor;
        for (const sd of rvl.sides) {
          pathParts([sd.poly]);
          ctx.fillStyle = zg;
          ctx.fill();
        }
        for (const [pc, i] of revPieces) drawRendered(ctx, d, pc, i, pathParts, strokeOutline, s.joint * sc < 1);
        const shadeSide = { L: 0.06, R: 0.12, T: 0.2, B: 0.02 };
        for (const sd of rvl.sides) {
          pathParts([sd.poly]);
          ctx.fillStyle = `rgba(0,0,0,${shadeSide[sd.side]})`;
          ctx.fill();
        }
      }
      drawOpeningFace(ctx, r.type, ix, iy, iw, ih, rx, ry, rw, rh);
      if (sel) {
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx, ry, rw, rh);
      }
    }
  });

  /* ---------- angles de mur ---------- */
  if (s.kind !== 'floor') {
    s.corners.forEach((fo, fi) => {
      if (fo.x <= 0 || fo.x >= W) return;
      const fx = X(fo.x),
        sel = fi === d.selection.corner;
      ctx.save();
      ctx.strokeStyle = sel ? C.accent : C.ink;
      ctx.lineWidth = sel ? 2.5 : 1.6;
      ctx.setLineDash(fo.type === 'in' ? [10, 4, 2, 4] : [3, 3]);
      ctx.beginPath();
      ctx.moveTo(fx, Y(0));
      ctx.lineTo(fx, Y(H));
      ctx.stroke();
      ctx.restore();
      if (!plan) {
        const g = ctx.createLinearGradient(fx - 14, 0, fx + 14, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, fo.type === 'in' ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.22)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(fx - 14, Y(0), 28, H * sc);
      }
    });
  }

  /* ---------- coupes apparentes ---------- */
  if (plan) {
    ctx.strokeStyle = C.thin;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (const pc of pieces) {
      for (const [A, B] of pc.vis) {
        ctx.beginPath();
        ctx.moveTo(X(A[0]), Y(A[1]));
        ctx.lineTo(X(B[0]), Y(B[1]));
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
  }

  /* ---------- reste non carrelé ---------- */
  if (lay.left > 0.5) {
    const s0 = Math.max(0, lay.used + s.joint / 2);
    const r = lay.horiz ? [0, s0, W, H - s0] : [s0, 0, W - s0, H];
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(r[0]!), Y(r[1]!), r[2]! * sc, r[3]! * sc);
    ctx.fillStyle = C.sheet;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = C.muted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let t = -d.height; t < d.width + d.height; t += 9) {
      ctx.beginPath();
      ctx.moveTo(t, 0);
      ctx.lineTo(t + d.height, d.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!plan) {
    const g = ctx.createLinearGradient(X(0), Y(0), X(W), Y(H));
    g.addColorStop(0, 'rgba(255,255,255,.10)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = g;
    ctx.fillRect(X(0), Y(0), W * sc, H * sc);
  }

  /* ---------- zones ---------- */
  const multi = s.zones.length > 1;
  if (plan) {
    lay.rects.forEach((r, i) => {
      if (r.w <= 0 || r.h <= 0) return;
      const sel = i === d.selection.zone;
      if (!multi && !sel) return;
      ctx.setLineDash(sel ? [] : [5, 4]);
      ctx.strokeStyle = sel ? C.accent : C.ink;
      ctx.lineWidth = sel ? 2.5 : 1.2;
      ctx.strokeRect(X(r.x), Y(r.y), r.w * sc, r.h * sc);
      ctx.setLineDash([]);
      if (!multi) return;
      const tag = 'Z' + (i + 1);
      ctx.font = `600 12px ${C.font}`;
      const tw = ctx.measureText(tag).width + 8;
      if (r.h * sc > 18 && r.w * sc > tw + 6) {
        ctx.fillStyle = sel ? C.accent : C.ink;
        ctx.fillRect(X(r.x) + 3, Y(r.y) + 3, tw, 16);
        ctx.fillStyle = sel ? C.onAccent : C.sheet;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, X(r.x) + 7, Y(r.y) + 11.5);
      }
    });
  }

  ctx.strokeStyle = C.ink;
  ctx.lineWidth = plan ? 2 : 1.5;
  ctx.strokeRect(X(0), Y(0), W * sc, H * sc);

  if (plan) {
    /* cotes */
    ctx.font = `600 14px ${C.font}`;
    hdim(ctx, C, X(0), X(W), Y(0) - 20, cmTxt(W) + ' cm');
    vdim(ctx, C, Y(0), Y(H), X(0) - 20, cmTxt(H) + ' cm');
    if (multi) {
      ctx.font = `600 13px ${C.font}`;
      for (const r of lay.rects) {
        if (lay.horiz) {
          if (r.h > 0) vdim(ctx, C, Y(r.y), Y(r.y + r.h), X(W) + 22, cmTxt(r.h));
        } else if (r.w > 0) hdim(ctx, C, X(r.x), X(r.x + r.w), Y(H) + 22, cmTxt(r.w));
      }
    }
    /* numéros de coupe */
    if (d.showNumbers) {
      ctx.font = `600 10px ${C.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      pieces.forEach((pc, i) => {
        const n = d.plan.source[d.offset + i];
        if (pc.full || n == null || !pc.parts) return;
        const mp = pc.parts.reduce((m, p) => (area(p) > area(m) ? p : m), pc.parts[0]!);
        const b = bbox(mp);
        if (Math.min(b[1] - b[0], b[3] - b[2]) * sc < 12) return;
        const cx = mp.reduce((t, q) => t + q[0], 0) / mp.length,
          cy = mp.reduce((t, q) => t + q[1], 0) / mp.length;
        const txt = String(n),
          w = ctx.measureText(txt).width + 5;
        if (w > (b[1] - b[0]) * sc - 2) return;
        ctx.fillStyle = C.sheet;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(X(cx) - w / 2, Y(cy) - 6, w, 12);
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.ink;
        ctx.fillText(txt, X(cx), Y(cy) + 0.5);
      });
    }
    /* étiquettes d'angles */
    if (s.kind !== 'floor') {
      s.corners.forEach((fo, fi) => {
        if (fo.x <= 0 || fo.x >= W) return;
        const sel = fi === d.selection.corner;
        ctx.font = `600 12px ${C.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const t = `A${fi + 1} ${fo.type === 'in' ? 'rentrant' : 'sortant'} ${Math.round(fo.angle)}°`,
          w = ctx.measureText(t).width + 8;
        const ty = Y(0) + 12,
          tx = Math.min(Math.max(X(fo.x), X(0) + w / 2 + 2), X(W) - w / 2 - 2);
        ctx.fillStyle = sel ? C.accent : C.ink;
        ctx.fillRect(tx - w / 2, ty - 8, w, 16);
        ctx.fillStyle = sel ? C.onAccent : C.sheet;
        ctx.fillText(t, tx, ty + 0.5);
      });
    }
    /* origine du motif de la zone active */
    const zb = build.zones[d.selection.zone],
      r = lay.rects[d.selection.zone];
    if (zb && r) {
      const oX = X(zb.O[0]),
        oY = Y(zb.O[1]);
      if (oX >= X(r.x) - 1 && oX <= X(r.x + r.w) + 1 && oY >= Y(r.y) - 1 && oY <= Y(r.y + r.h) + 1) {
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(oX - 9, oY);
        ctx.lineTo(oX + 9, oY);
        ctx.moveTo(oX, oY - 9);
        ctx.lineTo(oX, oY + 9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(oX, oY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /* guides d'aimantation */
  if (d.guides) {
    const r = lay.rects[d.guides.zone];
    if (r) {
      ctx.save();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      if (d.guides.x != null) {
        ctx.moveTo(X(r.x + d.guides.x), Y(r.y) - 8);
        ctx.lineTo(X(r.x + d.guides.x), Y(r.y + r.h) + 8);
      }
      if (d.guides.y != null) {
        ctx.moveTo(X(r.x) - 8, Y(r.y + d.guides.y));
        ctx.lineTo(X(r.x + r.w) + 8, Y(r.y + d.guides.y));
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  /* pièce touchée */
  const picked = pieces[d.selection.piece];
  if (picked?.parts) {
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 3;
    strokeOutline(picked);
  }
}

function drawRendered(
  ctx: CanvasRenderingContext2D,
  d: DrawInput,
  pc: Piece,
  i: number,
  pathParts: (p: Polygon[]) => void,
  strokeOutline: (pc: Piece) => void,
  thinJoint: boolean,
) {
  const { view } = d,
    sc = view.sc;
  const X = (x: number) => view.ox + x * sc,
    Y = (y: number) => view.oy + y * sc;
  pathParts(pc.parts!);
  ctx.fillStyle = pc.color;
  ctx.fill();
  const im = pc.img ? d.photo(pc.zone) : null;
  if (im && pc.img) {
    let [o, u, v] = pc.img;
    if (d.photoFlip(pc.zone) && hash(i * 31 + 7) & 1) [o, u, v] = [[u[0] + v[0] - o[0], u[1] + v[1] - o[1]], v, u];
    const [iw, ih] = d.photoSize(pc.zone);
    const ox = X(o[0]),
      oy = Y(o[1]);
    ctx.save();
    ctx.clip();
    ctx.transform((X(u[0]) - ox) / iw, (Y(u[1]) - oy) / iw, (X(v[0]) - ox) / ih, (Y(v[1]) - oy) / ih, ox, oy);
    ctx.drawImage(im, 0, 0);
    ctx.restore();
    pathParts(pc.parts!);
  }
  if (d.shade) {
    const h = hash(i),
      k = ((h % 1000) / 1000 - 0.5) * 2;
    ctx.fillStyle = k > 0 ? `rgba(255,255,255,${k * d.shade})` : `rgba(0,0,0,${-k * d.shade})`;
    ctx.fill();
  }
  if (thinJoint) {
    ctx.strokeStyle = d.surface.zones[pc.zone]!.groutColor;
    ctx.lineWidth = 0.7;
    strokeOutline(pc);
  }
}

function drawOpeningFace(
  ctx: CanvasRenderingContext2D,
  rt: string,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
) {
  if (rt === 'window') {
    const gl = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
    gl.addColorStop(0, '#dbe7ee');
    gl.addColorStop(0.5, '#b9cdd9');
    gl.addColorStop(1, '#9fb6c4');
    ctx.fillStyle = gl;
    ctx.fillRect(ix, iy, iw, ih);
    const fr = Math.max(3, Math.min(iw, ih) * 0.05);
    ctx.strokeStyle = '#f4f4f2';
    ctx.lineWidth = fr;
    ctx.strokeRect(ix + fr / 2, iy + fr / 2, iw - fr, ih - fr);
    if (iw > ih * 0.9) {
      ctx.beginPath();
      ctx.moveTo(ix + iw / 2, iy);
      ctx.lineTo(ix + iw / 2, iy + ih);
      ctx.lineWidth = fr * 0.8;
      ctx.stroke();
    }
  } else if (rt === 'door') {
    const g = ctx.createLinearGradient(ix, 0, ix + iw, 0);
    g.addColorStop(0, '#8a7259');
    g.addColorStop(1, '#6d5843');
    ctx.fillStyle = g;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + iw * 0.12, iy + ih * 0.06, iw * 0.76, ih * 0.4);
    ctx.strokeRect(ix + iw * 0.12, iy + ih * 0.52, iw * 0.76, ih * 0.42);
    ctx.fillStyle = '#d9d4c8';
    ctx.beginPath();
    ctx.arc(ix + iw * 0.86, iy + ih * 0.52, Math.max(1.5, iw * 0.035), 0, Math.PI * 2);
    ctx.fill();
  } else if (rt === 'socket') {
    const m = Math.max(1, Math.min(rw, rh) * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(rx - m + 1, ry - m + 2, rw + 2 * m, rh + 2 * m);
    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(rx - m, ry - m, rw + 2 * m, rh + 2 * m);
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(rx + rw / 2, ry + rh / 2, Math.min(rw, rh) * 0.32, 0, Math.PI * 2);
    ctx.stroke();
  } else if (rt === 'tub') {
    ctx.fillStyle = '#f6f6f3';
    ctx.fillRect(rx, ry, rw, rh);
    const g = ctx.createLinearGradient(0, ry, 0, ry + rh);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  } else if (rt === 'trap') {
    ctx.fillStyle = '#d9d5cd';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.strokeStyle = '#f2f0ea';
    ctx.lineWidth = Math.max(2, iw * 0.06);
    ctx.strokeRect(ix, iy, iw, ih);
  } else {
    ctx.fillStyle = '#e4e0d8';
    ctx.fillRect(ix, iy, iw, ih);
  }
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  if (rt !== 'socket') ctx.strokeRect(rx, ry, rw, rh);
}

function label(ctx: CanvasRenderingContext2D, C: PlanColors, txt: string, x: number, y: number, rot: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(-Math.PI / 2);
  const w = ctx.measureText(txt).width + 8;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(-w / 2, -9, w, 18);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

function hdim(ctx: CanvasRenderingContext2D, C: PlanColors, x0: number, x1: number, y: number, txt: string) {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.moveTo(x0, y - 5);
  ctx.lineTo(x0, y + 5);
  ctx.moveTo(x1, y - 5);
  ctx.lineTo(x1, y + 5);
  ctx.stroke();
  if (x1 - x0 > ctx.measureText(txt).width + 10) label(ctx, C, txt, (x0 + x1) / 2, y, false);
}

function vdim(ctx: CanvasRenderingContext2D, C: PlanColors, y0: number, y1: number, x: number, txt: string) {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.moveTo(x - 5, y0);
  ctx.lineTo(x + 5, y0);
  ctx.moveTo(x - 5, y1);
  ctx.lineTo(x + 5, y1);
  ctx.stroke();
  if (y1 - y0 > ctx.measureText(txt).width + 10) label(ctx, C, txt, x, (y0 + y1) / 2, true);
}

/** Cote d'une ouverture sélectionnée (distance au bord gauche ou au bas). */
function dimLabel(
  ctx: CanvasRenderingContext2D,
  C: PlanColors,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: string,
) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  const bw = ctx.measureText(t).width + 8,
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2;
  if (Math.hypot(x1 - x0, y1 - y0) < bw + 6) return;
  ctx.fillStyle = C.sheet;
  ctx.fillRect(mx - bw / 2, my - 8, bw, 16);
  ctx.fillStyle = C.accent;
  ctx.fillText(t, mx, my);
}
