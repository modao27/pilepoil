/** Import d'une fiche produit (#/import) : choix de la bibliothèque et favori « Envoyer à PilePoil ». */
import { describe, expect, it } from 'vitest';
import { libraries } from '../../src/modules/registry';
import { bookmarklet } from '../../src/ui/lib/bookmarklet';
import { rankLibraries } from '../../src/ui/lib/importSheet';

const ids = (text: string) => rankLibraries(text, libraries).map((d) => d.id);

describe('bibliothèque désignée par la fiche', () => {
  it('carreau, lame, peinture ; les bibliothèques sans lecture de fiche sont écartées', () => {
    expect(ids('Carrelage sol effet béton\nContenance de la boîte (en m²)\t1,08')[0]).toBe('tiles');
    expect(ids('Sol stratifié chêne clair\nNombre de lames ou dalles dans le pack\t9')[0]).toBe('boards');
    expect(ids('Peinture mur velours blanc 10L\nAspect\tVelours')[0]).toBe('paints');
    expect(ids('Peinture mur')).not.toContain('systems');
  });

  it('sans indice : ordre du registre', () => {
    expect(ids('Produit')).toEqual(['tiles', 'boards', 'paints']);
  });
});

describe('favori', () => {
  it('adresse javascript: dont le code est valide et vise l’application', () => {
    const url = bookmarklet('https://exemple.test/pilepoil/');
    expect(url.startsWith('javascript:')).toBe(true);
    const code = decodeURIComponent(url.slice('javascript:'.length));
    expect(code).toContain('"https://exemple.test/pilepoil/"+\'#/import/\'');
    expect(code).not.toContain('\n');
    expect(() => new Function(code)).not.toThrow();
  });
});
