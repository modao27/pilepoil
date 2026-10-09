<script lang="ts">
  /**
   * Plan des lames posées (lecture seule) : pièces de la pose, lames entières dans la couleur de la lame,
   * lames coupées en jaune, lames taillées dans une chute en vert, lames B des motifs plus foncées.
   * Toucher une lame la sélectionne.
   */
  import type { Polygon } from '../../../../core/geometry/types';
  import type { LaidPiece, Threshold } from '../../core/types';

  let {
    rooms,
    pieces,
    color,
    variants = false,
    others = [],
    thresholds = [],
    selected = $bindable(null),
    label,
  }: {
    rooms: Polygon[];
    pieces: LaidPiece[];
    color: string;
    /** Motifs : lames B plus foncées que les lames A. */
    variants?: boolean;
    /** Lames des autres poses, atténuées. */
    others?: { pieces: LaidPiece[]; color: string }[];
    /** Seuils de la pose : proposés en pointillés, posés en trait plein. */
    thresholds?: Threshold[];
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
  const dark = $derived(`color-mix(in srgb, ${color} 72%, black)`);
  const pts = (p: Polygon) => p.map((q) => q.join(',')).join(' ');
  const kind = (p: LaidPiece) => (p.cutType === 'full' ? 'full' : 'offcut' in p.source ? 'reuse' : 'cut');
</script>

<svg class="plan" viewBox={vb} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
  {#each rooms as r, i (i)}<polygon class="room" points={pts(r)} />{/each}
  {#each others as o, i (i)}
    <g class="other" aria-hidden="true">
      {#each o.pieces as p (p.id)}
        <polygon
          class="piece {kind(p)}"
          style={kind(p) === 'full' ? `fill: ${o.color}` : undefined}
          points={pts(p.polygon)}
        />
      {/each}
    </g>
  {/each}
  {#each pieces as p (p.id)}
    <!-- complément visuel au pointeur : longueur et coupe d'une lame ; la fiche de coupe complète, accessible
         au clavier, vient en P4 -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <polygon
      class="piece {kind(p)}"
      class:sel={selected === p.id}
      style={kind(p) === 'full' ? `fill: ${variants && p.variant === 'B' ? dark : color}` : undefined}
      points={pts(p.polygon)}
      onclick={() => (selected = selected === p.id ? null : p.id)}
    />
  {/each}
  {#each thresholds as t, i (i)}
    <line
      class="threshold"
      class:proposed={t.status === 'proposed'}
      x1={t.segment[0][0]}
      y1={t.segment[0][1]}
      x2={t.segment[1][0]}
      y2={t.segment[1][1]}
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
  .other {
    opacity: 0.45;
    pointer-events: none;
  }
  .threshold {
    stroke: var(--thin);
    stroke-width: 5px;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }
  .threshold.proposed {
    stroke-dasharray: 8 6;
  }
  .piece.sel {
    stroke: var(--accent);
    stroke-width: 3px;
  }
</style>
