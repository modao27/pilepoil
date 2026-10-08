/** Textes des erreurs et alertes du moteur : ce qui ne va pas, puis comment corriger. */
import type { ProductLabel, SurfaceError, SurfaceWarning } from '../../core';
import type { Surface } from '../../state/model';

const n = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
const OPENINGS = {
  window: 'Fenêtre',
  door: 'Porte',
  socket: 'Prise',
  trap: 'Trappe',
  tub: 'Baignoire',
  other: 'Réservation',
};

export function errorText(e: SurfaceError): string {
  switch (e.code) {
    case 'invalid-surface':
      return 'Dimensions de la surface ou joint manquants. Indiquez une largeur, une hauteur et un joint positifs.';
    case 'no-zone':
      return 'Aucune zone à carreler. Ajoutez une zone.';
    case 'invalid-tile':
      return `Zone ${e.zone + 1} : carreau sans dimensions ou introuvable. Choisissez un carreau dans la bibliothèque.`;
    case 'too-many-tiles':
      return `Environ ${n(e.estimate, 0)} carreaux : trop pour le calcul. Choisissez un plus grand carreau ou réduisez la surface.`;
  }
}

export function warningText(w: SurfaceWarning, s: Surface): string {
  switch (w.code) {
    case 'zones-overflow':
      return `Les zones dépassent la surface de ${n(w.amount / 10)} cm : la dernière est tronquée. Réduisez une zone.`;
    case 'zones-gap':
      return `${n(w.amount / 10)} cm restent sans carrelage. Passez une zone en « reste de la surface ».`;
    case 'reveal-pattern': {
      const o = s.openings[w.opening];
      return `${o ? OPENINGS[o.type] : 'Ouverture'} ${w.opening + 1} : tableaux non calculés pour ce motif. Choisissez un motif à carreaux rectangulaires.`;
    }
    case 'plinth-pattern':
      return 'Plinthes non calculées : choisissez une zone à carreaux rectangulaires.';
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
