<script lang="ts">
  /**
   * Écran Pièce (#/p/:id/r/:pièce[/:surface], docs/NAVIGATION.md §5) : le sol et les murs sur le dessin, leurs
   * zones et leurs poses, pour tous les revêtements. Toucher une surface la sélectionne (dans l'adresse) ; le
   * panneau la revêt (nouvelle pose ou suite d'une pose voisine), découpe un sol par une ligne, règle la hauteur
   * d'une zone de mur, change le revêtement d'une zone, la retire, ouvre son calepinage.
   */
  import { sameSurface, zoneBox, type Pose, type SurfaceRef, type Zone } from '../../core/coverage';
  import HelpTip from '../components/HelpTip.svelte';
  import type { Point } from '../../core/geometry/types';
  import { snapPoint } from '../../core/plan/snap';
  import { wallHeightOf } from '../../core/plan/levels';
  import { wallIndex, wallLength } from '../../core/plan/walls';
  import { moduleById } from '../../modules/registry';
  import type { ToolModule } from '../../modules/types';
  import { reduceProject, type ProjectAction } from '../../state/project';
  import Button from '../components/Button.svelte';
  import Dialog from '../components/Dialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Screen from '../components/Screen.svelte';
  import { app } from '../lib/app.svelte';
  import { coverageText } from '../lib/coverageMessages';
  import { cm } from '../lib/format';
  import { go } from '../lib/router.svelte';
  import { toast } from '../lib/toasts.svelte';
  import { poseColor } from '../room/colors';
  import {
    continuable,
    continueAction,
    contourAction,
    cutAction,
    modulesFor,
    freeWallSpans,
    newPoseAction,
    newPoseOnSpan,
    removeZoneAction,
    areaAction,
    switchAction,
    zonesOn,
  } from '../room/cover';
  import RoomDrawing from '../room/RoomDrawing.svelte';

  let { id, roomId, surface }: { id: string; roomId: string; surface?: string } = $props();

  const newId = () => crypto.randomUUID();
  const project = $derived(app.project(id));
  const room = $derived(project?.plan.rooms.find((r) => r.id === roomId));
  /** Surface sélectionnée : 'sol' ou identifiant d'un mur de la pièce. */
  const selected = $derived.by((): SurfaceRef | null => {
    if (!room || !surface) return null;
    if (surface === 'sol') return { room: room.id, wall: null };
    return room.walls.some((w) => w.id === surface) ? { room: room.id, wall: surface } : null;
  });
  const surfaces = $derived(
    room
      ? [
          { ref: { room: room.id, wall: null } as SurfaceRef, name: 'Sol', detail: '' },
          ...room.walls.map((w, i) => ({
            ref: { room: room.id, wall: w.id } as SurfaceRef,
            name: `Mur ${i + 1}`,
            detail: cm(wallLength(room, i)),
          })),
        ]
      : [],
  );
  const nameOf = (s: SurfaceRef) => surfaces.find((x) => sameSurface(x.ref, s))?.name ?? '';
  const pose = (pid: string): Pose | undefined => project?.poses.find((p) => p.id === pid);
  const poseIndex = (pid: string) => project?.poses.findIndex((p) => p.id === pid) ?? 0;
  /** « Carrelage · Salle de bain, sol » : l'outil est toujours dit devant le nom de la pose. */
  const poseLabel = (pid: string) => {
    const p = pose(pid);
    return p ? `${moduleOf(pid)?.label ?? p.module} · ${p.name}` : '';
  };
  const moduleOf = (pid: string): ToolModule | undefined => moduleById(pose(pid)?.module ?? '');
  const zones = $derived(project && selected ? zonesOn(project, selected) : []);

  function select(s: SurfaceRef) {
    cutting = null;
    go({ name: 'room', id, room: roomId, surface: s.wall ?? 'sol' }, true);
  }

  /** Applique une action ; `undo` : message avec « Annuler » (retour à l'état d'avant, s'il n'a pas changé). */
  async function dispatch(a: ProjectAction, undo?: string): Promise<boolean> {
    const before = project;
    if (!before) return false;
    const next = reduceProject(before, a);
    if (next === before) return false;
    const after = { ...next, updatedAt: Date.now() };
    if (!(await app.trySaveProject(after))) return false;
    if (undo) toast(undo, { action: { label: 'Annuler', run: () => void app.restoreIfUnchanged(after, before) } });
    return true;
  }

  /* ---------- revêtir ---------- */

  /** Surface à revêtir qui peut continuer une pose voisine : choix « Continuer » ou « Nouvelle pose ». */
  let choosing = $state.raw<{ ref: SurfaceRef; module: ToolModule; poses: Pose[] } | null>(null);

  function cover(ref: SurfaceRef, m: ToolModule) {
    if (!project) return;
    const poses = continuable(project, ref, m);
    if (poses.length) choosing = { ref, module: m, poses };
    else newPose(ref, m);
  }

  function newPose(ref: SurfaceRef, m: ToolModule) {
    choosing = null;
    if (!project) return;
    const r = newPoseAction(project, app.libraries, m, ref, newId);
    if ('error' in r) toast(coverageText(r.error), { tone: 'error' });
    else void dispatch(r.action);
  }

  /** Revêt la partie libre d'un mur (au-dessus d'une crédence…) par une nouvelle pose. */
  function coverSpan(ref: SurfaceRef, m: ToolModule, s: [number, number]) {
    if (!project) return;
    const r = newPoseOnSpan(project, app.libraries, m, ref, s, newId);
    if ('error' in r) toast(coverageText(r.error), { tone: 'error' });
    else void dispatch(r.action);
  }

  function continuePose(ref: SurfaceRef, poseId: string) {
    choosing = null;
    if (project) void dispatch(continueAction(project, ref, poseId, newId));
  }

  /* ---------- zones ---------- */

  function remove(z: Zone) {
    if (!project) return;
    void dispatch(
      removeZoneAction(project, app.libraries, z, newId),
      `Zone retirée de « ${pose(z.pose)?.name ?? ''} ».`,
    );
  }

  function switchTo(z: Zone, m: ToolModule) {
    if (!project) return;
    const r = switchAction(project, app.libraries, z, m, newId);
    if ('error' in r) toast(coverageText(r.error), { tone: 'error' });
    else void dispatch(r.action, `Zone passée en ${m.label.toLowerCase()}.`);
  }

  /** Hauteur d'une zone de mur, cm affichés (repère du mur : y vers le haut). */
  const span = (z: Zone): [number, number] => {
    const b = project ? zoneBox(project.plan, z) : null;
    return b ? [b[2], b[3]] : [0, wallTop(z)];
  };
  /** Hauteur du mur d'une zone, mm : sa hauteur propre, sinon celle de la pièce. */
  const wallTop = (z: Zone) =>
    room && z.surface.wall != null ? wallHeightOf(room, z.surface.wall) : (room?.height ?? 0);
  /** Largeur couverte d'une zone de mur : [bord gauche, bord droit], mm. */
  const widthOf = (z: Zone): [number, number] => {
    const b = project ? zoneBox(project.plan, z) : null;
    return b ? [b[0], b[1]] : [0, wallLen(z)];
  };
  /** Zones dont la dernière saisie de hauteur est refusée (message sous les champs, effacé dès qu'elle est correcte). */
  let spanErrors = $state<Record<string, string>>({});
  /** Saisies de hauteur ou de largeur mises en file : chacune part de l'état enregistré par la précédente. */
  let spanQueue: Promise<void> = Promise.resolve();
  /**
   * Partie du mur couverte par la zone, mm (repère du mur) : `from` / `to` en hauteur depuis le sol, `left` / `right`
   * en largeur depuis le bord gauche. Seule la valeur modifiée est donnée ; le reste vient de la zone enregistrée.
   */
  function setSpan(z: Zone, change: { from?: number; to?: number; left?: number; right?: number }) {
    spanQueue = spanQueue.then(async () => {
      const p = project;
      if (!p || !room || z.surface.wall == null) return;
      const now = p.zones.find((x) => x.id === z.id) ?? z;
      const b = zoneBox(p.plan, now);
      const [left0, right0] = b ? [b[0], b[1]] : [0, wallLen(z)];
      const [from0, to0] = span(now);
      const left = change.left ?? left0,
        right = change.right ?? right0,
        from = change.from ?? from0,
        to = change.to ?? to0;
      if (!(to > from) || !(right > left)) {
        spanErrors[z.id] = !(to > from)
          ? 'Le haut de la zone doit être au-dessus du bas : corrigez l’une des deux hauteurs (rien n’est enregistré tant que c’est incohérent).'
          : 'Le côté droit de la zone doit être à droite du côté gauche : corrigez l’une des deux distances (rien n’est enregistré tant que c’est incohérent).';
        return;
      }
      spanErrors[z.id] = '';
      const length = wallLen(z);
      await dispatch(
        areaAction(p, now, {
          x0: left > 0 ? left : null,
          x1: right < length ? Math.min(right, length) : null,
          y0: from > 0 ? from : null,
          y1: to < wallTop(z) ? Math.min(to, wallTop(z)) : null,
        }),
      );
    });
  }

  /** Longueur du mur d'une zone, mm. */
  const wallLen = (z: Zone) => (room && z.surface.wall != null ? wallLength(room, wallIndex(room, z.surface.wall)) : 0);

  /** Découpe d'une zone de sol : par une ligne (deux points) ou par un contour (points aimantés, refermé). */
  let cutting = $state.raw<{ zone: Zone; mode: 'line' | 'contour'; points: Point[] } | null>(null);
  let drawingEl = $state<HTMLDivElement>();
  /** Aimantation et fermeture du contour, mm : à l'échelle de la pièce. */
  const tolerance = $derived.by(() => {
    if (!room) return 100;
    const xs = room.outline.map((p) => p[0]),
      ys = room.outline.map((p) => p[1]);
    return Math.max(50, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 25);
  });
  /** Début de la découpe : le dessin revient en vue (sur téléphone, le panneau est dessous). */
  function startCut(zone: Zone, mode: 'line' | 'contour' = 'line') {
    cutting = { zone, mode, points: [] };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    drawingEl?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }
  function cutPoint(raw: Point) {
    if (!cutting) return;
    if (cutting.mode === 'contour') return contourPoint(raw);
    const points = [...cutting.points, raw];
    if (points.length < 2) {
      cutting = { ...cutting, points };
      return;
    }
    const zone = cutting.zone;
    cutting = null;
    if (Math.hypot(points[1]![0] - points[0]![0], points[1]![1] - points[0]![1]) < 10) {
      toast('Touchez deux points éloignés.', { tone: 'error' });
      return;
    }
    void dispatch(cutAction(zone, [points[0]!, points[1]!], newId), 'Sol découpé en deux zones.').then(
      (ok) => ok || toast('Cette ligne ne coupe pas la zone en deux.', { tone: 'error' }),
    );
  }

  /** Contour : point aimanté aux angles droits des points voisins et à la grille ; près du premier, il se referme. */
  function contourPoint(raw: Point) {
    if (!cutting) return;
    const pts = cutting.points;
    const first = pts[0];
    if (first && pts.length >= 3 && Math.hypot(raw[0] - first[0], raw[1] - first[1]) <= tolerance) {
      closeContour();
      return;
    }
    const p = snapPoint(
      raw,
      [pts.at(-1), first].filter((q): q is Point => !!q),
      tolerance,
    );
    const last = pts.at(-1);
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    cutting = { ...cutting, points: [...pts, p] };
  }

  function closeContour() {
    if (!cutting || !project) return;
    const { zone, points } = cutting;
    const r = contourAction(project, app.libraries, zone, points, newId);
    if (!r) {
      toast('Ce contour n’est pas valide : au moins 3 points, sans côtés qui se croisent.', { tone: 'error' });
      return;
    }
    cutting = null;
    void dispatch(r.action, 'Contour découpé : l’intérieur est une nouvelle pose.').then(
      (ok) => ok || toast('Ce contour ne découpe pas la zone.', { tone: 'error' }),
    );
  }

  const describe = (z: Zone): string => {
    if (z.surface.wall == null)
      return z.area ? 'contour dessiné' : z.cuts.length || z.holes?.length ? 'partie du sol' : 'tout le sol';
    const [a, b] = span(z);
    return `de ${cm(a)} à ${cm(b)}`;
  };
