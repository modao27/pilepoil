<script lang="ts">
  /** Carte d'un projet sur l'accueil, la même pour tous : plan, résumé par outil, coût, menu. */
  import type { Project } from '../../state/model';
  import { app } from '../lib/app.svelte';
  import { dateShort, euros } from '../lib/format';
  import { activeModules, deferredProjectOutputs, type ModuleOutput } from '../lib/moduleOutputs';
  import { consolidate } from '../lib/shopping';
  import { go } from '../lib/router.svelte';
  import PlanThumb from '../plan/PlanThumb.svelte';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';
  import IconButton from './IconButton.svelte';
  import TextField from './TextField.svelte';

  let { project }: { project: Project } = $props();

  let outputs = $state.raw<ModuleOutput[] | null>(null);
  let menu = $state(false);
  let renaming = $state(false);
  let newName = $state('');

  $effect(() => {
    const p = project;
    void app.libraries;
    let live = true;
    void deferredProjectOutputs(p).then((o) => live && (outputs = o));
    return () => (live = false);
  });

  const tools = $derived(activeModules(project));
  const cost = $derived(outputs ? consolidate(outputs.flatMap((o) => o.lines)) : null);
  const rooms = $derived(project.plan.rooms.length);

  async function rename() {
    const name = newName.trim();
    if (!name) return;
    if (!(await app.trySaveProject({ ...project, name, updatedAt: Date.now() }))) return;
    renaming = false;
    menu = false;
  }
</script>

<article class="card">
  <div class="thumb">
    {#if rooms}<PlanThumb plan={project.plan} label="Plan de {project.name}" />{/if}
  </div>
  <div class="info">
    <h2><a href="#/p/{project.id}" data-stretched>{project.name}</a></h2>
    <p class="muted">
      {rooms} pièce{rooms > 1 ? 's' : ''} · modifié {dateShort(project.updatedAt)}
    </p>
    {#if tools.length}
      <ul class="tools">
        {#each tools as m (m.id)}
          {@const s = outputs?.find((o) => o.module.id === m.id)?.summary}
          <li>{m.label}{s ? ' : ' + s.text : ''}</li>
        {/each}
      </ul>
      {#if cost && cost.total > 0}
        <p class="figs num"><span>{euros(cost.total)}</span></p>
      {:else if cost}
        <p class="muted">prix à saisir</p>
      {/if}
    {:else}
      <p class="muted">Aucun revêtement</p>
    {/if}
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
          if (c) go({ name: 'project', id: c.id });
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
    outline: 3px solid var(--color-focus);
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
    flex-wrap: wrap;
    gap: 0 var(--space-3);
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  .figs > span {
    white-space: nowrap;
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
