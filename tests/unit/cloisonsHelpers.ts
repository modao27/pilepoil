/** Entrées de test du moteur des cloisons. */
import { defaultSettings, createSystem, DEFAULT_REINFORCEMENT } from '../../src/modules/cloisons/core/defaults';
import type {
  CloisonsSettings,
  CloisonsSpec,
  PartitionSystem,
  SpecPartition,
} from '../../src/modules/cloisons/core/types';

export const S72: PartitionSystem = createSystem('s72', 0, { name: '72/48' });
export const S98: PartitionSystem = createSystem('s98', 0, {
  name: '98/48',
  thickness: 98,
  layers: 2,
});

/** Cloison de 3 m mur à mur, 2,50 m de haut, 72/48, entraxe 600, sans ouverture ; `o` remplace les champs. */
export function part(id: string, o: Partial<SpecPartition> = {}): SpecPartition {
  return {
    id,
    name: id,
    system: 's72',
    length: 3000,
    height: 2500,
    spacing: 600,
    plates: { a: 'standard', b: 'standard' },
    insulation: null,
    reinforcement: { ...DEFAULT_REINFORCEMENT },
    start: 'wall',
    end: 'wall',
    junctions: [],
    openings: [],
    tiledFaces: [],
    ...o,
  };
}

export function spec(
  partitions: SpecPartition[],
  settings: Partial<CloisonsSettings> = {},
  systems: PartitionSystem[] = [S72, S98],
): CloisonsSpec {
  return {
    partitions,
    systems: Object.fromEntries(systems.map((s) => [s.id, s])),
    settings: { ...defaultSettings(), ...settings },
    demolishedArea: 0,
  };
}

export const door = (offset: number, width = 830, height = 2040, id = 'd1') => ({
  id,
  kind: 'door' as const,
  offset,
  width,
  height,
});
