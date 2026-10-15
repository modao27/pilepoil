/**
 * Cas de référence du moteur des cloisons (docs/cloisons/SPEC.md §7). Chaque chiffre est calculé à la main dans le
 * commentaire du test avant d'être comparé au moteur.
 */
import { describe, expect, it } from 'vitest';
import { computeCloisons } from '../../src/modules/cloisons/core/compute';
import { door, part, spec } from './cloisonsHelpers';

const sheets = (r: ReturnType<typeof computeCloisons>, type: string) =>
  r.totals.plates.find((l) => l.type === type)?.sheets ?? {};
const count = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const codes = (r: ReturnType<typeof computeCloisons>) => r.alerts.map((a) => a.code).sort();

describe('R1 : 3 m mur à mur, 72/48, entraxe 600, sans ouverture', () => {
  /*
   * Montant plein : 2 500 − 10 = 2 490, barre de 2 500. Plaque : 2 500 − 10 = 2 490 de haut, format 2 500 × 1 200.
   * Rails : 2 × 3 000 = 6 000 mm → 2 barres de 3 000.
   * Montants : trame 600, 1 200, 1 800, 2 400 (3 000 est l'extrémité) = 4 ; extrémités 2 × 2 = 4 → 8, 8 barres.
   * Plaques : face a (décalage 0) 1 200 / 1 200 / 600 ; face b (décalage 600) 600 / 1 200 / 1 200.
   *   quatre 1 200 = 4 feuilles ; un 600 coupe une 5e feuille (reste 600 × 2 500) qui sert à l'autre 600 → 5.
   *   marge 5 % : ⌈5,25⌉ = 6.
   * Surface : 3,0 × 2,49 = 7,47 m² par face → 14,94 m².
   */
  const r = computeCloisons(spec([part('p1')], { plateMargin: 0 }));

  it('rails et montants', () => {
    expect(r.partitions[0]!.ok).toBe(true);
    expect(r.totals.rails['48']!.bars).toHaveLength(2);
    expect(r.partitions[0]!.studs).toHaveLength(8);
    expect(r.totals.studs['48:2500']!.bars).toHaveLength(8);
    expect(r.partitions[0]!.studs.map((s) => s.role).sort()).toEqual([
      'end',
      'end',
      'grid',
      'grid',
      'grid',
      'grid',
      'start',
      'start',
    ]);
  });

  it('plaques : 5 feuilles, 6 avec la marge de 5 %', () => {
    expect(sheets(r, 'standard')).toEqual({ '2500x1200': 5 });
    const withMargin = computeCloisons(spec([part('p1')]));
    expect(withMargin.totals.plates[0]!.purchased).toEqual({ '2500x1200': 6 });
  });

  it('surface posée : 7,47 m² par face', () => {
    const area = (f: string) =>
      r.partitions[0]!.plates.filter((p) => p.face === f).reduce((a, p) => a + p.area, 0) / 1e6;
    expect(area('a')).toBeCloseTo(7.47, 6);
    expect(area('b')).toBeCloseTo(7.47, 6);
  });

  it('consommables aux ratios par défaut', () => {
    const line = (k: string) => r.totals.consumables.find((c) => c.key === k)!;
    // 15 × 14,94 = 224,1 → 225 vis, une boîte de 1 000
    expect(line('screw25')).toMatchObject({ need: 225, packs: 1 });
    // 1,5 × 14,94 = 22,41 m, un rouleau de 150 m
    expect(line('jointTape').need).toBeCloseTo(22.41, 6);
    expect(line('jointTape').packs).toBe(1);
    // 0,5 × 14,94 = 7,47 kg, un sac de 25 kg
    expect(line('jointCompound').need).toBeCloseTo(7.47, 6);
    // 6 000 + 2 × 2 490 = 10 980 mm, un rouleau de 30 m
    expect(line('resilientStrip').need).toBeCloseTo(10.98, 6);
    // 2 rails × (⌈3 000 / 600⌉ + 1 = 6) + 2 montants de départ × (⌈2 490 / 600⌉ + 1 = 6) = 24
    expect(line('fixing')).toMatchObject({ need: 24, packs: 1 });
    expect(r.totals.consumables.find((c) => c.key === 'screw35')).toBeUndefined();
  });

  it('aucune alerte', () => {
    expect(codes(r)).toEqual([]);
  });
});

