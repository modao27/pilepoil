import { describe, it } from 'vitest';
import fixtureJson from './fixtures/legacy-results.json';
import { buildSurface } from '../../src/core/cutting/buildSurface';
import { planCuts } from '../../src/core/cutting/planCuts';
import { area } from '../../src/core/geometry/polygon';
import type { Piece, ProjectSpec, SurfaceError } from '../../src/core/types';
import { expectSame } from './compare';
import { fromLegacy } from './fromLegacy';
import type { LegacyProject } from './legacyTypes';

interface LegacyPiece {
  surface: number;
  reveal: string | null;
  [k: string]: unknown;
}
interface LegacyResult {
  input: LegacyProject;
  error?: string;
  pieces: LegacyPiece[];
  groups: ({ label: string } & Record<string, unknown>)[];
  note: string;
}

const fixture = fixtureJson as unknown as { results: Record<string, LegacyResult> };

const REVEAL_NAMES = { L: 'tableau gauche', R: 'tableau droit', T: 'linteau', B: 'appui' } as const;

/** Message d'erreur legacy correspondant à un code. */
function legacyError(e: SurfaceError): RegExp {
  switch (e.code) {
    case 'invalid-surface':
      return /^Renseignez des dimensions positives/;
    case 'invalid-tile':
      return new RegExp(`^Zone ${e.zone + 1} : renseignez les dimensions du carreau`);
    case 'too-many-tiles':
      return new RegExp(`^Environ ${Math.round(e.estimate).toLocaleString('fr-FR').replace(/\s/g, '\\s')} carreaux`);
    default:
      return /^$/;
  }
}

/** Pièces de toutes les surfaces calculables, dans l'ordre du projet. */
function allPieces(p: ProjectSpec): { pieces: Piece[]; firstError: SurfaceError | null } {
  const pieces: Piece[] = [];
  let firstError: SurfaceError | null = null;
  p.surfaces.forEach((s, i) => {
    const r = buildSurface(s, i);
    if (r.ok) pieces.push(...r.value.pieces);
    else if (i === 0) firstError = r.error;
  });
  return { pieces, firstError };
}

/** Projection d'une pièce sur les champs extraits de legacy. */
function project(pc: Piece) {
  return {
    surface: pc.surface,
    zone: pc.zone,
    full: pc.full,
    thin: pc.thin,
    vis: pc.vis.length,
    outline: pc.outline.length,
    minD: pc.minD,
    pw: pc.pw,
    ph: pc.ph,
    fw: pc.fw,
    fh: pc.fh,
    rect: pc.rect,
    notch: pc.notch,
    atFold: pc.atFold,
    drill: pc.drill,
    req: pc.req,
    shape: pc.shape,
    kind: pc.kind,
    par: pc.par,
    key: pc.key,
    color: pc.color,
    tA: pc.tA,
    tW: pc.tW,
    tH: pc.tH,
    box: pc.m2PerBox,
    plinth: pc.plinth,
    reveal: pc.plinth ? 'Plinthe' : pc.reveal ? `F${pc.reveal.opening + 1} ${REVEAL_NAMES[pc.reveal.side]}` : null,
    parts: pc.parts ? pc.parts.length : 0,
    area: pc.parts ? pc.parts.reduce((t, q) => t + area(q), 0) : null,
  };
}

const PIECE_FIELDS = [
  ...'surface zone full thin vis outline minD pw ph fw fh rect notch atFold drill req'.split(' '),
  ...'shape kind par key color tA tW tH box plinth reveal parts area'.split(' '),
];

describe.each(Object.entries(fixture.results))('parité : %s', (_name, L) => {
  const spec = fromLegacy(L.input);
  const { pieces, firstError } = allPieces(spec);

  it('erreur bloquante identique', () => {
    if (L.error) {
      if (!firstError) throw new Error('erreur attendue : ' + L.error);
      if (!legacyError(firstError).test(L.error)) throw new Error(`${firstError.code} ≠ « ${L.error} »`);
    } else if (firstError) throw new Error('erreur inattendue : ' + JSON.stringify(firstError));
  });

  it.skipIf(!!L.error)('pièces identiques', () => {
    const expected = L.pieces.map((p) => Object.fromEntries(PIECE_FIELDS.map((k) => [k, p[k]])));
    expectSame(pieces.map(project), expected, 'pièces');
  });

  it.skipIf(!!L.error)('plan de découpe identique (groupes, carreaux numérotés, réemploi)', () => {
    const plan = planCuts(pieces, spec.settings);
    expectSame(
      plan.groups.map((g) => ({
        key: g.key,
        shape: g.shape,
        W: g.tileWidth,
        H: g.tileHeight,
        tA: g.tileArea,
        color: g.color,
        box: g.m2PerBox,
        kind: g.kind,
        full: g.full,
        cuts: g.cuts,
        tiles: g.tiles,
      })),
      L.groups.map(({ label: _label, ...g }) => g),
      'groupes',
    );
    expectSame(
      plan.source,
      L.pieces.map((p) => p.source),
      'source',
    );
    expectSame(
      plan.reused,
      L.pieces.map((p) => p.reused),
      'réemploi',
    );
  });
});
