<script lang="ts">
  /** Vue d'un projet (phase 3) : plan de chaque surface, chiffres clés, commande. L'éditeur vient en phase 4. */
  import type { ProjectResult } from '../../core';
  import { projectArea, projectCost } from '../../state/pricing';
  import Button from '../components/Button.svelte';
  import DataTable from '../components/DataTable.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import PlanPreview from '../components/PlanPreview.svelte';
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import StatCard from '../components/StatCard.svelte';
  import { app } from '../lib/app.svelte';
  import { euros, m2 } from '../lib/format';
  import { errorText, productName, warningText } from '../lib/messages';
  import { go } from '../lib/router.svelte';

  let { id, surfaceId }: { id: string; surfaceId: string | null } = $props();

  const project = $derived(app.project(id));
  let result = $state.raw<ProjectResult | null>(null);
  let mode = $state<'tiles' | 'status'>('tiles');

  $effect(() => {
    const p = project;
    if (!p) return;
    let live = true;
    void app.result(p).then((r) => live && (result = r));
    return () => (live = false);
  });

  const index = $derived(Math.max(0, project?.surfaces.findIndex((s) => s.id === surfaceId) ?? 0));
  const surface = $derived(project?.surfaces[index]);
  const spec = $derived(project ? app.spec(project) : null);
  const sres = $derived(result?.surfaces[index]);
  /** Indice de la première pièce de la surface dans le plan de découpe du projet. */
  const offset = $derived(
    result ? result.surfaces.slice(0, index).reduce((t, s) => t + (s.ok ? s.value.pieces.length : 0), 0) : 0,
  );
  const cost = $derived(project && result ? projectCost(project, app.tiles, result) : null);
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title={project.name} backHref="#/" backLabel="Mes projets" wide>
    <div class="layout">
      <section class="planbox" aria-label="Plan">
        {#if project.surfaces.length > 1}
          <Segmented
            label="Surface"
            value={surface!.id}
            onchange={(sid) => go({ name: 'project', id, surfaceId: sid }, true)}
            options={project.surfaces.map((s) => ({ value: s.id, label: s.name }))}
          />
        {/if}
        <div class="plan">
          {#if sres?.ok && spec}
            <PlanPreview
              surface={spec.surfaces[index]!}
              pieces={sres.value.pieces}
              plan={result!.plan}
              {offset}
              {mode}
              grout={surface!.zones[0]?.groutColor}
              label="Plan de {surface!.name}"
            />
          {:else if sres && !sres.ok}
            <p class="err">{errorText(sres.error)}</p>
          {:else}
            <p class="muted" role="status">Calcul…</p>
          {/if}
        </div>
        <div class="tools">
          <Segmented
            label="Affichage du plan"
            bind:value={mode}
            options={[
              { value: 'tiles', label: 'Rendu' },
              { value: 'status', label: 'Coupes' },
            ]}
          />
          {#if mode === 'status'}
            <ul class="legend" aria-label="Légende">
              <li><span style="background: var(--sheet)"></span>entière</li>
              <li><span style="background: var(--cut)"></span>coupée</li>
              <li><span style="background: var(--reuse)"></span>dans une chute</li>
              <li><span style="background: var(--thin)"></span>coupe fine</li>
            </ul>
          {/if}
        </div>
        {#if sres?.ok && sres.value.warnings.length}
          <ul class="warn">
            {#each sres.value.warnings as w, i (i)}<li>{warningText(w, surface!)}</li>{/each}
          </ul>
        {/if}
      </section>

      {#if result}
        <section class="figs" aria-label="Résumé">
          <div class="stats">
            <StatCard label="À commander" value={result.metrics.order.toLocaleString('fr-FR')} unit="carreaux" />
            <StatCard label="Coupes" value={String(result.metrics.cuts)} status="cut" />
            <StatCard label="Dans les chutes" value={String(result.metrics.reused)} status="reuse" />
            <StatCard
              label="Coupes fines"
              value={String(result.metrics.thin)}
              status={result.metrics.thin ? 'thin' : undefined}
            />
            <StatCard label="Surface" value={m2(projectArea(project)).replace(' m²', '')} unit="m²" />
            <StatCard label="Coût estimé" value={cost && cost.total > 0 ? euros(cost.total) : '–'} />
          </div>
          <h2>Commande</h2>
          <DataTable
            caption="Commande par carreau"
            rows={result.plan.groups.map((g, i) => ({ g, o: result!.orders[i]! }))}
            columns={[
              { key: 'p', label: 'Carreau', cell: (r) => productName(r.g.label) },
              { key: 'posed', label: 'Posés', numeric: true, cell: (r) => String(r.o.posed) },
              { key: 'needed', label: 'Nécessaires', numeric: true, cell: (r) => String(r.o.needed) },
              { key: 'order', label: 'À commander', numeric: true, cell: (r) => String(r.o.order) },
              { key: 'boxes', label: 'Cartons', numeric: true, cell: (r) => (r.o.boxes ? String(r.o.boxes) : '–') },
            ]}
          />
          <p class="muted">Marge de casse {project.settings.margin} % comprise.</p>
        </section>
      {/if}
    </div>
  </Screen>
{/if}

<style>
  .layout {
    display: grid;
    gap: var(--space-4);
  }
  @media (min-width: 900px) {
    .layout {
      grid-template-columns: 3fr 2fr;
      align-items: start;
    }
  }
  section {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .planbox {
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .plan {
    height: clamp(220px, 50dvh, 560px);
    display: grid;
    place-items: center;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-sm);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .legend span {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--field-border);
  }
  .warn {
    margin: 0;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
    border-radius: var(--r-field);
    background: var(--thin-soft);
    font-size: var(--fs-sm);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-2);
  }
  .err {
    color: var(--thin-ink);
    padding: var(--space-4);
  }
  .muted {
    font-size: var(--fs-sm);
  }
</style>
