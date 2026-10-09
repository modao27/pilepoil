/** Textes des erreurs et alertes du moteur : ce qui ne va pas, puis comment corriger. */
import type { ProductLabel, SurfaceError, SurfaceWarning } from '../../core';
import type { Surface } from '../../state/model';
import type { CoverageError } from '../../../../core/coverage';

const n = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
const OPENINGS = {
  window: 'Fenêtre',
  door: 'Porte',
  socket: 'Prise',
  trap: 'Trappe',
  tub: 'Baignoire',
  other: 'Réservation',
};

/** Refus d'une zone ou d'une pose (règles du projet, docs/NAVIGATION.md §4). */
export function coverageText(e: CoverageError): string {
  switch (e.code) {
    case 'surface-missing':
      return 'Cette surface n’existe plus dans le plan.';
    case 'surface-unsupported':
      return 'Ce revêtement ne se pose pas sur ce type de surface.';
    case 'zone-empty':
      return 'La zone est vide : vérifiez les cotes.';
    case 'zone-overlap':
      return 'Cette surface a déjà un autre revêtement. Retirez-le d’abord ; le partage en zones arrive avec l’écran Pièce.';
    case 'pose-mixed':
      return 'Une même pose ne couvre pas à la fois un sol et un mur.';
    case 'pose-extent':
      return 'Cette pose ne peut pas s’étendre à cette surface.';
  }
}

export function errorText(e: SurfaceError): string {
  switch (e.code) {
    case 'invalid-surface':
      return 'Dimensions de la surface ou joint manquants. Indiquez une largeur, une hauteur et un joint positifs.';
    case 'no-zone':
      return 'Aucune bande à carreler. Ajoutez une bande.';
    case 'invalid-tile':
      return `Bande ${e.zone + 1} : carreau sans dimensions ou introuvable. Choisissez un carreau dans la bibliothèque.`;
    case 'too-many-tiles':
      return `Environ ${n(e.estimate, 0)} carreaux : trop pour le calcul. Choisissez un plus grand carreau ou réduisez la surface.`;
  }
}

export function warningText(w: SurfaceWarning, s: Surface): string {
  switch (w.code) {
    case 'zones-overflow':
      return `Les bandes dépassent la surface de ${n(w.amount / 10)} cm : la dernière est tronquée. Réduisez une bande.`;
    case 'zones-gap':
      return `${n(w.amount / 10)} cm restent sans carrelage. Passez une bande en « reste de la surface ».`;
    case 'reveal-pattern': {
      const o = s.openings[w.opening];
      return `${o ? OPENINGS[o.type] : 'Ouverture'} ${w.opening + 1} : tableaux non calculés pour ce motif. Choisissez un motif à carreaux rectangulaires.`;
    }
    case 'plinth-pattern':
      return 'Plinthes non calculées : choisissez une bande à carreaux rectangulaires.';
    case 'plinth-too-high':
      return 'Plinthes trop hautes pour le carreau. Réduisez leur hauteur.';
  }
}

/** « 60 × 30 cm », « Hexagone 20 cm », « Cabochon 7,3 cm »… */
export function productName(l: ProductLabel): string {
  const cm = (v: number) => n(v / 10);
  switch (l.shape) {
    case 'hex':
      return `Hexagone ${cm(l.size[0])} cm`;
    case 'octo':
      return `Octogone ${cm(l.size[0])} cm`;
    case 'cab':
      return `Cabochon ${cm(l.size[0])} cm`;
    case 'chevron':
      return `Lame Hongrie ${cm(l.size[0])} × ${cm(l.size[1])} cm`;
    default:
      return `${cm(l.size[0])} × ${cm(l.size[1])} cm`;
  }
}
