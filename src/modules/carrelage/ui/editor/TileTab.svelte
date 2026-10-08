<script lang="ts">
  import { createTile } from '../../state/factories';
  import type { Tile } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import ColorSwatch from '../../../../ui/components/ColorSwatch.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import TileForm from '../components/TileForm.svelte';
  import TileSwatch from '../components/TileSwatch.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { mm, tileSize } from '../../../../ui/lib/format';
  import { glueNoteText, NOTCH_LABEL } from '../lib/labels';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const tile = $derived(app.tile(ed.zone.tileId));
  const regular = $derived(tile?.shape === 'hex' || tile?.shape === 'octo');
  let dialog = $state<'new' | 'edit' | null>(null);
  let draft = $state<Tile>(createTile({ name: '' }));

  const glue = $derived(ed.result?.glue.find((g) => g.surface === ed.surfaceIndex && g.zone === ed.zoneIndex));

  function openNew() {
    draft = createTile({ name: '' });
    dialog = 'new';
  }
  function openEdit() {
    if (!tile) return;
    draft = { ...tile };
    dialog = 'edit';
  }
  function save(t: Tile) {
    app.putTile(t);
    if (dialog === 'new') ed.updateZone({ tileId: t.id });
    dialog = null;
    void ed.recompute();
  }
</script>

<div class="tab">
  <section aria-labelledby="t-tile">
    <h3 id="t-tile">Carreau{ed.surface.zones.length > 1 ? ` de la zone ${ed.zoneIndex + 1}` : ''}</h3>
    <div class="tiles" role="radiogroup" aria-labelledby="t-tile">
      {#each app.tiles as t (t.id)}
        <button
          type="button"
          role="radio"
          aria-checked={t.id === ed.zone.tileId}
          onclick={() => ed.updateZone({ tileId: t.id })}
        >
          <TileSwatch tile={t} size={36} />
          <span class="tt"
            ><strong>{t.name}</strong><span class="muted"
              >{tileSize(t.length, t.width, t.shape)} · ép. {mm(t.thickness)}</span
            ></span
          >
        </button>
      {/each}
    </div>
    <div class="row">
      <Button icon="plus" onclick={openNew}>Nouveau carreau</Button>
      {#if tile}<Button icon="edit" variant="ghost" onclick={openEdit}>Modifier ce carreau</Button>{/if}
    </div>
    {#if tile && !regular}
      <Checkbox
        label="Pose debout"
        hint="Long côté vertical à 0°."
        checked={ed.zone.tileUpright}
        onchange={(v) => ed.updateZone({ tileUpright: v })}
      />
    {/if}
    <NumberField
      label="Joint"
      value={ed.surface.joint}
      unit="mm"
      min={0}
      max={20}
      step={0.5}
      onchange={(v) => ed.updateSurface({ joint: v })}
    />
  </section>

  <section aria-labelledby="t-colors">
    <h3 id="t-colors">Couleurs</h3>
    <div class="field">
      <span class="lbl">Mélange</span>
      <Segmented
        label="Mélange de couleurs"
        value={ed.zone.mix}
        onchange={(v) => ed.updateZone({ mix: v })}
        options={[
          { value: 'solid', label: 'Uni' },
          { value: 'alternate', label: 'Alterné' },
          { value: 'random', label: 'Aléatoire' },
        ]}
      />
    </div>
    {#if ed.zone.mix !== 'solid'}
      <ColorSwatch
        label="Seconde couleur"
        value={ed.zone.colorB}
        palette={app.palette.tiles}
        onchange={(c) => ed.updateZone({ colorB: c }, 'colorB')}
        onpalette={(tiles) => app.setPalette({ ...app.palette, tiles })}
      />
    {/if}
    <ColorSwatch
      label="Couleur du joint"
      value={ed.zone.groutColor}
      palette={app.palette.grouts}
      onchange={(c) => ed.updateZone({ groutColor: c }, 'grout')}
      onpalette={(grouts) => app.setPalette({ ...app.palette, grouts })}
    />
    {#if tile?.photoId}
      <Checkbox
        label="Retourner la photo au hasard"
        hint="Variation entre carreaux, dans la vue Rendu."
        checked={ed.zone.photoRandomFlip}
        onchange={(v) => ed.updateZone({ photoRandomFlip: v })}
      />
    {/if}
    <div class="field">
      <span class="lbl">Variation de teinte (rendu)</span>
      <Segmented
        label="Variation de teinte"
        value={ed.project.settings.shadeVariation}
        onchange={(v) => ed.dispatch({ type: 'project/settings', patch: { shadeVariation: v } })}
        options={[
          { value: 0, label: 'Aucune' },
          { value: 0.06, label: 'Légère' },
          { value: 0.14, label: 'Marquée' },
        ]}
      />
    </div>
    <div class="row">
      <Button variant="ghost" icon="copy" onclick={() => ed.copyColors()}>Copier</Button>
      <Button variant="ghost" disabled={!ed.colorClip} onclick={() => ed.pasteColors()}>Coller sur cette zone</Button>
      {#if ed.surface.zones.length > 1}
        <Button variant="ghost" onclick={() => ed.applyColorsToAllZones()}>Appliquer à toutes les zones</Button>
      {/if}
    </div>
  </section>

  {#if glue}
    <section class="glue" aria-labelledby="t-glue">
      <h3 id="t-glue">Encollage (indicatif)</h3>
      <p>
        Spatule crantée <strong>{NOTCH_LABEL[glue.advice.notch]}</strong>,
        <strong class:dbl={glue.advice.double}>{glue.advice.double ? 'double encollage' : 'simple encollage'}</strong>.
      </p>
      <p class="muted">
        Carreau de {Math.round(glue.advice.S)} cm² en {ed.surface.kind === 'floor' ? 'sol' : 'mur'} intérieur. Environ
        {glue.advice.kgPerM2.toLocaleString('fr-FR')} kg/m², soit {glue.kg} kg pour {glue.m2.toLocaleString('fr-FR', {
          maximumFractionDigits: 1,
        })} m² avec la marge.
        {#each glue.advice.notes as n (n)}{' ' + glueNoteText(n, ed.surface.kind)}{/each}
      </p>
    </section>
  {/if}
</div>

<Dialog
  open={dialog != null}
  title={dialog === 'edit' ? 'Modifier le carreau' : 'Nouveau carreau'}
  onclose={() => (dialog = null)}
>
  {#if dialog === 'edit'}<p class="muted">Le carreau change dans tous les projets qui l’utilisent.</p>{/if}
  {#if dialog}
    <TileForm
      bind:tile={draft}
      submitLabel={dialog === 'edit' ? 'Enregistrer' : 'Ajouter et utiliser'}
      onsubmit={save}
    />
  {/if}
</Dialog>

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
  .tiles {
    display: grid;
    gap: var(--space-2);
  }
  .tiles button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .tiles button[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: var(--accent-soft);
  }
  .tt {
    display: grid;
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .field {
    display: grid;
    gap: var(--space-1);
  }
  .lbl {
    font-size: var(--fs-sm);
    font-weight: 500;
  }
  .glue {
    padding: var(--space-3);
    border-radius: var(--r-field);
    background: var(--paper);
  }
  .dbl {
    color: var(--thin-ink);
  }
</style>
