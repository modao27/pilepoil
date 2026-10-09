<script lang="ts">
  /**
   * Contour d'une pièce du plan, murs numérotés : le sol et les murs carrelés sont mis en avant. Sert à
   * repérer « Mur 2 » avant de le cocher (écran Carrelage, assistant).
   */
  import type { PlanRoom } from '../../../../core/plan/types';

  let {
    room,
    floor = false,
    walls = [],
    label,
  }: {
    room: PlanRoom;
    /** Sol carrelé. */
    floor?: boolean;
    /** Identifiants des murs carrelés. */
    walls?: readonly string[];
    label: string;
  } = $props();

  const pts = $derived(room.outline.map(([x, y]) => `${x},${y}`).join(' '));
  const box = $derived.by(() => {
    const xs = room.outline.map((p) => p[0]),
      ys = room.outline.map((p) => p[1]);
    const x0 = Math.min(...xs),
      y0 = Math.min(...ys),
      w = Math.max(...xs) - x0,
      h = Math.max(...ys) - y0;
    const pad = Math.max(w, h) * 0.12;
    return { vb: `${x0 - pad} ${y0 - pad} ${w + 2 * pad} ${h + 2 * pad}`, f: Math.max(w, h) / 14 };
  });
  /** Milieu de chaque mur, décalé vers l'extérieur pour le numéro. */
  const tags = $derived(
    room.outline.map((a, i) => {
      const b = room.outline[(i + 1) % room.outline.length]!;
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = (b[1] - a[1]) / l,
        ny = -(b[0] - a[0]) / l;
      const d = box.f * 0.9;
      return { a, b, x: (a[0] + b[0]) / 2 + nx * d, y: (a[1] + b[1]) / 2 + ny * d, id: room.walls[i]?.id ?? '' };
    }),
  );
</script>

<svg class="walls" viewBox={box.vb} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
  <polygon class="floor" class:on={floor} points={pts} />
  {#each room.obstacles as o (o.id)}
    <polygon class="obstacle" points={o.outline.map(([x, y]) => `${x},${y}`).join(' ')} />
  {/each}
  {#each tags as t, i (i)}
    <line class="wall" class:on={walls.includes(t.id)} x1={t.a[0]} y1={t.a[1]} x2={t.b[0]} y2={t.b[1]} />
    <text x={t.x} y={t.y} font-size={box.f} text-anchor="middle" dominant-baseline="middle">{i + 1}</text>
  {/each}
</svg>

<style>
  .walls {
    display: block;
    width: 100%;
    height: 100%;
  }
  .floor {
    fill: var(--paper);
    stroke: none;
  }
  .floor.on {
    fill: var(--accent-soft);
  }
  .obstacle {
    fill: var(--line);
  }
  .wall {
    stroke: var(--muted);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
  }
  .wall.on {
    stroke: var(--accent);
    stroke-width: 5;
  }
  text {
    fill: var(--ink);
    font-weight: 600;
  }
</style>
