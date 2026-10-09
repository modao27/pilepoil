/** Textes des alertes et erreurs du moteur du parquet : ce qui ne va pas, puis comment corriger. */
import type { ParquetError, ParquetWarning } from '../../core/types';

const mm = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} mm`;

export function warningText(w: ParquetWarning): string {
  switch (w.code) {
    case 'edge-row-narrow':
      return `Un rang de bord ne fait que ${mm(w.width)}. Cochez « Rangs de bord de même largeur » ou décalez la pose.`;
    case 'cut-too-short':
      return `Une pièce ne fait que ${mm(w.length)}, sous la coupe mini. Décalez la pose ou acceptez cette coupe.`;
    case 'joint-offset':
      return `Rang ${w.row + 1} : des joints ne sont qu’à ${mm(w.offset)} de ceux du rang précédent. Décalez la pose.`;
    case 'fractioning-needed':
      return `Surface de ${mm(w.length)} × ${mm(w.width)} : trop grande pour une pose flottante d’un seul tenant. Prévoyez un seuil.`;
    case 'narrow-passage':
      return `Passage de ${mm(w.width)} seulement : un seuil est conseillé.`;
    case 'tiny-piece':
      return 'Une pièce est très petite. Décalez la pose pour l’éviter.';
    case 'layout-overlap':
      return 'Cette pose recouvre une autre pose. Retirez la pièce commune de l’une des deux, ou séparez-les.';
  }
}

export function errorText(e: ParquetError): string {
  switch (e.code) {
    case 'invalid-room':
      return 'Une pièce du plan a un contour incorrect. Corrigez-la dans le plan.';
    case 'missing-board':
      return 'La lame choisie n’est plus dans la bibliothèque. Choisissez une lame.';
    case 'board-too-short-for-rules':
      return 'La lame est trop courte pour la coupe mini et le décalage mini des joints. Réduisez ces règles ou changez de lame.';
    case 'too-many-pieces':
      return `Trop de pièces à calculer (environ ${e.estimate.toLocaleString('fr-FR')}). Choisissez moins de pièces ou une lame plus grande.`;
  }
}
