/** Cloisons : élévation, fiche de coupe, rapport par portée, PDF. */
import { describe, expect, it } from 'vitest';
import type { Partition } from '../../src/core/plan/types';
import { computeCloisons } from '../../src/modules/cloisons/core/compute';
import { templateSystems } from '../../src/modules/cloisons/core/defaults';
import type { CloisonsResult } from '../../src/modules/cloisons/core/types';
import { CLOISONS_ID, CLOISONS_SCHEMA, createCloisonsData } from '../../src/modules/cloisons/state/model';
import { toSpec } from '../../src/modules/cloisons/state/spec';
import { cutList, cutText, elevationOf, platesOf, studSummary } from '../../src/modules/cloisons/ui/lib/elevation';
import { cloisonsReport } from '../../src/modules/cloisons/ui/lib/results';
import { hydrate, siteOf, type Project } from '../../src/state/model';
import { Doc } from '../../src/ui/lib/pdf/doc';
import { door, part, spec } from './cloisonsHelpers';
import { rect } from './planFixtures';

describe('élévation', () => {
  const p = part('p1', { length: 4000, openings: [door(1000)] });
  const r = computeCloisons(spec([p]));
  const res = r.partitions[0]!;
  const e = elevationOf(p, res);

  it('ossature : rails, linteau sous la tête de baie, montant court au-dessus', () => {
    expect(e.rails.filter((x) => x.kind === 'bottom')).toHaveLength(2);
    const lintel = e.rails.find((x) => x.kind === 'lintel')!;
    expect([lintel.y0, lintel.x0, lintel.x1]).toEqual([2040, 950, 1880]);
    const cripple = e.studs.find((s) => s.role === 'cripple')!;
    expect([cripple.x, cripple.y1]).toEqual([1200, 2460]);
    expect(cripple.y0).toBe(2460 - 450);
  });

  it('montants doublés : côte à côte autour de leur abscisse', () => {
    const jamb = e.studs.filter((s) => s.x === 1000);
    expect(jamb.map((s) => s.dx).sort((a, b) => a - b)).toEqual([-18, 18]);
    expect(e.openings).toEqual([{ x0: 1000, x1: 1830, height: 2040, kind: 'door' }]);
  });

  it('plaques d’une face : numérotées, avec leur origine', () => {
    const a = platesOf(res, 'a', 1);
    expect(a.map((x) => x.n)).toEqual([1, 2, 3, 4]);
    expect([a[0]!.x0, a[0]!.x1, a[3]!.x1]).toEqual([0, 1200, 4000]);
    expect(a.every((x) => x.y0 === 0)).toBe(true);
    // R3 : sept feuilles, la 7e fournit les deux pièces de 400, dont une de chute
    const all = [...platesOf(res, 'a', 1), ...platesOf(res, 'b', 1)];
    expect(all.filter((x) => x.reused)).toHaveLength(1);
    expect(all.filter((x) => x.source.startsWith('feuille'))).toHaveLength(7);
  });

  it('numéro d’une plaque en L : au-dessus de la baie quand son centre tombe dedans', () => {
    // face a, pièce 2 : de 1 200 à 2 400, centre à 1 800 dans la baie (1 000 à 1 830) : bande au-dessus de la tête (2 040 à 2 490)
    const piece = platesOf(res, 'a', 1, e.openings).find((x) => x.n === 2)!;
    expect([piece.lx, piece.ly]).toEqual([1800, (2040 + 2490) / 2]);
    // sans les baies, le numéro reste au centre
    expect(platesOf(res, 'a', 1).find((x) => x.n === 2)!.ly).toBe(1245);
  });

  it('fiche de coupe : face, couche, pièce ; texte lisible', () => {
    const list = cutList(res);
    expect(list.map((c) => `${c.face}${c.layer}.${c.n}`).slice(0, 5)).toEqual(['a1.1', 'a1.2', 'a1.3', 'a1.4', 'b1.1']);
    expect(cutText(list[0]!).replace(/\s/g, ' ')).toBe(
      'Face A · pièce 1 : 1 200 × 2 490 mm, feuille ' + list[0]!.source.split(' ')[1],
    );
    expect(cutText(list[0]!, 2)).toContain('couche 1');
  });

  it('résumé des montants', () => {
    expect(studSummary(res).reduce((t, s) => t + s.count, 0)).toBe(13);
  });
});

describe('rapport par portée et PDF', () => {
  const room = rect('a', 4000, 3000, { name: 'Séjour' });
  const other = { ...rect('b', 3000, 3000, { name: 'Cuisine' }), origin: [5000, 0] as [number, number] };
  const cloison: Partition = {
    id: 'c1',
    a: [2000, 0],
    b: [2000, 3000],
    thickness: 72,
    align: 'center',
    openings: [],
  };
  const site = { ...siteOf({ rooms: [room, other], passages: [] }), partitions: [cloison] };
  const project: Project = hydrate({
    schemaVersion: 4,
    id: 'p',
    name: 'Maison',
    createdAt: 0,
    updatedAt: 0,
    site,
    zones: [],
    poses: [],
    modules: { [CLOISONS_ID]: { schemaVersion: CLOISONS_SCHEMA, data: createCloisonsData() } },
  });
  const libraries = { systems: templateSystems() };
  const t = toSpec(project, libraries);
  if ('errors' in t) throw new Error('attendu : une entrée');
  const result: CloisonsResult = computeCloisons(t.spec);
  const input = (scope: Parameters<typeof cloisonsReport>[0]['scope']) => ({ project, libraries, result, scope });

  it('projet : un rapport par cloison, décrite par elle-même', () => {
    const [r] = cloisonsReport(input({ kind: 'project' }));
    expect(r).toMatchObject({ pose: 'c1', title: 'Cloison 1 · Séjour / Séjour (2)', ok: true });
    expect(r!.href).toBe('#/p/p/m/cloisons/c/c1');
    expect(r!.figures.map((f) => f.label)).toEqual(['Longueur', 'Hauteur', 'Plaque posée', 'Montants']);
    expect(r!.figures[0]!.value).toBe('3 m');
  });

  it('pièce : seulement les cloisons qui la bordent ; pose : aucune', () => {
    expect(cloisonsReport(input({ kind: 'room', room: 'a' }))).toHaveLength(1);
    expect(cloisonsReport(input({ kind: 'room', room: 'b' }))).toHaveLength(0);
    expect(cloisonsReport(input({ kind: 'pose', pose: 'x' }))).toHaveLength(0);
  });

  it('PDF : pages des cloisons avec élévation et liste à commander', async () => {
    const { writeCloisonsResults } = await import('../../src/modules/cloisons/ui/lib/pdf');
    const d = new Doc();
    writeCloisonsResults(d, input({ kind: 'project' }));
    expect(d.pdf.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(d.pdf.output('blob').size).toBeGreaterThan(2000);
    // hors portée : rien n'est écrit
    const e = new Doc();
    writeCloisonsResults(e, input({ kind: 'room', room: 'b' }));
    expect(e.pdf.getNumberOfPages()).toBe(1);
  });
});
