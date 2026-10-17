<script lang="ts">
  /** Détail de la maçonnerie sur l'écran Résultats : totaux par matériau. */
  import type { ResultSectionProps } from '../../../types';
  import type { MaconnerieResult } from '../../core/types';
  import { NOTICE } from '../lib/messages';

  let { result, scope }: ResultSectionProps = $props();
  const r = $derived(result as MaconnerieResult);
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const line = (t: MaconnerieResult['totals'][number]) =>
    [
      `${t.purchased} à acheter (${t.elements} posés)`,
      t.binderKg != null ? `${fr(t.binderKg)} kg de liant` : null,
      t.weightKg != null ? `${fr(t.weightKg / 1000, 2)} t` : null,
    ]
      .filter(Boolean)
      .join(' · ');
</script>

{#if scope.kind === 'project' && r.totals.length}
  <ul class="totals">
    {#each r.totals as t (t.material)}
      <li>
        <span class="name">{t.name}</span>
        <span class="muted num">{line(t)}</span>
      </li>
    {/each}
  </ul>
  <p class="muted">{NOTICE}</p>
{/if}

<style>
  .totals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  li {
    display: grid;
    gap: 2px;
  }
  .name {
    font-weight: 600;
  }
  .muted {
    margin: 0;
    color: var(--muted);
    font-size: var(--fs-sm);
  }
</style>
