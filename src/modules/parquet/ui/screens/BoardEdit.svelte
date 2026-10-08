<script lang="ts">
  /** Formulaire de lame (#/library/boards/<id> ou /new) : dimensions, longueurs mixtes, paquet, prix. */
  import { untrack } from 'svelte';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import ColorSwatch from '../../../../ui/components/ColorSwatch.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import TextField from '../../../../ui/components/TextField.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { formatNumber } from '../../../../ui/lib/calc';
  import { go } from '../../../../ui/lib/router.svelte';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import type { LibraryScreenProps } from '../../../types';
  import { createBoard, packArea, packMismatch, validateBoard, type Board, type BoardKind } from '../../core/board';
  import { BOARD_ERRORS, KIND_LABEL, PROFILE_LABEL } from '../lib/labels';

  let { itemId: id }: LibraryScreenProps = $props();

  // Valeur initiale voulue : l'écran est recréé à chaque changement d'id ({#key} dans App.svelte).
  const existing = untrack(() => (id ? app.libraryItem<Board>('boards', id) : undefined));
  let board = $state<Board>(
    existing ? structuredClone($state.snapshot(existing)) : createBoard(crypto.randomUUID(), Date.now(), { name: '' }),
  );
  let tried = $state(false);
  let price = $state(existing?.pricePerPack ?? 0);

  const errors = $derived(validateBoard(board));
  const mismatch = $derived(packMismatch(board));
  const mixed = $derived(board.lengths.length > 1);

  function addLength() {
    const last = board.lengths.at(-1) ?? 1000;
    board.lengths = [...board.lengths, last + 200];
    board.lengthMix = board.lengths.map(() => 1 / board.lengths.length);
  }

  function removeLength(i: number) {
    board.lengths = board.lengths.filter((_, k) => k !== i);
    board.lengthMix = board.lengths.length > 1 ? board.lengths.map(() => 1 / board.lengths.length) : null;
  }

  function setMix(i: number, pct: number) {
    const mix = board.lengthMix ?? board.lengths.map(() => 1 / board.lengths.length);
    board.lengthMix = mix.map((m, k) => (k === i ? pct / 100 : m));
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    tried = true;
    if (errors.length) return;
    const b: Board = { ...$state.snapshot(board), name: board.name.trim(), pricePerPack: price > 0 ? price : null };
    app.putLibraryItem('boards', b);
    toast(existing ? 'Lame enregistrée.' : 'Lame ajoutée à la bibliothèque.');
    go({ name: 'library', lib: 'boards' }, true);
  }

  function duplicate() {
    const copy: Board = {
      ...$state.snapshot(board),
      id: crypto.randomUUID(),
      name: board.name + ' (copie)',
      createdAt: Date.now(),
    };
    app.putLibraryItem('boards', copy);
    toast('Lame dupliquée.');
    go({ name: 'libraryItem', lib: 'boards', id: copy.id }, true);
  }

  function remove() {
    app.removeLibraryItem('boards', board.id);
    toast(`Lame « ${board.name} » supprimée.`);
    go({ name: 'library', lib: 'boards' }, true);
  }
</script>

