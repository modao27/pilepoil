/** Ligne de la liste d'achat consolidée du projet (docs/BOITE.md §7). Types seuls en S1, branchés en S3. */

export type ShoppingGroup = 'covering' | 'underlay' | 'finish' | 'consumable' | 'tool';

export type ShoppingUnit =
  'pack' | 'box' | 'roll' | 'bar' | 'bag' | 'sachet' | 'tube' | 'cartridge' | 'litre' | 'piece' | 'm2' | 'm';

export interface ShoppingLine {
  /** Identifiant du module qui produit la ligne. */
  module: string;
  /** Unique dans le module, stable (sert de clé de prix). */
  key: string;
  group: ShoppingGroup;
  /** « Stratifié chêne 1285 × 192 ». */
  label: string;
  /** En unité de vente. */
  quantity: number;
  unit: ShoppingUnit;
  /** « 49 lames + 5 % ». */
  detail?: string;
  unitPrice: number | null;
}
