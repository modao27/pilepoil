/**
 * Fiche produit reçue du favori « Envoyer à PilePoil » (#/import) : bibliothèques qui savent la lire et celle que
 * le texte désigne le plus (`LibraryDefinition.importHint`). Pur.
 */
import { normalizeLabel } from '../../core/sheet';
import type { LibraryDefinition } from '../../modules/types';

type Importable = Pick<LibraryDefinition, 'id' | 'importHint'>;

/** Bibliothèques qui acceptent une fiche, de la plus probable à la moins probable (ordre du registre à égalité). */
export function rankLibraries<T extends Importable>(text: string, defs: readonly T[]): T[] {
  const t = normalizeLabel(text);
  const score = (d: T) => (d.importHint ? (t.match(d.importHint)?.length ?? 0) : 0);
  return defs
    .filter((d) => d.importHint)
    .map((d, i) => ({ d, i, s: score(d) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.d);
}
