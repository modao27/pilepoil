<script lang="ts">
  /** Écran Projet (#/p/:id) : plan des pièces, outils activés avec leur résumé, ajout d'un outil. */
  import { modules } from '../../modules/registry';
  import type { ModuleSummary, ToolModuleS2 } from '../../modules/types';
  import { reduceProject } from '../../state/project';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import { moduleSummary } from '../lib/summaries';
  import PlanThumb from '../plan/PlanThumb.svelte';

  let { id }: { id: string } = $props();

  const project = $derived(app.project(id));
  const active = $derived(project ? modules.filter((m) => Object.hasOwn(project.modules, m.id)) : []);
  const available = $derived(project ? modules.filter((m) => !Object.hasOwn(project.modules, m.id)) : []);
  const rooms = $derived(project?.plan.rooms.length ?? 0);

  let summaries = $state.raw<Record<string, ModuleSummary | null | undefined>>({});
  $effect(() => {
    const p = project;
    void app.libraries;
    if (!p) return;
    let live = true;
    for (const m of active)
      void moduleSummary(p, m).then(
        (s) => live && (summaries = { ...summaries, [m.id]: s }),
        () => live && (summaries = { ...summaries, [m.id]: null }),
      );
    return () => (live = false);
  });

  async function addTool(m: ToolModuleS2) {
    const p = project;
    if (!p) return;
    const next = reduceProject(p, {
      type: 'project/module/add',
      id: m.id,
      doc: { schemaVersion: m.schemaVersion, data: m.create(p.plan) },
    });
    await app.saveProject({ ...next, updatedAt: Date.now() });
    go({ name: 'module', id: p.id, module: m.id, path: '' });
  }
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title={project.name} backHref="#/" backLabel="Mes projets">
    <div class="layout">
      <section aria-labelledby="h-plan">
        <h2 id="h-plan">Plan</h2>
        <a class="card plan" href="#/p/{project.id}/plan">
          <span class="thumb">
            {#if rooms}
              <PlanThumb plan={project.plan} label="Plan de {project.name}" />
            {:else}
              <span class="empty">Aucune pièce dessinée</span>
            {/if}
          </span>
          <span class="text">
            <span class="title">{rooms ? `${rooms} pièce${rooms > 1 ? 's' : ''}` : 'Dessiner les pièces'}</span>
            <span class="muted">{rooms ? 'Modifier le plan' : 'Murs, portes, fenêtres, poteaux'}</span>
          </span>
        </a>
      </section>

      <section aria-labelledby="h-tools">
        <h2 id="h-tools">Outils</h2>
        <ul class="tools">
          {#each active as m (m.id)}
            {@const s = summaries[m.id]}
            <li>
              <a class="card tool" href="#/p/{project.id}/m/{m.id}">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- tracé de l'icône du module, fourni par le code -->
                <svg class="icon" viewBox="0 0 34 24" aria-hidden="true">{@html m.icon}</svg>
                <span class="text">
                  <span class="title">{m.label}</span>
                  <span class="muted num"
                    >{s === undefined ? 'Calcul…' : s === null ? 'À compléter' : s.text}{#if s?.alerts}
                      · <span class="alert">{s.alerts} alerte{s.alerts > 1 ? 's' : ''}</span>{/if}</span
                  >
                </span>
              </a>
            </li>
          {/each}
        </ul>
        {#if available.length}
          <h3>Ajouter un outil</h3>
          <ul class="tools">
            {#each available as m (m.id)}
              <li class="card add">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -- tracé de l'icône du module, fourni par le code -->
                <svg class="icon" viewBox="0 0 34 24" aria-hidden="true">{@html m.icon}</svg>
                <span class="text">
                  <span class="title">{m.label}</span>
                  <span class="muted">{m.description}</span>
                </span>
                <Button icon="plus" onclick={() => addTool(m)}>Ajouter {m.label.toLowerCase()}</Button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  </Screen>
{/if}

<style>
  .layout {
    display: grid;
    gap: var(--space-5);
  }
  @media (min-width: 1024px) {
    .layout {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }
  h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--fs-lg);
  }
  h3 {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    text-decoration: none;
  }
  a.card:hover {
    border-color: var(--accent);
  }
  .plan {
    display: grid;
    gap: var(--space-2);
  }
  .thumb {
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    border-radius: var(--r-field);
    background: var(--paper);
  }
  .empty {
    color: var(--muted);
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .title {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
  .alert {
    color: var(--thin);
  }
  .tools {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .icon {
    flex: none;
    width: 51px;
    height: 36px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
  }
  .add {
    flex-wrap: wrap;
  }
</style>
