<script lang="ts">
  /**
   * Vue de dessus de la pièce : le sol, et les murs A, B, C, D dépliés autour (posés à plat contre leur
   * bord). Chaque surface est un lien vers son éditeur. Projet sans pièce : les surfaces côte à côte.
   */
  import type { ProjectResult, ProjectSpec } from '../../core';
  import type { Project } from '../../../../state/model';
  import { planDrawing } from '../../render/planSvg';

  let { project, spec, result }: { project: Project; spec: ProjectSpec; result: ProjectResult } = $props();

  type Placed = { i: number; transform: string; lx: number; ly: number; anchor: 'middle' | 'start' | 'end' };

  const room = $derived(spec.room);
  const placed = $derived.by<Placed[]>(() => {
    if (!room) return [];
    const L = room.length,
      l = room.width,
      out: Placed[] = [],
      f = Math.max(L, l) / 13;
    const W = room.walls;
    if (W.floor != null) out.push({ i: W.floor, transform: '', lx: L / 2, ly: l / 2, anchor: 'middle' });
    const h = (k: 'A' | 'B' | 'C' | 'D') => spec.surfaces[W[k]!]!.height;
    if (W.A != null)
      out.push({
        i: W.A,
        transform: `matrix(1 0 0 1 0 ${-h('A')})`,
        lx: L / 2,
        ly: -h('A') - f * 0.8,
        anchor: 'middle',
      });
    if (W.B != null)
      out.push({
        i: W.B,
        transform: `matrix(0 1 -1 0 ${L + h('B')} 0)`,
        lx: L + h('B') + f * 0.4,
        ly: l / 2,
        anchor: 'start',
      });
    if (W.C != null)
      out.push({
        i: W.C,
        transform: `matrix(-1 0 0 -1 ${L} ${l + h('C')})`,
        lx: L / 2,
        ly: l + h('C') + f * 0.9,
        anchor: 'middle',
      });
    if (W.D != null)
      out.push({
        i: W.D,
        transform: `matrix(0 -1 1 0 ${-h('D')} ${l})`,
        lx: -h('D') - f * 0.4,
        ly: l / 2,
        anchor: 'end',
      });
    return out;
  });

  const box = $derived.by(() => {
    if (!room) return '0 0 1 1';
    const r = room.walls;
    const hA = r.A != null ? spec.surfaces[r.A]!.height : 0,
      hB = r.B != null ? spec.surfaces[r.B]!.height : 0,
      hC = r.C != null ? spec.surfaces[r.C]!.height : 0,
      hD = r.D != null ? spec.surfaces[r.D]!.height : 0;
    const m = 700;
    return `${-hD - m - 600} ${-hA - m} ${room.length + hB + hD + 2 * m + 1200} ${room.width + hA + hC + 2 * m + 200}`;
  });

  /** Taille des noms proportionnelle à la pièce : lisible quelle que soit l'échelle d'affichage. */
  const fontSize = $derived(room ? Math.max(room.length, room.width) / 13 : 200);

  const drawing = (i: number) => {
    const r = result.surfaces[i];
    return planDrawing(spec.surfaces[i]!, r?.ok ? r.value.pieces : []);
  };
</script>

{#if room}
  <svg class="top" viewBox={box} role="group" aria-label="Pièce vue de dessus, murs dépliés autour du sol">
    {#each placed as p (p.i)}
      {@const s = spec.surfaces[p.i]!}
      {@const d = drawing(p.i)}
      {@const name = project.surfaces[p.i]?.name ?? ''}
      <a href="#/p/{project.id}/s/{project.surfaces[p.i]?.id}" aria-label="Ouvrir {name}">
        <g transform={p.transform}>
          <rect width={s.width} height={s.height} fill={project.surfaces[p.i]?.zones[0]?.groutColor ?? '#8f8a83'} />
          {#each d.shapes as sh, k (k)}<path d={sh.d} fill={sh.fill} />{/each}
          {#each d.holes as h, k (k)}<path class="hole" d={h} />{/each}
          <rect class="edge" width={s.width} height={s.height} />
        </g>
        <text x={p.lx} y={p.ly} text-anchor={p.anchor} dominant-baseline="middle" font-size={fontSize}>{name}</text>
      </a>
    {/each}
  </svg>
{:else}
  <ul class="grid" aria-label="Surfaces du projet">
    {#each project.surfaces as s, i (s.id)}
      {@const d = drawing(i)}
      <li>
        <a href="#/p/{project.id}/s/{s.id}">
          <svg viewBox={d.viewBox} role="img" aria-label="Aperçu de {s.name}">
            <rect width={d.width} height={d.height} fill={s.zones[0]?.groutColor} />
            {#each d.shapes as sh, k (k)}<path d={sh.d} fill={sh.fill} />{/each}
            {#each d.holes as h, k (k)}<path class="hole" d={h} />{/each}
          </svg>
          <span>{s.name}</span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .top {
    display: block;
    width: 100%;
    height: 100%;
  }
  .top a:focus-visible {
    outline: none;
  }
  .top a:focus-visible .edge,
  .top a:hover .edge {
    stroke: var(--accent);
    stroke-width: 4;
  }
  .edge {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .hole {
    fill: var(--paper);
    stroke: var(--muted);
    vector-effect: non-scaling-stroke;
  }
  text {
    fill: var(--ink);
    font-family: var(--font-num);
    font-weight: 600;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: var(--space-3);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
    gap: var(--space-3);
  }
  .grid a {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    text-decoration: none;
  }
  .grid svg {
    width: 100%;
    aspect-ratio: 4 / 3;
  }
</style>
