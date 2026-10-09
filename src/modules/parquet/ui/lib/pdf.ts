/**
 * Export PDF A4 du parquet : résumé et liste d'achat, plan coté de chaque pose à une échelle normalisée,
 * fiche de coupe dans l'ordre de pose, découpe des plinthes. Lit les résultats, n'écrit rien.
 */
import { pointInPolygon } from '../../../../core/geometry/polygon';
import type { Polygon } from '../../../../core/geometry/types';
import type { ShoppingLine } from '../../../../core/shopping/types';
import type { Project } from '../../../../state/model';
import { Doc, euro, fr, INK, LINE, M, MUTED, pdfText, poly, STATUS, THIN } from '../../../../ui/lib/pdf/doc';
import { thresholdCuts } from '../../core/accessories';
import { cuttingSheet } from '../../core/sheet';
import type { LaidPiece, ParquetResult } from '../../core/types';
import type { ParquetData } from '../../state/model';
import { errorText, warningText } from './messages';
import { groupTitle, itemText, quantityText, skirtingCutText } from './sheetText';

export interface ParquetPdfInput {
  project: Project;
  data: ParquetData;
  result: ParquetResult;
  lines: ShoppingLine[];
  /** Lames de la bibliothèque (noms). */
  boards: readonly { id: string; name: string }[];
  /** Date affichée (ms). */
  date: number;
}

/** Échelles proposées, de la plus grande à la plus petite. */
const SCALES = [20, 25, 50, 75, 100, 150, 200, 250, 500];

const PATTERN: Record<string, string> = {
  'random-stagger': 'pose droite à coupe perdue',
  'regular-stagger': 'pose droite à décalage régulier',
  herringbone: 'bâton rompu',
  chevron: 'point de Hongrie',
};
const METHOD = { floating: 'flottante', glued: 'collée', nailed: 'clouée' } as const;

