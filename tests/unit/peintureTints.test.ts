/** Teintes de peinture choisies dans la pose (B2) : palette, teinte foncée, besoins et achats par teinte, migration. */
import { describe, expect, it } from 'vitest';
import { NO_CONTEXT } from '../../src/core/coverage/wallBase';
import { module as manifest } from '../../src/modules/peinture';
import { FALLBACK_COLOR, luminance, PAINT_COLORS, shownColor, tintOf } from '../../src/modules/peinture/core/colors';
import { computePeinture } from '../../src/modules/peinture/core/compute';
import { PAINT_TEMPLATES } from '../../src/modules/peinture/core/paint';
import type { PaintColor, PaintPoseSettings, PeintureSpec } from '../../src/modules/peinture/core/types';
import { logic } from '../../src/modules/peinture/logic';
import { PEINTURE_MIGRATIONS, PEINTURE_SCHEMA, type PeintureData } from '../../src/modules/peinture/state/model';
import { peintureMeshes } from '../../src/modules/peinture/ui/lib/resultExports';
import type { Project } from '../../src/state/model';
import { planProject, rect } from './planFixtures';

const peinture = { ...manifest, ...logic };
const WHITE = {
  ...PAINT_TEMPLATES[0]!,
  packs: [
    { size: 2.5, price: 26 },
    { size: 10, price: 80 },
  ],
};
const libraries = { paints: [WHITE, ...PAINT_TEMPLATES.slice(1)] };
const SAUGE: PaintColor = { name: 'Vert sauge', hex: '#9caf95' };
const NUIT: PaintColor = { name: 'Bleu nuit', hex: '#2d3a4f' };

/** Une pose de peinture par pièce (4 000 × 3 000 × 2 500, sans ouverture), teinte de chaque pose donnée. */
function project(colors: (PaintColor | null)[]): Project {
  const ids = colors.map((_, i) => `r${i}`);
  const poses = ids.map((_, i) => ({ id: `P${i}`, module: 'peinture', name: `Pose ${i + 1}` }));
  const zones = ids.flatMap((r, i) =>
    ['w0', 'w1', 'w2', 'w3'].map((w) => ({
      id: `${r}-${w}`,
      surface: { room: r, wall: `${r}-${w}` },
      cuts: [],
      pose: `P${i}`,
    })),
  );
  const base = planProject(
    ids.map((id) => rect(id, 4000, 3000, { height: 2500 })),
    {},
    { zones, poses },
  );
  const data: PeintureData = {
    poses: Object.fromEntries(
      poses.map((p, i) => [
        p.id,
        { ...(peinture.createPose!(base, libraries) as PaintPoseSettings), color: colors[i]! },
      ]),
    ),
    prices: {},
  };
  return { ...base, modules: { ...base.modules, peinture: { schemaVersion: PEINTURE_SCHEMA, data } } };
}

const run = (p: Project) => {
  const r = peinture.toSpec(p, libraries, NO_CONTEXT);
  if (!('spec' in r)) throw new Error(JSON.stringify(r));
  return computePeinture(r.spec as PeintureSpec);
};
const dataOf = (p: Project) => p.modules.peinture!.data as PeintureData;

describe('palette', () => {
  it('teintes nommées, uniques, pastilles valides', () => {
    expect(PAINT_COLORS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(PAINT_COLORS.map((c) => c.name)).size).toBe(PAINT_COLORS.length);
    expect(new Set(PAINT_COLORS.map((c) => c.hex)).size).toBe(PAINT_COLORS.length);
    for (const c of PAINT_COLORS) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('teinte claire, moyenne, foncée d’après la luminance', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
    expect(tintOf('#f4f1ea')).toBe('light');
    expect(tintOf(SAUGE.hex)).toBe('medium');
    expect(tintOf(NUIT.hex)).toBe('dark');
  });

  it('couleur affichée : teinte de la pose, sinon de la peinture, sinon blanc cassé', () => {
    expect(shownColor(SAUGE, { name: 'Blanc', hex: '#ffffff' })).toBe(SAUGE.hex);
    expect(shownColor(null, { name: 'Blanc', hex: '#ffffff' })).toBe('#ffffff');
    expect(shownColor(null, null)).toBe(FALLBACK_COLOR);
  });
});

describe('teinte de la pose dans le calcul', () => {
  it('la finition porte la teinte ; teinte foncée sur ancien peint : une couche de plus conseillée', () => {
    const light = run(project([SAUGE])).poses[0]!.result;
    expect(light.products.find((x) => x.role === 'finish')!.color).toEqual(SAUGE);
    expect(light.alerts.map((a) => a.code)).not.toContain('dark-tint-coat');
    const dark = run(project([NUIT])).poses[0]!.result;
    expect(dark.alerts.map((a) => a.code)).toContain('dark-tint-coat');
  });

  it('sans teinte choisie : rien ne change', () => {
    const r = run(project([null])).poses[0]!.result;
    expect(r.products.find((x) => x.role === 'finish')!.color).toBeUndefined();
  });
});

describe('achats par teinte', () => {
  it('même peinture, deux teintes : deux combinaisons de pots, libellé et pastille de la teinte', () => {
    const p = project([SAUGE, NUIT]);
    const lines = peinture.shopping(run(p), dataOf(p), libraries, p);
    const sauge = lines.filter((l) => l.label.includes('Vert sauge'));
    const nuit = lines.filter((l) => l.label.includes('Bleu nuit'));
    expect(sauge.length).toBeGreaterThan(0);
    expect(nuit.length).toBeGreaterThan(0);
    expect(sauge.every((l) => l.key.endsWith(':9caf95') && l.color === SAUGE.hex)).toBe(true);
    expect(nuit.every((l) => l.key.endsWith(':2d3a4f'))).toBe(true);
  });

  it('même teinte sur deux poses : besoins additionnés ; sans teinte : clé d’origine (prix déjà saisis)', () => {
    const same = project([SAUGE, { ...SAUGE, hex: '#9CAF95' }]);
    const keys = peinture.shopping(run(same), dataOf(same), libraries, same).map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    const plain = project([null]);
    expect(peinture.shopping(run(plain), dataOf(plain), libraries, plain)[0]!.key).toMatch(
      /^peinture:modele-blanc-mat:finish:[\d.]+$/,
    );
  });

  it('3D : les murs prennent la teinte de la pose', () => {
    const p = project([NUIT]);
    const [mesh] = peintureMeshes({ project: p, libraries, result: run(p), scope: { kind: 'project' } });
    expect(mesh!.colors[0]).toBeLessThan(0.1);
  });
});

describe('migration des données (schéma 2)', () => {
  it('teinte absente → null, murs et boiseries ; le reste est gardé', () => {
    const before = {
      poses: { P0: { finish: 'x', coats: 2, woodwork: { finish: 'y', coats: 2 } } },
      prices: { a: 1 },
    };
    expect(PEINTURE_MIGRATIONS[2]!(before)).toEqual({
      poses: { P0: { finish: 'x', color: null, coats: 2, woodwork: { finish: 'y', color: null, coats: 2 } } },
      prices: { a: 1 },
    });
    expect(PEINTURE_SCHEMA).toBe(2);
  });
});
