<script lang="ts">
  /**
   * Maquette 3D d'un projet (ou d'une partie) avec ses revêtements : calcule chaque module de la portée par le
   * worker, charge ses maillages et la scène à la demande, puis l'affiche (Vue 3D, aperçu de l'écran Projet).
   */
  import { untrack } from 'svelte';
  import { scopePoses, type ResultScope } from '../../core/coverage/scope';
  import { modules } from '../../modules/registry';
  import type { ResultExports } from '../../modules/types';
  import type { WallMode } from '../../render/scene3d/scene';
  import type { Project } from '../../state/model';
  import { app } from '../lib/app.svelte';
  import { EMPTY_FRAME, loadModel3D, modelFrame, modelMeshes, type Model3DLibs, type ModelEntry } from '../lib/model3d';
  import Scene3DView from './Scene3DView.svelte';
  import { projectContext } from '../lib/projectContext';

  let {
    project,
    scope = { kind: 'project' },
    label,
    walls = $bindable('cut'),
    highlight = null,
    onpick,
    preview = false,
  }: {
    project: Project;
    scope?: ResultScope;
    label: string;
    walls?: WallMode;
    highlight?: readonly [number, number][] | null;
    onpick?: (p: [number, number]) => void;
    preview?: boolean;
  } = $props();

  const mods = $derived.by(() => {
    const poses = scopePoses(project, scope);
    return modules.filter((m) => Object.hasOwn(project.modules, m.id) && poses.some((p) => p.module === m.id));
  });

  let libs = $state.raw<Model3DLibs | null>(null);
  let failed = $state(false);
  $effect(() => {
    void loadModel3D().then(
      (l) => (libs = l),
      () => (failed = true),
    );
  });

  /** Revêtements calculés de chaque module ; un module qui ne peut pas calculer est simplement absent. */
  let entries = $state.raw<Record<string, ModelEntry>>({});
  let exportsBy: Record<string, ResultExports> = {};
  $effect(() => {
    const p = project;
    const libraries = app.libraries;
    let live = true;
    for (const m of mods) {
      const r = m.toSpec(p, libraries, projectContext(p, libraries));
      if ('errors' in r) continue;
      void Promise.all([
        app.queued(m.id, r.spec),
        untrack(() => exportsBy[m.id]) ?? m.results().then((x) => x.exports()),
      ]).then(
        ([result, exports]) => {
          exportsBy[m.id] = exports;
          if (live) entries = { ...untrack(() => entries), [m.id]: { module: m.id, project: p, result, exports } };
        },
        () => undefined,
      );
    }
    return () => (live = false);
  });

  const build = $derived.by(() => {
    const l = libs,
      p = project;
    if (!l) return null;
    // revêtements calculés pour le projet tel qu'il est : les autres attendent leur nouveau calcul
    const list = mods.flatMap((m) => (entries[m.id]?.project === p ? [entries[m.id]!] : []));
    const libraries = app.libraries;
    return () => modelMeshes(l, p, scope, list, libraries);
  });
  const frame = $derived(libs ? modelFrame(libs, project, scope) : EMPTY_FRAME);
</script>

{#if failed}
  <p class="err">La vue 3D n’a pas pu se charger. Rechargez la page.</p>
{:else}
  <Scene3DView
    {build}
    {frame}
    frameKey={project.id + JSON.stringify(scope)}
    {label}
    bind:walls
    {highlight}
    {onpick}
    {preview}
  />
{/if}

<style>
  .err {
    padding: var(--space-4);
    color: var(--color-error);
  }
</style>
