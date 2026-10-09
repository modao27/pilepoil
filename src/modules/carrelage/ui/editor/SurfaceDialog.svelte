<script lang="ts">
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import { cm } from '../../../../ui/lib/format';
  import { surfaceId } from '../../state/surfaces';
  import type { EditorState } from './editorState.svelte';

  let { ed, open = $bindable(false) }: { ed: EditorState; open: boolean } = $props();

  /** Pièce du plan de la surface courante. */
  const room = $derived(ed.project.plan.rooms.find((r) => r.id === ed.surface.ref.room));
  const tiled = $derived(new Set(ed.project.surfaces.map((s) => s.id)));
  const wallTiling = $derived(
    ed.surface.ref.wall ? ed.project.rooms[ed.surface.ref.room]?.walls[ed.surface.ref.wall] : undefined,
  );
</script>

<Dialog bind:open title="Surfaces">
  <div class="dlg">
    <section aria-labelledby="sd-list">
      <h3 id="sd-list">Surfaces carrelées</h3>
      <div class="list">
        {#each ed.project.surfaces as s (s.id)}
          <button
            type="button"
            aria-current={s.id === ed.surface.id ? 'true' : undefined}
            onclick={() => ed.setSurface(s.id)}
          >
            <strong>{s.name}</strong><span class="muted">{cm(s.width)} × {cm(s.height)}</span>
          </button>
        {/each}
      </div>
    </section>

    <section aria-labelledby="sd-this">
      <h3 id="sd-this">{ed.surface.name}</h3>
      <p class="muted">
        {ed.surface.kind === 'floor' ? 'Sol' : 'Mur'} de {cm(ed.surface.width)} × {cm(ed.surface.height)}. Les cotes
        viennent du plan.
      </p>
      {#if wallTiling}
        <NumberField
          label="Hauteur carrelée"
          value={ed.surface.height}
          unit="cm"
          factor={10}
          min={1}
          max={(room?.height ?? 0) / 10}
          onchange={(v) => ed.updateSurface({ tiledHeight: room && v >= room.height ? null : v })}
        />
      {/if}
      <div><Button href="#/p/{ed.project.id}/plan">Modifier le plan</Button></div>
    </section>

    {#if room}
      <section aria-labelledby="sd-room">
        <h3 id="sd-room">{room.name} : à carreler</h3>
        <div class="two">
          <Checkbox
            label="Sol"
            checked={tiled.has(surfaceId({ room: room.id, wall: null }))}
            onchange={(v) => ed.setTiled({ room: room.id, wall: null }, v)}
          />
          {#each room.walls as w, i (w.id)}
            <Checkbox
              label="Mur {i + 1}"
              checked={tiled.has(surfaceId({ room: room.id, wall: w.id }))}
              onchange={(v) => ed.setTiled({ room: room.id, wall: w.id }, v)}
            />
          {/each}
        </div>
      </section>
    {/if}
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
</style>
