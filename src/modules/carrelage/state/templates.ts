/**
 * Carreaux types posés une fois dans la bibliothèque (comme les lames, peintures et systèmes) : génériques, sans
 * marque, prix vides, à dupliquer et ajuster. Léger : chargé avec le manifeste du module.
 */
import { TILE_SCHEMA, type Tile } from './model';

const T0 = Date.UTC(2026, 9, 15);

type TemplateFields = Pick<Tile, 'name' | 'length' | 'width' | 'thickness' | 'color' | 'm2PerBox'> &
  Partial<Pick<Tile, 'shape' | 'orientation'>>;

function template(id: string, t: TemplateFields): Tile {
  return {
    schemaVersion: TILE_SCHEMA,
    id: 'modele-' + id,
    shape: 'rect',
    orientation: 'free',
    photoId: null,
    pricePerM2: null,
    createdAt: T0,
    updatedAt: T0,
    ...t,
  };
}

export const TILE_TEMPLATES: readonly Tile[] = [
  template('gres-60x60', {
    name: 'Grès cérame 60 × 60 cm',
    length: 600,
    width: 600,
    thickness: 9,
    color: '#cfc8bd',
    m2PerBox: 1.44,
  }),
  template('gres-60x30', {
    name: 'Grès cérame 60 × 30 cm',
    length: 600,
    width: 300,
    thickness: 9,
    color: '#d8cfc2',
    m2PerBox: 1.44,
  }),
  template('faience-20x20', {
    name: 'Faïence murale 20 × 20 cm',
    length: 200,
    width: 200,
    thickness: 7,
    color: '#eeebe5',
    m2PerBox: 1,
  }),
  template('metro-20x10', {
    name: 'Carreau métro 20 × 10 cm',
    length: 200,
    width: 100,
    thickness: 7,
    color: '#f4f2ee',
    m2PerBox: 0.5,
  }),
];
