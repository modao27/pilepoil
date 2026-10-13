<script lang="ts">
  /**
   * Une cloison en élévation : les deux faces côte à côte (l'une sous l'autre sur téléphone), plaques numérotées d'une
   * couche au choix, fiche de coupe, montants et rails, alertes.
   */
  import { onMount, untrack } from 'svelte';
  import type { Project } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { PLATE_LABEL } from '../../state/module';
  import { CloisonsEditorState } from '../editorState.svelte';
  import { cutList, cutText, elevationOf, platesOf, ROLE_LABEL, studSummary } from '../lib/elevation';
  import { alertText } from '../lib/messages';
  import ElevationView from './ElevationView.svelte';

  let { project, partitionId }: { project: Project; partitionId: string } = $props();

  const ed = untrack(() => new CloisonsEditorState(project));

  $effect(() => {
    const ext = app.project(project.id);
    const own = untrack(() => ed.doc);
    if (ext && ext !== own && ext.updatedAt > own.updatedAt) ed.store.reset(ext);
  });
  $effect(() => {
    void ed.doc;
    void app.libraries;
    void ed.recompute();
  });
  onMount(() => () => void ed.flush());

  const spec = $derived('spec' in ed.spec ? ed.spec.spec.partitions.find((p) => p.id === partitionId) : undefined);
  const res = $derived(ed.result?.partitions.find((p) => p.id === partitionId));
  const system = $derived(spec && 'spec' in ed.spec ? ed.spec.spec.systems[spec.system] : undefined);
  const layers = $derived(system?.layers ?? 1);
  let layer = $state(1);
  const elevation = $derived(spec && res?.ok ? elevationOf(spec, res) : null);
  const cuts = $derived(res?.ok ? cutList(res) : []);
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
</script>

<Screen title={spec?.name ?? 'Cloison'} backHref="#/p/{project.id}/m/cloisons" backLabel="Cloisons" wide>
  {#if !spec}
    <EmptyState icon="info" title="Cette cloison n’existe plus" text="Elle a peut-être été supprimée dans le plan.">
      {#snippet action()}<Button variant="primary" href="#/p/{project.id}/m/cloisons">Voir les cloisons</Button
        >{/snippet}
    </EmptyState>
  {:else if !res}
    <p class="muted" role="status">Calcul…</p>
  {:else if !res.ok || !elevation}
    <ul class="alerts" aria-label="Alertes">
      {#each res.alerts as a, i (a.code + i)}<li>{alertText(a)}</li>{/each}
    </ul>
  {:else}
    <p class="muted num">
      {fr(spec.length / 10)} cm de long, {fr(spec.height / 10)} cm de haut, entraxe {spec.spacing / 10} cm · {system?.name ??
        ''}
    </p>
    {#if layers > 1}
      <Segmented
        label="Couche de plaque affichée"
        bind:value={layer}
        options={[
          { value: 1, label: 'Couche 1 (contre l’ossature)' },
          { value: 2, label: 'Couche 2 (visible)' },
        ]}
      />
    {/if}
    <div class="faces">
      {#each ['a', 'b'] as const as face (face)}
        <section aria-labelledby="f-{face}">
          <h2 id="f-{face}">Face {face.toUpperCase()} · plaque {PLATE_LABEL[spec.plates[face]]}</h2>
          <ElevationView
            {elevation}
            plates={platesOf(res, face, layer, elevation.openings)}
            label="{spec.name}, face {face.toUpperCase()}, couche {layer}"
          />
        </section>
      {/each}
    </div>
    <p class="muted">
      Face A : à gauche dans le sens du tracé ; face B : à droite. En vert : plaque taillée dans une chute. Vérifier la
      notice du fabricant.
    </p>

    {#if res.alerts.length}
      <ul class="alerts" aria-label="Alertes">
        {#each res.alerts as a, i (a.code + i)}<li>{alertText(a)}</li>{/each}
      </ul>
    {/if}

    <div class="lists">
      <section aria-labelledby="h-frame">
        <h2 id="h-frame">Ossature</h2>
        <ul>
          {#each res.rails as r (r.id)}
            <li>
              {r.kind === 'top' ? 'Rail haut' : r.kind === 'bottom' ? 'Rail bas' : 'Linteau'} : {fr(r.length / 10)} cm
            </li>
          {/each}
          {#each studSummary(res) as s (s.role + s.length)}
            <li>{ROLE_LABEL[s.role]} : {s.count} × {fr(s.length / 10)} cm</li>
          {/each}
        </ul>
      </section>
      <section aria-labelledby="h-cuts">
        <h2 id="h-cuts">Fiche de coupe des plaques</h2>
        <ol class="cuts">
          {#each cuts as c (c.face + c.layer + c.n)}<li>{cutText(c, layers)}</li>{/each}
        </ol>
      </section>
    </div>
  {/if}
</Screen>

<style>
  .muted {
    margin: 0 0 var(--space-3);
    color: var(--muted);
  }
  .faces {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr));
    gap: var(--space-4);
    margin: var(--space-3) 0;
  }
  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .lists {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
    gap: var(--space-5);
    margin-top: var(--space-4);
  }
  ul,
  ol {
    margin: 0;
    padding-left: var(--space-5);
  }
  .cuts {
    font-family: var(--font-num);
    font-size: var(--fs-sm);
  }
  .alerts {
    margin: var(--space-3) 0;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--thin) 8%, var(--sheet));
  }
</style>
