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
    dimensions = false,
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
    /** Cotes des murs (longueur intérieure, cm), à l'extérieur de chaque pièce. */
    dimensions?: boolean;
    selected?: string | null;
    label: string;
  } = $props();

  const extent = $derived.by(() => {
    const pts = rooms.flat();
    if (!pts.length) return 4000;
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });
  /** Taille du texte des cotes, en mm du plan. */
  const font = $derived(Math.max(60, extent / 45));
  const pad = $derived(dimensions ? font * 3 : 250);
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
  /** Cote de chaque mur : milieu décalé vers l'extérieur de la pièce, texte le long du mur. */
  const dims = $derived(
    dimensions
      ? rooms.flatMap((r) => {
          const ccw = r.reduce((t, p, i) => {
            const q = r[(i + 1) % r.length]!;
            return t + p[0] * q[1] - q[0] * p[1];
          }, 0);
          return r.flatMap((a, i) => {
            const b = r[(i + 1) % r.length]!;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (len < 1) return [];
            const s = ccw > 0 ? 1 : -1;
            const n = [((b[1] - a[1]) / len) * s, (-(b[0] - a[0]) / len) * s];
            let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
            // lisible de gauche à droite ou de bas en haut
            if (angle >= 90) angle -= 180;
            if (angle < -90) angle += 180;
            const x = (a[0] + b[0]) / 2 + n[0]! * font * 1.3,
              y = (a[1] + b[1]) / 2 + n[1]! * font * 1.3;
            return [{ x, y, angle, text: `${(len / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}` }];
          });
        })
      : [],
  );
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
  {#each dims as d, i (i)}
    <text
      class="dim"
      x={d.x}
      y={d.y}
      font-size={font}
      transform="rotate({d.angle} {d.x} {d.y})"
      text-anchor="middle"
      dominant-baseline="middle">{d.text}</text
    >
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
  .dim {
    fill: var(--ink);
    font-family: var(--font-num);
    pointer-events: none;
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
