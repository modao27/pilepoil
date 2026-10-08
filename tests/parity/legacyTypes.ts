/** Types legacy pour la parité ; le format lui-même est dans src/storage/legacy/format.ts. */
import type { LegacyFold, LegacyOpening, LegacyRoom, LegacySurface, LegacyZone } from '../../src/storage/legacy/format';

export type { LegacyProject, LegacySurface, LegacyZone } from '../../src/storage/legacy/format';

/** Projet partiel accepté par `applyState` (les valeurs manquantes prennent les défauts legacy). */
export interface LegacyInput {
  surfaces: (Partial<Omit<LegacySurface, 'zones' | 'res' | 'folds'>> & {
    zones?: Partial<LegacyZone>[];
    res?: Partial<LegacyOpening>[];
    folds?: Partial<LegacyFold>[];
    name?: string;
  })[];
  active: 0;
  room?: LegacyRoom | null;
}

export interface ParityConfig {
  name: string;
  project: LegacyInput;
  /** Lance aussi l'optimiseur sur ces zones de la surface 0 avec cet objectif. */
  optimize?: { goal: 'thin' | 'tiles' | 'bal' | 'sym'; zones: number[] };
}
