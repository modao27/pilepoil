<script lang="ts">
  /** Éditeur du plan commun (#/p/:id/plan) : plan au centre, réglages dans le panneau (téléphone) ou à droite. */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../state/model';
  import BottomSheet from '../components/BottomSheet.svelte';
  import IconButton from '../components/IconButton.svelte';
  import { app } from '../lib/app.svelte';
  import AddRoomDialog from './AddRoomDialog.svelte';
  import PlanCanvas from './PlanCanvas.svelte';
  import PlanPanel from './PlanPanel.svelte';
  import { PlanEditorState } from './planState.svelte';

  let { project }: { project: Project } = $props();

  const st = untrack(() => new PlanEditorState(project));
  let desktop = $state(false);
  let snap = $state<0 | 1 | 2>(1);
  let adding = $state(false);
  let canvas: PlanCanvas;

  // projet modifié ailleurs (autre onglet, autre écran) : on reprend la version enregistrée la plus récente
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => st.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) st.store.reset(ext);
  });

  // ouverture d'un panneau utile dès qu'on choisit un élément
  $effect(() => {
    if (st.sel || st.mode !== 'select') untrack(() => snap === 0 && (snap = 1));
  });

  const rooms = $derived(st.plan.rooms.length);
  const label = $derived(
    `Plan de ${st.doc.name} : ${rooms} pièce${rooms > 1 ? 's' : ''}` +
      (st.mode === 'draw' ? ', dessin en cours' : st.mode === 'link' ? ', choix de la porte à relier' : ''),
  );

  onMount(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const upd = () => (desktop = mq.matches);
    upd();
    mq.addEventListener('change', upd);
    const flush = () => void st.flush();
    window.addEventListener('pagehide', flush);
    if (!st.plan.rooms.length) adding = true;
    return () => {
      mq.removeEventListener('change', upd);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });
</script>

{#snippet panel()}
  <PlanPanel {st} onaddroom={() => (adding = true)} />
{/snippet}

<div class="editor" class:desktop>
  <header class="bar">
    <IconButton icon="back" label="Projet" href="#/p/{st.doc.id}" />
    <h1><span class="pname">{st.doc.name}</span><span class="sub">Plan des pièces</span></h1>
    <IconButton icon="undo" label="Annuler" disabled={!st.canUndo} onclick={() => st.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!st.canRedo} onclick={() => st.redo()} />
    <IconButton icon="plus" label="Ajouter une pièce" onclick={() => (adding = true)} />
  </header>

  <main class="body">
    <div class="planwrap" style={desktop ? '' : `bottom: ${snap === 0 ? '96px' : '50%'}`}>
      <PlanCanvas bind:this={canvas} {st} {label} />
      <div class="float">
        <IconButton icon="fit" label="Voir tout le plan" onclick={() => canvas.fit()} />
      </div>
    </div>
    {#if desktop}
      <aside class="inspector" aria-label="Réglages du plan">{@render panel()}</aside>
    {:else}
      <BottomSheet label="Réglages du plan" bind:snap contained peek={96}>
        {#snippet header()}
          <p class="peek">
            {st.mode === 'draw'
              ? 'Dessin : touchez pour placer un coin'
              : st.mode === 'link'
                ? 'Touchez la porte à relier'
                : `${rooms} pièce${rooms > 1 ? 's' : ''}`}
          </p>
        {/snippet}
        {@render panel()}
      </BottomSheet>
    {/if}
  </main>
</div>

<AddRoomDialog {st} bind:open={adding} />

<style>
  .editor {
    display: grid;
    grid-template-rows: auto 1fr;
    height: 100dvh;
    background: var(--paper);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 56px;
    padding: env(safe-area-inset-top) 6px 0;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
  }
  h1 {
    flex: 1;
    min-width: 0;
    display: grid;
    margin: 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .pname {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: var(--fs-sm);
    font-weight: 400;
    color: var(--muted);
  }
  .body {
    position: relative;
    min-height: 0;
  }
  .planwrap {
    position: absolute;
    inset: 0;
  }
  .float {
    position: absolute;
    top: var(--space-2);
    right: var(--space-2);
    border-radius: var(--r-field);
    background: var(--paper);
  }
  .peek {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    margin: 0;
    font-weight: 600;
  }
  .desktop .body {
    display: grid;
    grid-template-columns: 1fr 400px;
  }
  .desktop .planwrap {
    position: relative;
  }
  .desktop .inspector {
    overflow: auto;
    padding: var(--space-3) var(--space-4) var(--space-6);
    border-left: 1px solid var(--line);
    background: var(--sheet);
  }
</style>
