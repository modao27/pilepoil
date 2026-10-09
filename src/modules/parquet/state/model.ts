/**
 * Données du parquet dans un projet (`project.modules.parquet`, docs/parquet/SPEC.md §2) et valeurs
 * initiales. Les pièces couvertes sont les zones des poses du projet (docs/NAVIGATION.md §4) ; le module garde
 * les réglages de chaque pose. Unités : mm, degrés.
 */
import type { Point, Segment } from '../../../core/geometry/types';
import type { Zone } from '../../../core/coverage/types';
import { BOARD_TEMPLATES, type Board } from '../core/board';
import { DEFAULT_ACCESSORIES, DEFAULT_SETTINGS, METHOD_BY_KIND, RULES_BY_KIND } from '../core/defaults';
import type { Accessories, AxisKind, LayingMethod, LayingRules, ParquetSettings, Pattern } from '../core/types';

type Id = string;

export const PARQUET_ID = 'parquet';
/** 4 : réglages par pose, pièces données par les zones du projet. */
export const PARQUET_SCHEMA = 4;

export interface ParquetData {
  /** Réglages de chaque pose de parquet du projet, par identifiant de pose. */
  poses: Record<Id, ParquetPose>;
  settings: ParquetSettings;
  accessories: Accessories;
  /** Prix unitaires par clé de ligne d'achat (`parquet:board:<id>`…). */
  prices: Record<string, number>;
  /** Suivi chantier : pièces posées, valable pour une empreinte de calcul donnée (P5). */
  worksite: { resultHash: string; done: string[] } | null;
}

/** Réglages d'une pose. */
export interface ParquetPose {
  /** Lame de la bibliothèque. */
  boardId: Id;
  pattern: Pattern;
  /** Degrés ; 0 = lames parallèles au mur de référence. */
  angle: number;
  /** null = plus long mur de la première pièce. */
  reference: { room: Id; wall: Id } | null;
  /** Motifs à axe : une des trois propositions du moteur, ou un point du plan. */
  axis: AxisKind | { point: Point };
  /** Décalage manuel de l'origine du motif (glisser sur le plan). */
  offset: Point;
  method: LayingMethod;
  rules: LayingRules;
  /** Seuils posés par l'utilisateur (fractionnement), segments dans le repère du plan. */
  breaks: Segment[];
  seed: number;
}

/** Pose vue par l'éditeur et les résultats : réglages, nom et zones de sol du projet, pièces dans l'ordre du plan. */
export interface Layout extends ParquetPose {
  id: Id;
  name: string;
  rooms: Id[];
  zones: Zone[];
}

/** Lame proposée par défaut : le stratifié des modèles types (s'il a été supprimé, l'éditeur en demande une). */
export const DEFAULT_BOARD_ID = BOARD_TEMPLATES[0]!.id;

/** Réglages d'une pose ; mode de pose et règles du type de la lame. */
export function createPoseSettings(o: Partial<ParquetPose> = {}, board?: Pick<Board, 'kind'>): ParquetPose {
  const kind = board?.kind ?? BOARD_TEMPLATES[0]!.kind;
  return {
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

/** Données initiales quand on active le parquet : aucune pose (elles naissent des zones). */
export function createParquetData(): ParquetData {
  return {
    poses: {},
    settings: { ...DEFAULT_SETTINGS },
    accessories: structuredClone(DEFAULT_ACCESSORIES),
    prices: {},
    worksite: null,
  };
}
