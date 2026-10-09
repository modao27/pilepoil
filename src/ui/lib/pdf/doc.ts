/**
 * Base des exports PDF A4 (jsPDF) : page, texte avec retour à la ligne, tableaux, polygones, couleurs et
 * caractères des polices standard. Extraite du PDF du carrelage (même rendu), partagée par les modules.
 */
import { jsPDF } from 'jspdf';

/** Marge de page, mm. */
export const M = 14;
export const INK: RGB = [21, 35, 44];
export const MUTED: RGB = [90, 106, 116];
export const LINE: RGB = [205, 213, 218];
export const ACCENT: RGB = [39, 71, 201];
export const THIN: RGB = [217, 71, 43];
/** Statuts de coupe en teintes claires pour l'impression. */
export const STATUS: Record<'full' | 'cut' | 'reuse' | 'thin', RGB> = {
  full: [255, 255, 255],
  cut: [248, 225, 160],
  reuse: [193, 229, 206],
  thin: [244, 180, 166],
};
export type RGB = [number, number, number];

/** Les polices PDF standard (WinAnsi) ignorent certains caractères : on les remplace. */
export function pdfText(s: string): string {
  // espaces fines et insécables (séparateur des milliers en français) → espace simple
  return s
    .replace(/[\u202F\u2009\u00A0]/g, ' ')
    .replace(/\u2153/g, '1/3')
    .replace(/\u2154/g, '2/3')
    .replace(/\u2248/g, '~')
    .replace(/[\u2039\u203A]/g, '');
}

export const fr = (v: number, d = 0) => pdfText(v.toLocaleString('fr-FR', { maximumFractionDigits: d }));
export const cm = (mm: number) => fr(mm / 10, 1);
export const euro = (v: number) => pdfText(v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));

export class Doc {
  readonly pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  y = M;

  get w() {
    return this.pdf.internal.pageSize.getWidth();
  }
  get h() {
    return this.pdf.internal.pageSize.getHeight();
  }

  page(orientation: 'portrait' | 'landscape' = 'portrait') {
    this.pdf.addPage('a4', orientation);
    this.y = M;
  }

  /** Garantit `need` mm de place, sinon nouvelle page. */
  room(need: number) {
    if (this.y + need > this.h - M - 6) this.page();
  }

  color(c: RGB) {
    this.pdf.setTextColor(...c);
  }

  text(s: string, size: number, o: { bold?: boolean; color?: RGB; gap?: number; x?: number; maxWidth?: number } = {}) {
    this.pdf.setFont('helvetica', o.bold ? 'bold' : 'normal');
    this.pdf.setFontSize(size);
    this.color(o.color ?? INK);
    const lines = this.pdf.splitTextToSize(pdfText(s), o.maxWidth ?? this.w - 2 * M - ((o.x ?? M) - M)) as string[];
    const lh = size * 0.42;
    this.room(lines.length * lh);
    this.pdf.text(lines, o.x ?? M, this.y + lh * 0.8);
    this.y += lines.length * lh + (o.gap ?? 1.5);
  }

  /** Tableau simple : en-tête grisé, lignes avec retour à la ligne, coupure de page. */
  table(
    cols: { label: string; w: number; align?: 'left' | 'right' }[],
    rows: string[][],
    o: { foot?: string[]; size?: number } = {},
  ) {
    const size = o.size ?? 9,
      lh = size * 0.42,
      pad = 1.6;
    const x0 = M;
    const drawRow = (cells: string[], header: boolean, bold = false) => {
      this.pdf.setFont('helvetica', header || bold ? 'bold' : 'normal');
      this.pdf.setFontSize(header ? size - 1 : size);
      const wrapped = cells.map((c, i) => this.pdf.splitTextToSize(pdfText(c), cols[i]!.w - 2 * pad) as string[]);
      const hRow = Math.max(...wrapped.map((l) => l.length)) * lh + 2 * pad;
      if (this.y + hRow > this.h - M - 6) {
        this.page();
        if (!header)
          drawRow(
            cols.map((c) => c.label),
            true,
          );
      }
      if (header) {
        this.pdf.setFillColor(230, 235, 238);
        this.pdf.rect(
          x0,
          this.y,
          cols.reduce((t, c) => t + c.w, 0),
          hRow,
          'F',
        );
      }
      let x = x0;
      wrapped.forEach((l, i) => {
        const c = cols[i]!;
        this.color(header ? MUTED : INK);
        if (c.align === 'right') this.pdf.text(l, x + c.w - pad, this.y + pad + lh * 0.8, { align: 'right' });
        else this.pdf.text(l, x + pad, this.y + pad + lh * 0.8);
        x += c.w;
      });
      this.y += hRow;
      this.pdf.setDrawColor(...LINE);
      this.pdf.setLineWidth(0.2);
      this.pdf.line(x0, this.y, x0 + cols.reduce((t, c) => t + c.w, 0), this.y);
    };
    drawRow(
      cols.map((c) => c.label),
      true,
    );
    for (const r of rows) drawRow(r, false);
    if (o.foot) drawRow(o.foot, false, true);
    this.y += 4;
  }
}

/** Polygone fermé (coordonnées absolues, mm papier). */
export function poly(pdf: jsPDF, pts: [number, number][], style: 'F' | 'S' | 'FD') {
  if (pts.length < 3) return;
  const [x0, y0] = pts[0]!;
  const rel = pts.slice(1).map((p, i) => [p[0] - pts[i]![0], p[1] - pts[i]![1]]);
  pdf.lines(rel, x0, y0, [1, 1], style, true);
}
