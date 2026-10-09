<script lang="ts">
  import type { OptimizerGoal } from '../../core';
  import Button from '../../../../ui/components/Button.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import PatternPicker from '../components/PatternPicker.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { carrelage } from '../state.svelte';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const shape = $derived(carrelage.tile(ed.band.tileId)?.shape ?? 'rect');
  const GOALS: { value: OptimizerGoal; label: string }[] = [
    { value: 'thin', label: 'Éviter les coupes fines et apparentes' },
    { value: 'tiles', label: 'Le moins de carreaux possible' },
    { value: 'bal', label: 'Équilibré' },
    { value: 'sym', label: 'Coupes symétriques' },
  ];
</script>

<div class="tab">
  <section aria-labelledby="p-pat">
    <h3 id="p-pat">Motif{ed.surface.bands.length > 1 ? ` de la bande ${ed.bandIndex + 1}` : ''}</h3>
    <PatternPicker value={ed.band.pattern} {shape} onchange={(p) => ed.updateBand({ pattern: p })} />
  </section>

  <section aria-labelledby="p-pos">
    <h3 id="p-pos">Position</h3>
    <div class="field">
      <span class="lbl">Orientation</span>
      <Segmented
        label="Orientation du motif"
        value={ed.band.angle}
        onchange={(a) => ed.updateBand({ angle: a })}
        options={[0, 30, 45, 60, 90].map((a) => ({ value: a, label: a + '°' }))}
      />
    </div>
    <div class="field">
      <span class="lbl">Départ</span>
      <Segmented
        label="Départ du motif"
        value={ed.band.start}
        onchange={(s) => ed.updateBand({ start: s })}
        options={[
          { value: 'corner', label: 'Angle' },
          { value: 'tile', label: 'Centré carreau' },
          { value: 'joint', label: 'Centré joint' },
        ]}
      />
    </div>
    <div class="two">
      <NumberField
        label="Décalage horizontal"
        value={ed.band.offsetX}
        unit="mm"
        step={5}
        onchange={(v) => ed.updateBand({ offsetX: v })}
      />
      <NumberField
        label="Décalage vertical"
        value={ed.band.offsetY}
        unit="mm"
        step={5}
        onchange={(v) => ed.updateBand({ offsetY: v })}
      />
    </div>
    <div class="row">
      <Button
        variant="ghost"
        disabled={!ed.band.offsetX && !ed.band.offsetY}
        onclick={() => ed.updateBand({ offsetX: 0, offsetY: 0 })}
      >
        Remettre le décalage à zéro
      </Button>
    </div>
    <p class="muted">Sur le plan, glissez dans la bande pour déplacer le motif : il s’aimante aux bords.</p>
  </section>

  <section aria-labelledby="p-opt">
    <h3 id="p-opt">Optimiser le départ</h3>
    <Select
      label="Priorité"
      value={ed.project.settings.optimizerGoal}
      options={GOALS}
      onchange={(g) => ed.dispatch({ type: 'carrelage/settings', patch: { optimizerGoal: g } })}
    />
    {#if ed.optimizing}
      <div class="progress">
        <div
          class="bar"
          role="progressbar"
          aria-label="Recherche du meilleur départ, bande {ed.optimizing.zone + 1}"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ed.optimizing.percent}
        >
          <span style="width: {ed.optimizing.percent}%"></span>
        </div>
        <Button onclick={() => ed.cancelOptimize()}>Arrêter</Button>
      </div>
    {:else}
      <div class="row">
        <Button variant="primary" onclick={() => ed.optimize([ed.bandIndex])}>
          {ed.surface.bands.length > 1 ? 'Optimiser cette bande' : 'Optimiser le départ'}
        </Button>
        {#if ed.surface.bands.length > 1}
          <Button onclick={() => ed.optimize(ed.surface.bands.map((_, i) => i))}>Toutes les bandes</Button>
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .tab {
    display: grid;
    gap: var(--space-5);
  }
  section {
    display: grid;
    gap: var(--space-3);
  }
  h3 {
    font-size: var(--fs-md);
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .bar {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--line);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
  }
</style>
