<script lang="ts">
  /**
   * Éditeur de surface. Téléphone : plan plein écran, outils flottants, panneau tiré (résumé permanent).
   * Ordinateur : outils à gauche, plan au centre, inspecteur à droite, résumé sous le plan.
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import { projectCost } from '../../state/pricing';
  import BottomSheet from '../../../../ui/components/BottomSheet.svelte';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import Scene3DView from '../components/Scene3DView.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import { roomLayout, surfaceLayout } from '../../../../render/scene3d/placement';
  import { scenePhoto } from '../../../../ui/lib/photos';
  import Tabs from '../../../../ui/components/Tabs.svelte';
  import Icon from '../../../../ui/icons/Icon.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { euros } from '../../../../ui/lib/format';
  import { pwa } from '../../../../ui/lib/pwa.svelte';
  import Alerts from './Alerts.svelte';
  import { EditorState, type Tab } from './editorState.svelte';
  import FinishTab from './FinishTab.svelte';
  import OpeningsTab from './OpeningsTab.svelte';
  import PatternTab from './PatternTab.svelte';
  import PieceInfo from './PieceInfo.svelte';
  import PlanCanvas from './PlanCanvas.svelte';
  import SurfaceDialog from './SurfaceDialog.svelte';
  import TileTab from './TileTab.svelte';
  import ZonesTab from './ZonesTab.svelte';

  let { project, surfaceId }: { project: Project; surfaceId: string | null } = $props();

  // L'éditeur garde son propre état : il est recréé quand on change de projet ({#key} dans App.svelte).
  const ed = untrack(() => new EditorState(project, surfaceId));
  let canvas = $state<PlanCanvas>();
  let surfaceDialog = $state(false);
  let snap = $state<0 | 1 | 2>(0);
  let desktop = $state(false);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'tile', label: 'Carreau' },
    { id: 'pattern', label: 'Motif' },
    { id: 'zones', label: 'Zones' },
    { id: 'openings', label: 'Ouvertures' },
    { id: 'finish', label: 'Finitions' },
  ];

  // Projet modifié ailleurs (chargement de scénario, annulation, import) : l'éditeur reprend la version la plus
  // récente. Ses propres enregistrements renvoient le même objet et ne déclenchent rien.
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => ed.project);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });

  // Calcul à chaque modification du projet ou de la bibliothèque.
  $effect(() => {
    void ed.project;
    void app.tiles;
    void ed.recompute();
  });

  // Toucher un élément du plan ouvre ses réglages : le panneau se lève s'il est replié.
  $effect(() => {
    void ed.tab;
    void ed.sel.opening;
    void ed.sel.corner;
    if (untrack(() => snap) === 0 && (ed.sel.opening >= 0 || ed.sel.corner >= 0)) snap = 1;
  });

  /** La surface courante fait partie de la pièce : la 3D peut montrer toute la pièce. */
  const inRoom = $derived(!!ed.project.room && Object.values(ed.project.room.walls).includes(ed.surface.id));
  const layout3d = $derived(
    ed.spec
      ? ed.scope3d === 'room' && inRoom && ed.project.room
        ? roomLayout(ed.spec, ed.project.room.height)
        : surfaceLayout(ed.spec, ed.surfaceIndex)
      : null,
  );
  const photo = $derived.by(() => {
    void app.photoUrls;
    return scenePhoto(ed.project);
  });

  const m = $derived(ed.result?.metrics);
  const cost = $derived(ed.result ? projectCost(ed.project, app.tiles, ed.result) : null);
  const summary = $derived(
    m
      ? `${m.order.toLocaleString('fr-FR')} carreaux · ${m.thin} coupe${m.thin > 1 ? 's' : ''} fine${m.thin > 1 ? 's' : ''}${cost && cost.total > 0 ? ' · ' + euros(cost.total) : ''}`
      : 'Calcul…',
  );

  onMount(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const upd = () => (desktop = mq.matches);
    upd();
    mq.addEventListener('change', upd);
    const flush = () => void ed.flush();
    window.addEventListener('pagehide', flush);
    const offUpdate = pwa.beforeUpdate(() => ed.flush());
    const keys = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) ed.store.redo();
        else ed.store.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        ed.store.redo();
      }
    };
    window.addEventListener('keydown', keys);
    return () => {
      mq.removeEventListener('change', upd);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('keydown', keys);
      offUpdate();
      void ed.flush();
    };
  });
</script>

