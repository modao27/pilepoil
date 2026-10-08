/** Enregistrement différé : regroupe les modifications rapprochées en une seule écriture. */
export interface Saver<T> {
  schedule(value: T): void;
  /** Écrit tout de suite la dernière valeur en attente (fermeture de page, changement de projet). */
  flush(): Promise<void>;
}

export const SAVE_DELAY_MS = 300;

export function createSaver<T>(
  write: (value: T) => Promise<void>,
  delay = SAVE_DELAY_MS,
  onError: (e: unknown) => void = () => {},
): Saver<T> {
  let pending: { value: T } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  const run = () => {
    timer = null;
    const p = pending;
    pending = null;
    if (p) chain = chain.then(() => write(p.value)).catch(onError);
    return chain;
  };
  return {
    schedule(value) {
      pending = { value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delay);
    },
    flush() {
      if (timer) clearTimeout(timer);
      return run();
    },
  };
}
