<script lang="ts">
  /** Détail des cloisons sur l'écran Résultats : cloisons de la portée, quantités du projet (rails, montants, plaques…). */
  import type { ResultSectionProps } from '../../../types';
  import type { CloisonsResult } from '../../core/types';
  import { PLATE_LABEL, shopping } from '../../state/module';
  import { cloisonsData, partitionRooms } from '../../state/spec';
  import { scopedPartitions } from '../lib/results';

  let { project, scope, result }: ResultSectionProps = $props();

  const r = $derived(result as CloisonsResult);
  const parts = $derived(scopedPartitions(project, r, scope));
  const data = $derived(cloisonsData(project));
  const lines = $derived(data ? shopping(r, data) : []);
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  const title = (id: string) => `Cloison ${project.site.partitions.findIndex((q) => q.id === id) + 1}`;
</script>

{#if parts.length}
  <h3>Par cloison</h3>
  <ul class="parts">
    {#each parts as p (p.id)}
      <li>
        <a href="#/p/{project.id}/m/cloisons/c/{p.id}">{title(p.id)} · {partitionRooms(project, p.id).join(' / ')}</a>
        <span class="muted"
          >{p.ok ? `${p.studs.length} montants, ${p.plates.length} pièces de plaque` : 'À corriger'}</span
        >
      </li>
    {/each}
  </ul>
{/if}

<h3>À commander pour tout le projet</h3>
<table>
  <thead><tr><th>Article</th><th class="r">Quantité</th><th>Détail</th></tr></thead>
  <tbody>
    {#each lines as l (l.key)}
      <tr><td>{l.label}</td><td class="r num">{l.quantity}</td><td class="muted">{l.detail ?? ''}</td></tr>
    {/each}
  </tbody>
</table>

{#each r.totals.plates as lot (lot.type + lot.thickness)}
  {#if lot.offcuts.length}
    <p class="muted">
      Chutes de plaque {PLATE_LABEL[lot.type]} gardées : {lot.offcuts
        .map(([w, h]) => `${fr(w / 10)} × ${fr(h / 10)} cm`)
        .join(', ')}.
    </p>
  {/if}
{/each}
{#if r.totals.demolishedArea > 0}
  <p class="muted">Surface de mur démolie : {fr(r.totals.demolishedArea, 2)} m² (information, non chiffrée).</p>
{/if}
<p class="muted">Vérifier la notice du fabricant.</p>

<style>
  /* cible tactile de 44 px */
  a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
  h3 {
    margin: var(--space-3) 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .parts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .parts li {
    display: grid;
    gap: 2px;
  }
  .muted {
    margin: var(--space-2) 0 0;
    color: var(--muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: var(--space-2);
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  .r {
    text-align: right;
  }
</style>
