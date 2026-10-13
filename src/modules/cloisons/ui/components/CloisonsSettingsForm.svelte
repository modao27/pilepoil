<script lang="ts">
  /** Réglages communs des cloisons : hauteurs maximales (« à vérifier »), coupes, marges, ratios de consommables. */
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import type { ConsumableRatios, HeightRule } from '../../core/types';
  import type { CloisonsEditorState } from '../editorState.svelte';

  let { ed }: { ed: CloisonsEditorState } = $props();

  const s = $derived(ed.data.settings);

  function rule(i: number, patch: Partial<HeightRule>) {
    ed.updateSettings({ maxHeights: s.maxHeights.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  }

  function ratio<K extends keyof ConsumableRatios>(k: K, patch: Partial<ConsumableRatios[K]>) {
    ed.updateSettings({ ratios: { ...s.ratios, [k]: { ...s.ratios[k], ...patch } } });
  }
</script>

<details class="settings">
  <summary>Réglages des cloisons</summary>

  <h3>Hauteurs maximales</h3>
  <p class="muted">
    Valeurs indicatives, à vérifier. Corrigez-les d’après la notice du fabricant du système, puis cochez « vérifié ».
  </p>
  <ul class="rules">
    {#each s.maxHeights as r, i (r.system + r.spacing)}
      <li>
        <strong>{r.system}, entraxe {r.spacing / 10} cm</strong>
        <NumberField
          label="Hauteur maximale"
          unit="cm"
          factor={10}
          min={0}
          value={r.max ?? 0}
          onchange={(max) => rule(i, { max: max > 0 ? max : null })}
        />
        <Checkbox
          label={r.verified ? 'Vérifié' : 'À vérifier'}
          checked={r.verified}
          onchange={(verified) => rule(i, { verified })}
        />
        <TextField label="Source" value={r.source} onchange={(e) => rule(i, { source: e.currentTarget.value })} />
      </li>
    {/each}
  </ul>

  <h3>Coupes et marges</h3>
  <div class="grid">
    <NumberField
      label="Longueur d’un rail"
      unit="cm"
      factor={10}
      min={1}
      value={s.railBar}
      onchange={(railBar) => ed.updateSettings({ railBar })}
    />
    <NumberField
      label="Jeu de hauteur d’un montant"
      unit="mm"
      min={0}
      value={s.studClearance}
      onchange={(studClearance) => ed.updateSettings({ studClearance })}
    />
    <NumberField
      label="Plaque plus courte que la cloison"
      unit="mm"
      min={0}
      value={s.plateGap}
      onchange={(plateGap) => ed.updateSettings({ plateGap })}
    />
    <NumberField
      label="Marge sur les plaques"
      unit="%"
      factor={0.01}
      min={0}
      max={100}
      value={s.plateMargin}
      onchange={(plateMargin) => ed.updateSettings({ plateMargin })}
    />
    <NumberField
      label="Marge sur l’isolant"
      unit="%"
      factor={0.01}
      min={0}
      max={100}
      value={s.insulationMargin}
      onchange={(insulationMargin) => ed.updateSettings({ insulationMargin })}
    />
    <NumberField
      label="Surface d’un rouleau d’isolant"
      unit="m²"
      min={0.1}
      decimals={2}
      value={s.insulationPack.m2}
      onchange={(m2) => ed.updateSettings({ insulationPack: { ...s.insulationPack, m2 } })}
    />
  </div>

  <h3>Consommables</h3>
  <p class="muted">Ratios indicatifs ; la notice du fabricant fait foi.</p>
  <div class="grid">
    <NumberField
      label="Vis 25 mm par m² de plaque"
      min={0}
      decimals={1}
      value={s.ratios.screw25.perM2}
      onchange={(perM2) => ratio('screw25', { perM2 })}
    />
    <NumberField
      label="Vis 35 mm par m² de plaque"
      min={0}
      decimals={1}
      value={s.ratios.screw35.perM2}
      onchange={(perM2) => ratio('screw35', { perM2 })}
    />
    <NumberField
      label="Bande à joint par m² de plaque"
      unit="m"
      min={0}
      decimals={2}
      value={s.ratios.jointTape.perM2}
      onchange={(perM2) => ratio('jointTape', { perM2 })}
    />
    <NumberField
      label="Enduit à joint par m² de plaque"
      unit="kg"
      min={0}
      decimals={2}
      value={s.ratios.jointCompound.kgPerM2}
      onchange={(kgPerM2) => ratio('jointCompound', { kgPerM2 })}
    />
    <NumberField
      label="Fixation des rails tous les"
      unit="cm"
      factor={10}
      min={5}
      value={s.ratios.fixing.spacing}
      onchange={(spacing) => ratio('fixing', { spacing })}
    />
  </div>
</details>

<style>
  .settings {
    margin: var(--space-4) 0;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  summary {
    min-height: var(--touch);
    display: flex;
    align-items: center;
    font-weight: 600;
    cursor: pointer;
  }
  h3 {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--fs-md);
  }
  .muted {
    margin: 0 0 var(--space-2);
    color: var(--muted);
  }
  .rules {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  .rules li {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
    align-items: end;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--line);
  }
  .rules strong {
    grid-column: 1 / -1;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
</style>