describe('R2 : R1 avec entraxe 400', () => {
  /*
   * Trame 400, 800, 1 200, 1 600, 2 000, 2 400, 2 800 = 7 ; extrémités 4 → 11 montants.
   * Face a 1 200 / 1 200 / 600 ; face b (décalage 400) 400 / 1 200 / 1 200 / 200.
   * Quatre 1 200 = 4 feuilles ; le 600 coupe une 5e (reste 600 × 2 500) ; le 400 y prend (reste 200 ≥ 150) ;
   * le 200 prend ce reste → 5 feuilles.
   */
  const r = computeCloisons(spec([part('p1', { spacing: 400 })], { plateMargin: 0 }));

  it('11 montants, 5 feuilles', () => {
    expect(r.partitions[0]!.studs).toHaveLength(11);
    expect(sheets(r, 'standard')).toEqual({ '2500x1200': 5 });
  });
});

describe('R3 : 4 m avec une porte de 830 × 2 040 à 1 000', () => {
  /*
   * Baie de 1 000 à 1 830. Rails : haut 4 000 ; bas 1 000 + 2 170 ; linteau 830 + 2 × 50 = 930. Total 8 100 → 3 barres.
   * Montants : trame 600 … 3 600. 1 800 est à 30 mm du bord de baie : supprimé ; 1 200 est dans la baie : montant
   *   court de 2 490 − 2 040 = 450. Pleins : 600, 2 400, 3 000, 3 600 = 4 ; baie 2 × 2 = 4 ; extrémités 4 → 12 + 1 court.
   *   Le court (450) n'entre pas dans le reste de 10 mm d'une barre de 2 500 : 13 barres.
   * Plaques : face a (décalage 0) joints 1 200, 2 400, 3 600 → 1 200 (L) / 1 200 (L) / 1 200 / 400.
   *   Face b (décalage 600) : joints 600, 1 800, 3 000 ; 1 800 est à 30 mm de 1 830 → décalage 0, mêmes colonnes.
   *   Six 1 200 = 6 feuilles ; un 400 coupe la 7e (reste 800 × 2 500), l'autre 400 y prend → 7 feuilles.
   */
  const r = computeCloisons(spec([part('p1', { length: 4000, openings: [door(1000)] })], { plateMargin: 0 }));

  it('rails : 3 barres', () => {
    const rails = r.partitions[0]!.rails;
    expect(rails.map((x) => [x.kind, x.length])).toEqual([
      ['top', 4000],
      ['bottom', 1000],
      ['bottom', 2170],
      ['lintel', 930],
    ]);
    expect(r.totals.rails['48']!.bars).toHaveLength(3);
  });

  it('montants : 12 pleins et un court de 450', () => {
    const studs = r.partitions[0]!.studs;
    expect(studs).toHaveLength(13);
    expect(studs.filter((s) => s.role === 'cripple').map((s) => [s.x, s.length])).toEqual([[1200, 450]]);
    expect(studs.filter((s) => s.role === 'jamb').map((s) => s.x)).toEqual([1000, 1000, 1830, 1830]);
    expect(studs.some((s) => s.x === 1800)).toBe(false);
    expect(r.totals.studs['48:2500']!.bars).toHaveLength(13);
  });

  it('plaques : le joint à 1 800 est corrigé, 7 feuilles', () => {
    expect(r.partitions[0]!.offsets).toEqual([
      { face: 'a', layer: 1, offset: 0 },
      { face: 'b', layer: 1, offset: 0 },
    ]);
    expect(sheets(r, 'standard')).toEqual({ '2500x1200': 7 });
    expect(codes(r)).toEqual(['joints-aligned']);
  });
});

describe('R4 : deux cloisons, liaison en T', () => {
  /*
   * P1 : 4 m mur à mur, une cloison s'arrête sur elle à 2 000. Trame 600 … 3 600 (6) + extrémités 4 + liaison doublée 2 = 12.
   * P2 : 2 m du mur à la face de P1. Trame 600, 1 200, 1 800 (3) + extrémités 4 = 7. Total 19.
   * Rails : P1 4 000 + 4 000 = 3 000 + 1 000 + 3 000 + 1 000 ; P2 2 000 + 2 000 → 12 000 mm → 4 barres.
   */
  const r = computeCloisons(
    spec([part('p1', { length: 4000, junctions: [2000] }), part('p2', { length: 2000, end: 'partition-t' })]),
  );

  it('19 montants, 4 barres de rail', () => {
    expect(r.partitions.map((p) => p.studs.length)).toEqual([12, 7]);
    expect(r.totals.rails['48']!.bars).toHaveLength(4);
  });
});

