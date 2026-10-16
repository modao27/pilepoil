<script lang="ts">
  /**
   * Fiche produit reçue du favori « Envoyer à PilePoil » (#/import/<texte>) ou collée ici (#/import) : choix de la
   * bibliothèque, puis formulaire « nouveau » pré-rempli par le module (rien n'est enregistré sans validation).
   */
  import { untrack } from 'svelte';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { libraries } from '../../modules/registry';
  import { app } from '../lib/app.svelte';
  import { rankLibraries } from '../lib/importSheet';
  import { go } from '../lib/router.svelte';

  let { text: received }: { text: string } = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement de texte ({#key} dans App.svelte).
  let text = $state(untrack(() => received));
  const ranked = $derived(rankLibraries(text, libraries));
  let chosen = $state<string | null>(null);
  const lib = $derived(chosen ?? ranked[0]?.id ?? null);
  const title = $derived(text.split('\n')[0]?.trim() ?? '');

  function next() {
    if (!lib || !text.trim()) return;
    app.setPendingSheet(lib, text);
    go({ name: 'libraryItem', lib, id: null }, true);
  }
</script>

<Screen title="Importer un produit" backHref="#/library" backLabel="Bibliothèques">
  {#if !ranked.length}
    <EmptyState icon="info" title="Aucune bibliothèque ne lit les fiches produit" text="" />
  {:else}
    <div class="form">
      {#if received}
        <p>Produit reçu : <strong>{title}</strong></p>
      {:else}
        <label for="imp-text">Caractéristiques du produit</label>
        <textarea id="imp-text" bind:value={text} rows="8"></textarea>
        <p class="muted">
          Copiez le tableau des caractéristiques sur le site du magasin et collez-le ici. Pour envoyer une fiche en un
          geste, installez le favori « Envoyer à PilePoil » depuis les <a href="#/settings">Réglages</a>.
        </p>
      {/if}
      <div class="field">
        <span class="lbl">Ajouter à</span>
        <Segmented
          label="Bibliothèque"
          value={lib ?? ''}
          onchange={(v: string) => (chosen = v)}
          options={ranked.map((d) => ({ value: d.id, label: d.label }))}
        />
      </div>
      <div class="actions">
        <Button variant="primary" icon="check" disabled={!text.trim()} onclick={next}>Continuer</Button>
      </div>
    </div>
  {/if}
</Screen>

<style>
  .form {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .lbl,
  label {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  textarea {
    width: 100%;
    min-height: 10rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    font: inherit;
    font-size: var(--fs-sm);
    resize: vertical;
  }
  .muted {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  .actions {
    display: flex;
    gap: var(--space-2);
  }
</style>
