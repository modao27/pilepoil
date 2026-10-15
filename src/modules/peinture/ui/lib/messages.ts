/** Textes de la peinture : bibliothèque, alertes du moteur, erreurs du calcul. */
import type { PaintError } from '../../core/paint';
import type { PaintAlert, PaintRole, PaintSheen, Support, SupportState, Tint } from '../../core/types';

export const ROLE_LABEL: Record<PaintRole, string> = { finish: 'Finition', primer: 'Apprêt', filler: 'Enduit' };

export const SHEEN_LABEL: Record<PaintSheen, string> = { mat: 'Mat', satin: 'Satiné', gloss: 'Brillant' };

export const TINT_LABEL: Record<Tint, string> = { light: 'Claire', medium: 'Moyenne', dark: 'Foncée' };

export const SUPPORT_LABEL: Record<Support, string> = {
  painted: 'Ancien peint',
  plaster: 'Plâtre ou placo neuf',
  concrete: 'Béton ou crépi',
};

export const STATE_LABEL: Record<SupportState, string> = {
  good: 'Bon état',
  average: 'À reboucher',
  poor: 'À reprendre',
};

export const PAINT_ERRORS: Record<PaintError, string> = {
  'name/empty': 'Donnez un nom à la peinture.',
  'yield/invalid': 'Indiquez le rendement (m² par litre et par couche).',
  'coats/invalid': 'Indiquez le nombre de couches conseillé, au moins 1.',
  'packs/empty': 'Ajoutez au moins un pot.',
  'packs/invalid': 'Chaque pot doit avoir une contenance positive et un prix positif ou vide.',
};

export function alertText(a: PaintAlert): string {
  const woodwork = a.target === 'woodwork' ? ' (boiseries)' : '';
  switch (a.code) {
    case 'no-product':
      return `Choisissez une peinture de finition${woodwork}.`;
    case 'product-missing':
      return `${ROLE_LABEL[a.role ?? 'finish']} introuvable dans la bibliothèque${woodwork} : choisissez-en un autre.`;
    case 'missing-yield':
      return `Une peinture n’a pas de rendement${woodwork} : renseignez-le dans la bibliothèque.`;
    case 'no-pack':
      return `Une peinture n’a pas de pot${woodwork} : ajoutez ses contenances dans la bibliothèque.`;
    case 'no-surface':
      return 'Aucune surface à peindre : ajoutez un mur à la pose.';
    case 'dark-tint-coat':
      return 'Teinte foncée sur un ancien mur peint : prévoyez une couche de plus.';
    case 'primer-missing':
      return 'Support neuf ou poreux : une sous-couche est conseillée.';
    case 'product-use-mismatch':
      return `Cette peinture n’est pas prévue pour cet usage${woodwork}.`;
    case 'opening-overlap':
      return 'Des ouvertures se recouvrent : leur surface n’est déduite qu’une fois.';
  }
}

/** Erreurs bloquantes de `toSpec` (module, projet). */
export const SPEC_ERRORS: Record<string, string> = {
  'peinture/absent': 'La peinture n’est pas activée dans ce projet.',
  'peinture/no-wall': 'Aucun mur à peindre : ajoutez un mur à une pose de peinture.',
};
