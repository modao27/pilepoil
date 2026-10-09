<script lang="ts">
  /**
   * Écran Carrelage (#/p/:id/m/carrelage) : les pièces du plan, le sol et les murs à cocher pour les carreler,
   * un lien vers chaque surface carrelée et vers la vue de la pièce.
   */
  import type { ModuleScreenProps } from '../../../types';
  import type { ProjectResult } from '../../core';
  import { checkZone, orphanZones, type SurfaceRef } from '../../../../core/coverage';
  import { carrelageData, carrelageView, CARRELAGE_ID } from '../../state/data';
  import { newId } from '../../state/factories';
  import { newPoseSettings, tilePosesOn, tileSurfaceAction, untileSurfaceAction } from '../../state/poses';
  import { covers, nameIn, tiledTop } from '../../state/surfaces';
  import { coverageText } from '../../../../ui/lib/coverageMessages';
  import { moduleById } from '../../../registry';
  import { wallLength } from '../../../../core/plan/walls';
  import { reduceProject, type ProjectAction } from '../../../../state/project';
  import Button from '../../../../ui/components/Button.svelte';
  import Checkbox from '../../../../ui/components/Checkbox.svelte';
  import EmptyState from '../../../../ui/components/EmptyState.svelte';
  import Screen from '../../../../ui/components/Screen.svelte';
  import { app } from '../../../../ui/lib/app.svelte';
  import { cm } from '../../../../ui/lib/format';
  import { toast } from '../../../../ui/lib/toasts.svelte';
  import RoomWalls from '../components/RoomWalls.svelte';
  import { errorText } from '../lib/messages';
  import { carrelage } from '../state.svelte';

  let { projectId: id }: ModuleScreenProps = $props();

  const doc = $derived(app.project(id));
  const project = $derived(doc ? carrelageView(doc) : null);
  let result = $state.raw<ProjectResult | null>(null);

  $effect(() => {
    const p = project;
    if (!p?.surfaces.length) return;
    let live = true;
    void carrelage.result(p).then((r) => live && (result = r));
    return () => (live = false);
  });

  const index = $derived(new Map(project?.surfaces.map((s, i) => [s.id, i]) ?? []));
  const warnings = $derived(project ? orphanZones(project.plan, project.zones).length : 0);
  /** Surface carrelée (première pose) d'un sol ou d'un mur. */
  const surfaceOn = (ref: SurfaceRef) => project?.surfaces.find((s) => covers(s, ref));

  /** Résumé d'une surface carrelée : pièces posées, coupes fines, ou erreur. */
  function status(sid: string): string {
    const i = index.get(sid);
    const r = i != null ? result?.surfaces[i] : undefined;
    if (!r) return 'Calcul…';
    if (!r.ok) return errorText(r.error);
    const n = r.value.pieces.filter((p) => !p.plinth && !p.reveal).length,
      thin = r.value.pieces.filter((p) => p.thin).length;
    return `${n} pièce${n > 1 ? 's' : ''}${thin ? ` · ${thin} coupe${thin > 1 ? 's' : ''} fine${thin > 1 ? 's' : ''}` : ''}`;
  }

  async function dispatch(a: ProjectAction) {
    if (!doc) return;
    const next = reduceProject(doc, a);
    if (next !== doc) await app.trySaveProject({ ...next, updatedAt: Date.now() });
  }

  /**
   * Carreler ou non toute une surface. Une nouvelle pose reprend les réglages de la dernière pose de la pièce,
   * sinon du projet ; un refus (surface déjà couverte par un autre revêtement…) est expliqué.
   */
  function setTiled(ref: SurfaceRef, on: boolean) {
    if (!doc || !project) return;
    if (!on) {
      void dispatch(untileSurfaceAction(doc, ref));
      toast('Surface retirée du carrelage.');
      return;
    }
    const inRoom = project.surfaces.filter((s) => s.ref.room === ref.room);
    const like = inRoom[inRoom.length - 1] ?? project.surfaces[project.surfaces.length - 1];
    const settings = newPoseSettings(carrelageData(doc), carrelage.tiles, newId, like?.id);
    const action = tileSurfaceAction(doc, ref, settings, newId);
    const error = checkZone(doc.plan, doc, action.zones[0]!, moduleById(CARRELAGE_ID)!.coverage);
    if (error) {
      toast(coverageText(error), { tone: 'error' });
      refused++;
    } else void dispatch(action);
  }
  /** Cases refusées : compteur pour les redessiner dans leur état réel. */
  let refused = $state(0);
