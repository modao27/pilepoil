/** Historique annuler / rétablir, immuable. */

export const HISTORY_LIMIT = 100;
/** Délai sous lequel deux modifications d'un même geste fusionnent. */
export const COALESCE_MS = 800;

export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
  /** Geste en cours (clé et heure de la dernière modification). */
  last: { key: string; at: number } | null;
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], last: null };
}

/**
 * Enregistre un nouvel état. Même `key` qu'à l'étape précédente et moins de COALESCE_MS d'écart :
 * l'étape est remplacée (un glissement ou une saisie = une seule étape).
 */
export function record<T>(h: History<T>, next: T, key: string | null, now: number): History<T> {
  if (next === h.present) return h;
  const merge = key != null && h.last?.key === key && now - h.last.at < COALESCE_MS && h.past.length > 0;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], last: key != null ? { key, at: now } : null };
}

export function undo<T>(h: History<T>): History<T> {
  const prev = h.past[h.past.length - 1];
  if (prev === undefined) return h;
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], last: null };
}

export function redo<T>(h: History<T>): History<T> {
  const next = h.future[0];
  if (next === undefined) return h;
  return { past: [...h.past, h.present], present: next, future: h.future.slice(1), last: null };
}
