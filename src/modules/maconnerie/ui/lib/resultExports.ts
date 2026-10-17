/** PDF de la maçonnerie pour l'écran Résultats commun (chargé à la demande, avec jsPDF). Pas de 3D avant les murets. */
import { MUTED, THIN, type Doc } from '../../../../ui/lib/pdf/doc';
import type { ResultExports, ResultInput } from '../../../types';
import type { MaconnerieResult } from '../../core/types';
import { maconnerieData } from '../../state/spec';
import { alertText, NOTICE } from './messages';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

function pdf(d: Doc, input: ResultInput<MaconnerieResult>): void {
  const { project, result, scope } = input;
  if (scope.kind !== 'project' || !result.walls.length) return;
  const walls = maconnerieData(project)?.walls ?? [];
  d.page();
  d.text('Maçonnerie', 16, { bold: true, gap: 1 });
  d.text(NOTICE, 9, { color: MUTED, gap: 3 });
  for (const r of result.walls) {
    const w = walls.find((x) => x.id === r.id);
    d.room(30);
    d.text(w?.name ?? 'Mur', 13, { bold: true, gap: 1 });
    if (w)
      d.text(
        `${fr(w.length / 10)} × ${fr(w.height / 10)} cm · ${fr(r.area, 2)} m² · ${r.courses} rangs · ${r.elements} éléments dont ${r.cut} coupés`,
        10,
        { gap: 1 },
      );
    if (r.glass)
      d.text(
        `${r.glass.cols} × ${r.glass.rows} briques, bordures ${fr(r.glass.borderX / 10)} et ${fr(r.glass.borderY / 10)} cm`,
        10,
        { gap: 1 },
      );
    for (const a of r.alerts) d.text(`• ${alertText(a)}`, 8.5, { color: THIN, gap: 0.5 });
  }
}

export const exports: ResultExports<MaconnerieResult> = { pdf, meshes: () => [] };
