/** Module cloisons : projet → entrée du moteur (géométrie des cloisons), réducteur, achats, résumé. */
import { describe, expect, it } from 'vitest';
import type { Demolition, Partition, PlanRoom } from '../../src/core/plan/types';
import { computeCloisons } from '../../src/modules/cloisons/core/compute';
import { createSystem, templateSystems } from '../../src/modules/cloisons/core/defaults';
import { reduce } from '../../src/modules/cloisons/state/actions';
import {
  CLOISONS_ID,
  CLOISONS_SCHEMA,
  createCloisonsData,
  defaultPartitionSettings,
  type CloisonsData,
} from '../../src/modules/cloisons/state/model';
import { create, priceAction, shopping, summary, toSpec } from '../../src/modules/cloisons/state/module';
import { hydrate, siteOf, type Project } from '../../src/state/model';
import { rect } from './planFixtures';

const room = rect('a', 4000, 3000, { name: 'Séjour' });
const cloison = (id: string, a: [number, number], b: [number, number], o: Partial<Partition> = {}): Partition => ({
  id,
  a,
  b,
  thickness: 72,
  align: 'center',
  openings: [],
  ...o,
});

function project(
  partitions: Partition[],
  o: {
    rooms?: PlanRoom[];
    data?: CloisonsData | null;
    demolitions?: Demolition[];
    zones?: Project['zones'];
    poses?: Project['poses'];
  } = {},
): Project {
  const site = { ...siteOf({ rooms: o.rooms ?? [room], passages: [] }), partitions, demolitions: o.demolitions ?? [] };
  return hydrate({
    schemaVersion: 4,
    id: 'p',
    name: 'Maison',
    createdAt: 0,
    updatedAt: 0,
    site,
    zones: o.zones ?? [],
    poses: o.poses ?? [],
    modules: o.data === null ? {} : { [CLOISONS_ID]: { schemaVersion: CLOISONS_SCHEMA, data: o.data ?? create() } },
  });
}

const libraries = { systems: templateSystems() };
const specOf = (p: Project) => {
  const r = toSpec(p, libraries);
  if ('errors' in r) throw new Error(JSON.stringify(r.errors));
  return r.spec;
};

