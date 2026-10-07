import type { LegacyInput, LegacyZone, ParityConfig } from './legacyTypes';

/**
 * Jeu de configurations de référence pour la parité avec legacy.
 * Format legacy : dimensions en mm, sauf taille de zone en cm (unit 'cm') et profondeur de tableau en cm.
 * Surface active toujours 0 (voir DOMAIN.md, ordre des surfaces).
 */

type S = LegacyInput['surfaces'][number];

const PATTERNS = ['grid', 'half', 'third', 'quarter', 'rand', 'herring', 'chevron', 'basket', 'hex', 'octo'] as const;

/** Carreau par défaut selon le motif : hexagone et octogone donnés par leur largeur. */
const tileFor = (pattern: string): Partial<LegacyZone> =>
  pattern === 'hex' ? { a: 200, b: 200 } : pattern === 'octo' ? { a: 250, b: 250 } : { a: 600, b: 300 };

const wall = (o: S = {}): S => ({ W: 2400, H: 1800, j: 3, ...o });
const one = (s: S, name: string, optimize?: ParityConfig['optimize']): ParityConfig => ({
  name,
  project: { surfaces: [s], active: 0 },
  ...(optimize ? { optimize } : {}),
});
const zone = (pattern: string, o: Partial<LegacyZone> = {}): Partial<LegacyZone> => ({
  pattern,
  ...tileFor(pattern),
  ...o,
});

const configs: ParityConfig[] = [];

// Motifs à 0°, départ angle de zone
for (const p of PATTERNS) configs.push(one(wall({ zones: [zone(p)] }), `motif ${p} 0° angle`));

// Motifs à 45°, départ centré carreau
for (const p of PATTERNS)
  configs.push(one(wall({ zones: [zone(p, { angle: 45, start: 'tile' })] }), `motif ${p} 45° carreau`));

// Autres angles et départ centré joint
for (const [p, angle] of [
  ['grid', 30],
  ['half', 60],
  ['herring', 90],
  ['basket', 30],
  ['third', 90],
] as const) {
  configs.push(one(wall({ zones: [zone(p, { angle, start: 'joint' })] }), `motif ${p} ${angle}° joint`));
}

// Joint nul : couverture exacte
for (const p of ['grid', 'herring', 'hex', 'chevron'] as const) {
  configs.push(one(wall({ j: 0, zones: [zone(p, { angle: p === 'grid' ? 45 : 0 })] }), `joint 0 ${p}`));
}

configs.push(one(wall({ j: 5, zones: [zone('half', { dx: 137, dy: -42 })] }), 'décalage X/Y joint 5'));
configs.push(one(wall({ zones: [zone('grid', { a: 300, b: 600 })] }), 'carreau vertical 300×600'));

// Ouvertures
configs.push(
  one(
    wall({
      W: 3000,
      H: 2400,
      res: [{ type: 'window', x: 900, sill: 1000, w: 1000, h: 900, cov: true, depth: 20 }],
      zones: [zone('half')],
    }),
    'fenêtre avec tableaux, profilé',
  ),
);
configs.push(
  one(
    wall({
      W: 3000,
      H: 2400,
      res: [
        {
          type: 'window',
          x: 900,
          sill: 1000,
          w: 1000,
          h: 900,
          cov: false,
          depth: 15,
          rv: { L: true, R: true, T: true, B: true },
        },
      ],
      hid: { T: false, B: true, L: false, R: false },
      zones: [zone('grid', { a: 300, b: 300 })],
    }),
    'fenêtre sans profilé, bords visibles',
  ),
);
configs.push(
  one(
    wall({
      W: 2600,
      H: 2200,
      res: [{ type: 'door', x: 400, sill: 0, w: 830, h: 2040, cov: true, depth: 10 }],
      zones: [zone('third')],
    }),
    'porte avec tableaux',
  ),
);
configs.push(
  one(
    wall({
      res: [
        { type: 'socket', x: 1150, sill: 1100, w: 80, h: 80 },
        { type: 'socket', x: 400, sill: 300, w: 80, h: 80 },
      ],
      zones: [zone('grid')],
    }),
    'prises à percer',
  ),
);
configs.push(
  one(
    wall({
      W: 2000,
      H: 1600,
      res: [{ type: 'tub', x: 0, sill: 0, w: 1700, h: 560, proj: 700 }],
      zones: [zone('half', { a: 300, b: 200 })],
    }),
    'baignoire',
  ),
);
configs.push(
  one(
    wall({
      res: [{ type: 'window', x: 600, sill: 800, w: 700, h: 600, cov: true, depth: 20 }],
      zones: [zone('hex')],
    }),
    'fenêtre sur hexagones (tableaux non calculés)',
  ),
);
configs.push(
  one(
    wall({ res: [{ type: 'other', x: 2000, sill: 1500, w: 900, h: 900, cov: false }], zones: [zone('grid')] }),
    'réservation débordant de la surface',
  ),
);
configs.push(
  one(
    wall({ res: [{ type: 'trap', x: 5000, sill: 300, w: 300, h: 300 }], zones: [zone('grid')] }),
    'ouverture hors surface',
  ),
);

