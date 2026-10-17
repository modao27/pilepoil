<script lang="ts">
  /**
   * Coquille commune du calepinage d'une pose (docs/NAVIGATION.md §6), pour tous les revêtements.
   * Téléphone : dessin plein écran, outils flottants, panneau tiré du bas (résumé permanent vers les résultats).
   * Ordinateur : outils à gauche, dessin au centre, panneau à droite, résumé sous le dessin.
   * Barre du haut : « ‹ Pièce », nom de la pose (ouvre la liste des poses du module), annuler, rétablir, résultats.
   * Panneau : alertes du module puis les étapes communes (Produit, Pose, Découpage, Finitions, Avancé) en onglets.
   * La coquille ne connaît aucun réglage : chaque module remplit `step(id)`.
   */
  import { onMount, type Snippet } from 'svelte';
  import BottomSheet from '../components/BottomSheet.svelte';
  import ComputeFailed from '../components/ComputeFailed.svelte';
  import IconButton from '../components/IconButton.svelte';
  import Tabs from '../components/Tabs.svelte';
  import Icon from '../icons/Icon.svelte';
  import { STEPS, type StepId } from './steps';

  let {
    title,
    context,
    ontitle,
    backHref,
    canUndo,
    canRedo,
    onundo,
    onredo,
    resultsHref,
    summary,
    panelLabel = 'Réglages',
    step = $bindable('product'),
    snap = $bindable(0),
    desktop = $bindable(false),
    peek = 128,
    header,
    tools,
    canvas,
    top,
    content,
    failed = false,
    onretry,
  }: {
    /** Nom de la pose et de ses surfaces : « Cuisine, murs 1 et 2 ». */
    title: string;
    /** Au-dessus du titre : le projet. */
    context: string;
    /** Toucher le titre : liste des poses du module (et renommage). */
    ontitle?: () => void;
    /** Écran Pièce, même surface. */
    backHref: string;
    canUndo: boolean;
    canRedo: boolean;
    onundo: () => void;
    onredo: () => void;
    resultsHref: string;
    /** Résumé permanent : « 46 carreaux · 2 coupes fines · 312 € ». */
    summary: string;
    panelLabel?: string;
    step?: StepId;
    snap?: 0 | 1 | 2;
    desktop?: boolean;
    /** Hauteur visible du panneau replié (téléphone), px. */
    peek?: number;
    /** Boutons de la barre du haut propres au module (avant Résultats). */
    header?: Snippet;
    /** Outils du dessin (vue, zoom) : colonne à gauche sur ordinateur, flottants sur téléphone. */
    tools?: Snippet;
    /** Le dessin, et ce qui flotte dessus. */
    canvas: Snippet;
    /** En tête du panneau : alertes, élément touché. */
    top?: Snippet;
    /** Contenu d'une étape. */
    content: Snippet<[StepId]>;
    /** Le dernier calcul a échoué : bandeau en tête du panneau, résumé remplacé. */
    failed?: boolean;
    onretry?: () => void;
  } = $props();

  const shown = $derived(failed ? 'Calcul échoué : chiffres d’avant la dernière modification' : summary);

  onMount(() => {
    const mq = matchMedia('(min-width: 1024px)');
    const upd = () => (desktop = mq.matches);
    upd();
    mq.addEventListener('change', upd);
    return () => mq.removeEventListener('change', upd);
  });
</script>

{#snippet panel()}
  <div class="panel">
    {#if failed}<ComputeFailed onretry={() => onretry?.()} />{/if}
    {@render top?.()}
    <Tabs label="Étapes du calepinage" tabs={[...STEPS]} bind:active={step}>
      {#snippet panel(id)}{@render content(id)}{/snippet}
    </Tabs>
  </div>
{/snippet}

<div class="editor" class:desktop>
  <header class="bar">
    <IconButton icon="back" label="Pièce" href={backHref} />
    <h1 class="heading">
      <button type="button" class="title" aria-haspopup="dialog" onclick={() => ontitle?.()}>
        <span class="context">{context}</span>
        <span class="name">{title} <Icon name="down" size={16} /></span>
      </button>
    </h1>
    <IconButton icon="undo" label="Annuler" disabled={!canUndo} onclick={onundo} />
    <IconButton icon="redo" label="Rétablir" disabled={!canRedo} onclick={onredo} />
    {@render header?.()}
    <IconButton icon="list" label="Résultats" href={resultsHref} />
  </header>

  <main class="body">
    {#if desktop && tools}<div class="tools">{@render tools()}</div>{/if}
    <div class="drawing" style={desktop ? '' : `bottom: ${snap === 0 ? `${peek}px` : '50%'}`}>
      {@render canvas()}
      {#if !desktop && tools}<div class="float top">{@render tools()}</div>{/if}
    </div>
    {#if desktop}
      <a class="summary bottom" href={resultsHref}>{shown}</a>
      <aside class="inspector" aria-label={panelLabel}>{@render panel()}</aside>
    {:else}
      <BottomSheet label={panelLabel} bind:snap contained {peek}>
        {#snippet header()}<a class="summary" href={resultsHref}>{shown}</a>{/snippet}
        {@render panel()}
      </BottomSheet>
    {/if}
  </main>
</div>

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
  .heading {
    flex: 1;
    min-width: 0;
    display: flex;
    margin: 0;
    font: inherit;
  }
  .title {
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
  .title:hover {
    background: var(--accent-soft);
  }
  .context {
    max-width: 100%;
    overflow: hidden;
    font-size: var(--fs-xs);
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 100%;
    overflow: hidden;
    font-size: var(--fs-lg);
    font-weight: 600;
    white-space: nowrap;
  }
  .body {
    position: relative;
    min-height: 0;
  }
  .drawing {
    position: absolute;
    inset: 0;
  }
  .float {
    position: absolute;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    pointer-events: none;
  }
  .float.top {
    top: var(--space-2);
    left: var(--space-2);
    right: var(--space-2);
  }
  .float.top > :global(*) {
    pointer-events: auto;
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

  /* ordinateur : outils | dessin | panneau, résumé sous le dessin */
  .desktop .body {
    display: grid;
    grid-template-columns: auto 1fr 420px;
    grid-template-rows: 1fr auto;
  }
  .desktop .tools {
    grid-column: 1;
    grid-row: 1 / span 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    width: 64px;
    padding: var(--space-3) 0;
    border-right: 1px solid var(--line);
  }
  .desktop .tools :global(.seg) {
    flex-direction: column;
  }
  .desktop .drawing {
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
