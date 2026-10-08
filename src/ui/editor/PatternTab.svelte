<script lang="ts">
  import type { OptimizerGoal } from '../../core';
  import Button from '../components/Button.svelte';
  import NumberField from '../components/NumberField.svelte';
  import PatternPicker from '../components/PatternPicker.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Select from '../components/Select.svelte';
  import { app } from '../lib/app.svelte';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const shape = $derived(app.tile(ed.zone.tileId)?.shape ?? 'rect');
  const GOALS: { value: OptimizerGoal; label: string }[] = [
    { value: 'thin', label: 'Éviter les coupes fines et apparentes' },
    { value: 'tiles', label: 'Le moins de carreaux possible' },
    { value: 'bal', label: 'Équilibré' },
    { value: 'sym', label: 'Coupes symétriques' },
  ];
</script>

<div class="tab">
  <section aria-labelledby="p-pat">
    <h3 id="p-pat">Motif{ed.surface.zones.length > 1 ? ` de la zone ${ed.zoneIndex + 1}` : ''}</h3>
    <PatternPicker value={ed.zone.pattern} {shape} onchange={(p) => ed.updateZone({ pattern: p })} />
  </section>

  <section aria-labelledby="p-pos">
    <h3 id="p-pos">Position</h3>
    <div class="field">
      <span class="lbl">Orientation</span>
      <Segmented
        label="Orientation du motif"
        value={ed.zone.angle}
        onchange={(a) => ed.updateZone({ angle: a })}
        options={[0, 30, 45, 60, 90].map((a) => ({ value: a, label: a + '°' }))}
      />
    </div>
    <div class="field">
      <span class="lbl">Départ</span>
      <Segmented
        label="Départ du motif"
        value={ed.zone.start}
        onchange={(s) => ed.updateZone({ start: s })}
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
        value={ed.zone.offsetX}
        unit="mm"
        step={5}
        onchange={(v) => ed.updateZone({ offsetX: v })}
      />
      <NumberField
        label="Décalage vertical"
        value={ed.zone.offsetY}
        unit="mm"
        step={5}
        onchange={(v) => ed.updateZone({ offsetY: v })}
      />
    </div>
    <div class="row">
      <Button
        variant="ghost"
        disabled={!ed.zone.offsetX && !ed.zone.offsetY}
        onclick={() => ed.updateZone({ offsetX: 0, offsetY: 0 })}
      >
        Remettre le décalage à zéro
      </Button>
    </div>
    <p class="muted">Sur le plan, glissez dans la zone pour déplacer le motif : il s’aimante aux bords.</p>
  </section>

  <section aria-labelledby="p-opt">
    <h3 id="p-opt">Optimiser le départ</h3>
    <Select
      label="Priorité"
      value={ed.project.settings.optimizerGoal}
      options={GOALS}
      onchange={(g) => ed.dispatch({ type: 'project/settings', patch: { optimizerGoal: g } })}
    />
    {#if ed.optimizing}
      <div class="progress">
        <div
          class="bar"
          role="progressbar"
          aria-label="Recherche du meilleur départ, zone {ed.optimizing.zone + 1}"
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
        <Button variant="primary" onclick={() => ed.optimize([ed.zoneIndex])}>
          {ed.surface.zones.length > 1 ? 'Optimiser cette zone' : 'Optimiser le départ'}
        </Button>
        {#if ed.surface.zones.length > 1}
          <Button onclick={() => ed.optimize(ed.surface.zones.map((_, i) => i))}>Toutes les zones</Button>
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
