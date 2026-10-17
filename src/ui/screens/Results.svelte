<script lang="ts">
  /**
   * Résultats d'une pose, d'une pièce ou du projet (docs/NAVIGATION.md §7), pour tous les revêtements :
   * Résumé (chiffres de chaque pose sur la portée, quantités à commander), Détail (section de chaque module),
   * 3D (enveloppe des pièces et revêtements ensemble) ; export PDF (calepinage, pièce, dossier du projet).
   * L'écran ne calcule rien de métier : il demande le calcul au worker et le rapport aux modules.
   */
  import { tick, untrack } from 'svelte';
  import HelpTip from '../components/HelpTip.svelte';
  import { poseWhere, type Pose } from '../../core/coverage';
  import { poseArea, scopePoses, type ResultScope } from '../../core/coverage/scope';
  import { moduleById, modules } from '../../modules/registry';
  import type { ModuleError, ModuleResults, PoseReport, ResultExports, ToolModule } from '../../modules/types';
  import type { Project } from '../../state/model';
  import Button from '../components/Button.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Scene3DView from '../components/Scene3DView.svelte';
  import Screen from '../components/Screen.svelte';
  import StatCard from '../components/StatCard.svelte';
  import Tabs from '../components/Tabs.svelte';
  import { app } from '../lib/app.svelte';
  import { canShareFiles, fileSlug, saveBlob } from '../lib/files';
  import { EMPTY_FRAME, loadModel3D, modelFrame, modelMeshes, type Model3DLibs } from '../lib/model3d';
  import { projectOutputs } from '../lib/moduleOutputs';
  import { consolidate } from '../lib/shopping';
  import { poseColor } from '../room/colors';
  import { projectContext } from '../lib/projectContext';

  let { id, scope }: { id: string; scope: ResultScope } = $props();

  const project = $derived(app.project(id));
  const room = $derived(scope.kind === 'room' ? project?.plan.rooms.find((r) => r.id === scope.room) : undefined);
  const pose = $derived(scope.kind === 'pose' ? project?.poses.find((p) => p.id === scope.pose) : undefined);
  const missing = $derived(!project || (scope.kind === 'room' && !room) || (scope.kind === 'pose' && !pose));
  const poses = $derived(project ? scopePoses(project, scope) : []);
  const mods = $derived(
    project
      ? modules.filter(
          (m) =>
            Object.hasOwn(project.modules, m.id) &&
            // un module sans pose (cloisons) est dans les résultats du projet et des pièces, pas d'une pose
            (poses.some((p) => p.module === m.id) || (!m.coverage && scope.kind !== 'pose')),
        )
      : [],
  );

  /**
   * Résultat de chaque module, avec le projet calculé ; null : le module ne peut pas calculer. Les raisons sont
   * gardées à part (erreurs de `toSpec` ou calcul échoué) pour être dites à l'utilisateur.
   */
  type Computed = { project: Project; result: unknown } | null;
  let problems = $state.raw<Record<string, ModuleError[] | 'failed'>>({});
  let results = $state.raw<Record<string, Computed>>({});
  $effect(() => {
    const p = project;
    const libraries = app.libraries;
    if (!p) return;
    let live = true;
    const set = (m: string, v: Computed, why?: ModuleError[] | 'failed') => {
      if (!live) return;
      results = { ...results, [m]: v };
      const { [m]: _, ...rest } = problems;
      problems = why ? { ...rest, [m]: why } : rest;
    };
    const context = projectContext(p, libraries);
    for (const m of mods) {
      const r = m.toSpec(p, libraries, context);
      if ('errors' in r) untrack(() => set(m.id, null, r.errors));
      else
        void app.queued(m.id, r.spec).then(
          (result) => set(m.id, { project: p, result }),
          () => set(m.id, null, 'failed'),
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
      const why = problems[m.id];
      const problem =
        c !== null || !impl
          ? null
          : why === 'failed'
            ? 'Le calcul a échoué. Rechargez la page ; si le problème revient, signalez-le.'
            : (why ?? []).map((e) => impl.errorText(e)).join(' ') || null;
      return { module: m, reports: list, problem, poses: poses.filter((p) => p.module === m.id) };
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
        : (poseModule && pose && poseModule.poseHref?.(id, pose.id)) || `#/p/${id}`,
  );

  /** Outils dont le détail est ouvert (clé absente : seul le premier, pour le projet entier). */
  let opened = $state<Record<string, boolean>>({});
  /** Ouvre l'outil et y amène la vue (pas de lien `#` : l'adresse sert au routeur). */
  function goToDetail(module: string) {
    opened[module] = true;
    void tick().then(() => document.getElementById('d-' + module)?.scrollIntoView({ block: 'start' }));
  }

  type Tab = 'summary' | 'detail' | '3d';
  let tab = $state<Tab>('summary');

  /* ---------- PDF et 3D : fonctions des modules chargées à la demande ---------- */

  let exportsBy = $state.raw<Record<string, ResultExports>>({});
  async function loadExports(): Promise<Record<string, ResultExports>> {
    const loaded = await Promise.all(mods.map(async (m) => [m.id, await (await m.results()).exports()] as const));
    exportsBy = { ...exportsBy, ...Object.fromEntries(loaded) };
    return exportsBy;
  }

  let libs3d = $state.raw<Model3DLibs | null>(null);
  let failed3d = $state(false);
  let walls = $state<'full' | 'low' | 'cut'>('cut');
  $effect(() => {
    if (tab !== '3d' || libs3d) return;
    void Promise.all([loadModel3D(), untrack(loadExports)]).then(
      ([l]) => (libs3d = l),
      () => (failed3d = true),
    );
  });
  const build = $derived.by(() => {
    const libs = libs3d,
      p = project,
      ex = exportsBy;
    if (!libs || !p) return null;
    const entries = mods.flatMap((m) => {
      const c = results[m.id];
      const x = ex[m.id];
      return c && x ? [{ module: m.id, project: c.project, result: c.result, exports: x }] : [];
    });
    const libraries = app.libraries;
    return () => modelMeshes(libs, p, scope, entries, libraries);
  });
  const frame = $derived(libs3d && project ? modelFrame(libs3d, project, scope) : EMPTY_FRAME);
  const frameKey = $derived(JSON.stringify(scope));

  /* ---------- export ---------- */

  const pdfTitle = $derived(
    scope.kind === 'project'
      ? 'Dossier du projet'
      : scope.kind === 'room'
        ? `PDF de la pièce — ${room?.name ?? ''}`
        : `PDF de la pose — ${pose ? where(pose) : ''}`,
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
            <a href={poseModule.poseHref?.(id, pose.id)}>{poseModule.label} · {pose.name}</a>
          </li>{/if}
        <li aria-current="page">Résultats</li>
      </ol>
    </nav>

    {#if !poses.length && !mods.length}
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
      <p class="words">
        Mots utilisés : coupe fine <HelpTip id="coupe-fine" /> coupe perdue <HelpTip id="coupe-perdue" /> chutes
        <HelpTip id="chutes" />
      </p>
      <div class="export">
        <Button variant="primary" icon="download" disabled={!ready || status === 'busy'} onclick={download}>
          {scope.kind === 'project'
            ? 'Dossier du projet (PDF)'
            : scope.kind === 'room'
              ? 'PDF de la pièce'
              : 'PDF de la pose'}
        </Button>
        {#if share}<Button icon="share" disabled={!ready || status === 'busy'} onclick={sharePdf}>Partager</Button>{/if}
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
          <!-- hauteur réservée : le contenu arrive après le calcul, sans faire sauter la page -->
          <div class="tabbody">
            {#if t === 'summary'}
              {#each reports as g (g.module.id)}
                {#if g.module.coverage || g.reports === undefined || g.reports === null || g.reports.length}
                  <section class="module" aria-labelledby="m-{g.module.id}">
                    <h2 id="m-{g.module.id}">{g.module.label}</h2>
                    {#if !g.module.coverage}
                      {#if g.reports === undefined}
                        <p class="muted" role="status">Calcul…</p>
                      {:else if g.reports === null}
                        <p class={g.problem ? 'err' : 'muted'}>{g.problem ?? 'À compléter.'}</p>
                      {:else}
                        {#each g.reports as r (r.pose)}
                          <article class="pose" aria-label="{g.module.label} · {r.title}">
                            <header>
                              <h3>{r.title}</h3>
                              <span class="muted">{r.where}</span>
                            </header>
                            {#if !r.ok}
                              <p class="err">{r.alerts.join(' ') || 'À compléter.'}</p>
                            {:else}
                              <div class="stats">
                                {#each r.figures as f (f.label)}<StatCard label={f.label} value={f.value} />{/each}
                              </div>
                              {#if r.alerts.length}
                                <ul class="alerts" aria-label="Alertes">
                                  {#each r.alerts as a (a)}<li>{a}</li>{/each}
                                </ul>
                              {/if}
                            {/if}
                            <p class="links"><a href={r.href}>Élévation et fiche de coupe</a></p>
                          </article>
                        {/each}
                        {#if g.reports[0]?.orderNote}<p class="muted">{g.reports[0].orderNote}</p>{/if}
                      {/if}
                    {/if}
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
                            {r?.alerts.join(' ') ||
                              g.problem ||
                              'À compléter : choisissez un produit dans le calepinage.'}
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
                          <a href={g.module.poseHref?.(id, p.id)}>Calepinage</a>
                          {#if scope.kind !== 'pose'}
                            · <a href="#/p/{id}/pose/{p.id}/resultats">Résultats de la pose</a>{/if}
                        </p>
                      </article>
                    {/each}
                  </section>
                {/if}
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
              {@const shown = reports.filter((g) => g.module.coverage || !g.reports || g.reports.length)}
              <!-- projet entier : un repli par outil et un sommaire ; une pose ou une pièce : tout ouvert -->
              {#if scope.kind === 'project' && shown.length > 1}
                <nav class="toc" aria-label="Aller à">
                  {#each shown as g (g.module.id)}
                    <button type="button" onclick={() => goToDetail(g.module.id)}>{g.module.label}</button>
                  {/each}
                </nav>
              {/if}
              {#each shown as g, i (g.module.id)}
                {@const c = results[g.module.id]}
                <details
                  class="module fold"
                  id="d-{g.module.id}"
                  open={scope.kind !== 'project' ||
                    opened[g.module.id] === true ||
                    (opened[g.module.id] === undefined && i === 0)}
                  ontoggle={(e) => (opened[g.module.id] = e.currentTarget.open)}
                >
                  <summary><h2>{g.module.label}</h2></summary>
                  {#if c === undefined}
                    <p class="muted" role="status">Calcul…</p>
                  {:else if c === null}
                    <p class="muted">À compléter dans le calepinage.</p>
                  {:else}
                    {#await g.module.results().then((r) => r.section()) then Section}
                      <Section project={c.project} {scope} result={c.result} />
                    {/await}
                  {/if}
                </details>
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
                    bind:walls
                    label={scope.kind === 'project'
                      ? 'Maquette 3D du logement'
                      : scope.kind === 'room'
                        ? `Maquette 3D de ${room?.name ?? ''}`
                        : `Maquette 3D de ${pose?.name ?? ''}`}
                  />
                {/if}
              </div>
            {/if}
          </div>
        {/snippet}
      </Tabs>
    {/if}
  </Screen>
{/if}

<style>
  .words {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    margin: 0 0 var(--space-2);
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  .tabbody {
    min-height: 70dvh;
  }
  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .toc button {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: var(--r-field);
    background: var(--sheet);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
  }
  .fold > summary {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    cursor: pointer;
  }
  .fold > summary > h2 {
    margin: 0;
  }
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
    /* hauteur réservée : le message apparaît et disparaît sans faire sauter les onglets */
    min-height: 1.5em;
    flex-basis: 100%;
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
