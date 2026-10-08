/** Liste d'achat du projet en PDF A4 (chargé seulement à l'export). */
import { jsPDF } from 'jspdf';
import type { Consolidated } from './shopping';
import { GROUP_LABEL, lineCost } from './shopping';

const eur = (v: number) =>
  v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }).replace(/\u202f|\u00a0/g, ' ');

export function shoppingPdf(c: Consolidated, title: string, date: number, moduleLabel: (id: string) => string): Blob {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const W = 210,
    M = 15;
  let y = M;
  const line = (h: number) => {
    if (y + h > 297 - M) {
      pdf.addPage();
      y = M;
    }
  };
  pdf
    .setFont('helvetica', 'bold')
    .setFontSize(16)
    .text(`Liste d’achat — ${title}`, M, y + 6);
  pdf
    .setFont('helvetica', 'normal')
    .setFontSize(9)
    .setTextColor(90)
    .text(new Date(date).toLocaleDateString('fr-FR'), W - M, y + 6, { align: 'right' });
  y += 14;
  for (const g of c.groups) {
    line(14);
    pdf
      .setTextColor(0)
      .setFont('helvetica', 'bold')
      .setFontSize(11)
      .text(GROUP_LABEL[g.group], M, y + 5);
    y += 8;
    for (const l of g.lines) {
      const detail = [moduleLabel(l.module), l.detail].filter(Boolean).join(' · ');
      line(11);
      pdf
        .setFont('helvetica', 'normal')
        .setFontSize(10)
        .setTextColor(0)
        .text(l.label, M, y + 4, { maxWidth: 125 });
      const cost = lineCost(l);
      pdf.text(cost == null ? 'prix à saisir' : eur(cost), W - M, y + 4, { align: 'right' });
      pdf
        .setFontSize(8.5)
        .setTextColor(90)
        .text(detail, M, y + 8.5, { maxWidth: 140 });
      y += 11;
    }
    pdf.setDrawColor(200).line(M, y, W - M, y);
    y += 2;
  }
  line(12);
  pdf
    .setFont('helvetica', 'bold')
    .setFontSize(12)
    .setTextColor(0)
    .text('Total estimé', M, y + 7);
  pdf.text(eur(c.total), W - M, y + 7, { align: 'right' });
  if (c.unpriced)
    pdf
      .setFont('helvetica', 'normal')
      .setFontSize(9)
      .setTextColor(90)
      .text(
        `${c.unpriced} article${c.unpriced > 1 ? 's' : ''} sans prix, non compté${c.unpriced > 1 ? 's' : ''}.`,
        M,
        y + 12,
      );
  return pdf.output('blob');
}
