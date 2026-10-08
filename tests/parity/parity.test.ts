import { describe, expect, it } from 'vitest';
import { area } from '../../src/core/geometry/polygon';
import { computeProject } from '../../src/core/project';
import type { GlueNote, Notch } from '../../src/core/rules/glue';
import type { Piece, SurfaceError, SurfaceWarning } from '../../src/core/types';
import { expectSame } from './compare';
import fixtureJson from './fixtures/legacy-results.json';
import { fromLegacy } from './fromLegacy';
import type { LegacyProject } from './legacyTypes';

interface LegacyPiece {
  surface: number;
  reveal: string | null;
  source: number | null;
  reused: boolean;
  [k: string]: unknown;
}
interface LegacyGlue {
  notch: string;
  note: string;
  [k: string]: unknown;
}
interface LegacyResult {
  input: LegacyProject;
  error?: string;
  pieces: LegacyPiece[];
  groups: ({ label: string } & Record<string, unknown>)[];
  metrics: Record<string, number>;
  shopping: { key: string; mult: number }[];
  glue: LegacyGlue[];
  note: string;
}

const fixture = fixtureJson as unknown as { results: Record<string, LegacyResult> };

/* ---------- textes legacy, reconstitués depuis les codes du moteur ---------- */

const REVEAL_NAMES = { L: 'tableau gauche', R: 'tableau droit', T: 'linteau', B: 'appui' } as const;
const OPENING_NAMES = {
  window: 'Fenêtre',
  door: 'Porte',
  socket: 'Prise',
  trap: 'Trappe',
  tub: 'Baignoire',
  other: 'Réservation',
};
const NOTCH: Record<Notch, string> = {
  U3: 'U3 (3 mm)',
  U6: 'U6 (6 mm)',
  U9: 'U9 (9 mm)',
  'U9-or-DL20': 'U9 ou demi-lune DL20',
  DL20: 'Demi-lune DL20',
};
const GLUE_NOTE: Record<GlueNote, RegExp> = {
  mosaic: /^Mosaïque/,
  deformable: /déformable \(C2 S1\) conseillé/,
  'large-format': /^Grand format/,
  'beyond-dtu': /hors DTU/,
  elongated: /Format allongé/,
};
const cm = (mm: number) => (mm / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

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

function legacyNote(w: SurfaceWarning, L: LegacyResult): string {
  switch (w.code) {
    case 'zones-overflow':
      return 'Les zones dépassent la surface de ' + cm(w.amount) + ' cm : la fin est tronquée.';
    case 'zones-gap':
      return cm(w.amount) + ' cm restent non carrelés. Passez une zone en « Reste de la surface » pour combler.';
    case 'reveal-pattern':
      return `${OPENING_NAMES[L.input.surfaces[0]!.res[w.opening]!.type]} ${w.opening + 1} : tableaux non calculés pour ce motif.`;
    case 'plinth-pattern':
      return 'Plinthes : choisissez une zone à carreau rectangulaire.';
    case 'plinth-too-high':
      return 'Plinthes : la hauteur dépasse la largeur du carreau.';
  }
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
  const R = computeProject(spec);
  const first = R.surfaces[0]!;

  it('erreur bloquante identique', () => {
    if (L.error) {
      if (first.ok) throw new Error('erreur attendue : ' + L.error);
      expect(L.error).toMatch(legacyError(first.error));
    } else if (!first.ok) throw new Error('erreur inattendue : ' + JSON.stringify(first.error));
  });

  if (L.error) return;

  it('pièces', () => {
    const expected = L.pieces.map((p) => Object.fromEntries(PIECE_FIELDS.map((k) => [k, p[k]])));
    expectSame(R.pieces.map(project), expected, 'pièces');
  });

  it('plan de découpe (groupes, carreaux numérotés, réemploi)', () => {
    expectSame(
      R.plan.groups.map((g) => ({
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
      R.plan.source,
      L.pieces.map((p) => p.source),
      'source',
    );
    expectSame(
      R.plan.reused,
      L.pieces.map((p) => p.reused),
      'réemploi',
    );
  });

  it('quantités', () => {
    expectSame(R.metrics, L.metrics, 'métriques');
  });

  it('encollage et joint', () => {
    expectSame(
      R.glue.map((g) => ({
        surface: g.surface,
        zone: g.zone,
        notch: NOTCH[g.advice.notch],
        double: g.advice.double,
        kgPerM2: g.advice.kgPerM2,
        S: g.advice.S,
        m2: g.m2,
        kg: g.kg,
        jointKg: g.jointKg,
        n: g.n,
        long: g.long,
      })),
      L.glue.map(({ note: _note, ...g }) => g),
      'encollage',
    );
    R.glue.forEach((g, i) => {
      const note = L.glue[i]!.note;
      expect(note === '').toBe(g.advice.notes.length === 0);
      for (const n of g.advice.notes) expect(note).toMatch(GLUE_NOTE[n]);
    });
  });

  it('liste d’achat', () => {
    expectSame(
      R.shopping.map((s) => ({ key: s.key, mult: s.mult })),
      L.shopping.map((s) => ({ key: s.key, mult: s.mult })),
      'achats',
    );
  });

  it('alertes de la surface', () => {
    const warnings = first.ok ? first.value.warnings : [];
    expect(warnings.map((w) => legacyNote(w, L)).join(' ')).toBe(L.note);
  });
});
