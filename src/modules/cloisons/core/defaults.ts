/** Valeurs par défaut du moteur des cloisons (docs/cloisons/SPEC.md §2). Indicatives : la notice du fabricant fait foi. */
import type {
  CloisonsSettings,
  ConsumableRatios,
  HeightRule,
  PartitionSystem,
  PlateFormat,
  Reinforcement,
} from './types';

export const DEFAULT_REINFORCEMENT: Reinforcement = {
  ends: 'double',
  jambs: 'double',
  junctions: 'double',
  woodInsert: false,
};

export const DEFAULT_PLATE_FORMATS: PlateFormat[] = [
  { length: 2500, width: 1200 },
  { length: 2600, width: 1200 },
  { length: 3000, width: 1200 },
];

export const DEFAULT_STUD_LENGTHS = [2500, 2600, 2700, 3000, 3500, 4000];

export const DEFAULT_RATIOS: ConsumableRatios = {
  screw25: { perM2: 15, pack: 1000 },
  screw35: { perM2: 12, pack: 1000 },
  jointTape: { perM2: 1.5, pack: 150 },
  jointCompound: { kgPerM2: 0.5, pack: 25 },
  resilientStrip: { pack: 30 },
  fixing: { spacing: 600, pack: 100 },
  cornerBead: { pack: 2.5 },
  woodInsert: { pack: 1 },
};

const SOURCE = 'ordre de grandeur, à confirmer : notice du fabricant du système choisi, DTU 25.41';

/** Hauteurs maximales initiales : toutes « à vérifier » (SPEC §2.4). */
export const DEFAULT_HEIGHT_RULES: HeightRule[] = [
  { system: '72/48', spacing: 600, max: 2600, verified: false, source: SOURCE },
  { system: '72/48', spacing: 400, max: 2800, verified: false, source: SOURCE },
  { system: '98/48', spacing: 600, max: 3000, verified: false, source: SOURCE },
  { system: '98/48', spacing: 400, max: 3300, verified: false, source: SOURCE },
  { system: '100/70', spacing: 600, max: 3400, verified: false, source: SOURCE },
  { system: '100/70', spacing: 400, max: 3800, verified: false, source: SOURCE },
];

export function defaultSettings(): CloisonsSettings {
  return {
    maxHeights: DEFAULT_HEIGHT_RULES.map((r) => ({ ...r })),
    plateFormats: DEFAULT_PLATE_FORMATS.map((f) => ({ ...f })),
    studLengths: [...DEFAULT_STUD_LENGTHS],
    railBar: 3000,
    kerf: 0,
    studClearance: 10,
    plateGap: 10,
    lintelBearing: 50,
    studMinGap: 100,
    minOffcut: 150,
    plateMargin: 0.05,
    insulationMargin: 0.05,
    insulationPack: { m2: 6.48, unit: 'roll' },
    ratios: structuredClone(DEFAULT_RATIOS),
  };
}

/** Compositions types ; celle du 100/70 (plaque de 15 mm) est à vérifier sur la notice. */
export const TEMPLATE_SYSTEMS: {
  name: string;
  thickness: number;
  studWidth: number;
  layers: 1 | 2;
  plateThickness: number;
}[] = [
  { name: '72/48', thickness: 72, studWidth: 48, layers: 1, plateThickness: 12.5 },
  { name: '98/48', thickness: 98, studWidth: 48, layers: 2, plateThickness: 12.5 },
  { name: '100/70', thickness: 100, studWidth: 70, layers: 1, plateThickness: 15 },
];

export function createSystem(id: string, now: number, o: Partial<PartitionSystem> = {}): PartitionSystem {
  return {
    schemaVersion: 1,
    id,
    name: '72/48',
    thickness: 72,
    studWidth: 48,
    layers: 1,
    plateThickness: 12.5,
    createdAt: now,
    updatedAt: now,
    ...o,
  };
}
