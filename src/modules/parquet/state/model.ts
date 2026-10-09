/**
 * Données du parquet dans un projet (`project.modules.parquet`, docs/parquet/SPEC.md §2) et valeurs
 * initiales. Unités : mm, degrés.
 */
import type { Point, Segment } from '../../../core/geometry/types';
import type { Plan } from '../../../core/plan/types';
import { BOARD_TEMPLATES } from '../core/board';
import { DEFAULT_ACCESSORIES, DEFAULT_SETTINGS, METHOD_BY_KIND, RULES_BY_KIND } from '../core/defaults';
import type { Accessories, LayingMethod, LayingRules, ParquetSettings, Pattern } from '../core/types';

type Id = string;

export const PARQUET_ID = 'parquet';
export const PARQUET_SCHEMA = 1;

export interface ParquetData {
  /** Une pose par groupe de pièces posées en continu. */
  layouts: Layout[];
  settings: ParquetSettings;
  accessories: Accessories;
  /** Prix unitaires par clé de ligne d'achat (`parquet:board:<id>`…). */
  prices: Record<string, number>;
  /** Suivi chantier : pièces posées, valable pour une empreinte de calcul donnée (P5). */
  worksite: { resultHash: string; done: string[] } | null;
}

export interface Layout {
  id: Id;
  name: string;
  /** Pièces du plan couvertes par cette pose (continuité entre elles via les passages). */
  rooms: Id[];
  /** Lame de la bibliothèque. */
  boardId: Id;
  pattern: Pattern;
  /** Degrés ; 0 = lames parallèles au mur de référence. */
  angle: number;
  /** null = plus long mur de la première pièce. */
  reference: { room: Id; wall: Id } | null;
  /** Motifs à axe : position de l'axe (P2). */
  axis: 'room-center' | 'main-door' | { point: Point };
  /** Décalage manuel de l'origine du motif (glisser sur le plan). */
  offset: Point;
  method: LayingMethod;
  rules: LayingRules;
  /** Seuils posés par l'utilisateur (fractionnement), segments dans le repère du plan. */
  breaks: Segment[];
  seed: number;
}

/** Lame proposée par défaut : le stratifié des modèles types (s'il a été supprimé, l'éditeur en demande une). */
export const DEFAULT_BOARD_ID = BOARD_TEMPLATES[0]!.id;

export function createLayout(id: Id, rooms: Id[], o: Partial<Layout> = {}): Layout {
  const kind = BOARD_TEMPLATES[0]!.kind;
  return {
    id,
    name: 'Pose 1',
    rooms,
    boardId: DEFAULT_BOARD_ID,
    pattern: { kind: 'random-stagger' },
    angle: 0,
    reference: null,
    axis: 'room-center',
    offset: [0, 0],
    method: METHOD_BY_KIND[kind],
    rules: { ...RULES_BY_KIND[kind] },
    breaks: [],
    seed: 1,
    ...o,
  };
}

/** Données initiales quand on active le parquet : une pose sur la première pièce du plan (s'il y en a une). */
export function createParquetData(plan: Plan, newId: () => Id): ParquetData {
  const first = plan.rooms[0];
  return {
    layouts: first ? [createLayout(newId(), [first.id])] : [],
    settings: { ...DEFAULT_SETTINGS },
    accessories: structuredClone(DEFAULT_ACCESSORIES),
    prices: {},
    worksite: null,
  };
}
