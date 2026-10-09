/** Export PDF du parquet : pages A4, résumé et achats, plan coté à l'échelle, fiche de coupe (cas R7). */
import { writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { rectRoom } from '../../src/core/plan/factories';
import { module as parquet } from '../../src/modules/parquet';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import type { ParquetData } from '../../src/modules/parquet/state/model';
import { buildParquetPdf } from '../../src/modules/parquet/ui/lib/pdf';
import type { Project } from '../../src/state/model';
import { parquetProject } from './parquetHelpers';

async function pagesText(blob: Blob) {
  const doc = await getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1 });
    const c = await p.getTextContent();
    out.push({ text: c.items.map((x) => ('str' in x ? x.str : '')).join(' '), width: vp.width, height: vp.height });
  }
  return out;
}

let n = 0;
const id = () => 'i' + ++n;

/** R7 : Séjour et Bureau 4000 × 3000, porte de 830 face à face, une pose sur les deux, seuil posé. */
function r7(): Project {
  const a = rectRoom(4000, 3000, { name: 'Séjour' }, id);
  const b = rectRoom(4000, 3000, { name: 'Bureau', origin: [4072, 0] }, id);
  a.openings = [{ id: 'da', kind: 'door', wall: a.walls[1]!.id, offset: 1000, width: 830, sill: 0, height: 2040 }];
  b.openings = [{ id: 'db', kind: 'door', wall: b.walls[3]!.id, offset: 1170, width: 830, sill: 0, height: 2040 }];
  const plan = {
    rooms: [a, b],
    passages: [{ id: 'P1', a: { room: a.id, opening: 'da' }, b: { room: b.id, opening: 'db' } }],
  };
  return parquetProject(
    plan,
    [
      {
        id: 'L1',
        rooms: [a.id, b.id],
        settings: {
          breaks: [
            [
              [4036, 1000],
              [4036, 1830],
            ],
          ],
        },
      },
    ],
    { name: 'Maison R7' },
  );
}

describe('export PDF du parquet', () => {
  it('R7 : résumé et achats, plan coté à l’échelle, fiche de coupe, plinthes', async () => {
    const project = r7();
    const data = project.modules.parquet!.data as ParquetData;
    const s = parquet.toSpec(project, { boards: BOARD_TEMPLATES });
    if (!('spec' in s)) throw new Error('spec');
    const result = computeParquet(s.spec);
    const lines = parquet.shopping(result, data, { boards: BOARD_TEMPLATES }, project);
    const blob = buildParquetPdf({ project, data, result, lines, boards: BOARD_TEMPLATES, date: Date.UTC(2026, 9, 9) });
    if (process.env.PARQUET_PDF) writeFileSync(process.env.PARQUET_PDF, Buffer.from(await blob.arrayBuffer()));
    const pages = await pagesText(blob);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const p of pages) {
      const [w, h] = [Math.min(p.width, p.height), Math.max(p.width, p.height)];
      expect((w / 72) * 25.4).toBeCloseTo(210, 0);
      expect((h / 72) * 25.4).toBeCloseTo(297, 0);
    }
    const [first, plan] = pages;
    expect(first!.text).toMatch(/Maison R7/);
    expect(first!.text).toMatch(/Liste d.achat/);
    expect(first!.text).toMatch(/Sous-couche/);
    expect(first!.text).toMatch(/Barres de seuil/);
    expect(first!.text).toMatch(/Séjour, Bureau/);
    // deux pièces côte à côte : 8072 × 3000, plan en paysage à 1:50
    expect(plan!.width).toBeGreaterThan(plan!.height);
    expect(plan!.text).toMatch(/Échelle 1:50/);
    expect(plan!.text).toMatch(/400/);
    const all = pages.map((p) => p.text).join(' ');
    expect(all).toMatch(/Fiche de coupe/);
    expect(all).toMatch(/Séjour — rang 1/);
    expect(all).toMatch(/Bureau — rang 1/);
    expect(all).toMatch(/lame neuve – couper à \d/);
    expect(all).toMatch(/vient de Séjour — rang 1, n° 4/);
    expect(all).not.toMatch(/Barre 1 :/);
    // police standard : pas de texte espacé lettre par lettre (repli d'encodage)
    expect(all).not.toMatch(/l a m e/);
    expect(all).toMatch(/va au stock/);
    expect(all).toMatch(/Plinthes : 12 barres de plinthe/);
    expect(all).toMatch(/Barre de plinthe 1 : 2 400 mm Séjour mur 1/);
    expect(all).toMatch(/Seuils : 1 barre de seuil/);
    expect(all).toMatch(/Barre de seuil 1 : 830 mm entre Séjour et Bureau · reste 100 mm/);
    // dernier rang : lames entières recoupées en largeur, pas « couper à 1 285 mm »
    expect(all).toMatch(/lame entière recoupée à 104 mm de large/);
    expect(all).not.toMatch(/couper à 1 285 mm/);
    expect(plan!.text).toMatch(/Séjour.*Bureau/);
    expect(all).toMatch(/1 \/ \d+/);
    expect(all).not.toMatch(new RegExp(`[${String.fromCodePoint(0x202f, 0x2153, 0x2248)}]`));
  });

  it('point de Hongrie : croquis cotés des coupes en biais dans la fiche', async () => {
    const project = r7();
    const data = project.modules.parquet!.data as ParquetData;
    const l = data.poses.L1!;
    l.boardId = 'modele-hongrie-45';
    l.pattern = { kind: 'chevron', endAngle: 45 };
    l.breaks = [];
    const s = parquet.toSpec(project, { boards: BOARD_TEMPLATES });
    if (!('spec' in s)) throw new Error('spec');
    const result = computeParquet(s.spec);
    const lines = parquet.shopping(result, data, { boards: BOARD_TEMPLATES }, project);
    const blob = buildParquetPdf({ project, data, result, lines, boards: BOARD_TEMPLATES, date: Date.UTC(2026, 9, 9) });
    if (process.env.PARQUET_PDF_H) writeFileSync(process.env.PARQUET_PDF_H, Buffer.from(await blob.arrayBuffer()));
    const all = (await pagesText(blob)).map((p) => p.text).join(' ');
    expect(all).toMatch(/Séjour — ligne 1/);
    expect(all).toMatch(/coupe en biais \(rives \d/);
    expect(all).toMatch(/même croquis que (le n° \d|Séjour — ligne \d+, n° \d)/);
    expect(all).toMatch(/même croquis que (Séjour|Bureau) — ligne \d+, n° \d/);
    // angles des coupes sous chaque croquis
    expect(all).toMatch(/45°/);
  });
});
