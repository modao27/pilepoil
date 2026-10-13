/**
 * Export PDF A4 des cloisons : pour chaque cloison de la portée, ses deux faces en élévation (ossature, baies, plaques
 * numérotées, chutes réemployées), sa fiche de coupe ; puis la liste à commander pour tout le projet. Lit les résultats,
 * n'écrit rien. Les textes n'utilisent que les polices standard du PDF.
 */
import {
  Doc,
  ACCENT,
  figures,
  footers,
  fr,
  INK,
  LINE,
  M,
  MUTED,
  pdfText,
  STATUS,
  THIN,
} from '../../../../ui/lib/pdf/doc';
import type { Project } from '../../../../state/model';
import type { Libraries, ResultInput } from '../../../types';
import type { CloisonsResult } from '../../core/types';
import { PLATE_LABEL, shopping } from '../../state/module';
import { cloisonsData, toSpec } from '../../state/spec';
import {
  cutList,
  cutText,
  elevationOf,
  platesOf,
  ROLE_LABEL,
  studSummary,
  type Elevation,
  type ElevationPlate,
} from './elevation';
import { alertText } from './messages';
import { scopedPartitions } from './results';

const NOTICE = 'Vérifier la notice du fabricant.';

/** Une face à l'échelle dans le cadre (x, y, largeur max, hauteur max) ; renvoie la hauteur occupée, mm papier. */
function drawFace(
  d: Doc,
  e: Elevation,
  plates: ElevationPlate[],
  x: number,
  y: number,
  wMax: number,
  hMax: number,
): number {
  const pdf = d.pdf;
  const k = Math.min(wMax / e.length, hMax / e.height);
  const ox = x + (wMax - e.length * k) / 2;
  const X = (v: number) => ox + v * k;
  const Y = (v: number) => y + (e.height - v) * k;
  pdf.setLineWidth(0.15);
  pdf.setDrawColor(...LINE);
  pdf.rect(X(0), Y(e.height), e.length * k, e.height * k, 'S');
  pdf.setFillColor(150, 160, 160);
  pdf.setDrawColor(...INK);
  for (const r of e.rails) pdf.rect(X(r.x0), Y(r.y1), (r.x1 - r.x0) * k, (r.y1 - r.y0) * k, 'FD');
  for (const s of e.studs) pdf.rect(X(s.x + s.dx - 18), Y(s.y1), 36 * k, (s.y1 - s.y0) * k, 'FD');
  for (const p of plates) {
    pdf.setLineWidth(0.25);
    if (p.reused) {
      pdf.setFillColor(...STATUS.reuse);
      pdf.setDrawColor(...ACCENT);
      pdf.rect(X(p.x0), Y(p.y1), (p.x1 - p.x0) * k, (p.y1 - p.y0) * k, 'FD');
    } else {
      pdf.setDrawColor(...ACCENT);
      pdf.rect(X(p.x0), Y(p.y1), (p.x1 - p.x0) * k, (p.y1 - p.y0) * k, 'S');
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(Math.max(5, Math.min(9, 130 * k * 2.83)));
    d.color(INK);
    pdf.text(String(p.n), X(p.lx), Y(p.ly), { align: 'center', baseline: 'middle' });
  }
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.3);
  for (const o of e.openings) pdf.rect(X(o.x0), Y(o.height), (o.x1 - o.x0) * k, o.height * k, 'FD');
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  d.color(MUTED);
  pdf.text(pdfText(`${fr(e.length / 10, 1)} cm`), X(e.length / 2), Y(0) + 3.5, { align: 'center' });
  return e.height * k + 5;
}

