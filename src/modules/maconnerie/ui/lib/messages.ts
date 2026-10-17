/** Textes des alertes et des erreurs de la maçonnerie : ce qui ne va pas, puis comment corriger. */
import type { MasonryAlert } from '../../core/types';

const fr = (v: unknown, d = 1) =>
  typeof v === 'number' ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }) : String(v ?? '');

export const NOTICE = 'Valeurs données à titre indicatif (estimation) : vérifiez la notice du fabricant.';

export const SPEC_ERRORS: Record<string, string> = {
  'maconnerie/no-wall': 'Aucun mur de maçonnerie : ajoutez-en un.',
  'maconnerie/no-material': 'Un mur n’a pas de matériau : choisissez-en un dans la bibliothèque.',
  'maconnerie/size': 'Un mur n’a pas de longueur ou de hauteur : saisissez ses dimensions.',
  'maconnerie/zone-material': 'Une zone n’a pas de matériau : choisissez-en un.',
  'maconnerie/zone-size': 'Une zone n’a pas de largeur ou de hauteur : saisissez ses dimensions.',
};

export function alertText(a: MasonryAlert): string {
  const p = a.params ?? {};
  switch (a.code) {
    case 'glass-not-cuttable':
      return `Les briques de verre ne se coupent pas : la bordure dépasse 10 cm. Prévoyez une ouverture de ${fr((p.width ?? 0) / 10)} × ${fr((p.height ?? 0) / 10)} cm (${p.cols} × ${p.rows} briques).`;
    case 'panel-area-exceeds-max':
      return `Panneau de ${fr(p.area)} m² : au-dessus de ${fr(p.max)} m² pour cette épaisseur. Coupez-le en deux panneaux.`;
    case 'joint-out-of-range':
      return `Joint de ${fr(p.joint)} mm : hors de la plage ${fr(p.min)} à ${fr(p.max)} mm du matériau.`;
    case 'binder-unknown':
      return 'Consommation de liant inconnue pour ce matériau : complétez sa fiche dans la bibliothèque.';
    case 'zone-outside':
      return 'Une zone dépasse du mur : rapprochez-la ou réduisez-la.';
    case 'zone-overlap':
      return 'Deux zones se chevauchent : déplacez l’une d’elles.';
    case 'zone-on-opening':
      return 'Une zone empiète sur une porte ou une baie : déplacez-la.';
    case 'too-small':
      return `Mur trop petit pour une brique de ${fr((p.length ?? 0) / 10)} × ${fr((p.height ?? 0) / 10)} cm et sa bordure.`;
  }
}
