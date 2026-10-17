/**
 * PDF des résultats d'une pose, d'une pièce ou du projet (docs/NAVIGATION.md §7), chargé seulement à l'export :
 * page de résumé (plan d'ensemble et résumé de chaque pièce pour le dossier du projet), pages de chaque
 * revêtement (fournies par son module), liste d'achat consolidée pour le dossier.
 */
import { poseWhere } from '../../core/coverage';
import { poseArea, type ResultScope } from '../../core/coverage/scope';
import { passageStep, roomFloor } from '../../core/plan/levels';
import type { Plan } from '../../core/plan/types';
import { planBounds } from '../../core/plan/snap';
import type { Libraries, ModuleResults, ResultExports, ToolModule } from '../../modules/types';
import type { Project } from '../../state/model';
import { Doc, footers, fr, INK, M, MUTED, pdfText, poly, THIN } from './pdf/doc';
import type { Consolidated } from './shopping';
import { writeShopping } from './shoppingPdf';

export interface ResultsPdfEntry {
  module: ToolModule;
  /** Dernier résultat du module. */
  result: unknown;
  /** Résultats du module (rapport). */
  results: ModuleResults;
  exports: ResultExports;
}

export interface ResultsPdfInput {
  project: Project;
  libraries: Libraries;
  scope: ResultScope;
  /** « Dossier du projet », « PDF de la pièce — Cuisine », « PDF de la pose — Cuisine, sol ». */
  title: string;
  /** Revêtements touchés par la portée et calculés. */
  entries: ResultsPdfEntry[];
  /** Liste d'achat consolidée (dossier du projet) ; null : pas de liste. */
  shopping: Consolidated | null;
  date: number;
}

export function buildResultsPdf(input: ResultsPdfInput): Blob {
  const { project, scope, date } = input;
  const d = new Doc();
  d.text(input.title, 18, { bold: true, gap: 1 });
  d.text(
    `${project.name} · ${new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    10,
    { color: MUTED, gap: 5 },
  );
  if (scope.kind === 'project') overview(d, project.plan);
  summary(d, input, scope);
  if (scope.kind === 'project')
    for (const room of project.plan.rooms) {
      const s: ResultScope = { kind: 'room', room: room.id };
      if (!reportRows(input, s).rows.length) continue;
      d.room(30);
      d.text(room.name + levelText(room), 13, { bold: true, gap: 2 });
      summary(d, input, s);
    }
  for (const e of input.entries) e.exports.pdf(d, { project, libraries: input.libraries, result: e.result, scope });
  if (input.shopping) {
    d.page();
    d.text('Liste d’achat du projet', 15, { bold: true, gap: 3 });
    writeShopping(d, input.shopping, (id) => input.entries.find((e) => e.module.id === id)?.module.label ?? id);
  }
  footers(d, `PilePoil · ${project.name}`);
  return d.pdf.output('blob');
}

/** Tableau des poses de la portée : où, surface revêtue, pièces posées et coupes, quantités à commander. */
function reportRows(input: ResultsPdfInput, scope: ResultScope): { rows: string[][]; notes: Set<string> } {
  const { project, libraries } = input;
  const rows: string[][] = [];
  const notes = new Set<string>();
  for (const e of input.entries) {
    const reports = e.results.report({ project, libraries, result: e.result, scope });
    for (const r of reports) {
      const pose = project.poses.find((p) => p.id === r.pose);
      if (r.orderNote) notes.add(r.orderNote);
      // module sans pose (cloisons) : l'objet se décrit lui-même
      if (!pose) {
        if (r.title)
          rows.push([
            `${e.module.label} · ${r.title}${r.where ? '\n' + r.where : ''}`,
            '',
            r.ok ? r.figures.map((f) => `${f.label} : ${f.value}`).join('\n') : r.alerts.join('\n'),
            r.order.join('\n') + (r.orderNote ? ' *' : ''),
          ]);
        continue;
      }
      rows.push([
        `${e.module.label} · ${pose.name}\n${poseWhere(project.plan, project.zones, pose.id, scope.kind === 'room' ? scope.room : undefined)}`,
        `${fr(poseArea(project.plan, project, pose.id, scope) / 1e6, 2)} m²`,
        r.ok ? r.figures.map((f) => `${f.label} : ${f.value}`).join('\n') : r.alerts.join('\n'),
        r.order.join('\n') + (r.orderNote ? ' *' : ''),
      ]);
    }
  }
  return { rows, notes };
}

function summary(d: Doc, input: ResultsPdfInput, scope: ResultScope) {
  const { project, libraries } = input;
  const { rows, notes } = reportRows(input, scope);
  if (!rows.length) {
    d.text('Aucun revêtement calculé ici.', 10, { color: MUTED, gap: 4 });
    return;
  }
  d.table(
    [
      { label: 'Revêtement ou travaux', w: 52 },
      { label: 'Surface', w: 22, align: 'right' },
      { label: 'Posés et coupes', w: 48 },
      { label: 'À commander', w: 60 },
    ],
    rows,
    { size: 8.5 },
  );
  for (const n of notes) d.text(`* ${n}`, 8, { color: MUTED, gap: 1 });
  const alerts = input.entries.flatMap((e) =>
    e.results.report({ project, libraries, result: e.result, scope }).flatMap((r) => (r.ok ? r.alerts : [])),
  );
  for (const a of new Set(alerts)) d.text(`• ${a}`, 8.5, { color: THIN, gap: 0.5 });
  d.y += 3;
}

/** « — niveau −15 cm » quand le sol de la pièce n'est pas à 0, sinon rien. */
function levelText(room: Plan['rooms'][number]): string {
  const f = roomFloor(room);
  return f === 0 ? '' : ` — niveau ${f > 0 ? '+' : '-'}${fr(Math.abs(f) / 10, 1)} cm`;
}

/** Plan d'ensemble : contour et nom de chaque pièce, à l'échelle de la largeur de la page. */
function overview(d: Doc, plan: Plan) {
  const b = planBounds(plan);
  if (!b) return;
  const pdf = d.pdf;
  const W = b[1] - b[0],
    H = b[3] - b[2];
  const k = Math.min((d.w - 2 * M) / W, 90 / H);
  const ox = M + (d.w - 2 * M - W * k) / 2,
    oy = d.y + 2;
  const P = (x: number, y: number): [number, number] => [ox + (x - b[0]) * k, oy + (y - b[2]) * k];
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.4);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  for (const r of plan.rooms) {
    const pts = r.outline.map((p) => P(r.origin[0] + p[0], r.origin[1] + p[1]));
    poly(pdf, pts, 'S');
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    d.color(INK);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
      cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    pdf.text(pdfText(r.name), cx, cy, { align: 'center', baseline: 'middle' });
    // niveau de sol, sous le nom, quand il n'est pas à 0
    if (roomFloor(r) !== 0) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(pdfText(levelText(r).replace(/^ — /, '')), cx, cy + 4, { align: 'center', baseline: 'middle' });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
    }
  }
  d.y = oy + H * k + 8;
  // marches aux passages entre deux niveaux
  for (const p of plan.passages) {
    const step = passageStep(plan, p);
    if (!step) continue;
    const from = plan.rooms.find((r) => r.id === p.a.room),
      to = plan.rooms.find((r) => r.id === p.b.room);
    d.text(
      `Marche de ${fr(Math.abs(step) / 10, 1)} cm entre ${from?.name ?? '?'} et ${to?.name ?? '?'} (${step < 0 ? 'descendante' : 'montante'} vers ${to?.name ?? '?'}).`,
      9,
      { color: MUTED, gap: 1 },
    );
  }
}
