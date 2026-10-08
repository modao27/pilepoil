<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Screen from '../components/Screen.svelte';
  import TileForm from '../components/TileForm.svelte';
  import { createTile } from '../../modules/carrelage';
  import type { Tile } from '../../state/model';
  import { app } from '../lib/app.svelte';
  import { go } from '../lib/router.svelte';
  import { toast } from '../lib/toasts.svelte';

  let { id }: { id: string | null } = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement d'id ({#key} dans App.svelte).
  const existing = untrack(() => (id ? app.tile(id) : undefined));
  let tile = $state<Tile>(existing ? { ...existing } : createTile({ name: '' }));
  let blocked = $state<string | null>(null);

  function save(t: Tile) {
    app.putTile(t);
    app.collectPhotos();
    toast(existing ? 'Carreau enregistré.' : 'Carreau ajouté à la bibliothèque.');
    go({ name: 'library' }, true);
  }

  function remove() {
    const user = app.deleteTile(tile.id);
    if (user) {
      blocked = user;
      return;
    }
    app.collectPhotos();
    toast(`Carreau « ${tile.name} » supprimé.`);
    go({ name: 'library' }, true);
  }
</script>

{#if id && !existing}
  <Screen title="Carreau introuvable" backHref="#/library" backLabel="Bibliothèque">
    <p>Ce carreau n’existe plus. <a href="#/library">Revenir à la bibliothèque</a>.</p>
  </Screen>
{:else}
  <Screen title={existing ? existing.name : 'Nouveau carreau'} backHref="#/library" backLabel="Bibliothèque">
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
