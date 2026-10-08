<script lang="ts">
  /**
   * Panneau tiré à 3 crans (fermé / mi-hauteur / plein). Poignée : toucher pour passer au cran suivant,
   * glisser, ou flèches Haut / Bas au clavier. `contained` : positionné dans son parent (démonstration).
   */
  import type { Snippet } from 'svelte';

  type Snap = 0 | 1 | 2;
  let {
    snap = $bindable<Snap>(1),
    label,
    header,
    children,
    contained = false,
  }: { snap?: Snap; label: string; header?: Snippet; children: Snippet; contained?: boolean } = $props();

  const NAMES = ['fermé', 'mi-hauteur', 'plein écran'];
  /** Hauteur visible de chaque cran, en % de la hauteur disponible (cran fermé : en-tête seul). */
  const HEIGHTS = [0, 50, 92];
  let dragY: number | null = $state(null);
  let startY = 0,
    startH = 0,
    box: HTMLElement;

  const set = (s: number) => (snap = Math.max(0, Math.min(2, s)) as Snap);

  function onkeydown(e: KeyboardEvent) {
    const d = { ArrowUp: 1, ArrowDown: -1, Home: -2, End: 2 }[e.key];
    if (d == null) return;
    e.preventDefault();
    set(snap + d);
  }
  function down(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startY = e.clientY;
    startH = box.getBoundingClientRect().height;
    dragY = 0;
  }
  function move(e: PointerEvent) {
    if (dragY != null) dragY = e.clientY - startY;
  }
  function up() {
    if (dragY == null) return;
    const moved = dragY;
    dragY = null;
    if (Math.abs(moved) < 6) return set((snap + 1) % 3);
    const parentH = box.parentElement?.getBoundingClientRect().height || window.innerHeight;
    const pct = ((startH - moved) / parentH) * 100;
    const nearest = HEIGHTS.reduce((b, h, i) => (Math.abs(h - pct) < Math.abs(HEIGHTS[b]! - pct) ? i : b), 0);
    set(nearest);
  }
</script>

<section
  bind:this={box}
  class="sheet"
  class:contained
  class:dragging={dragY != null}
  aria-label={label}
  style="--h: {HEIGHTS[snap]}%; --dy: {dragY ?? 0}px"
>
  <button
    type="button"
    class="handle"
    aria-label="{label} : {NAMES[snap]}. Toucher pour agrandir, flèches pour régler."
    aria-expanded={snap > 0}
    {onkeydown}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => (dragY = null)}
  >
    <span class="grip" aria-hidden="true"></span>
  </button>
  {#if header}<div class="head">{@render header()}</div>{/if}
  <div class="content" hidden={snap === 0}>{@render children()}</div>
</section>

<style>
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    max-height: 92dvh;
    min-height: calc(var(--touch) + 8px);
    height: calc(var(--h) - var(--dy));
    border-radius: var(--r-panel) var(--r-panel) 0 0;
    background: var(--sheet);
    box-shadow: var(--shadow);
    padding-bottom: env(safe-area-inset-bottom);
    transition: height var(--dur) ease-out;
  }
  .sheet.contained {
    position: absolute;
    max-height: 100%;
  }
  .sheet.dragging {
    transition: none;
  }
  .handle {
    flex: none;
    display: grid;
    place-items: center;
    height: var(--touch);
    border: 0;
    background: transparent;
    cursor: grab;
    touch-action: none;
  }
  .grip {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--field-border);
  }
  .head {
    flex: none;
    padding: 0 var(--gutter);
  }
  .content {
    flex: 1;
    overflow: auto;
    padding: var(--space-2) var(--gutter) var(--space-4);
  }
</style>
