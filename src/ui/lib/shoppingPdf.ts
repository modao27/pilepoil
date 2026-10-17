/** Liste d'achat du projet en PDF A4 (chargé seulement à l'export), seule ou dans le dossier du projet. */
import { Doc, euro, footers, MUTED } from './pdf/doc';
import type { Consolidated } from './shopping';
import { GROUP_LABEL, lineCost, quantityText } from './shopping';

/** Liste d'achat par rayon, avec le total estimé. */
export function writeShopping(d: Doc, c: Consolidated, moduleLabel: (id: string) => string) {
  for (const g of c.groups) {
    d.room(20);
    d.text(GROUP_LABEL[g.group], 11, { bold: true, gap: 1.5 });
    d.table(
      [
        { label: 'Article', w: 90 },
        { label: 'Détail', w: 62 },
        { label: 'Prix', w: 30, align: 'right' },
      ],
      g.lines.map((l) => {
        const cost = lineCost(l);
        return [
          `${quantityText(l)} · ${l.label}`,
          [moduleLabel(l.module), l.detail].filter(Boolean).join(' · '),
          cost == null ? 'prix à saisir' : euro(cost),
        ];
      }),
      { size: 8.5 },
    );
  }
  d.text(`Total estimé : ${euro(c.total)}`, 12, { bold: true, gap: 1 });
  if (c.unpriced)
    d.text(`${c.unpriced} article${c.unpriced > 1 ? 's' : ''} sans prix, non compté${c.unpriced > 1 ? 's' : ''}.`, 9, {
      color: MUTED,
    });
}

export function shoppingPdf(c: Consolidated, title: string, date: number, moduleLabel: (id: string) => string): Blob {
  const d = new Doc();
  d.text(`Liste d’achat — ${title}`, 16, { bold: true, gap: 1 });
  d.text(new Date(date).toLocaleDateString('fr-FR'), 9, { color: MUTED, gap: 4 });
  writeShopping(d, c, moduleLabel);
  footers(d, `PilePoil · ${title} · achats`);
  return d.pdf.output('blob');
}
