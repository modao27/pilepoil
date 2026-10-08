<script lang="ts">
  /** Résultats du parquet (#/p/:id/m/parquet/results), P1 : chiffres clés et alertes. Plan, coupes, PDF : P4. */
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import StatCard from '../../../../ui/components/StatCard.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ModuleScreenProps } from '../../../types';
  import type { ParquetResult } from '../../core/types';
  import { PARQUET_ID } from '../../state/model';
  import { parquetData, shopping, toSpec } from '../../state/module';
  import { errorText, warningText } from '../lib/messages';

  let { projectId }: ModuleScreenProps = $props();
  const project = $derived(app.project(projectId));
  let result = $state.raw<ParquetResult | null>(null);
  let failed = $state(false);

  $effect(() => {
    const p = project;
    void app.libraries;
    if (!p || !parquetData(p)) return;
    const r = toSpec(p, app.libraries);
    if ('errors' in r) {
      failed = true;
      return;
    }
    let live = true;
    void app.queued<ParquetResult>(PARQUET_ID, r.spec).then((x) => live && ((result = x), (failed = false)));
    return () => (live = false);
  });

  const lines = $derived(result && project ? shopping(result, parquetData(project)!, app.libraries) : []);
  const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
</script>

<Screen
  title="Résultats — {project?.name ?? 'Parquet'}"
  backHref="#/p/{projectId}/m/parquet"
  backLabel="Retour au parquet"
>
  {#if failed}
    <EmptyState icon="info" title="Rien à calculer" text="Choisissez au moins une pièce du plan dans l’éditeur." />
  {:else if !result}
    <p class="muted" role="status">Calcul…</p>
  {:else}
    <div class="stats">
      <StatCard label="Surface posable" value={fr(result.totals.area, 2)} unit="m²" />
      <StatCard label="Lames utilisées" value={fr(result.totals.boards)} />
      <StatCard label="Paquets" value={fr(lines.reduce((t, l) => t + l.quantity, 0))} />
      <StatCard
        label="Perte"
        value={fr(result.totals.wastePct, 1)}
        unit="%"
        status={result.totals.wastePct > 10 ? 'cut' : undefined}
      />
      <StatCard label="Lames coupées" value={fr(result.totals.cuts)} status="cut" />
    </div>
    {#each lines as l (l.key)}
      <p><strong>{l.label}</strong> : {l.quantity} paquet{l.quantity > 1 ? 's' : ''} — {l.detail}</p>
    {/each}
    {#each result.layouts as lr (lr.id)}
      {#if lr.errors.length || lr.warnings.length}
        <ul class="alerts">
          {#each lr.errors as e, i (i)}<li class="err">{errorText(e)}</li>{/each}
          {#each [...new Set(lr.warnings.map(warningText))] as w (w)}<li>{w}</li>{/each}
        </ul>
      {/if}
    {/each}
    <p class="muted">
      Plan coté, fiche de coupe dans l’ordre de pose et export PDF arrivent avec la prochaine étape du parquet. La liste
      d’achat du projet reprend déjà les paquets de lames : <a href="#/p/{projectId}/achats">voir les achats</a>.
    </p>
  {/if}
</Screen>

<style>
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .muted {
    color: var(--muted);
  }
  .alerts {
    padding-left: var(--space-5);
  }
  .err {
    color: var(--thin);
    font-weight: 600;
  }
</style>
