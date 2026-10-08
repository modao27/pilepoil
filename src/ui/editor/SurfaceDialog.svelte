<script lang="ts">
  import type { RoomWallKey } from '../../state/model';
  import Button from '../components/Button.svelte';
  import Checkbox from '../components/Checkbox.svelte';
  import Dialog from '../components/Dialog.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Segmented from '../components/Segmented.svelte';
  import TextField from '../components/TextField.svelte';
  import { cm } from '../lib/format';
  import { toast } from '../lib/toasts.svelte';
  import type { EditorState } from './editorState.svelte';

  let { ed, open = $bindable(false) }: { ed: EditorState; open: boolean } = $props();

  let name = $state('');
  const room = $state({ length: 2400, width: 1800, height: 2500, tiledHeight: 2000 });
  const walls = $state<Record<RoomWallKey, boolean>>({ A: true, B: true, C: true, D: true, floor: true });

  // À l'ouverture : valeurs actuelles de la surface et de la pièce.
  $effect(() => {
    if (!open) return;
    name = ed.surface.name;
    const r = ed.project.room;
    Object.assign(
      room,
      r
        ? { length: r.length, width: r.width, height: r.height, tiledHeight: r.tiledHeight }
        : {
            length: ed.surface.width,
            width: 2000,
            height: 2500,
            tiledHeight: Math.min(ed.surface.height, 2400),
          },
    );
    for (const k of ['A', 'B', 'C', 'D', 'floor'] as const) walls[k] = r ? r.walls[k] != null : true;
  });

  function rename() {
    const n = name.trim().slice(0, 40);
    if (n && n !== ed.surface.name) ed.updateSurface({ name: n });
  }

  function makeRoom() {
    ed.applyRoom({ ...room, walls: { ...walls } });
    toast(`Pièce de ${cm(room.length)} × ${cm(room.width)}, murs carrelés sur ${cm(room.tiledHeight)}.`);
  }
</script>

<Dialog bind:open title="Surfaces et pièce">
  <div class="dlg">
    <section aria-labelledby="sd-list">
      <h3 id="sd-list">Surfaces du projet</h3>
      <div class="list">
        {#each ed.project.surfaces as s (s.id)}
          <button
            type="button"
            aria-current={s.id === ed.surface.id ? 'true' : undefined}
            onclick={() => ed.setSurface(s.id)}
          >
            <strong>{s.name}</strong><span class="muted"
              >{s.kind === 'floor' ? 'sol' : 'mur'}, {cm(s.width)} × {cm(s.height)}</span
            >
          </button>
        {/each}
      </div>
      <div class="row">
        <Button icon="plus" onclick={() => ed.addSurface()}>Ajouter une surface</Button>
        {#if ed.project.surfaces.length > 1}
          <Button variant="danger" icon="trash" onclick={() => ed.removeSurface()}>Supprimer cette surface</Button>
        {/if}
      </div>
    </section>

    <section aria-labelledby="sd-this">
      <h3 id="sd-this">{ed.surface.name}</h3>
      <TextField label="Nom" bind:value={name} maxlength={40} onchange={rename} onblur={rename} />
      <Segmented
        label="Type de surface"
        value={ed.surface.kind}
        onchange={(k) => ed.updateSurface({ kind: k })}
        options={[
          { value: 'wall', label: 'Mur' },
          { value: 'floor', label: 'Sol' },
        ]}
      />
      <div class="two">
        <NumberField
          label={ed.surface.kind === 'floor' ? 'Longueur' : 'Largeur'}
          value={ed.surface.width}
          unit="cm"
          factor={10}
          min={1}
          onchange={(v) => ed.updateSurface({ width: v })}
        />
        <NumberField
          label={ed.surface.kind === 'floor' ? 'Largeur' : 'Hauteur'}
          value={ed.surface.height}
          unit="cm"
          factor={10}
          min={1}
          onchange={(v) => ed.updateSurface({ height: v })}
        />
      </div>
    </section>

    <section aria-labelledby="sd-room">
      <h3 id="sd-room">Pièce complète</h3>
      <p class="muted">
        Les nouveaux murs reprennent le carrelage de cette surface. Les chutes servent d’une surface à l’autre.
      </p>
      <div class="two">
        <NumberField label="Longueur" bind:value={room.length} unit="cm" factor={10} min={1} />
        <NumberField label="Largeur" bind:value={room.width} unit="cm" factor={10} min={1} />
        <NumberField label="Hauteur sous plafond" bind:value={room.height} unit="cm" factor={10} min={1} />
        <NumberField label="Hauteur carrelée" bind:value={room.tiledHeight} unit="cm" factor={10} min={1} />
      </div>
      <div class="two">
        <Checkbox label="Mur A (fond)" bind:checked={walls.A} />
        <Checkbox label="Mur B (droite)" bind:checked={walls.B} />
        <Checkbox label="Mur C (face)" bind:checked={walls.C} />
        <Checkbox label="Mur D (gauche)" bind:checked={walls.D} />
        <Checkbox label="Sol" bind:checked={walls.floor} />
      </div>
      <div>
        <Button variant="primary" onclick={makeRoom}
          >{ed.project.room ? 'Mettre à jour la pièce' : 'Créer la pièce'}</Button
        >
      </div>
    </section>
  </div>
</Dialog>

<style>
  .dlg {
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
  .list {
    display: grid;
    gap: var(--space-1);
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
  .list button[aria-current='true'] {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
    background: var(--accent-soft);
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--space-3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
