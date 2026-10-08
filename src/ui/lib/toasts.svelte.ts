/** File de messages courts (Toast), avec action facultative (« Annuler »). */
export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

let next = 1;
export const toasts = $state<ToastItem[]>([]);

export function dismiss(id: number): void {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

export function toast(
  message: string,
  opts: { action?: ToastItem['action']; tone?: ToastItem['tone']; timeout?: number } = {},
): number {
  const id = next++;
  toasts.push({ id, message, tone: opts.tone ?? 'info', action: opts.action });
  if (toasts.length > 3) toasts.shift();
  setTimeout(() => dismiss(id), opts.timeout ?? (opts.action ? 6000 : 4000));
  return id;
}
