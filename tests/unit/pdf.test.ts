import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { computeProject } from '../../src/modules/carrelage/core';
import {
  createOpening,
  createProject,
  createSurface,
  createTile,
  createZone,
} from '../../src/modules/carrelage/state/factories';
import { toProjectSpec } from '../../src/modules/carrelage/state/selectors';
import { buildPdf, pdfText } from '../../src/modules/carrelage/ui/lib/pdf';

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
  const wall = createSurface(tile.id, {
    name: 'Mur douche',
    width: 3000,
    height: 2400,
    openings: [createOpening('window', { x: 1000, sill: 900, revealDepth: 150 })],
    zones: [createZone(tile.id, { pattern: 'half', angle: 45 })],
  });
  const floor = createSurface(tile.id, { name: 'Sol', kind: 'floor', width: 2000, height: 3000 });
  const project = createProject([wall, floor], { name: 'Salle de bain ⅓', prices: { colle: 21 } });
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
    expect(pages[1]!.text).toMatch(/Plan coté — Mur douche/);
    expect(pages[1]!.width).toBeGreaterThan(pages[1]!.height); // mur large : page en paysage
    expect(pages[1]!.text).toMatch(/300 cm/);
    expect(pages[1]!.text).toMatch(/F1 100×120/);
    expect(pages[2]!.text).toMatch(/Plan coté — Sol/);
    expect(pages[2]!.height).toBeGreaterThan(pages[2]!.width);
    const all = pages.map((p) => p.text).join(' ');
    expect(all).toMatch(/Plan de découpe/);
    expect(all).toMatch(/Encollage/);
    expect(all).toMatch(/1 \/ \d+/);
    // aucun caractère hors police (affichés comme ? ou carrés)
    expect(all).not.toMatch(new RegExp(`[${String.fromCodePoint(0x202f, 0x2153, 0x2248)}]`));
  });

  it('remplace les caractères absents des polices standard', () => {
    expect(pdfText('1 200 m² ≈ ⅓')).toBe('1 200 m² ~ 1/3');
  });
});
