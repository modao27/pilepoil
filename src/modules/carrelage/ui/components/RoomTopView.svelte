<script lang="ts">
  /**
   * Vue de dessus d'une pièce du plan : le sol calepiné à sa place, les murs carrelés dépliés vers l'extérieur
   * contre leur segment, les murs nus en trait. Chaque surface carrelée est un lien vers son éditeur.
   */
  import type { PlanRoom } from '../../../../core/plan/types';
  import type { Point, ProjectResult, ProjectSpec } from '../../core';
  import type { CarrelageProject } from '../../state/data';
  import { surfaceId } from '../../state/surfaces';
  import { planDrawing } from '../../render/planSvg';
  import { boxOf, unfoldWall } from '../../render/roomTop';

  let {
    project,
    spec,
    result,
    room,
  }: { project: CarrelageProject; spec: ProjectSpec; result: ProjectResult; room: PlanRoom } = $props();

  const index = $derived(new Map(project.surfaces.map((s, i) => [s.id, i])));
  const floor = $derived(index.get(surfaceId({ room: room.id, wall: null })));
  const walls = $derived(
    room.walls.map((w, k) => {
      const i = index.get(surfaceId({ room: room.id, wall: w.id }));
      if (i == null) return { k, i: null, a: room.outline[k]!, b: room.outline[(k + 1) % room.outline.length]! };
      const s = spec.surfaces[i]!;
      return { k, i, ...unfoldWall(room.outline, k, s.width, s.height) };
    }),
  );
  const size = $derived.by(() => {
    const xs = room.outline.map((p) => p[0]),
      ys = room.outline.map((p) => p[1]);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });
  const fontSize = $derived(size / 16);
  const box = $derived.by(() => {
    const pts: Point[] = [...room.outline, ...walls.flatMap((w) => ('corners' in w ? w.corners : []))];
    return boxOf(pts, fontSize * 2.5).join(' ');
  });

  const drawing = (i: number) => {
    const r = result.surfaces[i];
    return planDrawing(spec.surfaces[i]!, r?.ok ? r.value.pieces : []);
  };
  const grout = (i: number) => project.surfaces[i]?.zones[0]?.groutColor ?? '#8f8a83';
  /** Point d'étiquette : au centre de la surface dépliée. */
  const centre = (c: Point[]): Point => [(c[0]![0] + c[2]![0]) / 2, (c[0]![1] + c[2]![1]) / 2];
</script>

<svg class="top" viewBox={box} role="group" aria-label="{room.name} vue de dessus, murs dépliés autour du sol">
  <polygon class="room" points={room.outline.map((p) => p.join(',')).join(' ')} />
  {#each walls as w (w.k)}
    {#if 'matrix' in w && w.i != null}
      {@const d = drawing(w.i)}
      {@const s = project.surfaces[w.i]!}
      {@const c = centre(w.corners)}
      <a href="#/p/{project.id}/m/carrelage/s/{s.id}" aria-label="Ouvrir {s.name}">
        <g transform="matrix({w.matrix.join(' ')})">
          <path d={d.outline} fill={grout(w.i)} />
          {#each d.shapes as sh, k (k)}<path d={sh.d} fill={sh.fill} />{/each}
          {#each d.holes as h, k (k)}<path class="hole" d={h} />{/each}
          <path class="edge" d={d.outline} />
        </g>
        <text x={c[0]} y={c[1]} font-size={fontSize} text-anchor="middle" dominant-baseline="middle">{w.k + 1}</text>
      </a>
    {:else if 'a' in w}
      <line class="bare" x1={w.a[0]} y1={w.a[1]} x2={w.b[0]} y2={w.b[1]} />
    {/if}
  {/each}
  {#if floor != null}
    {@const d = drawing(floor)}
    {@const s = project.surfaces[floor]!}
    <a href="#/p/{project.id}/m/carrelage/s/{s.id}" aria-label="Ouvrir {s.name}">
      <g transform="translate({s.origin[0]} {s.origin[1]})">
        <path d={d.outline} fill-rule="evenodd" fill={grout(floor)} />
        {#each d.shapes as sh, k (k)}<path d={sh.d} fill={sh.fill} />{/each}
        {#each d.holes as h, k (k)}<path class="hole" d={h} />{/each}
        <path class="edge" d={d.outline} fill-rule="evenodd" />
      </g>
    </a>
  {/if}
</svg>

<style>
  .top {
    display: block;
    width: 100%;
    height: 100%;
  }
  .room {
    fill: var(--paper);
    stroke: var(--muted);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .bare {
    stroke: var(--ink);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
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
    paint-order: stroke;
    stroke: var(--sheet);
    stroke-width: 6;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
    font-family: var(--font-num);
    font-weight: 600;
  }
</style>
