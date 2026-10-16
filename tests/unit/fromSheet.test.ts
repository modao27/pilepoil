/**
 * Formulaires pré-remplis d'après une fiche produit collée. Fiches écrites à la main (produits fictifs), dans les
 * mises en forme rencontrées : tableau copié, « libellé : valeur », libellé puis valeur à la ligne.
 */
import { describe, expect, it } from 'vitest';
import { tileFromSheet } from '../../src/modules/carrelage/state/fromSheet';
import { packMismatch, BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { boardFromSheet } from '../../src/modules/parquet/core/fromSheet';
import { paintFromSheet } from '../../src/modules/peinture/core/fromSheet';

const tab = (rows: [string, string][]) => rows.map(([a, b]) => `${a}\t${b}`).join('\n');

describe('carreau', () => {
  it('tableau de caractéristiques : dimensions en cm, épaisseur en mm, m² par boîte, prix au carton', () => {
    const r = tileFromSheet(
      'Carrelage sol effet pierre Exemplo l.30 x L.60 cm\n' +
        tab([
          ['Nombre de carreaux dans la boîte', '8'],
          ['Largeur de joint conseillée (en mm)', '3'],
          ['Epaisseur (en mm)', '8,5'],
          ['Longueur (en cm)', '60'],
          ['Largeur (en cm)', '30'],
          ['Couleur', 'Gris clair'],
          ['Forme', 'Rectangulaire'],
          ['Contenance de la boîte (en m²)', '1,44'],
          ['Prix', '28,80 € / carton'],
        ]),
    );
    expect(r.fields).toMatchObject({
      name: 'Carrelage sol effet pierre Exemplo l.30 x L.60 cm',
      length: 600,
      width: 300,
      thickness: 8.5,
      m2PerBox: 1.44,
      pricePerM2: 20,
      color: '#a8a7a3',
    });
    expect(r.read).not.toContain('shape');
  });

  it('format seul dans le titre, côtés remis dans l’ordre, hexagone', () => {
    const r = tileFromSheet('Tomette hexagonale 20 x 20 cm\nÉpaisseur : 10 mm\nForme : Hexagonale');
    expect(r.fields).toMatchObject({ shape: 'hex', length: 200, width: 200, thickness: 10 });
    expect(tileFromSheet('Faïence 30 x 10 cm').fields).toMatchObject({ length: 300, width: 100 });
  });

  it('texte sans rapport : rien de lu', () => {
    expect(tileFromSheet('Bonjour').read).toEqual([]);
  });
});

describe('lame', () => {
  it('stratifié : épaisseur totale plutôt que couche d’usure, paquet, clipsable', () => {
    const r = boardFromSheet(
      [
        'Sol stratifié Exemplo chêne clair, Ép.8 mm',
        'Longueur (en cm)',
        '128,5',
        'Largeur (en cm)',
        '19,2',
        "Epaisseur de la couche d'usure (en mm)",
        '0,2',
        'Epaisseur totale (en mm)',
        '8',
        'Nombre de lames ou dalles dans le pack',
        '9',
        'Contenance de la boîte (en m²)',
        '2,22',
        'Pose',
        'Clipsable',
      ].join('\n'),
    );
    expect(r.fields).toMatchObject({
      kind: 'laminate',
      lengths: [1285],
      width: 192,
      thickness: 8,
      boardsPerPack: 9,
      m2PerPack: 2.22,
      profile: 'click',
    });
  });

  it('nombre de lames déduit de la surface du paquet ; bâton rompu en lames A/B', () => {
    const r = boardFromSheet(
      'Parquet contrecollé chêne bâton rompu Exemplo\n' +
        tab([
          ['Type de bois', 'Contrecollé'],
          ['Longueur (en cm)', '60'],
          ['Largeur (en cm)', '12'],
          ['Epaisseur totale (en mm)', '14'],
          ['Contenance de la boîte (en m²)', '1,728'],
          ['Prix', '45 € / m²'],
        ]),
    );
    expect(r.fields).toMatchObject({ kind: 'engineered', boardsPerPack: 24, handed: true, profile: 'tongue-groove' });
    expect(r.fields.pricePerPack).toBeCloseTo(77.76);
    const b = { ...BOARD_TEMPLATES[0]!, ...r.fields };
    expect(packMismatch(b)).toBe(false);
  });

  it('vinyle reconnu au type de produit', () => {
    expect(boardFromSheet('Lame clipsable Exemplo\nMatière principale : PVC').fields.kind).toBe('vinyl');
  });
});

describe('peinture', () => {
  it('finition : aspect, teinte, contenance, rendement prudent, usages', () => {
    const r = paintFromSheet(
      'Peinture mur et plafond Exemplo velours blanc 10L\n' +
        tab([
          ['Nom de la teinte', 'Blanc'],
          ['Aspect', 'Velours'],
          ['Capacité (en L)', '10'],
          ['Destination', 'Mur | Plafond | Boiserie'],
          ['Pièce de destination', 'Toutes pièces | Salle de bains'],
          ['Rendement (en m²/l)', '10 à 12'],
          ['Marque du produit', 'EXEMPLO'],
          ['Prix', '59,90 €'],
        ]),
    );
    expect(r.fields).toMatchObject({
      role: 'finish',
      brand: 'EXEMPLO',
      sheen: 'velvet',
      color: { name: 'Blanc', hex: '#f2f0eb' },
      uses: ['walls', 'woodwork', 'humid'],
      yield: 10,
      packs: [{ size: 10, price: 59.9 }],
    });
  });

  it('sous-couche et enduit reconnus au nom ; contenance prise dans le nom seulement avec son unité', () => {
    const primer = paintFromSheet('Sous-couche universelle Exemplo 2,5L');
    expect(primer.fields).toMatchObject({ role: 'primer', packs: [{ size: 2.5, price: null }] });
    expect(primer.read).not.toContain('sheen');
    expect(paintFromSheet('Enduit de lissage Exemplo 15 kg').fields).toMatchObject({
      role: 'filler',
      packs: [{ size: 15 }],
    });
    expect(paintFromSheet('Peinture Exemplo 163 Faubourg satin').fields.packs).toBeUndefined();
  });
});
