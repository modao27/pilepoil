<script lang="ts" generics="T">
  /**
   * « Coller une fiche produit » : le texte copié sur le site d'un magasin pré-remplit le formulaire (docs/BOITE.md
   * §11, B1). Le module fournit la lecture (`read`) ; rien n'est enregistré sans validation. `pending` : fiche reçue
   * du favori « Envoyer à PilePoil », appliquée à l'ouverture.
   */
  import { onMount } from 'svelte';
  import type { SheetRead } from '../../core/sheet';
  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

  let {
    read,
    labels,
    onapply,
    pending = null,
  }: {
    read: (text: string) => SheetRead<T>;
    /** Nom de chaque champ dans le formulaire, pour dire ce qui a été rempli. */
    labels: Partial<Record<keyof T & string, string>>;
    onapply: (fields: Partial<T>) => void;
    pending?: string | null;
  } = $props();

  let open = $state(false);
  let text = $state('');
  let error = $state('');
  let filled = $state<string[]>([]);
  const uid = Math.random().toString(36).slice(2);

  function apply(t: string): boolean {
    const r = read(t);
    if (!r.read.length) return false;
    onapply(r.fields);
    filled = r.read.map((k) => labels[k]).filter((l): l is string => !!l);
    return true;
  }

  function submit() {
    if (apply(text)) {
      open = false;
      text = '';
      error = '';
    } else error = 'Aucune caractéristique reconnue. Collez le tableau des caractéristiques du produit.';
  }

  async function fromClipboard() {
    try {
      text = await navigator.clipboard.readText();
    } catch {
      error = 'Le presse-papiers n’est pas accessible : collez le texte dans le champ.';
    }
  }

  onMount(() => {
    if (pending && !apply(pending)) error = 'La fiche reçue ne contient aucune caractéristique reconnue.';
  });
</script>

<div class="ps">
  <Button icon="documents" onclick={() => ((open = true), (error = ''))}>Coller une fiche produit</Button>
  {#if filled.length}
    <p class="done" role="status">
      Rempli depuis la fiche : {filled.join(', ')}. Vérifiez avant d’enregistrer.
    </p>
  {:else if error && !open}
    <p class="err" role="alert">{error}</p>
  {/if}
</div>

<Dialog bind:open title="Coller une fiche produit">
  <div class="body">
    <p class="muted">
      Sur le site du magasin, copiez le tableau des caractéristiques du produit (ou toute la page), puis collez-le ici.
    </p>
    <label for="ps-{uid}">Caractéristiques du produit</label>
    <textarea
      id="ps-{uid}"
      bind:value={text}
      rows="8"
      aria-invalid={error ? 'true' : undefined}
      oninput={() => (error = '')}></textarea>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
  </div>
  {#snippet actions()}
    {#if typeof navigator !== 'undefined' && navigator.clipboard && 'readText' in navigator.clipboard}
      <Button variant="ghost" onclick={fromClipboard}>Coller depuis le presse-papiers</Button>
    {/if}
    <Button variant="primary" icon="check" onclick={submit}>Remplir</Button>
  {/snippet}
</Dialog>

<style>
  .ps {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
  }
  .body {
    display: grid;
    gap: var(--space-2);
  }
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
  textarea[aria-invalid='true'] {
    border-color: var(--color-error);
  }
  .done {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--r-field);
    background: var(--accent-soft);
    font-size: var(--fs-sm);
  }
  .err {
    color: var(--thin-ink);
    font-size: var(--fs-sm);
  }
  .muted {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
</style>
