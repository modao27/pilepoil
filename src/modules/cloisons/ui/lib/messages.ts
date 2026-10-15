/** Textes des alertes du moteur des cloisons (codes de core/compute.ts) : ce qui ne va pas, puis comment corriger. */
import type { Alert } from '../../core/types';

const NOTICE = ' Vérifier la notice du fabricant.';
const fr = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : String(v);

export function alertText(a: Alert): string {
  const p = a.params ?? {};
  switch (a.code) {
    case 'no-system':
      return 'Aucun système de cloison : ajoutez-en un dans la bibliothèque, puis choisissez-le.';
    case 'system-missing':
      return 'Le système de cette cloison n’est plus dans la bibliothèque : choisissez-en un autre.';
    case 'system-thickness-mismatch':
      return 'L’ossature et les plaques du système ne font pas son épaisseur. Corrigez le système.';
    case 'height-over-max':
      return `Hauteur de ${fr(p.height)} mm : au-dessus du maximum de ${fr(p.max)} mm${p.verified ? '' : ' (valeur à vérifier)'}. Choisissez un système plus fort ou un entraxe de 400.${NOTICE}`;
    case 'height-max-unknown':
      return `Hauteur maximale inconnue pour ${p.system} à ${p.spacing} mm d’entraxe : renseignez-la dans les réglages.${NOTICE}`;
    case 'no-plate-format':
      return `Aucune plaque assez longue pour ${fr(p.height)} mm. Ajoutez un format dans les réglages ou réduisez la hauteur.`;
    case 'no-stud-length':
      return `Aucun montant assez long pour ${fr(p.length)} mm. Ajoutez une longueur dans les réglages.`;
    case 'plate-width-spacing':
      return `La plaque de ${fr(p.width)} mm n’est pas un multiple de l’entraxe ${p.spacing} mm : les joints ne tomberont pas sur les montants.`;
    case 'opening-too-tall':
      return 'Une porte est plus haute que la cloison. Réduisez sa hauteur.';
    case 'opening-near-end':
      return 'Une porte est à moins de 10 cm d’un bout : prévoyez un renfort sur place.';
    case 'opening-wide':
      return 'Une baie de plus de 1,20 m : justifiez le linteau.' + NOTICE;
    case 'free-end':
      return 'Un bout de cloison n’a pas d’appui : il sera doublé et protégé par une cornière.';
    case 'short-run':
      return 'Cloison de moins de 30 cm : vérifiez qu’elle est utile.';
    case 'phonic-without-insulation':
      return 'Plaque phonique sans isolant : ajoutez un isolant pour le résultat acoustique.' + NOTICE;
    case 'fire-unchecked':
      return 'Plaque coupe-feu : la performance dépend du système complet.' + NOTICE;
    case 'wet-face-plate':
      return `La face ${String(p.face).toUpperCase()} est carrelée : choisissez une plaque hydrofuge.`;
    case 'joint-at-jamb':
      return 'Un joint de plaque tombe près d’un bord de porte : décalez la porte.';
    case 'joints-aligned':
      return 'Les joints de deux plaques coïncident (décalage corrigé près d’une porte).';
    default:
      return a.code;
  }
}
