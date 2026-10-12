/** Modules de la boîte à outils, dans l'ordre d'affichage (docs/BOITE.md §2). */
import { module as carrelage } from './carrelage/index';
import { module as parquet } from './parquet/index';
import type { LibraryDefinition, ModuleId, ModuleLogic, ModuleManifest, ToolModule } from './types';

const manifests = [carrelage, parquet] as readonly ModuleManifest[];

const notLoaded = (id: ModuleId) => () => {
  throw new Error(`Module ${id} : logique pas encore chargée (loadModules).`);
};

/** Outils proposés dans les projets ; leur logique arrive avec `loadModules()`. */
export const modules: readonly ToolModule[] = manifests.map((m) => {
  const missing = notLoaded(m.id);
  return {
    ...m,
    create: missing,
    createPose: missing,
    reduce: missing,
    toSpec: missing,
    shopping: missing,
    priceAction: missing,
    summary: missing,
  } as ToolModule;
});

let loading: Promise<void> | null = null;
let loaded = false;

/** Charge la logique de tous les modules (une fois) ; à attendre avant d'ouvrir un projet. */
export function loadModules(): Promise<void> {
  loading ??= Promise.all(
    manifests.map(async (m, i) => Object.assign(modules[i]!, (await m.logic()) as ModuleLogic)),
  ).then(() => {
    loaded = true;
  });
  return loading;
}

/** La logique des modules est-elle chargée ? */
export const modulesLoaded = (): boolean => loaded;

export function moduleById(id: ModuleId): ToolModule | undefined {
  return modules.find((m) => m.id === id);
}

/** Bibliothèques de produits des modules, dans l'ordre des onglets. */
export const libraries: readonly LibraryDefinition[] = modules.flatMap((m) => (m.library ? [m.library] : []));

export function libraryById(id: string): LibraryDefinition | undefined {
  return libraries.find((l) => l.id === id);
}
