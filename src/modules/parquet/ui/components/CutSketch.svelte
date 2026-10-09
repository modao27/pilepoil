<script lang="ts">
  /**
   * Croquis coté d'une coupe en biais : la pièce dans le repère de sa lame (rives horizontales), longueur de
   * chaque rive, angle de chaque coupe avec la rive. Pour la fiche de coupe et le chantier.
   */
  import type { Polygon } from '../../../../core/geometry/types';

  let { shape, angles }: { shape: Polygon; angles: number[] } = $props();

  const W = $derived(Math.max(...shape.map((p) => p[0]), 1));
  const H = $derived(Math.max(...shape.map((p) => p[1]), 1));
  const font = $derived(Math.max(W / 16, 18));
  const pad = $derived(font * 1.6);
  const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  /** Rives : arêtes horizontales en bas (y = 0) et en haut (y = H), avec leur longueur. */
  const rives = $derived.by(() => {
    const out: { x: number; y: number; len: number }[] = [];
    shape.forEach((a, i) => {
      const b = shape[(i + 1) % shape.length]!;
      if (Math.abs(a[1] - b[1]) > 0.5) return;
      const len = Math.abs(b[0] - a[0]);
      if (len < 1) return;
      // cote au-dessus de la rive du haut du dessin, au-dessous de celle du bas
      const below = a[1] > H / 2;
      out.push({ x: (a[0] + b[0]) / 2, y: below ? a[1] + font * 1.15 : a[1] - font * 0.45, len });
    });
    return out;
  });
  /** Coupes (arêtes non horizontales) : angle au milieu, du côté extérieur. */
  const cuts = $derived.by(() => {
    const cx = W / 2;
    const out: { x: number; y: number; text: string }[] = [];
    let k = 0;
    shape.forEach((a, i) => {
      const b = shape[(i + 1) % shape.length]!;
      if (Math.abs(a[1] - b[1]) <= 0.5 || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) return;
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      const angle = angles[k++];
      if (angle == null) return;
      out.push({ x: mx + (mx < cx ? -font * 1.6 : font * 1.6), y: my + font * 0.35, text: `${angle}°` });
    });
    return out;
  });
  const pts = $derived(shape.map((p) => p.join(',')).join(' '));
  const label = $derived(
    `Croquis : rives de ${rives.map((r) => fr(r.len)).join(' et ')} mm, coupes à ${angles.join(' et ')}°`,
  );
</script>

<svg
  class="sketch"
  viewBox="{-pad * 1.4} {-pad} {W + pad * 2.8} {H + pad * 2}"
  role="img"
  aria-label={label}
  preserveAspectRatio="xMinYMid meet"
>
  <polygon points={pts} />
  {#each rives as r, i (i)}
    <text x={r.x} y={r.y} font-size={font} text-anchor="middle">{fr(r.len)}</text>
  {/each}
  {#each cuts as c, i (i)}
    <text class="ang" x={c.x} y={c.y} font-size={font * 0.9} text-anchor="middle">{c.text}</text>
  {/each}
</svg>

<style>
  .sketch {
    display: block;
    width: min(100%, 300px);
    height: auto;
    max-height: 90px;
    margin: var(--space-1) 0 0 calc(28px + var(--space-3));
  }
  polygon {
    fill: color-mix(in srgb, var(--cut) 55%, var(--sheet));
    stroke: var(--ink);
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  text {
    fill: var(--ink);
    font-family: var(--font-num);
  }
  .ang {
    fill: var(--accent);
    font-weight: 600;
  }
</style>