describe('toSpec : géométrie', () => {
  it('une cloison d’un mur à l’autre : longueur, appuis, hauteur, système de même épaisseur', () => {
    const spec = specOf(project([cloison('c1', [2000, 0], [2000, 3000])]));
    const p = spec.partitions[0]!;
    expect(p.length).toBeCloseTo(3000, 0);
    expect([p.start, p.end]).toEqual(['wall', 'wall']);
    expect(p.height).toBe(2500);
    expect(p.junctions).toEqual([]);
    expect(p.system).toBe('modele-72-48');
    expect(p.name).toBe('Cloison 1 · Séjour / Séjour (2)');
    expect(Object.keys(spec.systems)).toHaveLength(3);
  });

  it('un bout qui entre dans le mur est ramené à la face', () => {
    const p = specOf(project([cloison('c1', [2000, -30], [2000, 3030])])).partitions[0]!;
    expect(p.length).toBeCloseTo(3000, 0);
  });

  it('liaison en T : appui sur la face de l’autre cloison, abscisse de la liaison', () => {
    const spec = specOf(project([cloison('c1', [2000, 0], [2000, 3000]), cloison('c2', [2000, 1500], [4000, 1500])]));
    const [c1, c2] = spec.partitions;
    expect(c2!.start).toBe('partition-t');
    expect(c2!.end).toBe('wall');
    expect(c2!.length).toBeCloseTo(4000 - 2036, 0);
    expect(c1!.junctions).toHaveLength(1);
    expect(c1!.junctions[0]).toBeCloseTo(1500, 0);
  });

  it('angle : les deux cloisons se rejoignent par leur bout', () => {
    const [c1, c2] = specOf(
      project([cloison('c1', [2000, 0], [2000, 1500]), cloison('c2', [2000, 1500], [4000, 1500])]),
    ).partitions;
    expect(c1!.end).toBe('partition-corner');
    expect(c2!.start).toBe('partition-corner');
    expect(c1!.junctions).toEqual([]);
  });

  it('bout libre', () => {
    const p = specOf(project([cloison('c1', [2000, 0], [2000, 1800])])).partitions[0]!;
    expect(p.end).toBe('free');
    expect(p.start).toBe('wall');
    expect(p.length).toBeCloseTo(1800, 0);
  });

  it('portes : décalage depuis la face d’appui, porte hors du corps ignorée', () => {
    const q = cloison('c1', [2000, -30], [2000, 3030], {
      openings: [{ id: 'o', kind: 'door', offset: 1030, width: 830, height: 2040 }],
    });
    const p = specOf(project([q])).partitions[0]!;
    expect(p.openings).toEqual([{ id: 'o', kind: 'door', offset: 1000, width: 830, height: 2040 }]);
  });

  it('hauteur choisie, entraxe et plaques viennent des réglages de la cloison', () => {
    const data: CloisonsData = {
      ...createCloisonsData(),
      partitions: {
        c1: {
          system: 'modele-98-48',
          height: 2700,
          spacing: 400,
          plates: { a: 'hydro', b: 'standard' },
          insulation: { kind: 'glass-wool' },
          reinforcement: { ends: 'single', jambs: 'double', junctions: 'single', woodInsert: true },
        },
      },
    };
    const p = specOf(project([cloison('c1', [2000, 0], [2000, 3000], { thickness: 98 })], { data })).partitions[0]!;
    expect([p.system, p.height, p.spacing, p.plates.a]).toEqual(['modele-98-48', 2700, 400, 'hydro']);
    expect(p.insulation).toEqual({ kind: 'glass-wool' });
    expect(p.reinforcement.woodInsert).toBe(true);
  });

  it('hauteur des pièces : la plus basse des deux voisines', () => {
    const low = { ...room, height: 2400 };
    const p = specOf(project([cloison('c1', [2000, 0], [2000, 3000])], { rooms: [low] })).partitions[0]!;
    expect(p.height).toBe(2400);
  });

  it('face carrelée : lue dans les zones du projet', () => {
    const p = project([cloison('c1', [2000, 0], [2000, 3000])], {
      zones: [
        { id: 'z', surface: { room: 'a', wall: 'c1:a' }, cuts: [], pose: 'P' },
        { id: 'y', surface: { room: 'a', wall: 'c1:b' }, cuts: [], pose: 'Q' },
      ],
      poses: [
        { id: 'P', module: 'carrelage', name: 'Pose 1' },
        { id: 'Q', module: 'peinture', name: 'Pose 2' },
      ],
    });
    expect(specOf(p).partitions[0]!.tiledFaces).toEqual(['a']);
  });

  it('une cloison refusée par la validation est ignorée ; démolitions comptées', () => {
    const b = { ...rect('b', 3000, 3000), origin: [4072, 0] as [number, number] };
    const c = { ...rect('c', 3000, 3000), origin: [7144, 0] as [number, number] };
    // « bad » franchit le mur démoli entre a et b, puis le mur entre b et c : refusée
    const p = project([cloison('ok', [500, 0], [500, 3000]), cloison('bad', [1000, 1500], [9000, 1500])], {
      rooms: [room, b, c],
      demolitions: [{ id: 'd', room: 'a', wall: 'a-w1', from: 0, to: 3000 }],
    });
    const spec = specOf(p);
    expect(spec.partitions.map((x) => x.id)).toEqual(['ok']);
    expect(spec.demolishedArea).toBeCloseTo(3 * 2.5, 6);
  });

  it('erreurs bloquantes : module absent, aucune cloison', () => {
    expect(toSpec(project([], { data: null }), libraries)).toEqual({ errors: [{ code: 'cloisons/absent' }] });
    expect(toSpec(project([]), libraries)).toEqual({ errors: [{ code: 'cloisons/no-partition' }] });
  });

  it('sans système en bibliothèque : le moteur signale no-system', () => {
    const r = toSpec(project([cloison('c1', [2000, 0], [2000, 3000])]), { systems: [] });
    if ('errors' in r) throw new Error('attendu : une entrée');
    expect(computeCloisons(r.spec).alerts.map((a) => a.code)).toEqual(['no-system']);
  });
});

describe('réducteur', () => {
  it('réglages d’une cloison créés à la première modification, inchangés si rien ne change', () => {
    const d = createCloisonsData();
    const e = reduce(d, { type: 'cloisons/partition/update', partitionId: 'c1', patch: { height: 2600 } });
    expect(e.partitions.c1).toMatchObject({ height: 2600, spacing: 600 });
    expect(reduce(e, { type: 'cloisons/partition/update', partitionId: 'c1', patch: { height: 2600 } })).toBe(e);
    expect(reduce(d, { type: 'pose/removed', poseId: 'x' })).toBe(d);
  });

  it('réglages communs, prix, nettoyage', () => {
    let d = createCloisonsData();
    d = reduce(d, { type: 'cloisons/settings/update', patch: { railBar: 2500 } });
    expect(d.settings.railBar).toBe(2500);
    d = reduce(d, { type: 'cloisons/price', key: 'k', value: 4.5 });
    expect(d.prices).toEqual({ k: 4.5 });
    d = reduce(d, { type: 'cloisons/price', key: 'k', value: null });
    expect(d.prices).toEqual({});
    d = reduce(d, { type: 'cloisons/partition/update', partitionId: 'old', patch: { height: 2600 } });
    expect(reduce(d, { type: 'cloisons/prune', keep: ['old'] })).toBe(d);
    expect(reduce(d, { type: 'cloisons/prune', keep: [] }).partitions).toEqual({});
  });
});

