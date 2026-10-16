/** Lecture de fiches produit collées (src/core/sheet) : formats de lignes, nombres français, unités. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  dimensionsMm,
  findValue,
  lengthMm,
  lowestNumber,
  normalizeLabel,
  numbers,
  parseSheet,
  price,
  productName,
  volume,
} from '../../src/core/sheet';

describe('paires libellé / valeur', () => {
  it('tableau copié (tabulations), deux-points, libellé puis valeur à la ligne', () => {
    const s = parseSheet(
      [
        'Carreau Exemple 30 x 60 cm',
        'Épaisseur (en mm)\t9,5',
        'Contenance de la boîte (en m²) : 1,44',
        'Couleur',
        'Gris clair',
      ].join('\n'),
    );
    expect(s.title).toBe('Carreau Exemple 30 x 60 cm');
    expect(findValue(s, /^epaisseur/)).toBe('9,5');
    expect(findValue(s, /^contenance/)).toBe('1,44');
    expect(findValue(s, /^couleur/)).toBe('Gris clair');
  });

  it('les motifs sont essayés dans l’ordre', () => {
    const s = parseSheet('Epaisseur de la couche d’usure (en mm)\t2,5\nEpaisseur totale (en mm)\t14');
    expect(findValue(s, /^epaisseur totale/, /^epaisseur/)).toBe('14');
  });

  it('libellés normalisés : accents, casse, espaces, deux-points final', () => {
    expect(normalizeLabel('  Épaisseur   Totale :')).toBe('epaisseur totale');
  });

  it('texte vide ou sans structure : aucune paire, jamais d’erreur', () => {
    expect(parseSheet('').pairs).toEqual([]);
    fc.assert(
      fc.property(fc.string(), (t) => {
        const s = parseSheet(t);
        return Array.isArray(s.pairs) && typeof s.title === 'string';
      }),
    );
  });
});

describe('nom du produit', () => {
  it('libellé Nom, sinon première ligne ; coupé au dernier mot entier', () => {
    expect(productName(parseSheet('Nom\tCarreau Exemplo\nCouleur\tGris'))).toBe('Carreau Exemplo');
    const long = 'Parquet chêne massif bâton rompu huilé naturel ép. 13 mm l. 85 mm long. 300 mm fabrication française';
    const n = productName(parseSheet(long))!;
    expect(n.length).toBeLessThanOrEqual(60);
    expect(long.startsWith(n)).toBe(true);
    expect(long[n.length]).toBe(' ');
    expect(productName(parseSheet('Bof'))).toBeNull();
  });
});

describe('valeurs', () => {
  it('nombres français : virgule, espaces de milliers', () => {
    expect(numbers('1,44 m² et 1 290 mm')).toEqual([1.44, 1290]);
    expect(lowestNumber('10 à 12')).toBe(10);
  });

  it('longueurs en mm : unité de la valeur, sinon du libellé, sinon par défaut', () => {
    expect(lengthMm('60', 'Longueur (en cm)', 'mm')).toBe(600);
    expect(lengthMm('9,5 mm', 'Epaisseur', 'cm')).toBe(9.5);
    expect(lengthMm('1,2 m', 'Longueur', 'cm')).toBe(1200);
    expect(lengthMm('119.8', 'Longueur', 'cm')).toBe(1198);
    expect(lengthMm('abc', 'Longueur', 'cm')).toBeNull();
  });

  it('dimensions « a x b » en mm', () => {
    expect(dimensionsMm('60 x 120 cm')).toEqual([600, 1200]);
    expect(dimensionsMm('l.31,6 x L.60 cm')).toEqual([316, 600]);
    expect(dimensionsMm('600×600 mm')).toEqual([600, 600]);
    expect(dimensionsMm('Grès')).toBeNull();
  });

  it('contenances et prix', () => {
    expect(volume('2,5 L')).toBe(2.5);
    expect(volume('750 ml')).toBe(0.75);
    expect(volume('15 kg')).toBe(15);
    expect(volume('10')).toBe(10);
    expect(price('22,90 € / m²')).toEqual({ amount: 22.9, per: 'm2' });
    expect(price('34,81 € par carton')).toEqual({ amount: 34.81, per: 'pack' });
    expect(price('12 €')).toEqual({ amount: 12, per: 'unit' });
    expect(price(undefined)).toBeNull();
  });

  it('valeurs toujours finies ou null', () => {
    fc.assert(
      fc.property(fc.string(), (t) => {
        const ok = (n: number | null) => n === null || Number.isFinite(n);
        const d = dimensionsMm(t);
        return ok(lengthMm(t, '', 'mm')) && ok(volume(t)) && (d === null || d.every(Number.isFinite));
      }),
    );
  });
});