/** Pages des cloisons de la portée ; sans cloison dans la portée, rien n'est écrit. */
export function writeCloisonsResults(d: Doc, input: ResultInput<CloisonsResult>): void {
  const { project, result, scope } = input;
  const parts = scopedPartitions(project, result, scope);
  if (!parts.length) return;
  const spec = toSpec(project, input.libraries);
  const specs = 'spec' in spec ? spec.spec : null;

  d.page();
  d.text('Cloisons', 16, { bold: true, gap: 1 });
  d.text(NOTICE, 9, { color: MUTED, gap: 3 });
  for (const p of parts) {
    const s = specs?.partitions.find((x) => x.id === p.id);
    d.room(60);
    d.text(s?.name ?? 'Cloison', 13, { bold: true, gap: 1 });
    for (const a of p.alerts) d.text(`• ${alertText(a)}`, 8.5, { color: THIN, gap: 0.5 });
    if (!p.ok || !s) continue;
    const system = specs?.systems[s.system];
    const layers = system?.layers ?? 1;
    figures(d, [
      ['Longueur', `${fr(s.length / 1000, 2)} m`],
      ['Hauteur', `${fr(s.height / 1000, 2)} m`],
      ['Entraxe', `${fr(s.spacing / 10)} cm`],
      ['Système', system?.name ?? '?'],
    ]);
    const e = elevationOf(s, p);
    for (const face of ['a', 'b'] as const) {
      for (let layer = 1; layer <= layers; layer++) {
        const h = Math.min(58, (d.w - 2 * M) * (e.height / e.length) + 10);
        d.room(h + 14);
        d.text(
          `Face ${face.toUpperCase()}${layers > 1 ? ` · couche ${layer}` : ''} · plaque ${PLATE_LABEL[s.plates[face]]}`,
          9.5,
          { bold: true, gap: 0.5 },
        );
        const used = drawFace(d, e, platesOf(p, face, layer, e.openings), M, d.y, d.w - 2 * M, 52);
        d.y += used + 3;
      }
    }
    d.text('Plaques numérotées ; en vert : taillées dans une chute.', 8, { color: MUTED, gap: 2 });
    d.table(
      [
        { label: 'Ossature', w: 90 },
        { label: 'Fiche de coupe des plaques', w: d.w - 2 * M - 90 },
      ],
      [
        [
          [
            ...p.rails.map(
              (r) =>
                `${r.kind === 'top' ? 'Rail haut' : r.kind === 'bottom' ? 'Rail bas' : 'Linteau'} : ${fr(r.length / 10, 1)} cm`,
            ),
            ...studSummary(p).map((q) => `${ROLE_LABEL[q.role]} : ${q.count} x ${fr(q.length / 10, 1)} cm`),
          ].join('\n'),
          cutList(p)
            .map((c) => cutText(c, layers))
            .join('\n'),
        ],
      ],
      { size: 7.5 },
    );
  }
  writeTotals(d, project, result);
}

/** Liste à commander pour tout le projet (rails, montants, plaques, isolant, consommables). */
function writeTotals(d: Doc, project: Project, result: CloisonsResult): void {
  const data = cloisonsData(project);
  if (!data) return;
  const lines = shopping(result, data);
  if (!lines.length) return;
  d.room(50);
  d.text('À commander pour tout le projet (cloisons)', 12, { bold: true, gap: 2 });
  d.table(
    [
      { label: 'Article', w: 100 },
      { label: 'Quantité', w: 24, align: 'right' },
      { label: 'Détail', w: d.w - 2 * M - 124 },
    ],
    lines.map((l) => [l.label, String(l.quantity), l.detail ?? '']),
    { size: 8.5 },
  );
  if (result.totals.demolishedArea > 0)
    d.text(`Surface de mur démolie : ${fr(result.totals.demolishedArea, 2)} m² (information).`, 8.5, {
      color: MUTED,
      gap: 1,
    });
  d.text(NOTICE, 8.5, { color: MUTED });
}

/** PDF des seules cloisons du projet (bouton de l'écran des cloisons). */
export function buildCloisonsPdf(project: Project, libraries: Libraries, result: CloisonsResult, date: number): Blob {
  const d = new Doc();
  d.text('Cloisons', 18, { bold: true, gap: 1 });
  d.text(
    `${project.name} · ${new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    10,
    { color: MUTED, gap: 4 },
  );
  writeCloisonsResults(d, { project, libraries, result, scope: { kind: 'project' } });
  footers(d, `PilePoil · ${project.name} · ${NOTICE}`);
  return d.pdf.output('blob');
}