describe('achats et résumé', () => {
  const data = createCloisonsData();
  const spec = specOf(project([cloison('c1', [2000, 0], [2000, 3000])]));
  const result = computeCloisons(spec);

  it('groupes, unités et clés de prix (R1 : 2 barres de rail, 8 montants, 6 plaques)', () => {
    const lines = shopping(result, data);
    const by = (k: string) => lines.find((l) => l.key === k)!;
    expect(by('cloisons:rail:48')).toMatchObject({ group: 'structure', unit: 'bar', quantity: 2 });
    expect(by('cloisons:stud:48:2500')).toMatchObject({ group: 'structure', unit: 'bar', quantity: 8 });
    expect(by('cloisons:plate:standard:12.5:2500x1200')).toMatchObject({
      unit: 'piece',
      quantity: 6,
      group: 'structure',
    });
    expect(by('cloisons:plate:standard:12.5:2500x1200').detail).toBe('5 plaques + 5 %');
    expect(by('cloisons:screw25')).toMatchObject({ group: 'consumable', unit: 'box', quantity: 1 });
    expect(by('cloisons:jointCompound').unit).toBe('bag');
    expect(lines.every((l) => l.module === 'cloisons' && l.unitPrice === null)).toBe(true);
    expect(by('cloisons:rail:48').label).toBe('Rail R48 — barre de 3 m');
  });

  it('un prix saisi dans le projet remplace le prix vide', () => {
    const d = reduce(data, priceAction('cloisons:rail:48', 4.2));
    expect(shopping(result, d).find((l) => l.key === 'cloisons:rail:48')!.unitPrice).toBe(4.2);
  });

  it('résumé', () => {
    expect(summary(result)).toEqual({ text: '1 cloison, 6 plaques', alerts: 0 });
  });

  it('un système sans lignes d’isolant : isolant ajouté, une ligne', () => {
    const insulated = specOf(
      project([cloison('c1', [2000, 0], [2000, 3000])], {
        data: {
          ...data,
          partitions: {
            c1: {
              ...createCloisonsData().partitions,
              system: null,
              height: null,
              spacing: 600,
              plates: { a: 'standard', b: 'standard' },
              insulation: { kind: 'rock-wool' },
              reinforcement: { ends: 'double', jambs: 'double', junctions: 'double', woodInsert: false },
            },
          },
        },
      }),
    );
    const lines = shopping(computeCloisons(insulated), data);
    expect(lines.find((l) => l.key === 'cloisons:insulation:rock-wool')).toMatchObject({ unit: 'roll', quantity: 2 });
  });

  it('système personnalisé de la bibliothèque', () => {
    const custom = createSystem('mine', 0, { name: '72/48 maison' });
    const r = toSpec(project([cloison('c1', [2000, 0], [2000, 3000])]), { systems: [custom] });
    if ('errors' in r) throw new Error('attendu : une entrée');
    expect(r.spec.partitions[0]!.system).toBe('mine');
  });
});

describe('toSpec : hauteur propre du plan (N3)', () => {
  it('la hauteur de la cloison du plan est celle du module, y compris pour un muret sans faces', () => {
    // traverse la pièce : séparée en deux, hauteur du plan
    const full = specOf(project([cloison('c1', [2000, 0], [2000, 3000], { height: 900 })]));
    expect(full.partitions[0]!.height).toBe(900);
    // muret qui ne traverse pas : un obstacle, mais toujours chiffré, à sa hauteur
    const low = specOf(project([cloison('c1', [2000, 0], [2000, 1500], { height: 900 })]));
    expect(low.partitions).toHaveLength(1);
    expect(low.partitions[0]!.height).toBe(900);
    expect(low.partitions[0]!.length).toBeCloseTo(1500, 0);
  });

  it('sans hauteur dans le plan : l’ancien réglage du module, puis les pièces voisines', () => {
    const p = project([cloison('c1', [2000, 0], [2000, 3000])]);
    expect(specOf(p).partitions[0]!.height).toBe(2500);
    const data = create() as CloisonsData;
    data.partitions.c1 = { ...defaultPartitionSettings(), height: 1800 };
    expect(specOf(project([cloison('c1', [2000, 0], [2000, 3000])], { data })).partitions[0]!.height).toBe(1800);
    // le plan l'emporte sur l'ancien réglage
    expect(
      specOf(project([cloison('c1', [2000, 0], [2000, 3000], { height: 900 })], { data })).partitions[0]!.height,
    ).toBe(900);
  });
});
