<script lang="ts">
  /**
   * Vue globale du projet (#/p/:id, docs/NAVIGATION.md §3) : plan d'ensemble cliquable (une pièce ouvre son écran
   * Pièce), pièces avec leurs surfaces revêtues et leurs poses (chaque pose ouvre son calepinage), résumé de chaque
   * revêtement, achats.
   */
  import { modules } from '../../modules/registry';
  import type { ShoppingLine } from '../../core/shopping/types';
  import type { ModuleSummary } from '../../modules/types';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { onMount } from 'svelte';
  import Icon from '../icons/Icon.svelte';
  import ProjectModel from '../components/ProjectModel.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
  import { euros } from '../lib/format';
  import { deferredOutput } from '../lib/moduleOutputs';
  import { consolidate } from '../lib/shopping';
  import { moduleById } from '../../modules/registry';
  import { poseColor } from '../room/colors';
  import PlanMap from '../room/PlanMap.svelte';

  let { id }: { id: string } = $props();

  /** L'aperçu 3D (three.js, lourd) ne se monte que quand le navigateur est libre : l'écran s'affiche avant. */
  let previewReady = $state(false);
  onMount(() => {
    // téléphone : pas d'aperçu animé (three.js bloque plus d'une seconde) ; l'icône mène à la vue 3D
    if (!matchMedia('(min-width: 720px)').matches) return;
    const go = () => (previewReady = true);
    if ('requestIdleCallback' in window) {
      const h = requestIdleCallback(go, { timeout: 2500 });
      return () => cancelIdleCallback(h);
    }
    const t = setTimeout(go, 800);
    return () => clearTimeout(t);
  });

  const project = $derived(app.project(id));
  const active = $derived(project ? modules.filter((m) => Object.hasOwn(project.modules, m.id)) : []);
  const rooms = $derived(project?.plan.rooms.length ?? 0);

  let summaries = $state.raw<Record<string, ModuleSummary | null | undefined>>({});
  let lines = $state.raw<Record<string, ShoppingLine[]>>({});
  const cost = $derived(
    active.every((m) => summaries[m.id] !== undefined) ? consolidate(active.flatMap((m) => lines[m.id] ?? [])) : null,
  );
  $effect(() => {
    const p = project;
    void app.libraries;
    if (!p) return;
    let live = true;
    for (const m of active)
      void deferredOutput(p, m).then(
        (o) => {
          if (!live) return;
          summaries = { ...summaries, [m.id]: o.summary };
          lines = { ...lines, [m.id]: o.lines };
        },
        () => live && (summaries = { ...summaries, [m.id]: null }),
      );
    return () => (live = false);
  });

  /** Poses d'une pièce, avec les surfaces qu'elles y couvrent : « Sol », « Murs 1, 2 ». */
  function posesIn(roomId: string) {
    const p = project;
    if (!p) return [];
    const room = p.plan.rooms.find((r) => r.id === roomId);
    return p.poses.flatMap((pose) => {
      const zs = p.zones.filter((z) => z.pose === pose.id && z.surface.room === roomId);
      if (!zs.length || !room) return [];
      const floor = zs.some((z) => z.surface.wall == null);
      const walls = [
        ...new Set(
          zs.flatMap((z) => (z.surface.wall ? [room.walls.findIndex((w) => w.id === z.surface.wall) + 1] : [])),
        ),
      ].sort((a, b) => a - b);
      const where = [floor ? 'sol' : '', walls.length ? `mur${walls.length > 1 ? 's' : ''} ${walls.join(', ')}` : '']
        .filter(Boolean)
        .join(', ');
      const m = moduleById(pose.module);
      return [{ pose, module: m, where, index: p.poses.indexOf(pose) }];
    });
  }
</script>

