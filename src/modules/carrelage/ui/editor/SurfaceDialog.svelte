<script lang="ts">
  import Button from '../../../../ui/components/Button.svelte';
  import Dialog from '../../../../ui/components/Dialog.svelte';
  import NumberField from '../../../../ui/components/NumberField.svelte';
  import { cm } from '../../../../ui/lib/format';
  import { wallIndex } from '../../../../core/plan/walls';
  import { tiledTop } from '../../state/surfaces';
  import type { EditorState } from './editorState.svelte';

  let { ed, open = $bindable(false) }: { ed: EditorState; open: boolean } = $props();

  /** Pièce du plan de la surface courante. */
  const room = $derived(ed.project.plan.rooms.find((r) => r.id === ed.surface.ref.room));
  /** Murs de la pose et haut de leurs zones depuis le sol : réglable mur par mur. */
  const walls = $derived(
    room && ed.surface.kind === 'wall'
      ? ed.surface.parts.map((p) => ({
          ref: p.ref,
          label:
            ed.surface.parts.length > 1
              ? `Hauteur carrelée, mur ${wallIndex(room, p.ref.wall!) + 1}`
              : 'Hauteur carrelée',
          top: tiledTop(ed.project.plan, ed.project.zones, p.ref) ?? room.height,
        }))
      : [],
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
      {#each walls as w (w.ref.wall)}
        <NumberField
          label={w.label}
          value={w.top}
          unit="cm"
          factor={10}
          min={1}
          max={(room?.height ?? 0) / 10}
          onchange={(v) => ed.setWallHeight(room && v >= room.height ? null : v, w.ref)}
        />
      {/each}
    </section>

    <div class="row">
      <Button href="#/p/{ed.project.id}/m/carrelage">Sol et murs à carreler</Button>
      <Button href="#/p/{ed.project.id}/plan">Modifier le plan</Button>
    </div>
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
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
