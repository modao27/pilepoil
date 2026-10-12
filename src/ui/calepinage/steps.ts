/**
 * Étapes du calepinage d'une pose (docs/NAVIGATION.md §6), les mêmes pour tous les revêtements et dans cet ordre.
 * Chaque module y range ses réglages ; la coquille ne connaît que ces étapes.
 */
export type StepId = 'product' | 'pose' | 'cut' | 'finish' | 'advanced';

export const STEPS: readonly { id: StepId; label: string }[] = [
  { id: 'product', label: 'Produit' },
  { id: 'pose', label: 'Pose' },
  { id: 'cut', label: 'Découpage' },
  { id: 'finish', label: 'Finitions' },
  { id: 'advanced', label: 'Avancé' },
];
