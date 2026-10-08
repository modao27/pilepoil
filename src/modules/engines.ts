/** Moteurs des modules, par identifiant : seul fichier des modules importé par le worker (docs/BOITE.md §6). */
import { engine as carrelage } from './carrelage/engine';
import { engine as parquet } from './parquet/engine';
import type { ModuleEngine, ModuleId } from './types';

/** Entrées et résultats circulent sans type à travers postMessage ; chaque module type les siens. */
export type AnyEngine = ModuleEngine<unknown, unknown>;

export const engines: Readonly<Record<ModuleId, AnyEngine>> = { carrelage, parquet };
