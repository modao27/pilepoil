/** Motifs du carrelage : types partagés (core/patterns), spécialisés par la liste des motifs du carrelage. */
import type { PatternModule as SharedPattern } from '../../../../core/patterns/types';
import type { PatternId } from '../types';

export { collector, ICON_FRAME, rectGeo, type Cell, type PatternGeo } from '../../../../core/patterns/types';
export type PatternModule = SharedPattern<PatternId>;