</script>

{#if !doc || !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title="Carrelage — {project.name}" backHref="#/p/{id}" backLabel="Projet">
    {#snippet actions()}
      {#if project.surfaces.length}
        <Button variant="ghost" href="#/p/{id}/m/carrelage/compare">Comparer</Button>
        <Button variant="primary" href="#/p/{id}/m/carrelage/results">Résultats</Button>
      {/if}
    {/snippet}
    {#if !project.plan.rooms.length}
      <EmptyState
        icon="room"
        title="Aucune pièce dans le plan"
        text="Dessinez la pièce, puis cochez ce qu’il faut carreler."
      >
        {#snippet action()}<Button variant="primary" href="#/p/{id}/plan">Dessiner le plan</Button>{/snippet}
      </EmptyState>
    {:else}
      <div class="home">
        {#if warnings}
          <p class="warn" role="status">
            {warnings} zone{warnings > 1 ? 's' : ''} carrelée{warnings > 1 ? 's' : ''} n’exist{warnings > 1
              ? 'ent'
              : 'e'} plus dans le plan.
            <Button variant="ghost" onclick={() => dispatch({ type: 'zone/prune' })}>Retirer</Button>
          </p>
        {/if}
        {#each project.plan.rooms as room (room.id)}
          {@const floor = !!doc && tilePosesOn(doc, { room: room.id, wall: null }).length > 0}
          {@const surfaces = project.surfaces.filter((s) => s.parts.some((q) => q.ref.room === room.id))}
          <section class="room card" aria-labelledby="h-{room.id}">
            <h2 id="h-{room.id}">{room.name}</h2>
            <div class="thumb">
              <RoomWalls
                {room}
                {floor}
                walls={room.walls.filter((w) => !!surfaceOn({ room: room.id, wall: w.id })).map((w) => w.id)}
                label="Plan de {room.name}, murs numérotés"
              />
            </div>
            {#key refused}<fieldset>
                <legend>À carreler</legend>
                <Checkbox label="Sol" checked={floor} onchange={(v) => setTiled({ room: room.id, wall: null }, v)} />
                {#each room.walls as w, i (w.id)}
                  {@const top = doc ? tiledTop(doc.plan, doc.zones, { room: room.id, wall: w.id }) : null}
                  {@const s = surfaceOn({ room: room.id, wall: w.id })}
                  <Checkbox
                    label="Mur {i + 1}"
                    hint="{cm(wallLength(room, i))}{s && top != null ? `, carrelé sur ${cm(top)}` : ''}"
                    checked={!!s}
                    onchange={(v) => setTiled({ room: room.id, wall: w.id }, v)}
                  />
                {/each}
              </fieldset>{/key}
            {#if surfaces.length}
              <ul class="surfaces">
                {#each surfaces as s (s.id)}
                  <li>
                    <a href="#/p/{id}/m/carrelage/s/{s.id}" aria-label="Ouvrir {s.name}">
                      <strong>{nameIn(s, room)}</strong>
                      <span class="muted">{status(s.id)}</span>
                    </a>
                  </li>
                {/each}
              </ul>
              <div><Button href="#/p/{id}/m/carrelage/room/{room.id}">Vue de la pièce</Button></div>
            {/if}
          </section>
        {/each}
        <div><Button href="#/p/{id}/plan">Modifier le plan</Button></div>
      </div>
    {/if}
  </Screen>
{/if}

<style>
  .home {
    display: grid;
    gap: var(--space-4);
  }
  .card {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-md);
  }
  .thumb {
    height: 160px;
  }
  fieldset {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-2);
    font-weight: 600;
  }
  .surfaces {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .surfaces a {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    align-items: baseline;
    min-height: var(--touch);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--field-border);
    border-radius: var(--r-field);
    color: var(--ink);
    text-decoration: none;
  }
  .surfaces a:hover {
    border-color: var(--accent);
  }
  .surfaces strong::first-letter {
    text-transform: uppercase;
  }
  .warn {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin: 0;
  }
  @media (min-width: 900px) {
    .home {
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      align-items: start;
    }
  }
</style>
