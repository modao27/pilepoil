/**
 * Annulation proposée après coup (bouton « Annuler » d'un message) : elle n'est sûre que si le changement
 * annoncé est encore le dernier état connu du projet. Sinon, annuler défairait autre chose ou réécrirait un
 * état plus ancien que ce qui a été modifié depuis (dans le même éditeur ou sur un autre écran).
 */

/** Version d'un projet : identifiant et date de modification. */
export interface Version {
  id: string;
  updatedAt: number;
}

/** Version la plus récente parmi celles connues (éditeur ouvert, projet enregistré). */
export function latest<V extends Version>(...versions: (V | undefined | null)[]): V | undefined {
  let best: V | undefined;
  for (const v of versions) if (v && (!best || v.updatedAt > best.updatedAt)) best = v;
  return best;
}

/** Le changement qui a produit `after` peut être annulé : rien n'a été modifié depuis. */
export function canUndo(after: Version, current: Version | undefined): boolean {
  return !!current && current.id === after.id && current.updatedAt === after.updatedAt;
}
