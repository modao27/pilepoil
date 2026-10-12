<script lang="ts" module>
  import { icons } from '../icons';

  /** Icônes de l'identité PilePoil (src/ui/icons.ts), appelées par leur nom dans l'application. */
  const BRAND = {
    back: 'retour',
    close: 'fermer',
    plus: 'ajouter',
    check: 'valider',
    undo: 'annuler',
    redo: 'retablir',
    menu: 'menu',
    trash: 'supprimer',
    edit: 'modifier',
    tiles: 'carrelage',
    settings: 'parametres',
    photo: 'photo',
    download: 'telecharger',
    warn: 'alerte',
    info: 'info',
    share: 'partager',
    plan: 'plan',
    shopping: 'achats',
    library: 'bibliotheque',
    view3d: 'vue-3d',
    magnet: 'aimant',
    success: 'succes',
    documents: 'documents',
  } as const satisfies Record<string, keyof typeof icons>;

  /** Icônes sans équivalent dans l'identité : même grille 24 × 24, même trait. */
  const EXTRA = {
    forward: 'M9 5l7 7-7 7',
    minus: 'M5 12h14',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    copy: 'M8 8h11v11H8zM5 16V5h11',
    home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
    upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
    drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    wall: 'M4 4h16v16H4zM4 9h16M4 14h16M10 4v5M15 9v5M10 14v6',
    floor: 'M3 17l9-5 9 5-9 5zM3 17V9l9-5 9 5v8',
    room: 'M3 8l9-5 9 5v10l-9 5-9-5zM12 13v10M3 8l9 5 9-5',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  } as const;

  export type IconName = keyof typeof BRAND | keyof typeof EXTRA;

  /** Contenu SVG (grille 24 × 24) d'une icône. */
  export function iconMarkup(name: IconName): string {
    return name in BRAND
      ? icons[BRAND[name as keyof typeof BRAND]]
      : `<path d="${EXTRA[name as keyof typeof EXTRA]}"/>`;
  }
</script>

<script lang="ts">
  let { name, size = 24, label }: { name: IconName; size?: number; label?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.75"
  stroke-linecap="round"
  stroke-linejoin="round"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
  focusable="false"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- tracés fixes de l'application -->
  {@html iconMarkup(name)}
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
