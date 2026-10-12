<script lang="ts">
  /** Étape Avancé du calepinage carrelage : découpe et chutes (réglages du projet). */
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const settings = $derived(ed.project.settings);
</script>

<div class="tab">
  <section aria-labelledby="f-cut">
    <h3 id="f-cut">Découpe et chutes</h3>
    <Checkbox
      label="Réutiliser les chutes de coupe"
      hint="Les pièces de même numéro sortent du même carreau."
      checked={settings.reuseOffcuts}
      onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { reuseOffcuts: v } })}
    />
    <Checkbox
      label="Numéros de coupe sur le plan"
      checked={app.showCutNumbers}
      onchange={(v) => app.setShowCutNumbers(v)}
    />
    <div class="two">
      <NumberField
        label="Perte par coupe"
        value={settings.kerf}
        unit="mm"
        min={0}
        step={0.5}
        onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { kerf: v } })}
      />
      <NumberField
        label="Chute minimale gardée"
        value={settings.minOffcut}
        unit="mm"
        min={1}
        step={5}
        onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { minOffcut: v } })}
      />
      <NumberField
        label="Marge de casse"
        value={settings.margin}
        unit="%"
        min={0}
        max={50}
        onchange={(v) => ed.dispatch({ type: 'carrelage/settings', patch: { margin: v } })}
      />
    </div>
    <p class="muted">
      Les pièces restent face émaillée dessus, jamais retournées. Le sens de rotation des chutes se règle sur le carreau
      (étape Produit, « Modifier ce carreau »).
    </p>
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
  .muted {
    font-size: var(--fs-sm);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }
</style>
