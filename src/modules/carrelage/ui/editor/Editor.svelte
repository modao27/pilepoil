<script lang="ts">
  /**
   * Calepinage d'une pose de carrelage, dans la coquille commune (ui/calepinage) : plan, rendu ou 3D au centre ;
   * étapes Produit (carreau), Pose (motif), Découpage (bandes, ouvertures), Finitions, Avancé (découpe et chutes).
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import { projectCost } from '../../state/pricing';
  import IconButton from '../../../../ui/components/IconButton.svelte';
  import Scene3DView from '../components/Scene3DView.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import { roomLayout, surfaceLayout } from '../../render/scene3d/placement';
  import { roomShape } from '../../state/surfaces';
  import { scenePhoto } from '../lib/photos';
  import Icon from '../../../../ui/icons/Icon.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { euros } from '../../../../ui/lib/format';
  import { pwa } from '../../../../ui/lib/pwa.svelte';
  import PoseEditorShell from '../../../../ui/calepinage/PoseEditorShell.svelte';
  import AdvancedTab from './AdvancedTab.svelte';
  import Alerts from './Alerts.svelte';
  import { EditorState } from './editorState.svelte';
  import FinishTab from './FinishTab.svelte';
  import OpeningsTab from './OpeningsTab.svelte';
  import PatternTab from './PatternTab.svelte';
  import PieceInfo from './PieceInfo.svelte';
  import PlanCanvas from './PlanCanvas.svelte';
  import SurfaceDialog from './SurfaceDialog.svelte';
  import TileTab from './TileTab.svelte';
  import BandsTab from './BandsTab.svelte';

  let { project, surfaceId }: { project: Project; surfaceId: string | null } = $props();

  // L'éditeur garde son propre état : il est recréé quand on change de projet ({#key} dans App.svelte).
  const ed = untrack(() => new EditorState(project, surfaceId));
  let canvas = $state<PlanCanvas>();
  let surfaceDialog = $state(false);
  let snap = $state<0 | 1 | 2>(0);
  let desktop = $state(false);

  // Projet modifié ailleurs (chargement de scénario, annulation, import) : l'éditeur reprend la version la plus
  // récente. Ses propres enregistrements renvoient le même objet et ne déclenchent rien.
  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => ed.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });

  // Calcul à chaque modification du projet ou de la bibliothèque.
  $effect(() => {
    void ed.project;
    void carrelage.tiles;
    void ed.recompute();
  });

  // Toucher un élément du plan ouvre ses réglages : le panneau se lève s'il est replié.
  $effect(() => {
    void ed.tab;
    void ed.sel.opening;
    if (untrack(() => snap) === 0 && ed.sel.opening >= 0) snap = 1;
  });

  const layout3d = $derived.by(() => {
    if (!ed.spec) return null;
    const shape = ed.scope3d === 'room' ? roomShape(ed.project.plan, ed.project.surfaces, ed.surface.ref.room) : null;
    return shape ? roomLayout(ed.spec, shape) : surfaceLayout(ed.spec, ed.surfaceIndex);
  });
  const photo = $derived.by(() => {
    void app.photoUrls;
    return scenePhoto(ed.project);
  });

  const m = $derived(ed.result?.metrics);
  const cost = $derived(ed.result ? projectCost(ed.project, carrelage.tiles, ed.result) : null);
  const summary = $derived(
    m
      ? `${m.order.toLocaleString('fr-FR')} carreaux · ${m.thin} coupe${m.thin > 1 ? 's' : ''} fine${m.thin > 1 ? 's' : ''}${cost && cost.total > 0 ? ' · ' + euros(cost.total) : ''}`
      : 'Calcul…',
  );

  onMount(() => {
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
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('keydown', keys);
      offUpdate();
      void ed.flush();
    };
  });
</script>

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
  {:else}
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

{#snippet header()}
  <IconButton icon="room" label="Résultats de la pièce" href="#/p/{ed.project.id}/r/{ed.surface.ref.room}/resultats" />
{/snippet}

{#snippet drawing()}
  {#if ed.mode === '3d' && ed.spec && ed.result && layout3d}
    <Scene3DView
      spec={ed.spec}
      result={ed.result}
      layout={layout3d}
      shade={ed.project.settings.shadeVariation}
      {photo}
      label="Vue 3D de {ed.scope3d === 'room' ? 'la pièce' : ed.surface.name}"
    />
  {:else if ed.mode !== '3d'}
    <PlanCanvas bind:this={canvas} {ed} label="Plan de {ed.surface.name}, {summary}" />
  {/if}
  {#if ed.mode === '3d'}
    <!-- pas d'optimisation en 3D : la vue reste dégagée -->
  {:else if !ed.optimizing}
    <button
      type="button"
      class="optim"
      aria-label="Optimiser le départ de toutes les bandes"
      onclick={() => ed.optimize(ed.surface.bands.map((_, i) => i))}
    >
      <Icon name="sparkle" size={20} /> Optimiser
    </button>
  {:else}
    <button type="button" class="optim" onclick={() => ed.cancelOptimize()}>
      Recherche {ed.optimizing.percent} % — Arrêter
    </button>
  {/if}
{/snippet}

{#snippet top()}
  <Alerts {ed} onsurface={() => (surfaceDialog = true)} />
  <PieceInfo {ed} />
{/snippet}

{#snippet content(id: import('../../../../ui/calepinage/steps').StepId)}
  {#if id === 'product'}<TileTab {ed} />
  {:else if id === 'pose'}<PatternTab {ed} />
  {:else if id === 'cut'}
    <div class="steps"><BandsTab {ed} /><OpeningsTab {ed} /></div>
  {:else if id === 'finish'}<FinishTab {ed} />
  {:else}<AdvancedTab {ed} />{/if}
{/snippet}

<PoseEditorShell
  title={ed.surface.name}
  context={ed.project.name}
  ontitle={() => (surfaceDialog = true)}
  backHref="#/p/{ed.project.id}/r/{ed.surface.ref.room}/{ed.surface.ref.wall ?? 'sol'}"
  canUndo={ed.canUndo}
  canRedo={ed.canRedo}
  onundo={() => ed.store.undo()}
  onredo={() => ed.store.redo()}
  resultsHref="#/p/{ed.project.id}/pose/{ed.surface.id}/resultats"
  {summary}
  bind:step={ed.tab}
  bind:snap
  bind:desktop
  {header}
  {tools}
  canvas={drawing}
  {top}
  {content}
/>

<SurfaceDialog {ed} bind:open={surfaceDialog} />

<style>
  .zoom {
    display: flex;
    gap: var(--space-1);
  }
  :global(.desktop) .zoom {
    flex-direction: column;
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
  .steps {
    display: grid;
    gap: var(--space-6);
  }
</style>