export function buildParquetPdf(input: ParquetPdfInput): Blob {
  const { project, data, result, lines, date } = input;
  const d = new Doc();
  const pdf = d.pdf;
  const roomName = (id: string) => project.plan.rooms.find((r) => r.id === id)?.name ?? 'Pièce';
  /** « entre Séjour et Bureau » pour un seuil dans un passage. */
  const passageName = (id: string | null) => {
    const p = id ? project.plan.passages.find((x) => x.id === id) : undefined;
    return p ? ` entre ${roomName(p.a.room)} et ${roomName(p.b.room)}` : '';
  };
  const layoutOf = (id: string) => data.layouts.find((l) => l.id === id);
  const multi = result.layouts.length > 1;
  const cost = lines.reduce((t, l) => t + (l.unitPrice != null ? l.unitPrice * l.quantity : 0), 0);
  const packs = lines.reduce((t, l) => t + (l.unit === 'pack' ? l.quantity : 0), 0);

  /* ---------- page 1 : résumé et achats ---------- */
  d.text(project.name, 18, { bold: true, gap: 1 });
  d.text(
    `Parquet · ${fr(result.totals.area, 2)} m² posables · ${new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    10,
    { color: MUTED, gap: 5 },
  );
  const figs: [string, string][] = [
    ['Lames utilisées', fr(result.totals.boards)],
    ['Paquets', fr(packs)],
    ['Perte', `${fr(result.totals.wastePct, 1)} %`],
    ['Lames coupées', fr(result.totals.cuts)],
    ['Coût estimé', cost > 0 ? euro(cost) : '–'],
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

  d.text(multi ? 'Poses' : 'Pose', 13, { bold: true, gap: 2 });
  for (const lr of result.layouts) {
    const l = layoutOf(lr.id);
    if (!l) continue;
    const board = input.boards.find((b) => b.id === l.boardId);
    const kind = PATTERN[l.pattern.kind] ?? l.pattern.kind;
    const extra =
      l.pattern.kind === 'chevron'
        ? ` à ${l.pattern.endAngle}°`
        : l.pattern.kind === 'regular-stagger'
          ? ` (1/${Math.round(1 / l.pattern.step)})`
          : '';
    d.text(
      `${multi ? `${l.name} : ` : ''}${l.rooms.map(roomName).join(', ')} · ${kind}${extra} · angle ${fr(l.angle)}° · pose ${METHOD[l.method]}${board ? ` · ${board.name}` : ''}`,
      10,
      { gap: 1 },
    );
    const alerts = [...lr.errors.map(errorText), ...new Set(lr.warnings.map(warningText))];
    for (const a of alerts) d.text(`• ${a}`, 9, { color: lr.errors.length ? THIN : MUTED, gap: 0.5 });
  }
  d.y += 4;

  d.text('Liste d’achat', 13, { bold: true, gap: 2 });
  d.table(
    [
      { label: 'Article', w: 58 },
      { label: 'Quantité', w: 26, align: 'right' },
      { label: 'Détail', w: 72 },
      { label: 'Prix', w: 26, align: 'right' },
    ],
    lines.map((l) => [
      l.label,
      quantityText(l),
      l.detail ?? '',
      l.unitPrice != null ? euro(l.unitPrice * l.quantity) : '–',
    ]),
    cost > 0 ? { foot: ['Total estimé', '', '', euro(cost)] } : {},
  );
  d.text('Règles de pose : valeurs du type de lame. Vérifier la notice du fabricant.', 8, { color: MUTED });

  /* ---------- plan coté de chaque pose ---------- */
  for (const lr of result.layouts) {
    const l = layoutOf(lr.id);
    const rooms: Polygon[] = (l?.rooms ?? []).flatMap((id) => {
      const r = project.plan.rooms.find((x) => x.id === id);
      return r ? [r.outline.map(([x, y]): [number, number] => [r.origin[0] + x, r.origin[1] + y])] : [];
    });
    const pts = rooms.flat();
    if (!pts.length) continue;
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    const W = Math.max(...xs) - Math.min(...xs),
      H = Math.max(...ys) - Math.min(...ys);
    d.page(W > H ? 'landscape' : 'portrait');
    d.text(`Plan coté${multi && l ? ` — ${l.name}` : ''} — ${(l?.rooms ?? []).map(roomName).join(', ')}`, 13, {
      bold: true,
      gap: 1,
    });
    // place pour les cotes : 10 mm de chaque côté ; légende en bas
    const availW = d.w - 2 * M - 20,
      availH = d.h - d.y - M - 30;
    const scale = SCALES.find((s) => W / s <= availW && H / s <= availH) ?? Math.ceil(Math.max(W / availW, H / availH));
    d.text(`Échelle 1:${scale} sur A4 (1 cm sur le papier = ${fr(scale / 100, 2)} m). Cotes intérieures en cm.`, 8, {
      color: MUTED,
      gap: 3,
    });
    const ox = M + 10 + (availW - W / scale) / 2 - Math.min(...xs) / scale,
      oy = d.y + 10 - Math.min(...ys) / scale;
    const P = (p: [number, number]): [number, number] => [ox + p[0] / scale, oy + p[1] / scale];
    const kind = (p: LaidPiece) => (p.cutType === 'full' ? 'full' : 'offcut' in p.source ? 'reuse' : 'cut');
    pdf.setLineWidth(0.08);
    pdf.setDrawColor(...MUTED);
    for (const p of lr.pieces) {
      pdf.setFillColor(...STATUS[kind(p)]);
      poly(pdf, p.polygon.map(P), 'FD');
    }
    pdf.setLineWidth(0.5);
    pdf.setDrawColor(...INK);
    for (const r of rooms) poly(pdf, r.map(P), 'S');
    // seuils
    pdf.setDrawColor(...THIN);
    for (const t of lr.thresholds) {
      pdf.setLineWidth(0.8);
      pdf.setLineDashPattern(t.status === 'proposed' ? [1.5, 1] : [], 0);
      const [a, b] = [P(t.segment[0]), P(t.segment[1])];
      pdf.line(a[0], a[1], b[0], b[1]);
    }
    pdf.setLineDashPattern([], 0);
    // cotes des murs, à l'extérieur
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    d.color(INK);
    for (const r of rooms) {
      const ccw = r.reduce((t, p, i) => t + p[0] * r[(i + 1) % r.length]![1] - r[(i + 1) % r.length]![0] * p[1], 0);
      r.forEach((a, i) => {
        const b = r[(i + 1) % r.length]!;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1) return;
        const s = ccw > 0 ? 1 : -1;
        const n = [((b[1] - a[1]) / len) * s, (-(b[0] - a[0]) / len) * s];
        // mur commun avec une autre pièce de la pose : la cote tomberait chez la voisine, on la laisse
        const outside: [number, number] = [
          (a[0] + b[0]) / 2 + n[0]! * 3.5 * scale,
          (a[1] + b[1]) / 2 + n[1]! * 3.5 * scale,
        ];
        if (rooms.some((o) => o !== r && pointInPolygon(outside, o))) return;
        const [mx, my] = P([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        // texte lisible de gauche à droite ou de bas en haut
        let angle = (-Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle <= -90) angle += 180;
        // ligne de base décalée d'une demi-hauteur de texte : les chiffres sont centrés sur le point visé
        const t = (angle * Math.PI) / 180,
          h = 1.9;
        const bx = mx + n[0]! * 3.5 + (Math.sin(t) * h) / 2,
          by = my + n[1]! * 3.5 + (Math.cos(t) * h) / 2;
        pdf.text(fr(len / 10, 1), bx, by, { align: 'center', angle });
      });
    }
    // noms des pièces, sur fond blanc au centre de chacune
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    (l?.rooms ?? []).forEach((id, i) => {
      const r = rooms[i];
      if (!r) return;
      const rx = r.map((p) => p[0]),
        ry = r.map((p) => p[1]);
      const [cx, cy] = P([(Math.min(...rx) + Math.max(...rx)) / 2, (Math.min(...ry) + Math.max(...ry)) / 2]);
      const name = pdfText(roomName(id));
      const tw = pdf.getTextWidth(name);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(cx - tw / 2 - 1.5, cy - 3.2, tw + 3, 4.6, 'F');
      d.color(INK);
      pdf.text(name, cx, cy, { align: 'center' });
    });
    // légende et barre d'échelle (1 m)
    d.y = oy + Math.max(...ys) / scale + 8;
    const legend: [keyof typeof STATUS, string][] = [
      ['full', 'lame entière'],
      ['cut', 'lame coupée'],
      ['reuse', 'taillée dans une chute'],
    ];
    let lx = M;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    for (const [k, label] of legend) {
      pdf.setFillColor(...STATUS[k]);
      pdf.setDrawColor(...MUTED);
      pdf.setLineWidth(0.2);
      pdf.rect(lx, d.y - 2.6, 5, 3.2, 'FD');
      d.color(INK);
      pdf.text(pdfText(label), lx + 6.5, d.y);
      lx += 8 + pdf.getTextWidth(pdfText(label)) + 6;
    }
    const bar = 1000 / scale;
    pdf.setDrawColor(...INK);
    pdf.setLineWidth(0.4);
    pdf.line(lx, d.y - 1, lx + bar, d.y - 1);
    pdf.line(lx, d.y - 2, lx, d.y);
    pdf.line(lx + bar, d.y - 2, lx + bar, d.y);
    pdf.text('1 m', lx + bar + 2, d.y);
  }

  /* ---------- fiche de coupe ---------- */
  const sheet = cuttingSheet(result, Object.fromEntries(data.layouts.map((l) => [l.id, l.rooms])));
  d.page();
  d.text('Fiche de coupe, dans l’ordre de pose', 13, { bold: true, gap: 1 });
  d.text(
    'Lames neuves coupées au bout ; les chutes mises au stock resservent plus loin. Longueurs en mm, repère de la lame.',
    8,
    { color: MUTED, gap: 3 },
  );
  for (const g of sheet) {
    d.room(12);
    d.text(`${multi ? `${layoutOf(g.layout)?.name ?? ''} · ` : ''}${groupTitle(g, roomName)}`, 10, {
      bold: true,
      gap: 0.8,
    });
    for (const it of g.items)
      // flèche absente des polices standard : tiret demi-cadratin
      d.text(itemText(it, sheet, roomName).replace(' → ', ' – '), 8.5, { x: M + 4, gap: 0.4, bold: it.kind === 'cut' });
    d.y += 2;
  }
  if (result.skirting.bars) {
    d.room(20);
    d.y += 2;
    d.text(`Plinthes : ${result.skirting.bars} barre${result.skirting.bars > 1 ? 's' : ''} de plinthe`, 11, {
      bold: true,
      gap: 1,
    });
    d.text('Longueurs à couper, suppléments d’onglet compris.', 8, { color: MUTED, gap: 1.5 });
    result.skirting.plan.forEach((b, i) =>
      d.text(
        `Barre de plinthe ${i + 1} : ${b.cuts.map((c) => skirtingCutText(c, roomName)).join(' + ')}${b.rest > 0 ? ` · reste ${fr(b.rest)} mm` : ''}`,
        8.5,
        { x: M + 4, gap: 0.4 },
      ),
    );
  }

  const seuils = thresholdCuts(result, data.accessories.thresholds.barLength);
  if (seuils.length) {
    const total = seuils.reduce((t, s) => t + s.bars.length, 0);
    d.room(16);
    d.y += 2;
    d.text(`Seuils : ${total} barre${total > 1 ? 's' : ''} de seuil`, 11, { bold: true, gap: 1 });
    let k = 0;
    for (const s of seuils)
      for (const b of s.bars)
        d.text(
          `Barre de seuil ${++k} : ${fr(b.length)} mm${passageName(s.passage)}${b.rest > 0 ? ` · reste ${fr(b.rest)} mm` : ''}`,
          8.5,
          { x: M + 4, gap: 0.4 },
        );
  }

  /* ---------- pieds de page ---------- */
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    const w = pdf.internal.pageSize.getWidth(),
      h = pdf.internal.pageSize.getHeight();
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(pdfText(`Pilepoil · ${project.name} · parquet`), M, h - 7);
    pdf.text(`${i} / ${n}`, w - M, h - 7, { align: 'right' });
  }
  return pdf.output('blob');
}
