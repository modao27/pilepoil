<script lang="ts">
  /**
   * Résultats d'une pose, d'une pièce ou du projet (docs/NAVIGATION.md §7), pour tous les revêtements :
   * Résumé (chiffres de chaque pose sur la portée, quantités à commander), Détail (section de chaque module),
   * 3D (enveloppe des pièces et revêtements ensemble) ; export PDF (calepinage, pièce, dossier du projet).
   * L'écran ne calcule rien de métier : il demande le calcul au worker et le rapport aux modules.
   */
  import { untrack } from 'svelte';
  import { poseWhere, type Pose } from '../../core/coverage';
  import { poseArea, scopePoses, scopeRooms, scopeWallSpans, type ResultScope } from '../../core/coverage/scope';
  import { moduleById, modules } from '../../modules/registry';
  import type { ModuleResults, PoseReport, ResultExports, ToolModule } from '../../modules/types';
  import type { Project } from '../../state/model';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Scene3DView from '../components/Scene3DView.svelte';
  import Screen from '../components/Screen.svelte';
  import StatCard from '../components/StatCard.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { app } from '../lib/app.svelte';
  import { canShareFiles, fileSlug, saveBlob } from '../lib/files';
  import { projectOutputs } from '../lib/moduleOutputs';
  import { consolidate } from '../lib/shopping';
  import { poseColor } from '../room/colors';

  let { id, scope }: { id: string; scope: ResultScope } = $props();

  const project = $derived(app.project(id));
  const room = $derived(scope.kind === 'room' ? project?.plan.rooms.find((r) => r.id === scope.room) : undefined);
  const pose = $derived(scope.kind === 'pose' ? project?.poses.find((p) => p.id === scope.pose) : undefined);
  const missing = $derived(!project || (scope.kind === 'room' && !room) || (scope.kind === 'pose' && !pose));
  const poses = $derived(project ? scopePoses(project, scope) : []);
  const mods = $derived(
    project ? modules.filter((m) => Object.hasOwn(project.modules, m.id) && poses.some((p) => p.module === m.id)) : [],
  );

  /** Résultat de chaque module, avec le projet calculé ; null : le module ne peut pas calculer. */
  type Computed = { project: Project; result: unknown } | null;
  let results = $state.raw<Record<string, Computed>>({});
  $effect(() => {
    const p = project;
    const libraries = app.libraries;
    if (!p) return;
    let live = true;
    const set = (m: string, v: Computed) => live && (results = { ...results, [m]: v });
    for (const m of mods) {
      const r = m.toSpec(p, libraries);
      if ('errors' in r) untrack(() => set(m.id, null));
      else
        void app.queued(m.id, r.spec).then(
          (result) => set(m.id, { project: p, result }),
          () => set(m.id, null),
        );
    }
    return () => (live = false);
  });
  /** Résultats de chaque module (rapport, section, exports), chargés à la demande. */
  let impls = $state.raw<Record<string, ModuleResults>>({});
  $effect(() => {
    for (const m of mods)
      if (!untrack(() => impls[m.id])) void m.results().then((r) => (impls = { ...impls, [m.id]: r }));
  });

  /** Tous les revêtements calculés pour le projet tel qu'il est. */
  const ready = $derived(!!project && mods.every((m) => results[m.id] === null || results[m.id]?.project === project));

  const reports = $derived(
    mods.map((m) => {
      const c = results[m.id];
      const impl = impls[m.id];
      const list: PoseReport[] | null | undefined =
        c === undefined || !impl
          ? undefined
          : c === null
            ? null
            : impl.report({ project: c.project, libraries: app.libraries, result: c.result, scope });
      return { module: m, reports: list, poses: poses.filter((p) => p.module === m.id) };
    }),
  );

  const roomOf = (p: Pose) => project?.zones.find((z) => z.pose === p.id)?.surface.room;
  const crumbRoom = $derived(room ?? (pose ? project?.plan.rooms.find((r) => r.id === roomOf(pose)) : undefined));
  const poseModule = $derived(pose ? moduleById(pose.module) : undefined);
  const where = (p: Pose) =>
    project ? poseWhere(project.plan, project.zones, p.id, scope.kind === 'room' ? scope.room : undefined) : '';
  const area = (p: Pose) =>
    project
      ? (poseArea(project.plan, project, p.id, scope) / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
      : '';
  const poseIndex = (p: Pose) => project?.poses.indexOf(p) ?? 0;

  const title = $derived(
    scope.kind === 'project'
      ? 'Résultats du projet'
      : scope.kind === 'room'
        ? `Résultats — ${room?.name ?? ''}`
        : `Résultats — ${poseModule?.label ?? ''} · ${pose?.name ?? ''}`,
  );
  const backHref = $derived(
    scope.kind === 'project'
      ? `#/p/${id}`
      : scope.kind === 'room'
        ? `#/p/${id}/r/${scope.room}`
        : (poseModule && pose && poseModule.poseHref(id, pose.id)) || `#/p/${id}`,
  );

  type Tab = 'summary' | 'detail' | '3d';
  let tab = $state<Tab>('summary');

  /* ---------- PDF et 3D : fonctions des modules chargées à la demande ---------- */

  let exportsBy = $state.raw<Record<string, ResultExports>>({});
  async function loadExports(): Promise<Record<string, ResultExports>> {
    const loaded = await Promise.all(mods.map(async (m) => [m.id, await (await m.results()).exports()] as const));
    exportsBy = { ...exportsBy, ...Object.fromEntries(loaded) };
    return exportsBy;
  }

  let envelope = $state.raw<typeof import('../../render/scene3d/envelope') | null>(null);
  let failed3d = $state(false);
  $effect(() => {
    if (tab !== '3d' || envelope) return;
    void Promise.all([import('../../render/scene3d/envelope'), untrack(loadExports)]).then(
      ([e]) => (envelope = e),
      () => (failed3d = true),
    );
  });
  const rooms3d = $derived(project ? scopeRooms(project.plan, project, scope) : []);
  const build = $derived.by(() => {
    const env = envelope,
      p = project,
      ex = exportsBy;
    if (!env || !p) return null;
    const entries = mods.flatMap((m) => {
      const c = results[m.id];
      const x = ex[m.id];
      return c && x ? [{ m, c, x }] : [];
    });
    // parties de murs revêtues par un module calculé : il les dessine (plâtre compris) ; le reste est dans l'enveloppe
    const drawn = new Set(entries.map((e) => e.m.id));
    const covered = {
      zones: p.zones.filter((z) => drawn.has(p.poses.find((x) => x.id === z.pose)?.module ?? '')),
      poses: p.poses,
    };
    const skip = scopeWallSpans(p.plan, covered, scope);
    const libraries = app.libraries;
    return () =>
      env.mergeMeshes([
        ...env.buildEnvelope(p.plan, rooms3d, skip),
        ...entries.flatMap((e) => e.x.meshes({ project: e.c.project, libraries, result: e.c.result, scope })),
      ]);
  });
  const frame = $derived(
    envelope && project
      ? envelope.planFrame(project.plan, rooms3d)
      : { kind: 'room' as const, bounds: { x: [0, 1] as [number, number], z: [0, 1] as [number, number], h: 2.5 } },
  );
  const frameKey = $derived(JSON.stringify(scope));

  /* ---------- export ---------- */

  const pdfTitle = $derived(
    scope.kind === 'project'
      ? 'Dossier du projet'
      : scope.kind === 'room'
        ? `PDF de la pièce — ${room?.name ?? ''}`
        : `PDF du calepinage — ${pose ? where(pose) : ''}`,
  );
  const fileName = $derived.by(() => {
    const p = fileSlug(project?.name ?? '');
    if (scope.kind === 'project') return `dossier-${p}.pdf`;
    if (scope.kind === 'room') return `${p}-${fileSlug(room?.name ?? '', 'piece')}.pdf`;
    return `calepinage-${p}-${fileSlug(pose ? where(pose) : '', 'pose')}.pdf`;
  });
  const share = canShareFiles();
  let status = $state<'idle' | 'busy' | 'done' | 'shared' | 'error'>('idle');

  async function makePdf(): Promise<File | null> {
    const p = project;
    if (!p || !ready) return null;
    status = 'busy';
    try {
      const [{ buildResultsPdf }, ex] = await Promise.all([import('../lib/resultsPdf'), loadExports()]);
      const entries = mods.flatMap((m) => {
        const c = results[m.id];
        const impl = impls[m.id];
        return c && impl && ex[m.id]
          ? [{ module: m as ToolModule, result: c.result, results: impl, exports: ex[m.id]! }]
          : [];
      });
      const shopping = scope.kind === 'project' ? consolidate((await projectOutputs(p)).flatMap((o) => o.lines)) : null;
      const blob = buildResultsPdf({
        project: p,
        libraries: app.libraries,
        scope,
        title: pdfTitle,
        entries,
        shopping,
        date: Date.now(),
      });
      return new File([blob], fileName, { type: 'application/pdf' });
    } catch {
      status = 'error';
      return null;
    }
  }

  async function download() {
    const f = await makePdf();
    if (!f) return;
    saveBlob(f, f.name);
    status = 'done';
  }

  async function sharePdf() {
    const f = await makePdf();
    if (!f || !project) return;
    try {
      await navigator.share({ files: [f], title: pdfTitle, text: `PilePoil : ${project.name}` });
      status = 'shared';
    } catch (e) {
      status = e instanceof DOMException && e.name === 'AbortError' ? 'idle' : 'error';
    }
  }
</script>

{#if missing || !project}
  <Screen title="Résultats introuvables" backHref={project ? `#/p/${id}` : '#/'} backLabel="Retour">
    <EmptyState icon="info" title="Cette page n’existe plus" text="La pièce ou la pose a peut-être été supprimée.">
      {#snippet action()}<Button variant="primary" href={project ? `#/p/${id}` : '#/'}>Revenir au projet</Button
        >{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen {title} {backHref} backLabel="Retour" wide>
    <nav class="crumbs" aria-label="Fil de navigation">
      <ol>
        <li><a href="#/p/{id}">Projet</a></li>
        {#if crumbRoom}<li><a href="#/p/{id}/r/{crumbRoom.id}">{crumbRoom.name}</a></li>{/if}
        {#if pose && poseModule}<li>
            <a href={poseModule.poseHref(id, pose.id)}>{poseModule.label} – {pose.name}</a>
          </li>{/if}
        <li aria-current="page">Résultats</li>
      </ol>
    </nav>

    {#if !poses.length}
      <EmptyState
        icon="info"
        title="Rien à calculer ici"
        text={scope.kind === 'room' ? 'Revêtez le sol ou un mur de cette pièce.' : 'Ajoutez une pièce et revêtez-la.'}
      >
        {#snippet action()}<Button
            variant="primary"
            href={scope.kind === 'room' ? `#/p/${id}/r/${scope.room}` : `#/p/${id}`}>Choisir les revêtements</Button
          >{/snippet}
      </EmptyState>
    {:else}
      <div class="export">
        <Button variant="primary" icon="download" disabled={!ready || status === 'busy'} onclick={download}>
          {scope.kind === 'project'
            ? 'Dossier du projet (PDF)'
            : scope.kind === 'room'
              ? 'PDF de la pièce'
              : 'PDF du calepinage'}
        </Button>
        {#if share}<Button icon="upload" disabled={!ready || status === 'busy'} onclick={sharePdf}>Partager</Button
          >{/if}
        {#if scope.kind === 'project'}<Button variant="ghost" href="#/p/{id}/achats">Achats</Button>{/if}
        <p class="status" role="status">
          {#if !ready}Calcul…{:else if status === 'busy'}Préparation du PDF…{:else if status === 'done'}PDF enregistré
            dans vos téléchargements.{:else if status === 'shared'}PDF partagé.{:else if status === 'error'}Création du
            PDF impossible.{/if}
        </p>
        {#if status === 'error'}<Button variant="secondary" onclick={download}>Réessayer</Button>{/if}
      </div>

      <Tabs
        label="Résultats"
        bind:active={tab}
        tabs={[
          { id: 'summary', label: 'Résumé' },
          { id: 'detail', label: 'Détail' },
          { id: '3d', label: '3D' },
        ]}
      >
        {#snippet panel(t)}
          {#if t === 'summary'}
            {#each reports as g (g.module.id)}
              <section class="module" aria-labelledby="m-{g.module.id}">
                <h2 id="m-{g.module.id}">{g.module.label}</h2>
                {#each g.poses as p (p.id)}
                  {@const r = g.reports?.find((x) => x.pose === p.id)}
                  <article
                    class="pose"
                    style="--pose: {poseColor(poseIndex(p))}"
                    aria-label="{g.module.label} · {p.name}"
                  >
                    <header>
                      <h3><span class="chip" aria-hidden="true"></span>{p.name}</h3>
                      <span class="muted">{where(p)} · {area(p)} m²</span>
                    </header>
                    {#if g.reports === undefined}
                      <p class="muted" role="status">Calcul…</p>
                    {:else if !r || !r.ok}
                      <p class="err">
                        {r?.alerts.join(' ') || 'À compléter : choisissez un produit dans le calepinage.'}
                      </p>
                    {:else}
                      <div class="stats">
                        {#each r.figures as f (f.label)}<StatCard
                            label={f.label}
                            value={f.value}
                            status={f.status}
                          />{/each}
                      </div>
                      {#if r.order.length}
                        <div class="order">
                          <h4>À commander</h4>
                          <ul>
                            {#each r.order as o (o)}<li>{o}</li>{/each}
                          </ul>
                          {#if r.orderNote}<p class="muted">{r.orderNote}</p>{/if}
                        </div>
                      {/if}
                      {#if r.alerts.length}
                        <ul class="alerts" aria-label="Alertes">
                          {#each r.alerts as a (a)}<li>{a}</li>{/each}
                        </ul>
                      {/if}
                    {/if}
                    <p class="links">
                      <a href={g.module.poseHref(id, p.id)}>Calepinage</a>
                      {#if scope.kind !== 'pose'}
                        · <a href="#/p/{id}/pose/{p.id}/resultats">Résultats de la pose</a>{/if}
                    </p>
                  </article>
                {/each}
              </section>
            {/each}
            {#if scope.kind === 'project'}
              <section class="module" aria-labelledby="h-rooms">
                <h2 id="h-rooms">Par pièce</h2>
                <ul class="rooms">
                  {#each project.plan.rooms as r (r.id)}
                    <li><a href="#/p/{id}/r/{r.id}/resultats">Résultats — {r.name}</a></li>
                  {/each}
                </ul>
              </section>
            {/if}
          {:else if t === 'detail'}
            {#each reports as g (g.module.id)}
              {@const c = results[g.module.id]}
              <section class="module" aria-labelledby="d-{g.module.id}">
                <h2 id="d-{g.module.id}">{g.module.label}</h2>
                {#if c === undefined}
                  <p class="muted" role="status">Calcul…</p>
                {:else if c === null}
                  <p class="muted">À compléter dans le calepinage.</p>
                {:else}
                  {#await g.module.results().then((r) => r.section()) then Section}
                    <Section project={c.project} {scope} result={c.result} />
                  {/await}
                {/if}
              </section>
            {/each}
          {:else}
            <div class="v3d">
              {#if failed3d}
                <p class="err">La vue 3D n’a pas pu se charger. Rechargez la page.</p>
              {:else}
                <Scene3DView
                  {build}
                  {frame}
                  {frameKey}
                  label={scope.kind === 'project'
                    ? 'Maquette 3D du logement'
                    : scope.kind === 'room'
                      ? `Maquette 3D de ${room?.name ?? ''}`
                      : `Maquette 3D de ${pose?.name ?? ''}`}
                />
              {/if}
            </div>
          {/if}
        {/snippet}
      </Tabs>
    {/if}
  </Screen>
{/if}

<style>
  .crumbs ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    margin: 0 0 var(--space-3);
    padding: 0;
    list-style: none;
    font-size: var(--fs-sm);
  }
  .crumbs li {
    display: flex;
    align-items: center;
  }
  .crumbs li + li::before {
    content: '›';
    margin-right: var(--space-1);
    color: var(--muted);
  }
  .crumbs a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--touch);
    min-height: var(--touch);
    padding: 0 var(--space-1);
  }
  .export {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .status {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .module {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .pose {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-left: 6px solid var(--pose);
    border-radius: var(--r-panel);
    background: var(--sheet);
  }
  .pose header {
    display: grid;
    gap: 2px;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--fs-md);
  }
  h4 {
    margin: 0;
    font-size: var(--fs-base);
  }
  .chip {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: var(--pose);
    border: 1px solid var(--ink);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--space-2);
  }
  .order ul,
  .rooms {
    margin: var(--space-1) 0 0;
    padding-left: var(--space-4);
  }
  .rooms a,
  .links a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
  }
  .links {
    margin: 0;
  }
  .alerts {
    margin: 0;
    padding-left: var(--space-4);
    color: var(--thin-ink);
  }
  .muted {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .err {
    margin: 0;
    color: var(--thin-ink);
  }
  .v3d {
    position: relative;
    height: min(70vh, 600px);
    min-height: 320px;
    margin-top: var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-panel);
    overflow: hidden;
  }
</style>
