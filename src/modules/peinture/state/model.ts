/**
 * Données de la peinture dans un projet (`project.modules.peinture`, docs/peinture/SPEC.md §2). Les murs peints
 * sont les zones des poses du projet (docs/NAVIGATION.md §4) ; le module garde les réglages de chaque pose.
 */
import { defaultPoseSettings } from '../core/defaults';
import type { PaintPoseSettings } from '../core/types';

type Id = string;

export const PEINTURE_ID = 'peinture';
/** 1 : réglages par pose, prix au niveau du module. */
export const PEINTURE_SCHEMA = 1;

export interface PeintureData {
  /** Réglages de chaque pose de peinture du projet, par identifiant de pose. */
  poses: Record<Id, PaintPoseSettings>;
  /** Prix saisis dans le projet, par clé de ligne d'achat (`peinture:<produit>:<rôle>:<taille>`…). */
  prices: Record<string, number>;
}

export const createPeintureData = (): PeintureData => ({ poses: {}, prices: {} });

/** Produits proposés par défaut dans une nouvelle pose (modèles types de la bibliothèque). */
export const DEFAULT_FINISH_ID = 'modele-blanc-mat';
export const DEFAULT_WOODWORK_ID = 'modele-boiseries';

export { defaultPoseSettings };
