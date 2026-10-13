<script lang="ts">
  /** Détail de la peinture sur l'écran Résultats : murs de chaque pose dans la portée, produits et pots. */
  import { app } from '../../../../ui/lib/app.svelte';
  import type { ResultSectionProps } from '../../../types';
  import type { Paint } from '../../core/paint';
  import type { PeintureResult } from '../../core/types';
  import { layoutsOf } from '../../state/poses';

  let { project, scope, result }: ResultSectionProps = $props();

  const poses = $derived(
    (result as PeintureResult).poses.filter((p) =>
      scope.kind === 'pose'
        ? p.id === scope.pose
        : scope.kind === 'room'
          ? p.result.zones.some((z) => z.room === scope.room)
          : true,
    ),
  );
  const name = (id: string) => ((app.libraries.paints ?? []) as readonly Paint[]).find((p) => p.id === id)?.name ?? id;
  const poseName = (id: string) => layoutsOf(project).find((l) => l.id === id)?.name ?? id;
  const wallLabel = (room: string, wall: string) => {
    const r = project.plan.rooms.find((x) => x.id === room);
    return r ? `${r.name}, mur ${r.walls.findIndex((w) => w.id === wall) + 1}` : 'Mur';
  };
  const fr = (v: number, d = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
</script>

{#each poses as p (p.id)}
  <section aria-label={poseName(p.id)}>
    <h3>{poseName(p.id)}</h3>
    <table>
      <thead
        ><tr
          ><th scope="col">Mur</th><th scope="col">Brut</th><th scope="col">Ouvertures</th><th scope="col">Net</th></tr
        ></thead
      >
      <tbody>
        {#each p.result.zones.filter((z) => scope.kind !== 'room' || z.room === scope.room) as z (z.id)}
          <tr>
            <th scope="row">{wallLabel(z.room, z.wall)}</th>
            <td>{fr(z.gross)} m²</td>
            <td>{fr(z.openings, 2)} m²</td>
            <td>{fr(z.net)} m²</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if p.result.products.length}
      <ul class="products">
        {#each p.result.products as x (x.key)}
          <li>
            {name(x.paint)} : {fr(x.need / 1000)}
            {x.role === 'filler' ? 'kg' : 'L'} sur {fr(x.surface)} m² ({x.packs
              .map((k) => `${k.count} × ${fr(k.size, 2)}`)
              .join(' + ') || 'pas de pot'})
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/each}

<style>
  section {
    display: grid;
    gap: var(--space-2);
  }
  h3 {
    margin: 0;
    font-size: var(--fs-base);
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    padding: var(--space-1) var(--space-2);
    border-bottom: 1px solid var(--line);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  th[scope='row'],
  thead th:first-child {
    text-align: left;
  }
  .products {
    margin: 0;
    padding-left: var(--space-5);
  }
</style>
