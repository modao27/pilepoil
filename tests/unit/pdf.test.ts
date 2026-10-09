import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import {
  createFloorTiling,
  createRoomTiling,
  createTile,
  createWallTiling,
  createZone,
} from '../../src/modules/carrelage/state/factories';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { buildPdf, pdfText } from '../../src/modules/carrelage/ui/lib/pdf';
import { lShape, planProject, rect, view, withOpening } from './planFixtures';

/** Texte de chaque page, extrait comme le ferait un lecteur PDF. */
async function pagesText(blob: Blob): Promise<{ text: string; width: number; height: number }[]> {
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

describe('export PDF', () => {
  const tile = createTile({ pricePerM2: 32.5 });
  // sol 2 m × 3 m ; mur 2 (3 m, à droite) carrelé sur 2,4 m avec une fenêtre du plan
  const room = withOpening(rect('r', 2000, 3000, { name: 'Salle de bain', height: 2400 }), 1, { offset: 1000 });
  const wall = createWallTiling(tile.id, {
    zones: [createZone(tile.id, { pattern: 'half', angle: 45 })],
    openings: {
      'r-o0': { covered: true, revealDepth: 150, reveals: { left: true, right: true, top: true, bottom: false } },
    },
  });
  const rooms = { r: createRoomTiling({ floor: createFloorTiling(tile.id), walls: { 'r-w1': wall } }) };
  const project = view(planProject([room], { rooms, prices: { colle: 21 } }, { name: 'Salle de bain ⅓' }));
  const spec = toProjectSpec(project, [tile]).spec;
  const result = computeProject(spec);

  it('pages A4 : résumé, un plan coté par surface, découpe, encollage', async () => {
    const pages = await pagesText(buildPdf({ project, spec, result, tiles: [tile], date: Date.UTC(2026, 9, 8) }));
    expect(pages.length).toBeGreaterThanOrEqual(4);
    for (const p of pages) {
      const [a, b] = [Math.min(p.width, p.height), Math.max(p.width, p.height)];
      expect((a / 72) * 25.4).toBeCloseTo(210, 0);
      expect((b / 72) * 25.4).toBeCloseTo(297, 0);
    }
    expect(pages[0]!.text).toMatch(/Salle de bain 1\/3/);
    expect(pages[0]!.text).toMatch(/Liste d.achat/);
    expect(pages[0]!.text).toMatch(/Total estimé/);
    expect(pages[1]!.text).toMatch(/Plan coté — Salle de bain, sol/);
    expect(pages[1]!.height).toBeGreaterThan(pages[1]!.width);
    expect(pages[2]!.text).toMatch(/Plan coté — Salle de bain, mur 2/);
    expect(pages[2]!.width).toBeGreaterThan(pages[2]!.height); // mur large : page en paysage
    expect(pages[2]!.text).toMatch(/300 cm/);
    expect(pages[2]!.text).toMatch(/F1 100×120/);
    const all = pages.map((p) => p.text).join(' ');
    expect(all).toMatch(/Plan de découpe/);
    expect(all).toMatch(/Encollage/);
    expect(all).toMatch(/1 \/ \d+/);
    // aucun caractère hors police (affichés comme ? ou carrés)
    expect(all).not.toMatch(new RegExp(`[${String.fromCodePoint(0x202f, 0x2153, 0x2248)}]`));
  });

  it('sol d’une pièce en L : surface réelle, longueur de chaque mur', async () => {
    const room = lShape('r', 4000, 3000, 1500, 1000);
    const rooms = { r: createRoomTiling({ floor: createFloorTiling(tile.id) }) };
    const p = view(planProject([room], { rooms }));
    const sp = toProjectSpec(p, [tile]).spec;
    const pages = await pagesText(
      buildPdf({ project: p, spec: sp, result: computeProject(sp), tiles: [tile], date: 0 }),
    );
    expect(pages[1]!.text).toMatch(/Sol de 10,5 m², 400 × 300 cm hors tout/);
    for (const l of ['400', '200', '150', '100', '250', '300']) expect(pages[1]!.text).toContain(l);
  });

  it('remplace les caractères absents des polices standard', () => {
    expect(pdfText('1 200 m² ≈ ⅓')).toBe('1 200 m² ~ 1/3');
  });
});