{#if !project}
  <Screen title="Projet introuvable" backHref="#/" backLabel="Accueil">
    <EmptyState icon="info" title="Ce projet n’existe plus" text="Il a peut-être été supprimé.">
      {#snippet action()}<Button variant="primary" href="#/">Voir mes projets</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title={project.name} backHref="#/" backLabel="Mes projets">
    {#snippet actions()}<Button variant="ghost" href="#/p/{project.id}/plan">Modifier le plan</Button>{/snippet}
    {#if project.poses.length || active.some((m) => !m.coverage)}
      <div class="row top">
        <Button variant="primary" icon="list" href="#/p/{project.id}/resultats"
          >Résultats du projet (3D, dossier PDF)</Button
        >
      </div>
    {/if}
    <div class="layout">
      <section aria-labelledby="h-plan">
        <h2 id="h-plan">Plan</h2>
        {#if rooms}
          <div class="map"><PlanMap {project} /></div>
          <p class="muted">Touchez une pièce pour choisir ses revêtements.</p>
          <a class="card model" href="#/p/{project.id}/3d">
            <span class="preview" aria-hidden="true"
              >{#if previewReady}<ProjectModel {project} label="Aperçu 3D du projet" preview />{:else}<span class="ph"
                  ><Icon name="view3d" size={40} /></span
                >{/if}</span
            >
            <span class="text">
              <span class="title">Vue 3D</span>
              <span class="muted">Toutes les pièces en maquette, murs coupés</span>
            </span>
          </a>
        {:else}
          <a class="card plan" href="#/p/{project.id}/plan">
            <span class="thumb"><span class="empty">Aucune pièce dessinée</span></span>
            <span class="text">
              <span class="title">Ajoutez votre première pièce</span>
              <span class="muted">Murs, portes, fenêtres, poteaux</span>
            </span>
          </a>
        {/if}
      </section>

      <section aria-labelledby="h-rooms">
        <h2 id="h-rooms">Pièces</h2>
        <ul class="tools">
          {#each project.plan.rooms as r (r.id)}
            {@const poses = posesIn(r.id)}
            <li class="card room">
              <a class="text" href="#/p/{project.id}/r/{r.id}">
                <span class="title">{r.name}</span>
                <span class="muted">{poses.length ? '' : 'Sans revêtement : choisir les revêtements'}</span>
              </a>
              {#if poses.length}
                <ul class="poses">
                  {#each poses as x (x.pose.id)}
                    <li style="--pose: {poseColor(x.index)}">
                      <a href={x.module?.poseHref?.(project.id, x.pose.id)}
                        ><span class="chip" aria-hidden="true"></span>{x.module?.label} · {x.pose.name}
                        <span class="muted">({x.where})</span></a
                      >
                    </li>
                  {/each}
                </ul>
                <a class="more" href="#/p/{project.id}/r/{r.id}/resultats">Résultats de {r.name}</a>
              {/if}
            </li>
          {/each}
        </ul>
        <div class="row">
          <Button icon="plus" href="#/p/{project.id}/plan">Ajouter une pièce</Button>
          <!-- outils de travaux pas encore utilisés (sans pose : ils s'ouvrent depuis le projet) -->
          {#each modules.filter((m) => !m.coverage && !Object.hasOwn(project!.modules, m.id)) as m (m.id)}
            <Button icon="plus" href="#/p/{project.id}/m/{m.id}">{m.label}</Button>
          {/each}
        </div>

        {#snippet toolCard(m: (typeof modules)[number])}
          {@const s = summaries[m.id]}
          <li>
            <a class="card tool" href={m.coverage ? `#/p/${project!.id}/resultats` : `#/p/${project!.id}/m/${m.id}`}>
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- tracé de l'icône du module, fourni par le code -->
              <svg class="icon" viewBox="0 0 34 24" aria-hidden="true">{@html m.icon}</svg>
              <span class="text">
                <span class="title">{m.label}</span>
                <span class="muted num"
                  >{s === undefined ? 'Calcul…' : s === null ? 'À compléter' : s.text}{#if s?.alerts}
                    · <span class="alert">{s.alerts} alerte{s.alerts > 1 ? 's' : ''}</span>{/if}</span
                >
              </span>
            </a>
          </li>
        {/snippet}
        {#if active.length}
          {#if active.some((m) => m.coverage)}
            <h2 class="sub">Revêtements</h2>
            <ul class="tools">
              {#each active.filter((m) => m.coverage) as m (m.id)}{@render toolCard(m)}{/each}
            </ul>
          {/if}
          {#if active.some((m) => !m.coverage)}
            <h2 class="sub">Travaux</h2>
            <ul class="tools">
              {#each active.filter((m) => !m.coverage) as m (m.id)}{@render toolCard(m)}{/each}
            </ul>
          {/if}
          <a class="card shop" href="#/p/{project.id}/achats">
            <span class="text">
              <span class="title">Achats</span>
              <span class="muted num"
                >{!cost
                  ? 'Calcul…'
                  : cost.total > 0
                    ? `Total estimé ${euros(cost.total)}`
                    : 'Liste d’achat, prix à saisir'}{cost?.unpriced
                  ? ` · ${cost.unpriced} article${cost.unpriced > 1 ? 's' : ''} sans prix`
                  : ''}</span
              >
            </span>
          </a>
        {/if}
      </section>
    </div>
  </Screen>
{/if}

<style>
  .layout {
    display: grid;
    gap: var(--space-5);
  }
  @media (min-width: 1024px) {
    .layout {
      grid-template-columns: 1fr 1fr;
      align-items: start;
    }
  }
  h2 {
    margin: 0 0 var(--space-3);
    font-size: var(--fs-lg);
  }
  .card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--sheet);
    color: var(--ink);
    text-decoration: none;
  }
  a.card:hover {
    border-color: var(--accent);
  }
  .plan {
    display: grid;
    gap: var(--space-2);
  }
  .thumb {
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    border-radius: var(--r-field);
    background: var(--paper);
  }
  .empty {
    color: var(--muted);
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .title {
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
  }
  .alert {
    /* texte : --thin-ink (contraste AA), --thin est réservé aux tracés */
    color: var(--thin-ink);
  }
  .tools {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .icon {
    flex: none;
    width: 51px;
    height: 36px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .shop {
    margin-top: var(--space-2);
  }
  .model {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .ph {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--muted);
    background: var(--paper);
  }
  .preview {
    position: relative;
    aspect-ratio: 16 / 9;
    border-radius: var(--r-field);
    overflow: hidden;
    pointer-events: none;
  }
  .map {
    aspect-ratio: 4 / 3;
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    background: var(--paper);
  }
  .sub {
    margin-top: var(--space-5);
  }
  .room {
    display: grid;
    align-items: start;
  }
  .room > a {
    color: var(--ink);
    text-decoration: none;
    min-height: var(--touch);
    display: grid;
    align-content: center;
  }
  .poses {
    display: grid;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .poses a {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch);
    color: var(--ink);
  }
  .chip {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: var(--pose);
    border: 1px solid var(--ink);
  }
  .row {
    margin-top: var(--space-3);
  }
  .row.top {
    margin: 0 0 var(--space-4);
  }
  .more {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
</style>
