<script lang="ts">
  /** Formulaire d'un matériau (#/library/materials/<id> ou /new) : dimensions, poids, technique de pose. */
  import { untrack } from 'svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import ItemInUseDialog from '../../../../ui/components/ItemInUseDialog.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { go } from '../../../../ui/lib/router.svelte';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import type { LibraryScreenProps } from '../../../types';
  import { BINDER_LABEL, FAMILY_LABEL, createMaterial, defaultLaying, validateMaterial } from '../../core/defaults';
  import type { Binder, Material, MaterialFamily } from '../../core/types';

  let { itemId: id }: LibraryScreenProps = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement d'id ({#key} dans App.svelte).
  const existing = untrack(() => (id ? app.libraryItem<Material>('materials', id) : undefined));
  let material = $state<Material>(
    existing ? structuredClone($state.snapshot(existing)) : createMaterial(crypto.randomUUID(), Date.now()),
  );
  let tried = $state(false);
  let weight = $state<number>(existing?.weight ?? 0);
  let binderPerM2 = $state<number>(existing?.laying.binderPerM2 ?? 0);

  const errors = $derived(validateMaterial(material));
  const MESSAGES: Record<string, string> = {
    name: 'Donnez un nom au matériau (« Parpaing creux 20×20×50 »).',
    length: 'La longueur doit être positive.',
    height: 'La hauteur doit être positive.',
    thickness: 'L’épaisseur doit être positive.',
    joint: 'Joint : le minimum, la valeur usuelle et le maximum doivent être dans l’ordre.',
  };

  const families = (Object.keys(FAMILY_LABEL) as MaterialFamily[]).map((value) => ({
    value,
    label: FAMILY_LABEL[value],
  }));
  const binders = (Object.keys(BINDER_LABEL) as Binder[]).map((value) => ({ value, label: BINDER_LABEL[value] }));

  /** Changer de famille propose la technique usuelle de cette famille. */
  function onFamily(f: MaterialFamily) {
    material.laying = defaultLaying(f);
    binderPerM2 = 0;
  }

  function finished(): Material {
    const m = $state.snapshot(material);
    return {
      ...m,
      name: m.name.trim(),
      weight: weight > 0 ? weight : null,
      laying: { ...m.laying, binderPerM2: binderPerM2 > 0 ? binderPerM2 : null },
      updatedAt: Date.now(),
    };
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    tried = true;
    if (errors.length) return;
    app.putLibraryItem('materials', finished());
    toast(existing ? 'Matériau enregistré.' : 'Matériau ajouté à la bibliothèque.');
    go({ name: 'library', lib: 'materials' }, true);
  }

  function duplicate() {
    const copy: Material = {
      ...finished(),
      id: crypto.randomUUID(),
      name: material.name + ' (copie)',
      createdAt: Date.now(),
    };
    app.putLibraryItem('materials', copy);
    toast('Matériau dupliqué.');
    go({ name: 'libraryItem', lib: 'materials', id: copy.id }, true);
  }

  let blocked = $state<string | null>(null);

  function remove() {
    blocked = app.removeLibraryItem('materials', material.id);
    if (blocked) return;
    toast(`Matériau « ${material.name} » supprimé.`);
    go({ name: 'library', lib: 'materials' }, true);
  }
</script>

{#if id && !existing}
  <Screen title="Matériau introuvable" backHref="#/library/materials" backLabel="Maçonnerie">
    <p>Ce matériau n’existe plus. <a href="#/library/materials">Revenir à la bibliothèque</a>.</p>
  </Screen>
{:else}
  <Screen title={existing ? existing.name : 'Nouveau matériau'} backHref="#/library/materials" backLabel="Maçonnerie">
    <form class="form" onsubmit={save} novalidate>
      <TextField label="Nom" bind:value={material.name} maxlength={48} placeholder="Parpaing creux 20×20×50" />
      <Select label="Famille" bind:value={material.family} options={families} onchange={onFamily} />
      <div class="grid">
        <NumberField label="Longueur" unit="mm" min={1} decimals={1} bind:value={material.length} />
        <NumberField label="Hauteur" unit="mm" min={1} decimals={1} bind:value={material.height} />
        <NumberField label="Épaisseur" unit="mm" min={1} decimals={1} bind:value={material.thickness} />
        <NumberField label="Poids (vide : à compléter)" unit="kg" min={0} decimals={2} bind:value={weight} />
      </div>

      <h2>Technique de pose</h2>
      <Select label="Liant" bind:value={material.laying.binder} options={binders} />
      <NumberField
        label="Consommation de liant (vide : à compléter)"
        unit="kg/m²"
        min={0}
        decimals={2}
        bind:value={binderPerM2}
      />
      <div class="grid">
        <NumberField
          label="Joint horizontal mini"
          unit="mm"
          min={0}
          decimals={1}
          bind:value={material.laying.jointH.min}
        />
        <NumberField
          label="Joint horizontal usuel"
          unit="mm"
          min={0}
          decimals={1}
          bind:value={material.laying.jointH.def}
        />
        <NumberField
          label="Joint horizontal maxi"
          unit="mm"
          min={0}
          decimals={1}
          bind:value={material.laying.jointH.max}
        />
      </div>
      <Segmented
        label="Appareillage"
        bind:value={material.laying.bond}
        options={[
          { value: 'running', label: 'À demi-longueur' },
          { value: 'stack', label: 'Joints alignés' },
        ]}
      />
      {#if !material.laying.cutAllowed}
        <p class="muted">Ce matériau ne se coupe pas : un panneau se compose d’éléments entiers.</p>
      {/if}
      <p class="muted">Valeurs données à titre indicatif (estimation). Vérifiez la notice du fabricant.</p>
      {#if tried && errors.length}
        <ul class="errors" role="alert">
          {#each errors as e (e)}<li>{MESSAGES[e]}</li>{/each}
        </ul>
      {/if}
      <div class="row">
        <Button type="submit" variant="primary" icon="check">{existing ? 'Enregistrer' : 'Ajouter le matériau'}</Button>
        {#if existing}
          <Button icon="copy" onclick={duplicate}>Dupliquer</Button>
          <Button variant="danger" icon="trash" onclick={remove}>Supprimer le matériau</Button>
        {/if}
      </div>
    </form>
  </Screen>
  <ItemInUseDialog
    bind:project={blocked}
    title="Matériau utilisé"
    message={(p) =>
      `Ce matériau sert à un mur du projet « ${p} ». Choisissez un autre matériau pour ce mur, puis supprimez-le.`}
  />
{/if}

<style>
  .form {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .errors {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    list-style: none;
  }
</style>
