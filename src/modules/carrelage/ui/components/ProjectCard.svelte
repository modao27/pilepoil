<script lang="ts">
  import type { ProjectResult } from '../../core';
  import type { Project } from '../../../../state/model';
  import { projectArea, projectCost } from '../../state/pricing';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import PlanPreview from './PlanPreview.svelte';
  import { dateShort, euros, m2 } from '../../../../ui/lib/format';
  import { go } from '../../../../ui/lib/router.svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';

  let { project }: { project: Project } = $props();

  let result = $state.raw<ProjectResult | null>(null);
  let menu = $state(false);
  let renaming = $state(false);
  let newName = $state('');

  $effect(() => {
    let live = true;
    void carrelage.result(project).then((r) => live && (result = r));
    return () => (live = false);
  });

  const first = $derived(result?.surfaces[0]);
  const cost = $derived(result ? projectCost(project, carrelage.tiles, result) : null);
  const firstGrout = $derived(project.surfaces[0]?.zones[0]?.groutColor);

  async function rename() {
    const name = newName.trim();
    if (!name) return;
    await app.saveProject({ ...project, name, updatedAt: Date.now() });
    renaming = false;
    menu = false;
  }
</script>

<article class="card">
  <div class="thumb">
    {#if first?.ok}
      <PlanPreview
        surface={carrelage.spec(project).surfaces[0]!}
        pieces={first.value.pieces}
        grout={firstGrout}
        label="Aperçu de {project.surfaces[0]!.name}"
      />
    {/if}
  </div>
  <div class="info">
    <h2><a href="#/p/{project.id}" data-stretched>{project.name}</a></h2>
    <p class="muted">
      {project.surfaces.length > 1 ? `${project.surfaces.length} surfaces · ` : ''}modifié {dateShort(
        project.updatedAt,
      )}
    </p>
    <p class="figs num">
      <span>{m2(projectArea(project))}</span>
      {#if cost && cost.total > 0}<span>{euros(cost.total)}</span>{:else if cost}<span class="muted">prix à saisir</span
        >{/if}
    </p>
  </div>
  <div class="menu">
    <IconButton icon="more" label="Actions pour {project.name}" onclick={() => (menu = true)} />
  </div>
</article>

<Dialog bind:open={menu} title={project.name} onclose={() => (renaming = false)}>
  {#if renaming}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        void rename();
      }}
    >
      <TextField label="Nouveau nom" bind:value={newName} maxlength={60} required />
    </form>
  {:else}
    <div class="actions">
      <Button variant="ghost" icon="edit" block onclick={() => ((newName = project.name), (renaming = true))}
        >Renommer</Button
      >
      <Button
        variant="ghost"
        icon="copy"
        block
        onclick={async () => {
          menu = false;
          const c = await app.duplicateProject(project.id);
          if (c) go({ name: 'project', id: c.id, surfaceId: null });
        }}>Dupliquer</Button
      >
      <Button
        variant="danger"
        icon="trash"
        block
        onclick={() => {
          menu = false;
          app.deleteProject(project.id);
        }}>Supprimer</Button
      >
    </div>
  {/if}
  {#snippet actions()}
    {#if renaming}
      <Button onclick={() => (renaming = false)}>Annuler</Button>
      <Button variant="primary" onclick={rename}>Renommer</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .card {
    position: relative;
    display: grid;
    grid-template-columns: 96px 1fr auto;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .card:hover {
    border-color: var(--field-border);
  }
  .card:focus-within {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .thumb {
    width: 96px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--paper);
    overflow: hidden;
  }
  .info {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  h2 {
    font-size: var(--fs-md);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h2 a {
    color: inherit;
    text-decoration: none;
  }
  /* toute la carte est cliquable, le bouton de menu reste au-dessus */
  h2 a::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--r-panel);
  }
  h2 a:focus-visible {
    outline: none;
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .figs {
    display: flex;
    gap: var(--space-3);
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  .figs .muted {
    font-family: var(--font);
    font-weight: 400;
    font-size: var(--fs-sm);
    align-self: center;
  }
  .menu {
    position: relative;
    z-index: 1;
  }
  .actions {
    display: grid;
    gap: var(--space-1);
  }
  .actions :global(.btn) {
    justify-content: flex-start;
  }
</style>
