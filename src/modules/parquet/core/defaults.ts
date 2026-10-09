/** Valeurs par défaut du parquet (docs/parquet/SPEC.md §2, tableau des règles). Pur. */
import type { BoardKind } from './board';
import type { Accessories, LayingMethod, LayingRules, ParquetSettings, Pattern } from './types';

/**
 * Règles de pose selon le type de lame. Décision proposée (SPEC §2, « à décider avant P1 ») : le type de lame
 * donne les valeurs ; le mode de pose ne change que les alertes (voir `alertsApply`).
 */
export const RULES_BY_KIND: Record<BoardKind, LayingRules> = {
  laminate: {
    expansionGap: 8,
    minCutLength: 300,
    minJointOffset: 300,
    minEdgeRowWidth: 50,
    balanceEdgeRows: 'if-needed',
    maxFloatingLength: 10000,
    maxFloatingWidth: 8000,
    minPassageWidth: 1200,
  },
  vinyl: {
    expansionGap: 8,
    minCutLength: 300,
    minJointOffset: 300,
    minEdgeRowWidth: 50,
    balanceEdgeRows: 'if-needed',
    maxFloatingLength: 10000,
    maxFloatingWidth: 8000,
    minPassageWidth: 1200,
  },
  engineered: {
    expansionGap: 10,
    minCutLength: 300,
    minJointOffset: 300,
    minEdgeRowWidth: 50,
    balanceEdgeRows: 'if-needed',
    maxFloatingLength: 12000,
    maxFloatingWidth: 10000,
    minPassageWidth: 1200,
  },
  solid: {
    expansionGap: 12,
    minCutLength: 250,
    minJointOffset: 200,
    minEdgeRowWidth: 50,
    balanceEdgeRows: 'if-needed',
    // massif collé ou cloué : pas de limite de fractionnement ni de passage
    maxFloatingLength: null,
    maxFloatingWidth: null,
    minPassageWidth: null,
  },
};

/** Mode de pose habituel du type de lame. */
export const METHOD_BY_KIND: Record<BoardKind, LayingMethod> = {
  laminate: 'floating',
  vinyl: 'floating',
  engineered: 'floating',
  solid: 'nailed',
};

/** Les alertes de fractionnement et de passage étroit ne concernent que la pose flottante. */
export const alertsApply = (method: LayingMethod): boolean => method === 'floating';

/** Trait de scie, mm. */
export const KERF = 3;

/** Marge d'achat conseillée, % : 5 droit, 10 diagonale, 12 motifs (bâton rompu, point de Hongrie). */
export function defaultMargin(pattern: Pattern, angle: number): number {
  if (pattern.kind === 'herringbone' || pattern.kind === 'chevron') return 12;
  return ((angle % 90) + 90) % 90 === 0 ? 5 : 10;
}

export const DEFAULT_SETTINGS: ParquetSettings = { reuseOffcuts: true, kerf: KERF, marginPct: null };

export const DEFAULT_ACCESSORIES: Accessories = {
  underlay: { enabled: true, m2PerRoll: 15, overlap: 0.05 },
  vaporBarrier: { enabled: false, m2PerRoll: 25, overlap: 0.1, upstand: 50 },
  skirting: { enabled: true, barLength: 2400, height: 60, mitreAllowance: 10, aroundObstacles: false },
  thresholds: { barLength: 930 },
  glue: null,
  fixings: null,
};

/** Accessoires de fixation selon le mode de pose : colle (m² par seau), clous ou agrafes (par m²). */
export function fixingFor(method: LayingMethod): Pick<Accessories, 'glue' | 'fixings'> {
  if (method === 'glued') return { glue: { m2PerUnit: 12 }, fixings: null };
  if (method === 'nailed') return { glue: null, fixings: { perM2: 25 } };
  return { glue: null, fixings: null };
}

/** Pas des décalages réguliers proposés. */
export const STAGGER_STEPS = [1 / 2, 1 / 3, 1 / 4] as const;
