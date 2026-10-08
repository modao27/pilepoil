<script lang="ts">
  import type { OpeningType } from '../../../../state/model';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import Select from '../../../../ui/components/Select.svelte';
  import { cm } from '../../../../ui/lib/format';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const TYPES: { value: OpeningType; label: string }[] = [
    { value: 'window', label: 'Fenêtre' },
    { value: 'door', label: 'Porte' },
    { value: 'socket', label: 'Prise, interrupteur' },
    { value: 'trap', label: 'Trappe de visite' },
    { value: 'tub', label: 'Baignoire, receveur' },
    { value: 'other', label: 'Autre (niche, meuble)' },
  ];
  const NAME: Record<OpeningType, string> = {
    window: 'Fenêtre',
    door: 'Porte',
    socket: 'Prise',
    trap: 'Trappe',
    tub: 'Baignoire',
    other: 'Réservation',
  };
  let newType = $state<OpeningType>('window');

  const o = $derived(ed.surface.openings[ed.sel.opening]);
  const floor = $derived(ed.surface.kind === 'floor');
  const revealPieces = $derived(
    ed.build?.pieces.map((p, i) => [p, i] as const).filter(([p]) => p.reveal?.opening === ed.sel.opening) ?? [],
  );
  const revealReused = $derived(revealPieces.filter(([, i]) => ed.result?.plan.reused[ed.offset + i]).length);
</script>

<div class="tab">
  <section aria-labelledby="o-list">
    <h3 id="o-list">Ouvertures et réservations</h3>
    {#if ed.surface.openings.length}
      <div class="list">
        {#each ed.surface.openings as r, i (r.id)}
          <button type="button" aria-pressed={i === ed.sel.opening} onclick={() => ed.select({ opening: i })}>
            <strong>{NAME[r.type]} {i + 1}</strong><span class="muted">{cm(r.width)} × {cm(r.height)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="muted">
        Aucune ouverture. Ajoutez fenêtres, portes, prises ou baignoire : les carreaux sont découpés autour.
      </p>
    {/if}
    <div class="add">
      <Select label="Type à ajouter" bind:value={newType} options={TYPES} />
      <Button icon="plus" onclick={() => ed.addOpening(newType)}>Ajouter</Button>
    </div>
  </section>

  {#if o}
    <section aria-labelledby="o-edit">
      <h3 id="o-edit">{NAME[o.type]} {ed.sel.opening + 1}</h3>
      <Select label="Type" value={o.type} options={TYPES} onchange={(t) => ed.updateOpening({ type: t })} />
      <div class="two">
        <NumberField
          label="Largeur"
          value={o.width}
          unit="cm"
          factor={10}
          min={1}
          onchange={(v) => ed.updateOpening({ width: v })}
        />
        <NumberField
          label="Hauteur"
          value={o.height}
          unit="cm"
          factor={10}
          min={1}
          onchange={(v) => ed.updateOpening({ height: v })}
        />
        <NumberField
          label="Depuis le bord gauche"
          value={o.x}
          unit="cm"
          factor={10}
          min={0}
          onchange={(v) => ed.updateOpening({ x: v })}
        />
        <NumberField
          label={floor ? 'Depuis le bord bas' : 'Allège depuis le bas'}
          value={o.sill}
          unit="cm"
          factor={10}
          min={0}
          onchange={(v) => ed.updateOpening({ sill: v })}
        />
      </div>
      {#if o.type === 'tub'}
        <NumberField
          label="Avancée dans la pièce"
          value={o.projection}
          unit="cm"
          factor={10}
          min={10}
          onchange={(v) => ed.updateOpening({ projection: v })}
        />
      {/if}
      <Checkbox
        label="Bords recouverts"
        hint="Profilé, plaque ou habillage : les coupes contre l’ouverture ne se voient pas."
        checked={o.covered}
        onchange={(v) => ed.updateOpening({ covered: v })}
      />
      {#if o.type === 'window' || o.type === 'door'}
        <fieldset>
          <legend>Tableaux carrelés</legend>
          <NumberField
            label="Profondeur du tableau"
            value={o.revealDepth}
            unit="cm"
            factor={10}
            min={0}
            step={0.5}
            onchange={(v) => ed.updateOpening({ revealDepth: v })}
          />
          <div class="two">
            <Checkbox
              label="Gauche"
              checked={o.reveals.left}
              onchange={(v) => ed.updateOpening({ reveals: { ...o.reveals, left: v } })}
            />
            <Checkbox
              label="Droite"
              checked={o.reveals.right}
              onchange={(v) => ed.updateOpening({ reveals: { ...o.reveals, right: v } })}
            />
            <Checkbox
              label="Linteau (haut)"
              checked={o.reveals.top}
              onchange={(v) => ed.updateOpening({ reveals: { ...o.reveals, top: v } })}
            />
            {#if o.type === 'window'}
              <Checkbox
                label="Appui (bas)"
                checked={o.reveals.bottom}
                onchange={(v) => ed.updateOpening({ reveals: { ...o.reveals, bottom: v } })}
              />
            {/if}
          </div>
          {#if o.revealDepth > 0 && revealPieces.length}
            <p class="muted">Tableaux : {revealPieces.length} pièces, dont {revealReused} taillées dans les chutes.</p>
          {/if}
        </fieldset>
      {/if}
      <div class="row">
        <Button onclick={() => ed.updateOpening({ x: Math.round((ed.surface.width - o.width) / 2) })}
          >Centrer horizontalement</Button
        >
        <Button variant="danger" icon="trash" onclick={() => ed.removeOpening()}>Supprimer</Button>
      </div>
      <p class="muted">Sur le plan, glissez l’ouverture pour la déplacer.</p>
    </section>
  {/if}
</div>

<style>
  .tab {
    display: grid;
    gap: var(--space-5);
  }
  section,
  fieldset {
    display: grid;
    gap: var(--space-3);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    font-weight: 600;
    margin-bottom: var(--space-2);
  }
  h3 {
    font-size: var(--fs-md);
  }
  .muted {
    font-size: var(--fs-sm);
  }
  .list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .list button {
    display: grid;
    min-height: var(--touch);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .list button[aria-pressed='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: var(--accent-soft);
  }
  .add {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--space-2);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
