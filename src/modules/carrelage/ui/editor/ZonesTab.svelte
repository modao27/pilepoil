<script lang="ts">
  import { pattern } from '../../core';
  import type { Zone } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import ListReorder from '../../../../ui/components/ListReorder.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Segmented from '../../../../ui/components/Segmented.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { cm } from '../../../../ui/lib/format';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const horiz = $derived(ed.surface.split === 'h');
  const rect = $derived(ed.build?.layout.rects[ed.zoneIndex]);
  const sizeText = (z: Zone) =>
    z.unit === 'rest'
      ? 'reste de la surface'
      : z.unit === 'rows'
        ? `${z.size} rangée${z.size > 1 ? 's' : ''}`
        : cm(z.size);
  const label = (z: Zone, i: number) =>
    `Zone ${i + 1} : ${pattern(z.pattern).name}, ${app.tile(z.tileId)?.name ?? 'carreau manquant'}, ${sizeText(z)}`;
</script>

<div class="tab">
  <section aria-labelledby="z-split">
    <h3 id="z-split">Découpage</h3>
    <Segmented
      label="Sens des bandes"
      value={ed.surface.split}
      onchange={(v) => ed.updateSurface({ split: v })}
      options={[
        { value: 'h', label: 'Empilées' },
        { value: 'v', label: 'Côte à côte' },
      ]}
    />
    <p class="muted">{horiz ? 'Les zones se suivent de haut en bas.' : 'Les zones se suivent de gauche à droite.'}</p>
  </section>

  <section aria-labelledby="z-list">
    <h3 id="z-list">Zones</h3>
    <ListReorder
      label="Zones"
      items={ed.surface.zones}
      itemLabel={(_z, i) => `Zone ${i + 1}`}
      onmove={(f, t) => ed.moveZone(f, t)}
    >
      {#snippet item(z, i)}
        <button type="button" class="zbtn" aria-pressed={i === ed.zoneIndex} onclick={() => ed.select({ zone: i })}>
          <strong>Zone {i + 1}</strong>
          <span class="muted">{label(z, i).replace(/^Zone \d+ : /, '')}</span>
        </button>
      {/snippet}
    </ListReorder>
    <div class="row">
      <Button icon="plus" onclick={() => ed.addZone()}>Ajouter une zone</Button>
      {#if ed.surface.zones.length > 1}<Button variant="danger" icon="trash" onclick={() => ed.removeZone()}
          >Supprimer la zone</Button
        >{/if}
    </div>
  </section>

  <section aria-labelledby="z-size">
    <h3 id="z-size">Taille de la zone {ed.zoneIndex + 1}</h3>
    <Segmented
      label="Unité de la zone"
      value={ed.zone.unit}
      onchange={(u) => {
        if (u === 'length' && ed.zone.unit !== 'length')
          ed.updateZone({ unit: u, size: Math.round(rect?.len ?? 1000) });
        else if (u === 'rows' && ed.zone.unit !== 'rows') ed.updateZone({ unit: u, size: 3 });
        else ed.updateZone({ unit: u });
      }}
      options={[
        { value: 'rows', label: 'Rangées' },
        { value: 'length', label: 'Longueur' },
        { value: 'rest', label: 'Reste' },
      ]}
    />
    {#if ed.zone.unit === 'rows'}
      <NumberField
        label="Nombre de rangées"
        value={ed.zone.size}
        min={0}
        max={200}
        step={1}
        decimals={0}
        onchange={(v) => ed.updateZone({ size: Math.round(v) })}
      />
    {:else if ed.zone.unit === 'length'}
      <NumberField
        label={horiz ? 'Hauteur' : 'Largeur'}
        value={ed.zone.size}
        unit="cm"
        factor={10}
        min={0}
        onchange={(v) => ed.updateZone({ size: v })}
      />
    {/if}
    {#if rect}<p class="muted">{horiz ? 'Hauteur' : 'Largeur'} de la zone : {cm(rect.len)}.</p>{/if}
  </section>

  <section aria-labelledby="z-tpl">
    <h3 id="z-tpl">Modèle</h3>
    <Button onclick={() => ed.applyFriezeTemplate()}>Frise : 3 rangées, bâtons rompus, 3 rangées</Button>
  </section>
</div>

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
  .muted {
    font-size: var(--fs-sm);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .zbtn {
    display: grid;
    width: 100%;
    min-height: var(--touch);
    padding: var(--space-2);
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .zbtn[aria-pressed='true'] {
    background: var(--accent-soft);
    box-shadow: inset 3px 0 0 var(--accent);
  }
</style>