// Angles de mur
configs.push(
  one(
    wall({
      W: 3600,
      folds: [
        { x: 1200, type: 'in', ang: 90, cov: true },
        { x: 2500, type: 'out', ang: 90, cov: false },
      ],
      zones: [zone('half')],
    }),
    'angles rentrant et sortant',
  ),
);
configs.push(
  one(
    wall({ W: 3600, folds: [{ x: 1800, type: 'out', ang: 90, cov: true }], zones: [zone('herring', { angle: 45 })] }),
    'angle sortant avec profilé, bâtons rompus',
  ),
);
configs.push(
  one(wall({ folds: [{ x: 9000, type: 'in', ang: 90, cov: true }], zones: [zone('grid')] }), 'angle hors surface'),
);
configs.push(
  one(
    wall({ kind: 'floor', folds: [{ x: 1200, type: 'in', ang: 90, cov: true }], zones: [zone('grid')] }),
    'angle ignoré sur un sol',
  ),
);

// Plinthes
configs.push(one(wall({ plinth: { len: 6000, h: 80, zone: 0 }, zones: [zone('grid')] }), 'plinthes'));
configs.push(one(wall({ plinth: { len: 3000, h: 400, zone: 0 }, zones: [zone('grid')] }), 'plinthes trop hautes'));
configs.push(one(wall({ plinth: { len: 3000, h: 80, zone: 0 }, zones: [zone('octo')] }), 'plinthes sur octogone'));

// Couleurs
configs.push(one(wall({ zones: [zone('grid', { mix: 'alt', c1: '#ffffff', c2: '#222222' })] }), 'mélange alterné'));
configs.push(one(wall({ zones: [zone('half', { mix: 'rand', c1: '#ffffff', c2: '#222222' })] }), 'mélange aléatoire'));
configs.push(one(wall({ zones: [zone('chevron', { mix: 'alt', c1: '#ffffff', c2: '#222222' })] }), 'Hongrie alternée'));

// Réglages de découpe
configs.push(one(wall({ reuse: false, zones: [zone('half', { angle: 45 })] }), 'réemploi désactivé'));
configs.push(one(wall({ orient: '180', zones: [zone('half', { angle: 45 })] }), 'sens demi-tour'));
configs.push(one(wall({ orient: 'none', zones: [zone('hex', { angle: 30 })] }), 'sens aucune rotation, hexagone'));
configs.push(one(wall({ kerf: 0, minr: 50, zones: [zone('third', { angle: 30 })] }), 'kerf 0, chute mini 50'));
configs.push(one(wall({ margin: 15, zones: [zone('octo', { angle: 45 })] }), 'octogone 45°, marge 15'));

// Zones
configs.push(
  one(
    wall({
      W: 2400,
      H: 2400,
      split: 'h',
      zones: [
        zone('grid', { unit: 'rows', size: 3, a: 300, b: 300 }),
        zone('grid', { unit: 'cm', size: 10, a: 200, b: 100, c1: '#334455' }),
        zone('half', { unit: 'rest' }),
      ],
    }),
    'frise : rangées, cm, reste',
  ),
);
configs.push(
  one(
    wall({
      W: 3000,
      split: 'v',
      zones: [zone('half', { unit: 'cm', size: 120 }), zone('herring', { unit: 'rest', angle: 45 })],
    }),
    'zones côte à côte',
  ),
);
configs.push(
  one(
    wall({
      split: 'h',
      jcov: true,
      hid: { T: false, B: false, L: false, R: false },
      zones: [zone('grid', { unit: 'rows', size: 2, angle: 90 }), zone('grid', { unit: 'rest', a: 200, b: 200 })],
    }),
    'jonction couverte, bords visibles',
  ),
);
configs.push(
  one(
    wall({ zones: [zone('grid', { unit: 'cm', size: 100 }), zone('grid', { unit: 'cm', size: 120 })] }),
    'zones qui débordent',
  ),
);
configs.push(one(wall({ zones: [zone('grid', { unit: 'rows', size: 2 })] }), 'surface non remplie'));