{#if id && !existing}
  <Screen title="Lame introuvable" backHref="#/library/boards" backLabel="Lames">
    <p>Cette lame n’existe plus. <a href="#/library/boards">Revenir à la bibliothèque</a>.</p>
  </Screen>
{:else}
  <Screen title={existing ? existing.name : 'Nouvelle lame'} backHref="#/library/boards" backLabel="Lames">
    <form class="form" onsubmit={save} novalidate>
      <TextField label="Nom" bind:value={board.name} maxlength={60} placeholder="Chêne naturel 1285 × 192" />
      <Select
        label="Type de lame"
        bind:value={board.kind}
        options={(Object.keys(KIND_LABEL) as BoardKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
      />

      <fieldset>
        <legend>Longueurs</legend>
        <ul class="lengths">
          {#each board.lengths as _, i (i)}
            <li>
              <NumberField
                label={mixed ? `Longueur ${i + 1}` : 'Longueur'}
                unit="mm"
                min={1}
                decimals={0}
                bind:value={board.lengths[i]!}
              />
              {#if mixed}
                <NumberField
                  label="Part du paquet"
                  unit="%"
                  min={0}
                  max={100}
                  decimals={0}
                  value={Math.round((board.lengthMix?.[i] ?? 0) * 100)}
                  onchange={(v) => setMix(i, v)}
                />
                <Button variant="ghost" icon="trash" onclick={() => removeLength(i)}>Retirer</Button>
              {/if}
            </li>
          {/each}
        </ul>
        <Button icon="plus" onclick={addLength}>Ajouter une longueur (longueurs mixtes)</Button>
      </fieldset>

      <div class="grid">
        <NumberField
          label="Largeur utile"
          unit="mm"
          min={1}
          decimals={0}
          hint="Hors languette."
          bind:value={board.width}
        />
        <NumberField label="Épaisseur" unit="mm" min={1} decimals={1} bind:value={board.thickness} />
      </div>
      <Segmented
        label="Assemblage"
        bind:value={board.profile}
        options={[
          { value: 'click', label: PROFILE_LABEL.click },
          { value: 'tongue-groove', label: PROFILE_LABEL['tongue-groove'] },
        ]}
      />
      <Checkbox
        label="Lames gauche et droite (A/B)"
        hint="Bâton rompu, point de Hongrie : deux variantes, emballées séparément."
        bind:checked={board.handed}
      />
      <ColorSwatch label="Couleur" bind:value={board.color} />

      <fieldset>
        <legend>Paquet</legend>
        <div class="grid">
          <NumberField
            label={board.handed ? 'Lames par paquet (par variante)' : 'Lames par paquet'}
            min={1}
            decimals={0}
            bind:value={board.boardsPerPack}
          />
          <NumberField
            label="Surface annoncée"
            unit="m²"
            min={0}
            decimals={2}
            step={0.01}
            bind:value={board.m2PerPack}
          />
          <NumberField label="Prix du paquet" unit="€" min={0} decimals={2} step={0.5} bind:value={price} />
        </div>
        <p class="muted num">Surface calculée : {formatNumber(packArea(board), 2)} m² par paquet.</p>
        {#if mismatch}
          <p class="warn" role="status">
            La surface annoncée s’écarte de plus de 3 % de celle des lames du paquet. Vérifiez les dimensions ou le
            nombre de lames : le nombre de paquets se calcule avec le nombre de lames.
          </p>
        {/if}
      </fieldset>

      {#if tried && errors.length}
        <ul class="errors" role="alert">
          {#each errors as e (e)}<li>{BOARD_ERRORS[e]}</li>{/each}
        </ul>
      {/if}

      <div class="row">
        <Button type="submit" variant="primary" icon="check">{existing ? 'Enregistrer' : 'Ajouter la lame'}</Button>
        {#if existing}
          <Button icon="copy" onclick={duplicate}>Dupliquer</Button>
          <Button variant="danger" icon="trash" onclick={remove}>Supprimer la lame</Button>
        {/if}
      </div>
    </form>
  </Screen>
{/if}

<style>
  .form {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  fieldset {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
  }
  legend {
    padding: 0 var(--space-1);
    font-weight: 600;
  }
  .lengths {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  .lengths li,
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-3);
    align-items: end;
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
  .warn {
    margin: 0;
    padding: var(--space-3);
    border-left: 4px solid var(--cut);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--cut) 15%, var(--sheet));
  }
  .errors {
    margin: 0;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-6);
    border-left: 4px solid var(--thin);
    border-radius: var(--r-field);
    background: color-mix(in srgb, var(--thin) 8%, var(--sheet));
  }
</style>
