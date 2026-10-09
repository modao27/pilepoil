import type { PatternId } from '../types';
import { basket } from './basket';
import { chevron } from '../../../../core/patterns/chevron';
import { grid } from './grid';
import { half } from './half';
import { herring } from '../../../../core/patterns/herring';
import { hex } from './hex';
import { octo } from './octo';
import { quarter } from './quarter';
import { rand } from './rand';
import { third } from './third';
import type { PatternModule } from './types';

/** Motifs dans l'ordre d'affichage. Ajouter un motif : un fichier + une ligne ici. */
export const PATTERNS: readonly PatternModule[] = [
  grid,
  half,
  third,
  quarter,
  rand,
  herring,
  chevron,
  basket,
  hex,
  octo,
];

const byId = new Map<PatternId, PatternModule>(PATTERNS.map((p) => [p.id, p]));

/** Motif inconnu → droit, comme legacy. */
export function pattern(id: PatternId): PatternModule {
  return byId.get(id) ?? grid;
}