// Sol, formats
configs.push(
  one(
    wall({
      kind: 'floor',
      W: 2600,
      H: 2000,
      res: [
        { type: 'tub', x: 0, sill: 0, w: 1700, h: 700 },
        { type: 'trap', x: 2000, sill: 1400, w: 300, h: 300 },
      ],
      zones: [zone('grid', { a: 600, b: 600 })],
    }),
    'sol avec baignoire et trappe',
  ),
);
configs.push(
  one(
    wall({ kind: 'floor', W: 4000, H: 3000, zones: [zone('half', { a: 1200, b: 600, box: 1.44 })] }),
    'grand format sol',
  ),
);
configs.push(
  one(wall({ W: 3000, H: 2400, zones: [zone('half', { a: 1200, b: 200, box: 0.96 })] }), 'format allongé mur'),
);
configs.push(one(wall({ W: 600, H: 400, j: 2, zones: [zone('grid', { a: 50, b: 50, box: 1 })] }), 'mosaïque'));
configs.push(one(wall({ W: 2000, H: 2000, zones: [zone('grid', { a: 1200, b: 1200 })] }), 'très grand format mur'));
configs.push(one(wall({ zones: [zone('basket', { a: 300, b: 75, box: 0 })] }), 'vannerie vendue à la pièce'));

// Plusieurs surfaces
configs.push({
  name: 'deux murs, chutes partagées',
  project: {
    active: 0,
    surfaces: [wall({ W: 2350, zones: [zone('half')] }), wall({ W: 1730, H: 1800, zones: [zone('half')] })],
  },
});
configs.push({
  name: 'pièce complète',
  project: {
    active: 0,
    room: { L: 2400, l: 1800, H: 2500, T: 2000, surf: { A: 0, B: 1, C: 2, D: 3, F: 4 } },
    surfaces: [
      wall({
        W: 2400,
        H: 2000,
        res: [{ type: 'window', x: 700, sill: 1000, w: 800, h: 800, cov: true, depth: 15 }],
        folds: [],
        zones: [zone('half')],
      }),
      wall({ W: 1800, H: 2000, zones: [zone('half')] }),
      wall({
        W: 2400,
        H: 2000,
        res: [{ type: 'door', x: 300, sill: 0, w: 830, h: 2000, cov: true }],
        zones: [zone('half')],
      }),
      wall({ W: 1800, H: 2000, zones: [zone('half')] }),
      wall({ kind: 'floor', W: 2400, H: 1800, zones: [zone('grid', { a: 600, b: 600, c1: '#777777' })] }),
    ],
  },
});
configs.push({
  name: 'deux surfaces, une en erreur',
  project: { active: 0, surfaces: [wall({ zones: [zone('grid')] }), wall({ zones: [zone('grid', { a: 0 })] })] },
});

// Cas limites (erreurs)
configs.push(one(wall({ W: 0, zones: [zone('grid')] }), 'erreur surface nulle'));
configs.push(one(wall({ j: -1, zones: [zone('grid')] }), 'erreur joint négatif'));
configs.push(one(wall({ zones: [zone('grid'), zone('grid', { b: 0 })] }), 'erreur carreau nul'));
configs.push(one(wall({ W: 10000, H: 10000, zones: [zone('grid', { a: 50, b: 50 })] }), 'erreur trop de carreaux'));

// Optimisation du départ
configs.push(one(wall({ zones: [zone('grid')] }), 'optimiser droit, coupes fines', { goal: 'thin', zones: [0] }));
configs.push(
  one(wall({ zones: [zone('half', { angle: 45 })] }), 'optimiser décalé 45°, carreaux', { goal: 'tiles', zones: [0] }),
);
configs.push(
  one(wall({ zones: [zone('herring')] }), 'optimiser bâtons rompus, équilibré', { goal: 'bal', zones: [0] }),
);
configs.push(one(wall({ zones: [zone('half')] }), 'optimiser symétrique', { goal: 'sym', zones: [0] }));
configs.push(
  one(
    wall({ zones: [zone('grid', { unit: 'rows', size: 2 }), zone('half', { unit: 'rest', a: 300, b: 200 })] }),
    'optimiser symétrique, rangées verrouillées',
    { goal: 'sym', zones: [0, 1] },
  ),
);
configs.push(one(wall({ zones: [zone('hex')] }), 'optimiser hexagone, coupes fines', { goal: 'thin', zones: [0] }));

export default configs;
