/**
 * Export PDF A4 : résumé et liste d'achat, plan coté de chaque surface, plan de découpe, encollage.
 * Dessin vectoriel (lisible à l'impression, zoomable à l'écran). Lit les résultats, n'écrit rien.
 */
import { bbox, type Polygon, type ProjectResult, type ProjectSpec, type SurfaceBuild } from '../../core';
import { itemPrice, projectArea, projectCost } from '../../state/pricing';
import type { Tile } from '../../state/model';
import type { CarrelageProject } from '../../state/data';
import { glueRows, pieceCutText, projectDescription, shoppingLabel } from './labels';
import { productName } from './messages';
import {
  ACCENT,
  cm,
  Doc,
  euro,
  fr,
  INK,
  LINE,
  M,
  MUTED,
  pdfText,
  poly,
  STATUS,
  THIN,
} from '../../../../ui/lib/pdf/doc';

export { pdfText };

export interface PdfInput {
  project: CarrelageProject;
  spec: ProjectSpec;
  result: ProjectResult;
  tiles: readonly Tile[];
  /** Date affichée (ms). */
  date: number;
}

export function buildPdf(input: PdfInput): Blob {
  const { project, spec, result, tiles, date } = input;
  const d = new Doc();
  const pdf = d.pdf;
  const cost = projectCost(project, tiles, result);
  const tilesById = new Map(tiles.map((t) => [t.id, t]));
  const multi = project.surfaces.length > 1;

  /* ---------- page 1 : résumé, commande, achats ---------- */
  d.text(project.name, 18, { bold: true, gap: 1 });
  d.text(
    `${projectDescription(project, tiles)} · ${fr(projectArea(project), 2)} m² · ${new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    10,
    { color: MUTED, gap: 5 },
  );
  const m = result.metrics;
  const figs: [string, string][] = [
    ['À commander', `${fr(m.order)} carreaux`],
    ['Coupes', fr(m.cuts)],
    ['Dans les chutes', fr(m.reused)],
    ['Coupes fines', fr(m.thin)],
    ['Coût estimé', cost.total > 0 ? euro(cost.total) : '–'],
  ];
  const fw = (d.w - 2 * M) / figs.length;
  figs.forEach(([l, v], i) => {
    const x = M + i * fw;
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x + 0.5, d.y, fw - 1, 15, 1.5, 1.5, 'S');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    d.color(MUTED);
    pdf.text(pdfText(l), x + 3, d.y + 5);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    d.color(INK);
    pdf.text(pdfText(v), x + 3, d.y + 11.5);
  });
  d.y += 21;

  d.text('Commande' + (multi ? ', toutes surfaces' : ''), 13, { bold: true, gap: 2 });
  d.table(
    [
      { label: 'Carreau', w: 62 },
      { label: 'Posés', w: 22, align: 'right' },
      { label: 'Nécessaires', w: 26, align: 'right' },
      { label: 'À commander', w: 28, align: 'right' },
      { label: 'm²', w: 22, align: 'right' },
      { label: 'Cartons', w: 22, align: 'right' },
    ],
    result.plan.groups.map((g, i) => {
      const o = result.orders[i]!;
      return [productName(g.label), fr(o.posed), fr(o.needed), fr(o.order), fr(o.m2, 2), o.boxes ? fr(o.boxes) : '–'];
    }),
  );
  d.text(`Marge de casse ${fr(project.settings.margin)} % comprise.`, 8, { color: MUTED, gap: 5 });

  d.text('Liste d’achat', 13, { bold: true, gap: 2 });
  d.table(
    [
      { label: 'Article', w: 66 },
      { label: 'Quantité', w: 58 },
      { label: 'Prix unitaire', w: 30, align: 'right' },
      { label: 'Total', w: 28, align: 'right' },
    ],
    result.shopping.map((it) => {
      const l = shoppingLabel(it, result.plan.groups);
      const p = itemPrice(it, project, tilesById, result);
      return [l.label, l.qty, p != null ? `${fr(p, 2)} ${l.unit}` : '', p != null ? euro(p * it.mult) : '–'];
    }),
    {
      foot: [
        `Total estimé${cost.unpriced ? ` (${cost.unpriced} sans prix)` : ''}`,
        '',
        '',
        cost.total > 0 ? euro(cost.total) : '–',
      ],
    },
  );
  d.text(
    'Quantités arrondies au conditionnement, marge de casse incluse. Croisillons, cales, primaire et silicone sont des estimations.',
    8,
    { color: MUTED },
  );

  /* ---------- un plan coté par surface ---------- */
  let offset = 0;
  result.surfaces.forEach((sr, si) => {
    const s = spec.surfaces[si]!;
    const pieces = sr.ok ? sr.value.pieces : [];
    const start = offset;
    offset += pieces.length;
    d.page(s.width >= s.height ? 'landscape' : 'portrait');
    d.text(`Plan coté — ${project.surfaces[si]?.name ?? ''}`, 15, { bold: true, gap: 1 });
    d.text(
      `${s.kind === 'floor' ? 'Sol' : 'Mur'} de ${cm(s.width)} × ${cm(s.height)} cm, joint ${fr(s.joint, 1)} mm`,
      9,
      { color: MUTED, gap: 2 },
    );
    if (!sr.ok) {
      d.text('Surface non calculée : vérifiez ses dimensions et son carreau.', 11, { color: THIN });
      return;
    }
    drawPlan(d, s, sr.value, result, start);
  });

  /* ---------- plan de découpe ---------- */
  d.page();
  d.text('Plan de découpe', 15, { bold: true, gap: 1 });
  d.text('Les pièces de même numéro sortent du même carreau. Numéros identiques sur les plans.', 9, {
    color: MUTED,
    gap: 4,
  });
  const cutGroups = result.plan.groups.filter((g) => g.tiles.length);
  if (!cutGroups.length) d.text('Aucune coupe.', 10);
  for (const g of cutGroups) {
    d.room(14);
    d.text(`${productName(g.label)} — ${g.tiles.length} carreaux à couper`, 11, { bold: true, gap: 1.5 });
    d.table(
      [
        { label: 'N°', w: 14 },
        { label: 'Pièces taillées dans le carreau (mm)', w: d.w - 2 * M - 14 },
      ],
      g.tiles.map((t) => [String(t.n), t.pieces.map((i) => pieceCutText(result.pieces[i]!, project)).join(' + ')]),
      { size: 8.5 },
    );
  }

  /* ---------- encollage ---------- */
  d.room(40);
  d.text('Encollage (indicatif)', 13, { bold: true, gap: 2 });
  d.table(
    [
      { label: 'Zone', w: 34 },
      { label: 'Carreau', w: 34 },
      { label: 'Spatule', w: 30 },
      { label: 'Encollage', w: 62 },
      { label: 'Colle', w: 22, align: 'right' },
    ],
    glueRows(project, result).map((g) => [
      g.where,
      `${g.tile} (${g.size})`,
      g.notch,
      `${g.mode}${g.note ? ' — ' + g.note : ''}`,
      g.kg,
    ]),
    { size: 8.5 },
  );
  d.text(
    'Repères issus du NF DTU 52.2 et des fiches techniques de mortiers-colles, pose intérieure sur support plan. La fiche du mortier-colle et la notice du fabricant restent prioritaires.',
    8,
    { color: MUTED },
  );

  /* ---------- pieds de page ---------- */
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    const w = pdf.internal.pageSize.getWidth(),
      h = pdf.internal.pageSize.getHeight();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(pdfText(`Pilepoil · ${project.name}`), M, h - 7);
    pdf.text(`${i} / ${n}`, w - M, h - 7, { align: 'right' });
  }
  return pdf.output('blob');
}

/** Plan coté d'une surface dans l'espace restant de la page, avec légende. */
function drawPlan(
  d: Doc,
  s: ProjectSpec['surfaces'][number],
  build: SurfaceBuild,
  result: ProjectResult,
  start: number,
) {
  const pdf = d.pdf;
  const pieces = build.pieces;
  const legendH = 8;
  const left = M + 14,
    top = d.y + 12,
    right = d.w - M - 4,
    bottom = d.h - M - 8 - legendH;
  const k = Math.min((right - left) / s.width, (bottom - top) / s.height);
  const ox = left + (right - left - s.width * k) / 2,
    oy = top;
  const X = (x: number) => ox + x * k,
    Y = (y: number) => oy + y * k;
  const P = (p: Polygon): [number, number][] => p.map((q) => [X(q[0]), Y(q[1])]);

  // échelle lisible : 1:N arrondi
  const scale = 1 / k;
  d.text(`Échelle 1:${fr(Math.round(scale / 5) * 5)} sur A4`, 8, { color: MUTED, gap: 0 });

  /* pièces */
  pdf.setLineWidth(0.08);
  pdf.setDrawColor(140, 150, 156);
  pieces.forEach((pc, i) => {
    if (!pc.parts) return;
    const reused = result.plan.reused[start + i];
    const st = pc.full ? 'full' : pc.thin ? 'thin' : reused ? 'reuse' : 'cut';
    pdf.setFillColor(...STATUS[st]);
    for (const part of pc.parts) poly(pdf, P(part), 'FD');
  });

  /* ouvertures */
  pdf.setLineWidth(0.25);
  pdf.setDrawColor(...INK);
  s.openings.forEach((o, ri) => {
    const x0 = Math.max(0, o.x),
      x1 = Math.min(s.width, o.x + o.width),
      y0 = Math.max(0, s.height - o.sill - o.height),
      y1 = Math.min(s.height, s.height - o.sill);
    if (x1 <= x0 || y1 <= y0) return;
    if (o.type !== 'socket') {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(X(x0), Y(y0), (x1 - x0) * k, (y1 - y0) * k, 'FD');
      pdf.setLineWidth(0.1);
      pdf.line(X(x0), Y(y0), X(x1), Y(y1));
      pdf.line(X(x1), Y(y0), X(x0), Y(y1));
      pdf.setLineWidth(0.25);
    } else pdf.circle(X((x0 + x1) / 2), Y((y0 + y1) / 2), Math.max(0.8, ((x1 - x0) * k) / 2), 'S');
    const code =
      ({ window: 'F', door: 'Po', socket: 'Pr', trap: 'T', tub: 'B', other: 'R' } as const)[o.type] + (ri + 1);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    d.color(ACCENT);
    pdf.text(`${code} ${cm(o.width)}×${cm(o.height)}`, X((x0 + x1) / 2), Y((y0 + y1) / 2), {
      align: 'center',
      baseline: 'middle',
    });
    // position : depuis la gauche et allège
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`x ${cm(o.x)}`, X(x0) - 1, Y((y0 + y1) / 2) + 3.5, { align: 'right' });
    if (o.sill > 0 && o.type !== 'socket')
      pdf.text(`${s.kind === 'floor' ? 'y' : 'allège'} ${cm(o.sill)}`, X((x0 + x1) / 2), Y(y1) + 3, {
        align: 'center',
      });
  });

  /* angles de mur */
  if (s.kind === 'wall') {
    pdf.setLineDashPattern([1.5, 1], 0);
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(...INK);
    for (const c of s.corners) if (c.x > 0 && c.x < s.width) pdf.line(X(c.x), Y(0), X(c.x), Y(s.height));
    pdf.setLineDashPattern([], 0);
  }

  /* coupes apparentes */
  pdf.setDrawColor(...THIN);
  pdf.setLineWidth(0.7);
  for (const pc of pieces) for (const [A, B] of pc.vis) pdf.line(X(A[0]), Y(A[1]), X(B[0]), Y(B[1]));

  /* contour et cotes */
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.4);
  pdf.rect(X(0), Y(0), s.width * k, s.height * k, 'S');
  pdf.setLineWidth(0.15);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  d.color(INK);
  const hy = Y(0) - 5;
  pdf.line(X(0), hy, X(s.width), hy);
  pdf.line(X(0), hy - 1.5, X(0), hy + 1.5);
  pdf.line(X(s.width), hy - 1.5, X(s.width), hy + 1.5);
  pdf.text(`${cm(s.width)} cm`, X(s.width / 2), hy - 1.2, { align: 'center' });
  const vx = X(0) - 5;
  pdf.line(vx, Y(0), vx, Y(s.height));
  pdf.line(vx - 1.5, Y(0), vx + 1.5, Y(0));
  pdf.line(vx - 1.5, Y(s.height), vx + 1.5, Y(s.height));
  pdf.text(`${cm(s.height)} cm`, vx - 1.2, Y(s.height / 2), { align: 'center', angle: 90 });

  /* cotes des zones */
  const lay = build.layout;
  if (lay.rects.length > 1) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    for (const r of lay.rects) {
      if (lay.horiz) pdf.text(`${cm(r.h)}`, X(s.width) + 2, Y(r.y + r.h / 2), { baseline: 'middle' });
      else pdf.text(`${cm(r.w)}`, X(r.x + r.w / 2), Y(s.height) + 3.5, { align: 'center' });
      pdf.setLineDashPattern([1, 0.8], 0);
      pdf.rect(X(r.x), Y(r.y), r.w * k, r.h * k, 'S');
      pdf.setLineDashPattern([], 0);
    }
  }

  /* numéros de coupe */
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6);
  d.color(INK);
  pieces.forEach((pc, i) => {
    const n = result.plan.source[start + i];
    if (pc.full || n == null || !pc.parts) return;
    const part = pc.parts.reduce((a, b) => (bbox(b)[1] - bbox(b)[0] > bbox(a)[1] - bbox(a)[0] ? b : a));
    const b = bbox(part);
    if ((b[1] - b[0]) * k < 3 || (b[3] - b[2]) * k < 2.4) return;
    const cx = part.reduce((t, q) => t + q[0], 0) / part.length,
      cy = part.reduce((t, q) => t + q[1], 0) / part.length;
    pdf.text(String(n), X(cx), Y(cy), { align: 'center', baseline: 'middle' });
  });

  /* légende */
  const ly = d.h - M - 8;
  let lx = M;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  for (const [lab, st] of [
    ['entière', 'full'],
    ['coupée', 'cut'],
    ['taillée dans une chute', 'reuse'],
    ['coupe fine', 'thin'],
  ] as const) {
    pdf.setFillColor(...STATUS[st]);
    pdf.setDrawColor(140, 150, 156);
    pdf.setLineWidth(0.1);
    pdf.rect(lx, ly - 3, 4, 4, 'FD');
    d.color(INK);
    pdf.text(pdfText(lab), lx + 5.5, ly);
    lx += 7 + pdf.getTextWidth(pdfText(lab)) + 5;
  }
  pdf.setDrawColor(...THIN);
  pdf.setLineWidth(0.7);
  pdf.line(lx, ly - 1, lx + 6, ly - 1);
  pdf.text('coupe apparente', lx + 7.5, ly);
}
