<script lang="ts">
  /**
   * Plan des lames posées (lecture seule) : pièces de la pose, lames entières dans la couleur de la lame,
   * lames coupées en jaune, lames taillées dans une chute en vert. Toucher une lame la sélectionne.
   */
  import type { Polygon } from '../../../../core/geometry/types';
  import type { LaidPiece } from '../../core/types';

  let {
    rooms,
    pieces,
    color,
    selected = $bindable(null),
    label,
  }: {
    rooms: Polygon[];
    pieces: LaidPiece[];
    color: string;
    selected?: string | null;
    label: string;
  } = $props();

  const pad = 250;
  const vb = $derived.by(() => {
    const pts = rooms.flat();
    if (!pts.length) return '0 0 4000 3000';
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs) - pad,
      y0 = Math.min(...ys) - pad;
    return `${x0} ${y0} ${Math.max(...xs) + pad - x0} ${Math.max(...ys) + pad - y0}`;
  });
  const pts = (p: Polygon) => p.map((q) => q.join(',')).join(' ');
  const kind = (p: LaidPiece) => (p.cutType === 'full' ? 'full' : 'offcut' in p.source ? 'reuse' : 'cut');
</script>

<svg class="plan" viewBox={vb} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
  {#each rooms as r, i (i)}<polygon class="room" points={pts(r)} />{/each}
  {#each pieces as p (p.id)}
    <!-- complément visuel au pointeur : longueur et coupe d'une lame ; la fiche de coupe complète, accessible
         au clavier, vient en P4 -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <polygon
      class="piece {kind(p)}"
      class:sel={selected === p.id}
      style={kind(p) === 'full' ? `fill: ${color}` : undefined}
      points={pts(p.polygon)}
      onclick={() => (selected = selected === p.id ? null : p.id)}
    />
  {/each}
</svg>

<style>
  .plan {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--sheet);
  }
  .room {
    fill: var(--paper);
    stroke: var(--ink);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .piece {
    stroke: var(--ink);
    stroke-width: 0.6px;
    vector-effect: non-scaling-stroke;
    cursor: pointer;
  }
  .piece.cut {
    fill: color-mix(in srgb, var(--cut) 70%, var(--sheet));
  }
  .piece.reuse {
    fill: color-mix(in srgb, var(--reuse) 70%, var(--sheet));
  }
  .piece.sel {
    stroke: var(--accent);
    stroke-width: 3px;
  }
</style>
