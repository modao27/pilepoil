/**
 * Modèles types des bibliothèques : chaque modèle est posé une seule fois, repéré par son identifiant. Un modèle
 * supprimé ne revient pas ; un modèle ajouté par une mise à jour apparaît. Pur.
 *
 * Avant la phase B1, seule la bibliothèque était notée (`librarySeeded`) : ses modèles d'alors, tous préfixés
 * `modele-`, comptent comme posés. Les modèles ajoutés depuis portent un autre préfixe (`lm-`, `type-`).
 */

/** Préfixe des modèles posés avant B1. */
export const LEGACY_TEMPLATE_PREFIX = 'modele-';

export interface SeedState {
  /** Bibliothèques amorcées avant B1 (préférence `librarySeeded`). */
  legacy: readonly string[];
  /** Modèles posés, `<bibliothèque>:<modèle>` (préférence `templatesSeeded`). */
  seeded: readonly string[];
}

/** Modèles à poser maintenant et nouvel état des modèles posés. */
export function templatesToSeed(
  libraryId: string,
  templateIds: readonly string[],
  state: SeedState,
): { pose: string[]; seeded: string[] } {
  const key = (id: string) => `${libraryId}:${id}`;
  const seeded = new Set(state.seeded);
  const known = state.seeded.some((k) => k.startsWith(libraryId + ':'));
  if (!known && state.legacy.includes(libraryId))
    for (const id of templateIds) if (id.startsWith(LEGACY_TEMPLATE_PREFIX)) seeded.add(key(id));
  const pose = templateIds.filter((id) => !seeded.has(key(id)));
  for (const id of pose) seeded.add(key(id));
  return { pose, seeded: [...seeded] };
}
