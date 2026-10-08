/** Listes des bibliothèques de produits : triées par nom (ordre français), un élément par identifiant. */
import type { LibraryItem } from '../../modules/types';

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Ajoute ou remplace `item` (même id) ; renvoie une liste neuve triée par nom. */
export function upsertItem<T extends LibraryItem>(list: readonly T[], item: T): T[] {
  return [...list.filter((x) => x.id !== item.id), item].sort((a, b) => collator.compare(a.name, b.name));
}
