<script lang="ts" generics="T extends { id: string }">
  /**
   * Liste réordonnable : poignée à glisser (souris, doigt) et boutons Monter / Descendre (clavier).
   * Le déplacement est annoncé aux lecteurs d'écran.
   */
  import type { Snippet } from 'svelte';
  import IconButton from './IconButton.svelte';
  import Icon from '../icons/Icon.svelte';

  let {
    items,
    label,
    itemLabel,
    item,
    onmove,
  }: {
    items: T[];
    label: string;
    itemLabel: (it: T, i: number) => string;
    item: Snippet<[T, number]>;
    onmove: (from: number, to: number) => void;
  } = $props();

  let rows: HTMLLIElement[] = $state([]);
  let drag: { from: number; to: number; pointer: number } | null = $state(null);
  let announce = $state('');

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || to === from) return;
    const name = itemLabel(items[from]!, from);
    onmove(from, to);
    announce = `${name} déplacé en position ${to + 1} sur ${items.length}.`;
  }

  function down(e: PointerEvent, i: number) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { from: i, to: i, pointer: e.pointerId };
  }
  function moveOver(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    let to = 0;
    rows.forEach((r, k) => {
      if (!r) return;
      const b = r.getBoundingClientRect();
      if (e.clientY > b.top + b.height / 2) to = k + (k >= drag!.from ? 0 : 1);
    });
    drag.to = Math.max(0, Math.min(items.length - 1, to));
  }
  function up() {
    if (drag) move(drag.from, drag.to);
    drag = null;
  }
</script>

<ol class="lr" aria-label={label}>
  {#each items as it, i (it.id)}
    <li bind:this={rows[i]} class:dragging={drag?.from === i} class:target={drag && drag.to === i && drag.from !== i}>
      <span
        class="handle"
        role="presentation"
        onpointerdown={(e) => down(e, i)}
        onpointermove={moveOver}
        onpointerup={up}
        onpointercancel={() => (drag = null)}
      >
        <Icon name="drag" />
      </span>
      <div class="content">{@render item(it, i)}</div>
      <IconButton icon="up" label="Monter {itemLabel(it, i)}" disabled={i === 0} onclick={() => move(i, i - 1)} />
      <IconButton
        icon="down"
        label="Descendre {itemLabel(it, i)}"
        disabled={i === items.length - 1}
        onclick={() => move(i, i + 1)}
      />
    </li>
  {/each}
</ol>
<p class="visually-hidden" aria-live="polite">{announce}</p>

<style>
  .lr {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding-right: var(--space-1);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
  }
  li.dragging {
    opacity: 0.6;
  }
  li.target {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .handle {
    display: grid;
    place-items: center;
    width: var(--touch);
    height: var(--touch);
    color: var(--muted);
    cursor: grab;
    touch-action: none;
  }
  .content {
    flex: 1;
    min-width: 0;
  }
</style>
