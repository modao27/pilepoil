<script lang="ts">
  /** Détail de la peinture sur l'écran Résultats : produits et pots de chaque pose (PE3 : par portée). */
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ResultSectionProps } from '../../../types';
  import type { Paint } from '../../core/paint';
  import type { PeintureResult } from '../../core/types';

  let { result }: ResultSectionProps = $props();

  const poses = $derived((result as PeintureResult).poses);
  const name = (id: string) => ((app.libraries.paints ?? []) as readonly Paint[]).find((p) => p.id === id)?.name ?? id;
  const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
</script>

{#each poses as p (p.id)}
  {#if p.result.products.length}
    <ul class="products">
      {#each p.result.products as x (x.key)}
        <li>
          {name(x.paint)} : {fr(x.need / 1000)}
          {x.role === 'filler' ? 'kg' : 'L'} sur {fr(x.surface)} m²
        </li>
      {/each}
    </ul>
  {/if}
{/each}

<style>
  .products {
    margin: 0;
    padding-left: var(--space-5);
  }
</style>
