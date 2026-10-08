<script lang="ts">
  /** Création rapide d'une pièce : rectangle, L, U (cotes) ou dessin libre point par point. */
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Segmented from '../components/Segmented.svelte';
  import TextField from '../components/TextField.svelte';
  import type { PlanEditorState } from './planState.svelte';

  let { st, open = $bindable(false) }: { st: PlanEditorState; open: boolean } = $props();

  type Kind = 'rect' | 'l' | 'u' | 'draw';
  let kind = $state<Kind>('rect');
  let name = $state('');
  let length = $state(4000);
  let width = $state(3000);
  let cutLength = $state(1500);
  let cutWidth = $state(1200);
  let arm = $state(1200);
  let depth = $state(1200);

  $effect(() => {
    if (open) name = st.nextRoomName();
  });

  const valid = $derived(
    kind === 'draw' ||
      (length > 0 &&
        width > 0 &&
        (kind !== 'l' || (cutLength < length && cutWidth < width)) &&
        (kind !== 'u' || (2 * arm < length && depth < width))),
  );

  function create() {
    if (!valid) return;
    const n = name.trim() || st.nextRoomName();
    if (kind === 'draw') st.startDraw();
    else if (kind === 'rect') st.addRoom({ kind, length, width }, n);
    else if (kind === 'l') st.addRoom({ kind, length, width, cutLength, cutWidth }, n);
    else st.addRoom({ kind, length, width, arm, depth }, n);
    open = false;
  }
</script>

<Dialog bind:open title="Ajouter une pièce">
  <div class="form">
    <Segmented
      label="Forme"
      bind:value={kind}
      options={[
        { value: 'rect', label: 'Rectangle' },
        { value: 'l', label: 'En L' },
        { value: 'u', label: 'En U' },
        { value: 'draw', label: 'Dessin' },
      ]}
    />
    {#if kind === 'draw'}
      <p class="muted">Vous placerez chaque coin sur le plan, puis vous fermerez la pièce sur le premier point.</p>
    {:else}
      <TextField label="Nom" bind:value={name} maxlength={40} />
      <div class="grid">
        <NumberField label="Longueur" unit="cm" factor={10} min={10} bind:value={length} />
        <NumberField label="Largeur" unit="cm" factor={10} min={10} bind:value={width} />
        {#if kind === 'l'}
          <NumberField label="Retrait en longueur" unit="cm" factor={10} min={1} bind:value={cutLength} />
          <NumberField label="Retrait en largeur" unit="cm" factor={10} min={1} bind:value={cutWidth} />
        {:else if kind === 'u'}
          <NumberField label="Largeur des ailes" unit="cm" factor={10} min={1} bind:value={arm} />
          <NumberField label="Profondeur de l’encoche" unit="cm" factor={10} min={1} bind:value={depth} />
        {/if}
      </div>
      {#if !valid}<p class="error" role="alert">Le retrait doit rester plus petit que la pièce.</p>{/if}
    {/if}
  </div>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (open = false)}>Annuler</Button>
    <Button variant="primary" disabled={!valid} onclick={create}
      >{kind === 'draw' ? 'Commencer le dessin' : 'Ajouter'}</Button
    >
  {/snippet}
</Dialog>

<style>
  .form {
    display: grid;
    gap: var(--space-3);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-3);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .error {
    margin: 0;
    color: var(--thin);
  }
</style>
