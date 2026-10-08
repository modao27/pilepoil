<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import TileForm from '../components/TileForm.svelte';
  import { createTile } from '../../state/factories';
  import type { Tile } from '../../state/model';
  import { app } from '../../../../ui/lib/app.svelte';
  import { carrelage } from '../state.svelte';
  import { go } from '../../../../ui/lib/router.svelte';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import type { LibraryScreenProps } from '../../../types';

  let { itemId: id }: LibraryScreenProps = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement d'id ({#key} dans App.svelte).
  const existing = untrack(() => (id ? carrelage.tile(id) : undefined));
  let tile = $state<Tile>(existing ? { ...existing } : createTile({ name: '' }));
  let blocked = $state<string | null>(null);

  function save(t: Tile) {
    carrelage.putTile(t);
    app.collectPhotos();
    toast(existing ? 'Carreau enregistré.' : 'Carreau ajouté à la bibliothèque.');
    go({ name: 'library', lib: 'tiles' }, true);
  }

  function remove() {
    const user = carrelage.deleteTile(tile.id);
    if (user) {
      blocked = user;
      return;
    }
    app.collectPhotos();
    toast(`Carreau « ${tile.name} » supprimé.`);
    go({ name: 'library', lib: 'tiles' }, true);
  }
</script>

{#if id && !existing}
  <Screen title="Carreau introuvable" backHref="#/library/tiles" backLabel="Carreaux">
    <p>Ce carreau n’existe plus. <a href="#/library/tiles">Revenir à la bibliothèque</a>.</p>
  </Screen>
{:else}
  <Screen title={existing ? existing.name : 'Nouveau carreau'} backHref="#/library/tiles" backLabel="Carreaux">
    <TileForm bind:tile submitLabel={existing ? 'Enregistrer' : 'Ajouter le carreau'} onsubmit={save}>
      {#snippet extra()}
        {#if existing}<Button variant="danger" icon="trash" onclick={remove}>Supprimer le carreau</Button>{/if}
      {/snippet}
    </TileForm>
  </Screen>
  <Dialog open={blocked != null} title="Carreau utilisé" onclose={() => (blocked = null)}>
    <p>
      Ce carreau est utilisé dans le projet « {blocked} ». Choisissez un autre carreau dans ce projet, puis supprimez-le.
    </p>
    {#snippet actions()}<Button variant="primary" onclick={() => (blocked = null)}>Compris</Button>{/snippet}
  </Dialog>
{/if}
