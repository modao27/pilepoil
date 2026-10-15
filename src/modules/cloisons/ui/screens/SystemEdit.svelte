<script lang="ts">
  /** Formulaire d'un système de cloison (#/library/systems/<id> ou /new) : épaisseur, ossature, plaques. */
  import { untrack } from 'svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import ItemInUseDialog from '../../../../ui/components/ItemInUseDialog.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { go } from '../../../../ui/lib/router.svelte';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import type { LibraryScreenProps } from '../../../types';
  import { createSystem, thicknessMismatch, validateSystem } from '../../core/defaults';
  import type { PartitionSystem } from '../../core/types';

  let { itemId: id }: LibraryScreenProps = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement d'id ({#key} dans App.svelte).
  const existing = untrack(() => (id ? app.libraryItem<PartitionSystem>('systems', id) : undefined));
  let system = $state<PartitionSystem>(
    existing ? structuredClone($state.snapshot(existing)) : createSystem(crypto.randomUUID(), Date.now(), { name: '' }),
  );
  let tried = $state(false);

  const errors = $derived(validateSystem(system));
  const mismatch = $derived(thicknessMismatch(system));
  const MESSAGES: Record<string, string> = {
    name: 'Donnez un nom au système (« 72/48 »).',
    thickness: 'L’épaisseur finie doit être positive.',
    studWidth: 'La largeur d’ossature doit être positive.',
    plateThickness: 'L’épaisseur d’une plaque doit être positive.',
  };

  function save(e: SubmitEvent) {
    e.preventDefault();
    tried = true;
    if (errors.length) return;
    app.putLibraryItem('systems', { ...$state.snapshot(system), name: system.name.trim(), updatedAt: Date.now() });
    toast(existing ? 'Système enregistré.' : 'Système ajouté à la bibliothèque.');
    go({ name: 'library', lib: 'systems' }, true);
  }

  function duplicate() {
    const copy: PartitionSystem = {
      ...$state.snapshot(system),
      id: crypto.randomUUID(),
      name: system.name + ' (copie)',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    app.putLibraryItem('systems', copy);
    toast('Système dupliqué.');
    go({ name: 'libraryItem', lib: 'systems', id: copy.id }, true);
  }

  let blocked = $state<string | null>(null);

  function remove() {
    blocked = app.removeLibraryItem('systems', system.id);
    if (blocked) return;
    toast(`Système « ${system.name} » supprimé.`);
    go({ name: 'library', lib: 'systems' }, true);
  }
</script>

{#if id && !existing}
  <Screen title="Système introuvable" backHref="#/library/systems" backLabel="Cloisons">
    <p>Ce système n’existe plus. <a href="#/library/systems">Revenir à la bibliothèque</a>.</p>
  </Screen>
{:else}
  <Screen title={existing ? existing.name : 'Nouveau système'} backHref="#/library/systems" backLabel="Cloisons">
    <form class="form" onsubmit={save} novalidate>
      <TextField label="Nom" bind:value={system.name} maxlength={40} placeholder="72/48" />
      <div class="grid">
        <NumberField label="Épaisseur finie" unit="mm" min={1} decimals={1} bind:value={system.thickness} />
        <NumberField label="Largeur d’ossature" unit="mm" min={1} decimals={1} bind:value={system.studWidth} />
        <NumberField label="Épaisseur d’une plaque" unit="mm" min={1} decimals={1} bind:value={system.plateThickness} />
      </div>
      <Segmented
        label="Plaques par face"
        bind:value={system.layers}
        options={[
          { value: 1, label: 'Une plaque' },
          { value: 2, label: 'Deux plaques' },
        ]}
      />
      {#if mismatch}
        <p class="warn" role="status">
          L’ossature et les plaques ne font pas l’épaisseur annoncée : {system.studWidth} + 2 × {system.layers} × {system.plateThickness}
          mm. Vérifiez la notice du fabricant.
        </p>
      {/if}
      <p class="muted">
        Vérifier la notice du fabricant : hauteurs maximales, entraxes et fixations dépendent du système.
      </p>
      {#if tried && errors.length}
        <ul class="errors" role="alert">
          {#each errors as e (e)}<li>{MESSAGES[e]}</li>{/each}
        </ul>
      {/if}
      <div class="row">
        <Button type="submit" variant="primary" icon="check">{existing ? 'Enregistrer' : 'Ajouter le système'}</Button>
        {#if existing}
          <Button icon="copy" onclick={duplicate}>Dupliquer</Button>
          <Button variant="danger" icon="trash" onclick={remove}>Supprimer le système</Button>
        {/if}
      </div>
    </form>
  </Screen>
  <ItemInUseDialog
    bind:project={blocked}
    title="Système utilisé"
    message={(p) =>
      `Ce système sert à une cloison du projet « ${p} ». Choisissez un autre système pour cette cloison, puis supprimez-le.`}
  />
{/if}

<style>
  .form {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
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
  .warn,
  .errors {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
  }
  .errors {
    list-style: none;
  }
</style>