{#snippet panel()}
  <div class="panel">
    <Alerts {ed} onsurface={() => (surfaceDialog = true)} />
    <PieceInfo {ed} />
    <Tabs label="Réglages de la surface" tabs={TABS} bind:active={ed.tab}>
      {#snippet panel(id)}
        {#if id === 'tile'}<TileTab {ed} />
        {:else if id === 'pattern'}<PatternTab {ed} />
        {:else if id === 'zones'}<ZonesTab {ed} />
        {:else if id === 'openings'}<OpeningsTab {ed} />
        {:else}<FinishTab {ed} />{/if}
      {/snippet}
    </Tabs>
  </div>
{/snippet}

{#snippet tools()}
  <Segmented
    label="Vue du plan"
    bind:value={ed.mode}
    options={[
      { value: 'plan', label: 'Plan' },
      { value: 'render', label: 'Rendu' },
      { value: '3d', label: '3D' },
    ]}
  />
  {#if ed.mode !== '3d'}
    <div class="zoom">
      <IconButton icon="plus" variant="outline" label="Zoomer" onclick={() => canvas?.zoomBy(1.25)} />
      <IconButton icon="minus" variant="outline" label="Dézoomer" onclick={() => canvas?.zoomBy(0.8)} />
      <IconButton icon="fit" variant="outline" label="Ajuster à l’écran" onclick={() => canvas?.fit()} />
    </div>
  {:else if inRoom}
    <Segmented
      label="Contenu de la vue 3D"
      bind:value={ed.scope3d}
      options={[
        { value: 'surface', label: 'Surface' },
        { value: 'room', label: 'Pièce' },
      ]}
    />
  {/if}
{/snippet}

<div class="editor" class:desktop>
  <header class="bar">
    <IconButton icon="back" label="Mes projets" href="#/" />
    <button type="button" class="surf" aria-haspopup="dialog" onclick={() => (surfaceDialog = true)}>
      <span class="pname">{ed.project.name}</span>
      <span class="sname">{ed.surface.name} <Icon name="down" size={16} /></span>
    </button>
    <IconButton icon="undo" label="Annuler" disabled={!ed.canUndo} onclick={() => ed.store.undo()} />
    <IconButton icon="redo" label="Rétablir" disabled={!ed.canRedo} onclick={() => ed.store.redo()} />
    {#if ed.project.room}<IconButton icon="room" label="Pièce" href="#/p/{ed.project.id}/room" />{/if}
    <IconButton icon="list" label="Résultats" href="#/p/{ed.project.id}/results" />
  </header>

  <main class="body">
    {#if desktop}<div class="tools">{@render tools()}</div>{/if}
    <div class="planwrap" style={desktop ? '' : `bottom: ${snap === 0 ? '128px' : '50%'}`}>
      {#if ed.mode === '3d' && ed.spec && ed.result && layout3d}
        <Scene3DView
          spec={ed.spec}
          result={ed.result}
          layout={layout3d}
          shade={ed.project.settings.shadeVariation}
          {photo}
          label="Vue 3D de {ed.scope3d === 'room' && inRoom ? 'la pièce' : ed.surface.name}"
        />
      {:else if ed.mode !== '3d'}
        <PlanCanvas bind:this={canvas} {ed} label="Plan de {ed.surface.name}, {summary}" />
      {/if}
      {#if !desktop}<div class="float top">{@render tools()}</div>{/if}
      {#if ed.mode === '3d'}
        <!-- pas d'optimisation en 3D : la vue reste dégagée -->
      {:else if !ed.optimizing}
        <button
          type="button"
          class="optim"
          aria-label="Optimiser le départ de toutes les zones"
          onclick={() => ed.optimize(ed.surface.zones.map((_, i) => i))}
        >
          <Icon name="sparkle" size={20} /> Optimiser
        </button>
      {:else}
        <button type="button" class="optim" onclick={() => ed.cancelOptimize()}>
          Recherche {ed.optimizing.percent} % — Arrêter
        </button>
      {/if}
    </div>
    {#if desktop}
      <a class="summary bottom" href="#/p/{ed.project.id}/results">{summary}</a>
      <aside class="inspector" aria-label="Réglages">{@render panel()}</aside>
    {:else}
      <BottomSheet label="Réglages" bind:snap contained peek={128}>
        {#snippet header()}
          <a class="summary" href="#/p/{ed.project.id}/results">{summary}</a>
        {/snippet}
        {@render panel()}
      </BottomSheet>
    {/if}
  </main>
</div>

<SurfaceDialog {ed} bind:open={surfaceDialog} />

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
  .surf {
    flex: 1;
    min-width: 0;
    display: grid;
    justify-items: start;
    min-height: var(--touch);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--r-field);
    background: transparent;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .surf:hover {
    background: var(--accent-soft);
  }
  .pname {
    font-size: var(--fs-xs);
    color: var(--muted);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sname {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 600;
    font-size: var(--fs-lg);
  }
  .body {
    position: relative;
    min-height: 0;
  }
  .planwrap {
    position: absolute;
    inset: 0;
    background: var(--sheet);
  }
  .float.top {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    right: var(--space-2);
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    pointer-events: none;
  }
  .float.top > :global(*) {
    pointer-events: auto;
  }
  .zoom {
    display: flex;
    gap: var(--space-1);
  }
  .optim {
    position: absolute;
    right: var(--space-2);
    bottom: var(--space-2);
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    padding: 0 var(--space-4);
    border: 0;
    border-radius: 22px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    box-shadow: var(--shadow);
    cursor: pointer;
  }
  .summary {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    font-family: var(--font-num);
    font-size: var(--fs-lg);
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
  }
  .summary::after {
    content: '›';
    margin-left: auto;
    color: var(--muted);
    font-size: var(--fs-xl);
  }
  .panel {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
  }
  .panel > :global(*) {
    min-width: 0;
  }

  /* ordinateur : outils | plan | inspecteur, résumé sous le plan */
  .desktop .body {
    display: grid;
    grid-template-columns: 64px 1fr 420px;
    grid-template-rows: 1fr auto;
  }
  .desktop .tools {
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-right: 1px solid var(--line);
  }
  .desktop .tools :global(.seg) {
    flex-direction: column;
  }
  .desktop .tools .zoom {
    flex-direction: column;
  }
  .desktop .planwrap {
    position: relative;
    grid-column: 2;
    grid-row: 1;
  }
  .desktop .summary.bottom {
    grid-column: 2;
    grid-row: 2;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--line);
    background: var(--paper);
  }
  .desktop .inspector {
    grid-column: 3;
    grid-row: 1 / span 2;
    overflow: auto;
    padding: var(--space-3) var(--space-4) var(--space-6);
    border-left: 1px solid var(--line);
    background: var(--sheet);
  }
</style>
