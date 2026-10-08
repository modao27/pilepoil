/** Textes de la bibliothèque de lames. */
import type { BoardError, BoardKind } from '../../core/board';

export const KIND_LABEL: Record<BoardKind, string> = {
  solid: 'Massif',
  engineered: 'Contrecollé',
  laminate: 'Stratifié',
  vinyl: 'Vinyle',
};

export const PROFILE_LABEL = { click: 'Clic', 'tongue-groove': 'Rainure et languette' } as const;

export const BOARD_ERRORS: Record<BoardError, string> = {
  'name/empty': 'Donnez un nom à la lame.',
  'lengths/empty': 'Indiquez au moins une longueur.',
  'lengths/invalid': 'Chaque longueur doit être positive.',
  'mix/count': 'Indiquez une proportion pour chaque longueur.',
  'mix/sum': 'Les proportions des longueurs doivent faire 100 %.',
  'width/invalid': 'Indiquez la largeur utile, hors languette.',
  'thickness/invalid': 'Indiquez l’épaisseur.',
  'pack/boards': 'Le nombre de lames par paquet doit être un entier, au moins 1.',
};