</script>

{#if !project || !room}
  <Screen title="Pièce introuvable" backHref="#/p/{id}" backLabel="Projet">
    <EmptyState icon="info" title="Cette pièce n’existe plus" text="Elle a peut-être été supprimée du plan.">
      {#snippet action()}<Button variant="primary" href="#/p/{id}">Revenir au projet</Button>{/snippet}
    </EmptyState>
  </Screen>
{:else}
  <Screen title={room.name} backHref="#/p/{id}" backLabel="Projet">
    {#snippet actions()}<Button variant="ghost" href="#/p/{id}/plan">Modifier le plan</Button>{/snippet}
    {#if project.zones.some((z) => z.surface.room === room.id)}
      <div class="results">
        <Button icon="list" href="#/p/{id}/r/{room.id}/resultats">Résultats de la pièce (3D, PDF)</Button>
      </div>
    {/if}
    <div class="layout">
      <div class="drawing" bind:this={drawingEl}>
        <RoomDrawing
          {project}
          {room}
          {selected}
          cutting={!!cutting}
          cut={cutting?.points ?? []}
          contour={cutting?.mode === 'contour'}
          onselect={select}
          oncutpoint={cutPoint}
        />
      </div>

      <div class="panel">
        {#if cutting?.mode === 'contour'}
          {@const n = cutting.points.length}
          <section class="card" aria-live="polite">
            <h2>Contour sur le sol</h2>
            <p>
              Touchez chaque coin sur le sol, puis le premier point pour fermer. Les points s’alignent sur les angles
              droits et sur une grille de 1 cm.
            </p>
            <p class="muted">{n} point{n > 1 ? 's' : ''}</p>
            <div class="row">
              <Button variant="primary" disabled={n < 3} onclick={closeContour}>Fermer le contour</Button>
              <Button
                icon="undo"
                disabled={!n}
                onclick={() => cutting && (cutting = { ...cutting, points: cutting.points.slice(0, -1) })}
                >Retirer le dernier point</Button
              >
              <Button variant="ghost" onclick={() => (cutting = null)}>Annuler</Button>
            </div>
          </section>
        {:else if cutting}
          <section class="card" aria-live="polite">
            <h2>Découper le sol</h2>
            <p>Touchez deux points sur le sol : la ligne qui les relie coupe la zone en deux, d’un mur à l’autre.</p>
            <p class="muted">{cutting.points.length} point{cutting.points.length > 1 ? 's' : ''} sur 2</p>
            <Button onclick={() => (cutting = null)}>Annuler la découpe</Button>
          </section>
        {:else if selected}
          {@const kind = selected.wall == null ? 'floor' : 'wall'}
          <section class="card" aria-labelledby="h-surface">
            <h2 id="h-surface">{nameOf(selected)}</h2>
            {#if zones.length}
              <ul class="zones">
                {#each zones as z (z.id)}
                  {@const m = moduleOf(z.pose)}
                  <li style="--pose: {poseColor(poseIndex(z.pose))}">
                    <p class="head">
                      <span class="chip" aria-hidden="true"></span>
                      <strong>{m?.label ?? ''} · {pose(z.pose)?.name ?? ''}</strong>
                      <span class="muted">{describe(z)}</span>
                    </p>
                    {#if kind === 'wall'}
                      {@const [from, to] = span(z)}
                      {@const [left, right] = widthOf(z)}
                      <div class="grid">
                        <NumberField
                          label="Depuis le sol"
                          unit="cm"
                          factor={10}
                          min={0}
                          max={wallTop(z) / 10}
                          value={from}
                          onchange={(v) => setSpan(z, { from: v })}
                        />
                        <NumberField
                          label="Jusqu’à"
                          unit="cm"
                          factor={10}
                          min={1}
                          max={wallTop(z) / 10}
                          value={to}
                          onchange={(v) => setSpan(z, { to: v })}
                        />
                      </div>
                      <div class="grid">
                        <NumberField
                          label="Depuis le bord gauche"
                          unit="cm"
                          factor={10}
                          min={0}
                          max={wallLen(z) / 10}
                          value={left}
                          hint="Vu de l’intérieur de la pièce."
                          onchange={(v) => setSpan(z, { left: v })}
                        />
                        <NumberField
                          label="Jusqu’à (largeur)"
                          unit="cm"
                          factor={10}
                          min={1}
                          max={wallLen(z) / 10}
                          value={right}
                          onchange={(v) => setSpan(z, { right: v })}
                        />
                      </div>
                      {#if spanErrors[z.id]}<p class="span-err" role="alert">{spanErrors[z.id]}</p>{/if}
                    {/if}
                    <div class="row">
                      {#if m}<Button variant="primary" href={m.poseHref?.(id, z.pose)}
                          >{m.poseLabel ?? 'Calepinage'}</Button
                        >{/if}
                      {#if kind === 'floor'}
                        <Button onclick={() => startCut(z)}>Découper par une ligne</Button>
                        <Button onclick={() => startCut(z, 'contour')}>Découper par un contour</Button>
                      {/if}
                      {#each modulesFor(selected).filter((x) => x.id !== m?.id) as other (other.id)}
                        <Button onclick={() => switchTo(z, other)}>Passer en {other.label.toLowerCase()}</Button>
                      {/each}
                      <Button variant="ghost" icon="trash" onclick={() => remove(z)}>Retirer</Button>
                    </div>
                  </li>
                {/each}
              </ul>
              {#each kind === 'wall' && project ? freeWallSpans(project, selected) : [] as s (s[0])}
                <div class="free">
                  <p class="muted">Libre de {cm(s[0])} à {cm(s[1])}</p>
                  <div class="row">
                    {#each modulesFor(selected) as m (m.id)}
                      <Button variant="secondary" icon="plus" onclick={() => coverSpan(selected, m, s)}
                        >Revêtir : {m.label.toLowerCase()}</Button
                      >
                    {/each}
                  </div>
                </div>
              {/each}
            {:else}
              <p class="muted">Sans revêtement.</p>
              <div class="row">
                {#each modulesFor(selected) as m (m.id)}
                  <Button variant="primary" icon="plus" onclick={() => cover(selected, m)}
                    >Revêtir : {m.label.toLowerCase()}</Button
                  >
                {/each}
              </div>
            {/if}
          </section>
        {:else}
          <p class="muted">Touchez le sol ou un mur sur le dessin, ou choisissez-le dans la liste.</p>
        {/if}

        <section aria-labelledby="h-list">
          <h2 id="h-list" class="with-tip">
            Sol et murs <HelpTip id="surface" />
          </h2>
          <ul class="list">
            {#each surfaces as s (s.ref.wall ?? 'sol')}
              {@const zs = zonesOn(project, s.ref)}
              <li>
                <Button
                  block
                  variant={selected && sameSurface(selected, s.ref) ? 'secondary' : 'ghost'}
                  onclick={() => select(s.ref)}
                  >{s.name}{s.detail ? ` (${s.detail})` : ''} :
                  {zs.length ? [...new Set(zs.map((z) => poseLabel(z.pose)))].join(', ') : 'sans revêtement'}</Button
                >
              </li>
            {/each}
          </ul>
        </section>
      </div>
    </div>
  </Screen>
{/if}

{#if choosing}
  {@const c = choosing}
  <Dialog open title="{c.module.label} : {nameOf(c.ref).toLowerCase()}" onclose={() => (choosing = null)}>
    <p class="muted">
      Continuer une pose voisine garde le même calepinage : joints alignés, coupes à l’angle ou au passage.
    </p>
    <div class="choices">
      {#each c.poses as p (p.id)}
        <Button variant="primary" onclick={() => continuePose(c.ref, p.id)}>Continuer « {p.name} »</Button>
      {/each}
      <Button onclick={() => newPose(c.ref, c.module)}>Nouvelle pose</Button>
    </div>
  </Dialog>
{/if}

<style>
  .with-tip {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .results {
    margin-bottom: var(--space-3);
  }
  .layout {
    display: grid;
    gap: var(--space-4);
  }
  @media (min-width: 1024px) {
    .layout {
      grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
      align-items: start;
    }
  }
  .drawing {
    height: min(60vh, 560px);
    border: 1px solid var(--line);
    border-radius: var(--r-card, 12px);
    background: var(--paper);
  }
  .panel {
    display: grid;
    gap: var(--space-4);
  }
  .card {
    display: grid;
    gap: var(--space-3);
  }
  h2 {
    margin: 0;
    font-size: var(--fs-md);
  }
  ul {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .zones li {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--line);
    border-left: 6px solid var(--pose);
    border-radius: 8px;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
  }
  .chip {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    background: var(--pose);
    border: 1px solid var(--ink);
  }
  .span-err {
    margin: var(--space-1) 0 0;
    color: var(--color-error);
    font-size: var(--fs-sm);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: var(--space-3);
  }
  .free {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding: var(--space-3);
    border: 1px dashed var(--line);
    border-radius: 8px;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .list {
    gap: var(--space-1);
  }
  .muted {
    margin: 0;
    color: var(--muted);
  }
  .choices {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
</style>
