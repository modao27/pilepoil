/**
 * PDF de la maçonnerie pour l'écran Résultats commun (chargé à la demande, avec jsPDF) : pour chaque mur de la portée,
 * ses dimensions, sa base et ses zones, ses alertes. Pas de 3D par matériau : les cloisons maçonnées sont dessinées
 * comme des murs par l'enveloppe.
 */
import { MUTED, THIN, type Doc } from '../../../../ui/lib/pdf/doc';
import type { ResultExports, ResultInput } from '../../../types';
import type { MaconnerieResult, Material, SurfaceResult } from '../../core/types';
import { maconnerieData, materialsOf, partitionTitle } from '../../state/spec';
import { alertText, NOTICE } from './messages';
import { scopedWalls } from './results';

const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });

function line(r: SurfaceResult, materials: readonly Material[]): string {
  const name = materials.find((m) => m.id === r.material)?.name ?? 'Matériau';
  const glass = r.glass ? ` · ${r.glass.cols} × ${r.glass.rows}, bordures ${fr(r.glass.borderX / 10)} cm` : '';
  return `${name} : ${fr(r.area, 2)} m², ${r.elements} éléments dont ${r.cut} coupés${glass}`;
}

function pdf(d: Doc, input: ResultInput<MaconnerieResult>): void {
  const walls = scopedWalls(input);
  if (!walls.length) return;
  const { project } = input;
  const manual = maconnerieData(project)?.walls ?? [];
  const materials = materialsOf(input.libraries);
  d.page();
  d.text('Maçonnerie', 16, { bold: true, gap: 1 });
  d.text(NOTICE, 9, { color: MUTED, gap: 3 });
  for (const r of walls) {
    d.room(30);
    d.text(manual.find((x) => x.id === r.id)?.name ?? partitionTitle(project, r.id), 13, { bold: true, gap: 1 });
    if (r.ok) {
      d.text(line(r, materials), 10, { gap: 0.5 });
      for (const z of r.zones) if (z.ok) d.text(`Zone — ${line(z, materials)}`, 10, { gap: 0.5 });
    }
    for (const a of r.alerts) d.text(`• ${alertText(a)}`, 8.5, { color: THIN, gap: 0.5 });
  }
}

export const exports: ResultExports<MaconnerieResult> = { pdf, meshes: () => [] };
