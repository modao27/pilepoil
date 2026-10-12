<script lang="ts">
  /**
   * Plan d'ensemble cliquable de la vue globale : chaque pièce est un lien vers son écran Pièce, son sol coloré
   * par les poses qui le couvrent (hachuré s'il est nu), son nom au centre ; murs avec leur épaisseur.
   */
  import { zoneRegion } from '../../core/coverage';
  import type { Point } from '../../core/geometry/types';
  import { labelPoint, planBounds } from '../../core/plan/snap';
  import type { PlanRoom } from '../../core/plan/types';
  import { wallBands } from '../../core/plan/walls';
  import type { Project } from '../../state/model';
  import { poseColor } from './colors';

  let { project }: { project: Project } = $props();

  const uid = Math.random().toString(36).slice(2);
  const b = $derived(planBounds(project.plan));
  const pad = 400;
  const vb = $derived(
    b ? `${b[0] - pad} ${b[2] - pad} ${b[1] - b[0] + 2 * pad} ${b[3] - b[2] + 2 * pad}` : '0 0 4000 3000',
  );
  const font = $derived(b ? Math.max(b[1] - b[0], b[3] - b[2]) / 28 : 150);
  const at = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];
  const pts = (r: PlanRoom, poly: readonly Point[]) => poly.map((p) => at(r, p).join(',')).join(' ');
  const poseIndex = $derived(new Map(project.poses.map((p, i) => [p.id, i])));
  const floors = (r: PlanRoom) =>
    project.zones
      .filter((z) => z.surface.room === r.id && z.surface.wall == null)
      .map((z) => ({ z, rings: zoneRegion(project.plan, z) ?? [] }));
  const summary = (r: PlanRoom) => {
    const names = [
      ...new Set(
        project.zones
          .filter((z) => z.surface.room === r.id)
          .map((z) => project.poses.find((p) => p.id === z.pose)?.name ?? ''),
      ),
    ];
    return names.length ? names.join(', ') : 'sans revêtement';
  };
</script>

<svg class="map" viewBox={vb} role="group" aria-label="Plan de {project.name}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern
      id="bare-{uid}"
      width={font / 1.5}
      height={font / 1.5}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1="0" y1="0" x2="0" y2={font / 1.5} class="hatch" />
    </pattern>
  </defs>
  {#each project.plan.rooms as r (r.id)}
    {@const c = at(r, labelPoint(r.outline))}
    <a href="#/p/{project.id}/r/{r.id}" aria-label="Ouvrir {r.name} : {summary(r)}">
      <polygon class="floor" points={pts(r, r.outline)} fill="url(#bare-{uid})" />
      {#each floors(r) as f (f.z.id)}
        {#each f.rings as ring, k (k)}
          <polygon class="zone" points={pts(r, ring)} fill={poseColor(poseIndex.get(f.z.pose) ?? 0)} />
        {/each}
      {/each}
      <polygon class="edge" points={pts(r, r.outline)} />
      {#each wallBands(r) as band, i (i)}<polygon class="wall" points={pts(r, band)} />{/each}
      <text x={c[0]} y={c[1]} font-size={font} text-anchor="middle" dominant-baseline="middle">{r.name}</text>
    </a>
  {/each}
</svg>

<style>
  .map {
    display: block;
    width: 100%;
    height: 100%;
  }
  .floor {
    stroke: none;
  }
  .hatch {
    stroke: var(--line);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .zone {
    opacity: 0.85;
  }
  .edge {
    fill: none;
    stroke: transparent;
    stroke-width: 4;
    vector-effect: non-scaling-stroke;
  }
  .wall {
    fill: var(--muted);
  }
  a:hover .edge,
  a:focus-visible .edge {
    stroke: var(--accent);
  }
  a:focus-visible {
    outline: none;
  }
  text {
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 3px;
    font-weight: 600;
  }
</style>