describe('R5 : 98/48, deux couches, face a hydrofuge, face b standard, isolant', () => {
  /*
   * Décalages : (a, 1) 0 ; (a, 2) 600 ; (b, 1) 600 ; (b, 2) 0. Montants et rails comme R1 : 8 et 2 barres.
   * Hydrofuge (face a) : 1 200 / 1 200 / 600 et 600 / 1 200 / 1 200 → quatre 1 200 = 4 feuilles, un 600 coupe une 5e
   *   dont la chute sert à l'autre 600 → 5. Standard (face b) : idem, 5.
   * Isolant : 3,0 × 2,5 = 7,5 m² × 1,05 = 7,875 → ⌈7,875 / 6,48⌉ = 2 rouleaux.
   * Vis : 25 mm sur les couches 1 (14,94 m²) : 15 × 14,94 = 224,1 → 225 ; 35 mm sur les couches 2 : 12 × 14,94 = 179,28 → 180.
   */
  const r = computeCloisons(
    spec([part('p1', { system: 's98', plates: { a: 'hydro', b: 'standard' }, insulation: { kind: 'glass-wool' } })], {
      plateMargin: 0,
    }),
  );

  it('décalages, montants, rails', () => {
    expect(r.partitions[0]!.offsets.map((o) => [o.face, o.layer, o.offset])).toEqual([
      ['a', 1, 0],
      ['a', 2, 600],
      ['b', 1, 600],
      ['b', 2, 0],
    ]);
    expect(r.partitions[0]!.studs).toHaveLength(8);
    expect(r.totals.rails['48']!.bars).toHaveLength(2);
  });

  it('5 feuilles hydrofuges et 5 standard, 2 rouleaux d’isolant', () => {
    expect(sheets(r, 'hydro')).toEqual({ '2500x1200': 5 });
    expect(sheets(r, 'standard')).toEqual({ '2500x1200': 5 });
    expect(r.totals.insulation['glass-wool']!.packs).toBe(2);
    expect(r.totals.insulation['glass-wool']!.area).toBeCloseTo(7.5, 6);
  });

  it('vis des deux longueurs', () => {
    const line = (k: string) => r.totals.consumables.find((c) => c.key === k)!;
    expect(line('screw25').need).toBe(225);
    expect(line('screw35').need).toBe(180);
  });

  it('aucune alerte de joints', () => {
    expect(codes(r)).toEqual([]);
  });
});

describe('R6 : R1 plus haut', () => {
  it('2,80 m : alerte hauteur, barre de 3 000, plaques 3 000 × 1 200', () => {
    /* Montant 2 790 → barre de 3 000 ; plaque 2 790 → format 3 000 × 1 200 ; quantités de R1. */
    const r = computeCloisons(spec([part('p1', { height: 2800 })], { plateMargin: 0 }));
    expect(codes(r)).toEqual(['height-over-max']);
    expect(r.totals.studs['48:3000']!.bars).toHaveLength(8);
    expect(r.totals.rails['48']!.bars).toHaveLength(2);
    expect(sheets(r, 'standard')).toEqual({ '3000x1200': 5 });
  });

  it('3,20 m : aucune plaque assez longue, cloison exclue des totaux', () => {
    const good = computeCloisons(spec([part('g')]));
    const r = computeCloisons(spec([part('g'), part('p1', { height: 3200 })]));
    expect(r.partitions[1]).toMatchObject({ ok: false, studs: [], plates: [] });
    expect(codes(r)).toContain('no-plate-format');
    expect(r.totals).toEqual(good.totals);
  });
});

describe('alertes', () => {
  it('système inconnu, faces carrelées, plaques particulières, bout libre', () => {
    const r = computeCloisons(
      spec([
        part('a', { system: 'inconnu' }),
        part('b', { tiledFaces: ['a'], plates: { a: 'standard', b: 'phonic' }, end: 'free' }),
        part('c', { plates: { a: 'fire', b: 'hydro' }, tiledFaces: ['b'] }),
      ]),
    );
    expect(r.partitions[0]).toMatchObject({ ok: false });
    expect(computeCloisons(spec([part('a', { system: '' })])).alerts.map((a) => a.code)).toEqual(['no-system']);
    expect(codes(r)).toEqual(
      ['fire-unchecked', 'free-end', 'phonic-without-insulation', 'system-missing', 'wet-face-plate'].sort(),
    );
  });

  it('hauteur absente de la table', () => {
    const r = computeCloisons(spec([part('p1')], { maxHeights: [] }));
    expect(codes(r)).toEqual(['height-max-unknown']);
  });

  it('baie près d’un bout, trop large, trop haute', () => {
    const r = computeCloisons(spec([part('p1', { length: 4000, openings: [door(50, 1300, 2600)] })]));
    expect(codes(r)).toEqual(expect.arrayContaining(['opening-near-end', 'opening-too-tall', 'opening-wide']));
  });

  it('déterminisme : même entrée, même JSON', () => {
    const s = spec([part('p1', { length: 4000, openings: [door(1000)] }), part('p2', { end: 'partition-t' })]);
    expect(JSON.stringify(computeCloisons(s))).toBe(JSON.stringify(computeCloisons(s)));
    expect(count(sheets(computeCloisons(s), 'standard'))).toBeGreaterThan(0);
  });
});
