/**
 * Données de la peinture dans un projet (`project.modules.peinture`, docs/peinture/SPEC.md §2). Les murs peints
 * sont les zones des poses du projet (docs/NAVIGATION.md §4) ; le module garde les réglages de chaque pose.
 */
import { defaultPoseSettings } from '../core/defaults';
import type { PaintPoseSettings } from '../core/types';

type Id = string;

export const PEINTURE_ID = 'peinture';
/** 1 : réglages par pose, prix au niveau du module. 2 : teinte choisie dans la pose (murs et boiseries). */
export const PEINTURE_SCHEMA = 2;

/** Migrations des données : migrations[n] passe de n − 1 à n. */
export const PEINTURE_MIGRATIONS: Record<number, (doc: unknown) => unknown> = {
  2: (doc) => {
    type Pose = Record<string, unknown> & { woodwork: Record<string, unknown> };
    const d = doc as { poses: Record<string, Pose> } & Record<string, unknown>;
    const poses = Object.fromEntries(
      Object.entries(d.poses).map(([id, p]) => [
        id,
        { ...p, color: p.color ?? null, woodwork: { ...p.woodwork, color: p.woodwork.color ?? null } },
      ]),
    );
    return { ...d, poses };
  },
};

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
