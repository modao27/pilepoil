<script lang="ts">
  /** Formulaire de carreau (bibliothèque et assistant). */
  import type { Snippet } from 'svelte';
  import type { Tile, TileShape } from '../../state/model';
  import { tileName } from '../../state/factories';
  import { app } from '../lib/app.svelte';
  import Button from './Button.svelte';
  import ColorSwatch from './ColorSwatch.svelte';
  import NumberField from './NumberField.svelte';
  import PhotoPicker from './PhotoPicker.svelte';
  import Segmented from './Segmented.svelte';
  import TextField from './TextField.svelte';

  let {
    tile = $bindable(),
    submitLabel,
    onsubmit,
    extra,
  }: { tile: Tile; submitLabel: string; onsubmit: (t: Tile) => void; extra?: Snippet } = $props();

  const regular = $derived(tile.shape === 'hex' || tile.shape === 'octo');
  let price = $state(tile.pricePerM2 ?? 0);
  let error = $state('');
  $effect(() => app.loadPhoto(tile.photoId));

  function setShape(s: TileShape) {
    tile.shape = s;
    if (s === 'hex' || s === 'octo') tile.width = tile.length;
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!(tile.length > 0) || (!regular && !(tile.width > 0))) {
      error = 'Renseignez les dimensions du carreau.';
      return;
    }
    let { length, width } = tile;
    if (regular) width = length;
    else if (width > length) [length, width] = [width, length];
    const name = tile.name.trim() || tileName(tile.shape, length, width);
    onsubmit({ ...$state.snapshot(tile), name, length, width, pricePerM2: price > 0 ? price : null });
  }
</script>

<form class="tf" onsubmit={submit} novalidate>
  <TextField
    label="Nom"
    bind:value={tile.name}
    placeholder={tileName(tile.shape, tile.length, tile.width)}
    maxlength={60}
    hint="Laissez vide pour nommer d’après les dimensions."
  />

  <div class="field">
    <span class="lbl">Forme</span>
    <Segmented
      label="Forme du carreau"
      value={tile.shape}
      onchange={setShape}
      options={[
        { value: 'rect', label: 'Rectangle' },
        { value: 'hex', label: 'Hexagone' },
        { value: 'octo', label: 'Octogone' },
        { value: 'chevron', label: 'Hongrie' },
      ]}
    />
  </div>

  <div class="two">
    <NumberField
      label={regular ? 'Largeur plat à plat' : 'Longueur'}
      bind:value={tile.length}
      unit="mm"
      min={1}
      max={3200}
      step={5}
      decimals={1}
    />
    {#if !regular}
      <NumberField label="Largeur" bind:value={tile.width} unit="mm" min={1} max={3200} step={5} decimals={1} />
    {/if}
    <NumberField
      label="Épaisseur"
      bind:value={tile.thickness}
      unit="mm"
      min={0}
      max={40}
      step={0.5}
      hint="Sert au calcul du joint."
    />
  </div>

  <ColorSwatch label="Couleur" bind:value={tile.color} palette={app.palette.tiles} />

  <div class="field">
    <span class="lbl">Photo (facultatif)</span>
    <PhotoPicker
      url={tile.photoId ? app.photoUrls[tile.photoId] : null}
      onpick={async (p) => (tile.photoId = await app.savePhoto(p.blob, p.width, p.height))}
      onremove={() => (tile.photoId = null)}
    />
  </div>

  <div class="two">
    <NumberField
      label="Surface par carton"
      bind:value={tile.m2PerBox}
      unit="m²"
      min={0}
      step={0.01}
      decimals={3}
      hint="0 si vendu à la pièce."
    />
    <NumberField label="Prix" bind:value={price} unit="€/m²" min={0} step={1} decimals={2} hint="Facultatif." />
  </div>

  <div class="field">
    <span class="lbl">Sens du carreau</span>
    <Segmented
      label="Sens du carreau"
      bind:value={tile.orientation}
      options={[
        { value: 'free', label: 'Sans sens' },
        { value: '180', label: 'Demi-tour' },
        { value: 'none', label: 'Orienté' },
      ]}
    />
    <p class="hint muted">
      {tile.orientation === 'free'
        ? 'Les chutes peuvent être tournées dans tous les sens.'
        : tile.orientation === '180'
          ? 'Veinage ou nuance : les chutes ne sont retournées que d’un demi-tour.'
          : 'Motif orienté : les chutes ne sont jamais tournées.'}
    </p>
  </div>

  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <div class="actions">
    <Button type="submit" variant="primary" icon="check">{submitLabel}</Button>
    {#if extra}{@render extra()}{/if}
  </div>
</form>

<style>
  .tf {
    display: grid;
    gap: var(--space-4);
    max-width: 640px;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .hint {
    font-size: var(--fs-xs);
  }
  .err {
    color: var(--thin-ink);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
  }
</style>
