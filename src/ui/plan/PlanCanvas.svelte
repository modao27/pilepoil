<script lang="ts">
  /**
   * Plan des pièces en SVG (repère écran). Gestes : glisser le fond pour se déplacer, pincer ou molette pour
   * zoomer, toucher pour sélectionner ; glisser une pièce, un point, une ouverture le long de son mur ou un
   * obstacle pour le déplacer (aimantation grille 10 mm et angles droits). Clavier : Échap, Suppr.
   */
  import { onMount } from 'svelte';
  import type { Point } from '../../core/geometry/types';
  import { area } from '../../core/geometry/polygon';
  import { labelPoint, planBounds, snapPartitionPoint, snapPoint, GRID } from '../../core/plan/snap';
  import { absWallBands, demolitionBand, partitionBand } from '../../core/plan/works';
  import { lostByPose } from '../../core/coverage';
  import type { Project } from '../../state/model';
  import { toast } from '../lib/toasts.svelte';
  import type { Demolition, Id, Partition, PlanRoom } from '../../core/plan/types';
  import { openingCenter, wallBands, wallDirection, wallIndex, wallLength, wallSegment } from '../../core/plan/walls';
  import { fitView, panBy, toWorld, zoomAt, type View } from '../../render/view';
  import { formatNumber } from '../lib/calc';
  import type { PlanEditorState } from './planState.svelte';

  let { st, label }: { st: PlanEditorState; label: string } = $props();

  let svg: SVGSVGElement;
  let size = $state({ w: 360, h: 480 });
  let userView = $state.raw<View | null>(null);
  /** Position du pointeur (dessin libre : segment provisoire). */
  let hover = $state.raw<Point | null>(null);

  /** Marges du cadrage, px : place des cotes autour des murs. */
  const MARGIN = { left: 96, top: 64, right: 96, bottom: 64 };
  /** Vue qui montre tout le plan (ou 8 × 6 m s'il est vide). */
  const base = $derived.by<View>(() => {
    const b = planBounds(st.plan);
    if (!b) return fitView(8000, 6000, size.w, size.h, MARGIN);
    const pad = 200;
    const v = fitView(b[1] - b[0] + 2 * pad, b[3] - b[2] + 2 * pad, size.w, size.h, MARGIN);
    return { ...v, ox: v.ox - (b[0] - pad) * v.sc, oy: v.oy - (b[2] - pad) * v.sc };
  });
  const view = $derived(userView ?? base);
  const S = (x: number, y: number): Point => [view.ox + x * view.sc, view.oy + y * view.sc];
  const pts = (r: PlanRoom, poly: Point[]) =>
    poly.map(([x, y]) => S(r.origin[0] + x, r.origin[1] + y).join(',')).join(' ');

  export function fit(): void {
    userView = null;
  }

  /* ---------- gestes ---------- */

  type Drag =
    | { kind: 'pan' }
    | { kind: 'room'; room: Id; start: Point; origin: Point }
    | { kind: 'point'; room: Id; index: number }
    | { kind: 'obstacle'; room: Id; id: Id; start: Point; outline: Point[] }
    | { kind: 'opening'; room: Id; id: Id }
    | { kind: 'pend'; partition: Id; end: 0 | 1; start: Project };

  // pointeurs du geste en cours : interne, volontairement non réactif
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; v: View } | null = null;
  let drag: Drag | null = null;
  let down: { x: number; y: number; target: HTMLElement | null } | null = null;
  let moved = false;
  let gesture = 0;
  /** Vue figée le temps d'un glissement : sinon le cadrage suit le plan et la conversion écran → plan bouge. */
  let frozen = false;

  const local = (e: PointerEvent): Point => {
    const r = svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const world = (e: PointerEvent): Point => toWorld(view, ...local(e));
  /** Tolérance d'aimantation : 12 px à l'écran, en mm. */
  const tol = () => 12 / view.sc;

  function data(t: Element | null) {
    const el = t?.closest<SVGElement>('[data-k]');
    return el
      ? { k: el.dataset.k!, room: el.dataset.room ?? '', id: el.dataset.id ?? '', i: Number(el.dataset.i) }
      : null;
  }

  function onpointerdown(e: PointerEvent) {
    svg.setPointerCapture(e.pointerId);
    const [x, y] = local(e);
    pointers.set(e.pointerId, { x, y });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), v: view };
      frozen = false;
      drag = null;
      return;
    }
    if (pointers.size > 2) return;
    down = { x, y, target: e.target as HTMLElement };
    moved = false;
    gesture++;
    const d = data(e.target as Element);
    drag = { kind: 'pan' };
    if (st.layer === 'works') {
      // calque travaux : les pièces ne se modifient pas ; on glisse seulement les bouts d'une cloison choisie
      if (st.mode === 'select' && d?.k === 'pend')
        drag = { kind: 'pend', partition: d.id, end: d.i === 1 ? 1 : 0, start: st.doc };
      return;
    }
    if (st.mode !== 'select' || !d) return;
    const r = st.room(d.room);
    if (!r) return;
    if (d.k === 'point') drag = { kind: 'point', room: r.id, index: d.i };
    else if (d.k === 'room' && st.sel?.kind === 'room' && st.sel.room === r.id)
      drag = { kind: 'room', room: r.id, start: world(e), origin: r.origin };
    else if (d.k === 'obstacle') {
      const o = r.obstacles.find((x) => x.id === d.id);
      if (o) drag = { kind: 'obstacle', room: r.id, id: o.id, start: world(e), outline: o.outline };
    } else if (d.k === 'opening') drag = { kind: 'opening', room: r.id, id: d.id };
    else drag = null;
  }

  function onpointermove(e: PointerEvent) {
    if (st.mode === 'draw') hover = snapDraw(world(e));
    else if (st.mode === 'partition') hover = snapWorks(world(e));
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = local(e);
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x, y });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      userView = zoomAt(pinch.v, d / pinch.d, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2, base.sc);
      return;
    }
    if (!down) return;
    if (!moved && Math.hypot(x - down.x, y - down.y) < 6) return;
    if (!moved) {
      moved = true;
      if (drag && drag.kind !== 'pan' && !userView) {
        userView = view;
        frozen = true;
      }
      // une pièce, un obstacle ou une ouverture qu'on commence à glisser devient la sélection
      if (drag && drag.kind !== 'pan' && drag.kind !== 'point' && drag.kind !== 'pend') select(data(down.target));
    }
    const w = world(e);
    const key = `drag:${gesture}`;
    switch (drag?.kind) {
      case 'pan':
        userView = panBy(view, x - prev.x, y - prev.y);
        return;
      case 'point': {
        const r = st.room(drag.room);
        if (!r) return;
        const n = r.outline.length;
        const p: Point = [w[0] - r.origin[0], w[1] - r.origin[1]];
        const neighbors = [r.outline[(drag.index - 1 + n) % n]!, r.outline[(drag.index + 1) % n]!];
        st.dispatch(
          { type: 'plan/point/move', roomId: r.id, index: drag.index, point: snapPoint(p, neighbors, tol()) },
          key,
        );
        st.sel = { kind: 'point', room: r.id, index: drag.index };
        return;
      }
      case 'room': {
        const o: Point = [
          Math.round((drag.origin[0] + w[0] - drag.start[0]) / GRID) * GRID,
          Math.round((drag.origin[1] + w[1] - drag.start[1]) / GRID) * GRID,
        ];
        st.dispatch({ type: 'plan/room/update', roomId: drag.room, patch: { origin: o } }, key);
        return;
      }
      case 'obstacle': {
        const dx = Math.round((w[0] - drag.start[0]) / GRID) * GRID,
          dy = Math.round((w[1] - drag.start[1]) / GRID) * GRID;
        const outline = drag.outline.map(([px, py]): Point => [px + dx, py + dy]);
        st.dispatch({ type: 'plan/obstacle/update', roomId: drag.room, obstacleId: drag.id, patch: { outline } }, key);
        return;
      }
      case 'pend': {
        const q = st.partition(drag.partition);
        if (!q) return;
        const other = drag.end === 0 ? q.b : q.a;
        const pt = snapWorks(w, other);
        // pendant le geste, pas de confirmation : la perte éventuelle est annoncée au relâchement
        st.dispatch(
          { type: 'plan/partition/update', partitionId: q.id, patch: drag.end === 0 ? { a: pt } : { b: pt } },
          key,
        );
        return;
      }
      case 'opening': {
        const r = st.room(drag.room);
        const id = drag.id;
        const o = r?.openings.find((x) => x.id === id);
        if (!r || !o) return;
        const i = wallIndex(r, o.wall);
        const [a] = wallSegment(r, i);
        const u = wallDirection(r, i);
        const t = (w[0] - r.origin[0] - a[0]) * u[0] + (w[1] - r.origin[1] - a[1]) * u[1] - o.width / 2;
        const max = Math.max(0, wallLength(r, i) - o.width);
        const offset = Math.round(Math.min(max, Math.max(0, t)) / GRID) * GRID;
        st.dispatch({ type: 'plan/opening/update', roomId: r.id, openingId: o.id, patch: { offset } }, key);
        return;
      }
    }
  }

  function onpointerup(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const was = down;
    down = null;
    if (frozen && !pointers.size) {
      // fin du glissement : le cadrage automatique reprend
      userView = null;
      frozen = false;
    }
    if (drag?.kind === 'pend' && moved) {
      const from = drag.start,
        now = st.doc;
      for (const l of lostByPose(from.plan, now.plan, from.zones, from.poses))
        toast(
          `${l.pose.name} perd ${formatNumber(l.area / 1e6, 2)} m² de revêtement : remettez la cloison en place ou annulez.`,
        );
    }
    if (!was || moved || pointers.size) {
      drag = null;
      return;
    }
    drag = null;
    tap(data(was.target), world(e));
  }

  function tap(d: ReturnType<typeof data>, w: Point) {
    if (st.mode === 'draw') {
      st.drawPoint(snapDraw(w), 16 / view.sc);
      return;
    }
    if (st.mode === 'link') {
      if (d?.k === 'opening') st.link({ room: d.room, opening: d.id });
      else st.cancelLink();
      return;
    }
    if (st.mode === 'partition') {
      st.partitionPoint(snapWorks(w, st.partitionFrom));
      return;
    }
    if (st.mode === 'demolish') {
      if (d?.k === 'xwall') st.demolishWall(d.room, d.id);
      return;
    }
    if (st.layer === 'works') {
      if (d?.k === 'partition') st.select({ kind: 'partition', partition: d.id });
      else if (d?.k === 'demolition') st.select({ kind: 'demolition', demolition: d.id });
      else st.select(null);
      return;
    }
    if (d?.k === 'mid') st.splitWall(d.room, d.id);
    else select(d);
  }

  function select(d: ReturnType<typeof data>) {
    if (!d) return st.select(null);
    switch (d.k) {
      case 'room':
        return st.select({ kind: 'room', room: d.room });
      case 'wall':
      case 'dim':
        return st.select({ kind: 'wall', room: d.room, wall: d.id });
      case 'point':
        return st.select({ kind: 'point', room: d.room, index: d.i });
      case 'opening':
        return st.select({ kind: 'opening', room: d.room, opening: d.id });
      case 'obstacle':
        return st.select({ kind: 'obstacle', room: d.room, obstacle: d.id });
      case 'passage':
        return st.select({ kind: 'passage', passage: d.id });
    }
  }

  /** Dessin libre : grille, et angle droit avec le dernier point et le premier. */
  function snapDraw(w: Point): Point {
    const d = st.draft;
    return snapPoint(
      w,
      [d.at(-1), d[0]].filter((p): p is Point => !!p),
      tol(),
    );
  }

  /** Cloison en cours de tracé : angle droit, arêtes et faces des pièces, grille. */
  function snapWorks(w: Point, start: Point | null = st.partitionFrom): Point {
    return snapPartitionPoint(w, start, st.plan, tol());
  }

  function zoomBy(k: number) {
    userView = zoomAt(view, k, size.w / 2, size.h / 2, base.sc);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(0.8);
    else if (e.key === '0') fit();
    else if (e.key === 'Escape') {
      if (st.mode === 'partition' || st.mode === 'demolish') st.cancelTool();
      else if (st.mode === 'draw') st.cancelDraw();
      else if (st.mode === 'link') st.cancelLink();
      else st.select(null);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) {
      const s = st.sel;
      if (s.kind === 'room') st.askRemoveRoom(s.room);
      else if (s.kind === 'opening') st.removeOpening(s.room, s.opening);
      else if (s.kind === 'point') st.removePoint(s.room, s.index);
      else if (s.kind === 'obstacle')
        st.dispatch({ type: 'plan/obstacle/remove', roomId: s.room, obstacleId: s.obstacle });
      else if (s.kind === 'passage') st.dispatch({ type: 'plan/passage/remove', passageId: s.passage });
      else if (s.kind === 'partition') st.removePartition(s.partition);
      else if (s.kind === 'demolition') st.removeDemolition(s.demolition);
      else return;
    } else return;
    e.preventDefault();
  }

  onMount(() => {
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      size = { w: Math.max(100, r.width), h: Math.max(100, r.height) };
    });
    ro.observe(svg);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      userView = zoomAt(view, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, base.sc);
    };
    svg.addEventListener('wheel', wheel, { passive: false });
    return () => {
      ro.disconnect();
      svg.removeEventListener('wheel', wheel);
    };
  });

  /* ---------- dessin ---------- */

  const sel = $derived(st.sel);
  const isSel = (k: string, room: Id, id?: Id | number) =>
    !!sel &&
    sel.kind === k &&
    'room' in sel &&
    sel.room === room &&
    (id == null ||
      ('wall' in sel && sel.wall === id) ||
      ('opening' in sel && sel.opening === id) ||
      ('obstacle' in sel && sel.obstacle === id) ||
      ('index' in sel && sel.index === id));
  const activeRoom = $derived(st.selectedRoom?.id);
  const cm = (mm: number) => formatNumber(mm / 10, 1);
  /** Polygone du plan d'ensemble en points d'écran. */
  const ap = (poly: Point[]) => poly.map(([x, y]) => S(x, y).join(',')).join(' ');
  const selPartition = $derived(sel?.kind === 'partition' ? sel.partition : null);
  const selDemolition = $derived(sel?.kind === 'demolition' ? sel.demolition : null);
  const works = $derived(st.layer === 'works');
  const badPartitions = $derived(
    st.doc.site.partitions.filter((q) => st.issues.some((i) => i.id === q.id && i.severity === 'error')),
  );
  /** Bande d'une démolition (repère du plan) ; null si son mur n'existe plus. */
  function demoBand(d: Demolition): Point[] | null {
    const r = st.doc.site.existing.rooms.find((x) => x.id === d.room);
    const i = r ? wallIndex(r, d.wall) : -1;
    return r && i >= 0 ? demolitionBand(r, i, d.from, d.to, 0) : null;
  }
  /** Cloison provisoire pendant le tracé. */
  const preview = $derived.by<Partition | null>(() =>
    st.mode === 'partition' && st.partitionFrom && hover
      ? { id: 'preview', a: st.partitionFrom, b: hover, thickness: 72, align: 'right', openings: [] }
      : null,
  );
  /**
   * Cotes des murs de la pièce choisie, en px : hors du mur, sans toucher le « + » du milieu (décalage selon
   * l'orientation du mur) ; une cote qui en chevauche une autre s'écarte du mur (petits murs d'un angle).
   */
  const dims = $derived.by(() => {
    const r = st.selectedRoom;
    if (!r || st.mode !== 'select' || st.layer !== 'existing') return [];
    const out: { wall: Id; x: number; y: number; text: string }[] = [];
    r.outline.forEach((_, i) => {
      const [a, b] = wallSegment(r, i);
      const u = wallDirection(r, i);
      const n: Point = [u[1], -u[0]];
      const px = r.walls[i]!.thickness * view.sc + 16 + Math.abs(u[1]) * 30 + Math.abs(u[0]) * 13;
      let [x, y] = S(r.origin[0] + (a[0] + b[0]) / 2, r.origin[1] + (a[1] + b[1]) / 2);
      x += n[0] * px;
      y += n[1] * px;
      for (let k = 0; k < 10 && out.some((q) => Math.abs(q.x - x) < 64 && Math.abs(q.y - y) < 30); k++) {
        x += n[0] * 12;
        y += n[1] * 12;
      }
      out.push({ wall: r.walls[i]!.id, x, y, text: cm(wallLength(r, i)) });
    });
    return out;
  });
  /** Grille de 1 m, seulement si elle reste lisible. */
  const gridStep = $derived(1000 * view.sc);
</script>

<!-- role="application" : widget à manipulation directe avec son propre clavier (Échap, Suppr), focalisable.
     Tout reste faisable sans pointeur depuis le panneau (liste des pièces, cotes des murs, ajouts). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={svg}
  class="plan"
  class:draw={st.mode === 'draw'}
  class:link={st.mode === 'link'}
  class:tool={st.mode === 'partition' || st.mode === 'demolish'}
  role="application"
  aria-label={label}
  tabindex="0"
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  onpointercancel={onpointerup}
  onpointerleave={() => (hover = null)}
  {onkeydown}
>
  {#if gridStep > 12}
    <defs>
      <pattern
        id="plan-grid"
        width={gridStep}
        height={gridStep}
        patternUnits="userSpaceOnUse"
        x={view.ox % gridStep}
        y={view.oy % gridStep}
      >
        <path d="M {gridStep} 0 L 0 0 0 {gridStep}" class="gridline" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#plan-grid)" />
  {/if}

  {#each st.plan.rooms as r (r.id)}
    {@const active = activeRoom === r.id}
    {@const c = labelPoint(r.outline)}
    <g class="room" class:active>
      <polygon class="floor" points={pts(r, r.outline)} data-k="room" data-room={r.id} />
      {#each wallBands(r) as band, i (r.walls[i]!.id)}
        {@const w = r.walls[i]!}
        <polygon
          class="wall"
          class:locked={!!w.locked}
          class:partition={!!w.of}
          class:sel={w.of ? selPartition === w.of.partition : isSel('wall', r.id, w.id)}
          points={pts(r, band)}
          data-k={w.of ? 'partition' : 'wall'}
          data-room={r.id}
          data-id={w.of ? w.of.partition : w.id}
        />
      {/each}
      {#each r.obstacles as o (o.id)}
        <polygon
          class="obstacle"
          class:sel={isSel('obstacle', r.id, o.id)}
          points={pts(r, o.outline)}
          data-k="obstacle"
          data-room={r.id}
          data-id={o.id}
        />
      {/each}
      {#each r.openings as o (o.id)}
        {@const i = wallIndex(r, o.wall)}
        {#if i >= 0}
          {@const [a] = wallSegment(r, i)}
          {@const u = wallDirection(r, i)}
          {@const t = r.walls[i]!.thickness}
          {@const n = [u[1], -u[0]]}
          {@const p0 = [a[0] + u[0] * o.offset, a[1] + u[1] * o.offset] as Point}
          {@const p1 = [p0[0] + u[0] * o.width, p0[1] + u[1] * o.width] as Point}
          {@const q1 = [p1[0] + n[0]! * t, p1[1] + n[1]! * t] as Point}
          {@const q0 = [p0[0] + n[0]! * t, p0[1] + n[1]! * t] as Point}
          {@const linkable = st.mode === 'link' && o.kind !== 'window' && r.id !== st.linkFrom?.room}
          <g
            class="opening {o.kind}"
            class:sel={isSel('opening', r.id, o.id)}
            class:linkable
            data-k="opening"
            data-room={r.id}
            data-id={o.id}
          >
            <polygon points={pts(r, [p0, p1, q1, q0])} />
            {#if o.kind === 'door'}
              {@const tip = [p0[0] - n[0]! * o.width, p0[1] - n[1]! * o.width] as Point}
              <!-- battant : quart de cercle vers l'intérieur -->
              <path
                class="swing"
                d="M {pts(r, [p1])} A {o.width * view.sc} {o.width * view.sc} 0 0 0 {pts(r, [tip])} L {pts(r, [p0])}"
              />
            {/if}
          </g>
        {/if}
      {/each}
      <text
        class="name"
        x={S(r.origin[0] + c[0], r.origin[1] + c[1])[0]}
        y={S(r.origin[0] + c[0], r.origin[1] + c[1])[1]}
        >{r.name}<tspan class="area" x={S(r.origin[0] + c[0], 0)[0]} dy="1.3em"
          >{formatNumber(area(r.outline) / 1e6, 2)} m²</tspan
        ></text
      >

      {#each r.walls as w, i (w.id)}
        {#if w.locked && wallLength(r, i) * view.sc > 40}
          {@const [a, b] = wallSegment(r, i)}
          {@const u = wallDirection(r, i)}
          {@const lp = S(
            r.origin[0] + (a[0] + b[0]) / 2 + u[1] * (w.thickness / 2),
            r.origin[1] + (a[1] + b[1]) / 2 - u[0] * (w.thickness / 2),
          )}
          <!-- cadenas : mur extérieur ou porteur, qu'on ne démolit pas -->
          <g class="lock" transform="translate({lp[0]} {lp[1]})">
            <title>{w.locked === 'exterior' ? 'Mur extérieur' : 'Mur porteur'}</title>
            <rect x="-6" y="-1" width="12" height="9" rx="2" />
            <path d="M -3.5 -1 v -3 a 3.5 3.5 0 0 1 7 0 v 3" />
          </g>
        {/if}
      {/each}

      {#if active && st.mode === 'select' && !works}
        {#each r.outline as _, i (i)}
          {@const [a, b] = wallSegment(r, i)}
          {@const wall = r.walls[i]!}
          {@const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point}
          {@const mp = S(r.origin[0] + m[0], r.origin[1] + m[1])}
          {#if wallLength(r, i) * view.sc > 80}
            <g class="mid" data-k="mid" data-room={r.id} data-id={wall.id}>
              <circle class="hit" cx={mp[0]} cy={mp[1]} r="22" />
              <circle cx={mp[0]} cy={mp[1]} r="9" />
              <path d="M {mp[0] - 4} {mp[1]} h 8 M {mp[0]} {mp[1] - 4} v 8" />
            </g>
          {/if}
        {/each}
        {#each dims as d (d.wall)}
          <!-- cote du mur (toucher : choisir le mur) -->
          <g class="dim" class:sel={isSel('wall', r.id, d.wall)} data-k="dim" data-room={r.id} data-id={d.wall}>
            <rect x={d.x - 30} y={d.y - 13} width="60" height="26" rx="6" />
            <text x={d.x} y={d.y}>{d.text}</text>
          </g>
        {/each}
        {#each r.outline as p, i (i)}
          {@const sp = S(r.origin[0] + p[0], r.origin[1] + p[1])}
          <g class="point" class:sel={isSel('point', r.id, i)} data-k="point" data-room={r.id} data-i={i}>
            <circle class="hit" cx={sp[0]} cy={sp[1]} r="22" />
            <circle cx={sp[0]} cy={sp[1]} r="8" />
          </g>
        {/each}
      {/if}
    </g>
  {/each}

  {#if works}
    <!-- démolitions : bande du mur démoli, hachurée -->
    {#each st.doc.site.demolitions as d (d.id)}
      {@const band = demoBand(d)}
      {#if band}
        <polygon
          class="demolition"
          class:sel={selDemolition === d.id}
          class:bad={st.issues.some((i) => i.id === d.id && i.severity === 'error')}
          points={ap(band)}
          data-k="demolition"
          data-id={d.id}
        />
      {/if}
    {/each}
    <!-- cloisons refusées : tracées en rouge pour pouvoir les corriger ou les supprimer -->
    {#each badPartitions as q (q.id)}
      <polygon
        class="badpart"
        class:sel={selPartition === q.id}
        points={ap(partitionBand(q))}
        data-k="partition"
        data-id={q.id}
      />
    {/each}
    {#if selPartition}
      {@const q = st.partition(selPartition)}
      {#if q}
        {@const mid = S((q.a[0] + q.b[0]) / 2, (q.a[1] + q.b[1]) / 2)}
        <g class="dim sel" pointer-events="none">
          <rect x={mid[0] - 30} y={mid[1] - 13} width="60" height="26" rx="6" />
          <text x={mid[0]} y={mid[1]}>{cm(Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]))}</text>
        </g>
        {#each [q.a, q.b] as p, k (k)}
          {@const sp = S(p[0], p[1])}
          <g class="point" class:sel={true} data-k="pend" data-id={q.id} data-i={k}>
            <circle class="hit" cx={sp[0]} cy={sp[1]} r="22" />
            <circle cx={sp[0]} cy={sp[1]} r="8" />
          </g>
        {/each}
      {/if}
    {/if}
    {#if st.mode === 'demolish'}
      <!-- murs de l'état existant, à toucher pour les démolir ; les murs verrouillés sont refusés -->
      {#each st.doc.site.existing.rooms as r (r.id)}
        {#each absWallBands(r) as band, i (r.walls[i]!.id)}
          <polygon
            class="xwall"
            class:locked={!!r.walls[i]!.locked}
            points={ap(band)}
            data-k="xwall"
            data-room={r.id}
            data-id={r.walls[i]!.id}
          />
        {/each}
      {/each}
    {/if}
    {#if st.mode === 'partition'}
      {#if preview}
        <polygon class="preview" points={ap(partitionBand(preview))} />
        <line
          class="draft"
          x1={S(...preview.a)[0]}
          y1={S(...preview.a)[1]}
          x2={S(...preview.b)[0]}
          y2={S(...preview.b)[1]}
        />
      {/if}
      {#if st.partitionFrom}<circle
          class="draftpt"
          cx={S(...st.partitionFrom)[0]}
          cy={S(...st.partitionFrom)[1]}
          r="6"
        />{/if}
      {#if hover}<circle class="cursor" cx={S(...hover)[0]} cy={S(...hover)[1]} r="5" />{/if}
    {/if}
  {/if}

  <!-- passages par-dessus les murs : bande largeur de porte × épaisseur du mur -->
  {#each st.plan.passages as p (p.id)}
    {@const ra = st.room(p.a.room)}
    {@const rb = st.room(p.b.room)}
    {@const oa = ra?.openings.find((o) => o.id === p.a.opening)}
    {@const ob = rb?.openings.find((o) => o.id === p.b.opening)}
    {#if ra && rb && oa && ob}
      {@const ca = openingCenter(ra, oa)!}
      {@const cb = openingCenter(rb, ob)!}
      <line
        class="passage"
        class:sel={sel?.kind === 'passage' && sel.passage === p.id}
        x1={S(...ca)[0]}
        y1={S(...ca)[1]}
        x2={S(...cb)[0]}
        y2={S(...cb)[1]}
        stroke-width={Math.max(6, oa.width * view.sc)}
        data-k="passage"
        data-id={p.id}
      />
    {/if}
  {/each}

  {#if st.mode === 'draw'}
    {@const d = st.draft}
    {#if d.length}
      <polyline class="draft" points={[...d, ...(hover ? [hover] : [])].map((p) => S(...p).join(',')).join(' ')} />
      {#each d as p, i (i)}
        <circle
          class="draftpt"
          class:first={i === 0 && d.length >= 3}
          cx={S(...p)[0]}
          cy={S(...p)[1]}
          r={i === 0 && d.length >= 3 ? 12 : 6}
        />
      {/each}
    {/if}
    {#if hover}<circle class="cursor" cx={S(...hover)[0]} cy={S(...hover)[1]} r="5" />{/if}
  {/if}
</svg>

<style>
  .plan {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
    background: var(--sheet);
    cursor: grab;
  }
  .plan:focus-visible {
    outline: 3px solid var(--color-focus);
    outline-offset: -3px;
  }
  .plan.draw,
  .plan.tool {
    cursor: crosshair;
  }
  .gridline {
    fill: none;
    stroke: var(--line);
    stroke-width: 1;
  }
  .floor {
    fill: color-mix(in srgb, var(--paper) 60%, var(--sheet));
    stroke: none;
    cursor: pointer;
  }
  .room.active .floor {
    fill: color-mix(in srgb, var(--accent) 10%, var(--sheet));
    cursor: move;
  }
  .wall {
    fill: var(--muted);
    stroke: var(--ink);
    stroke-width: 1;
    cursor: pointer;
  }
  .wall.sel {
    fill: var(--accent);
  }
  /* mur verrouillé : plus sombre, on ne le démolit pas */
  .wall.locked {
    fill: color-mix(in srgb, var(--ink) 55%, var(--muted));
  }
  /* face d'une cloison neuve */
  .wall.partition {
    fill: color-mix(in srgb, var(--accent) 45%, var(--sheet));
  }
  .wall.partition.sel {
    fill: var(--accent);
  }
  .lock rect {
    fill: var(--sheet);
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .lock path {
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .lock {
    pointer-events: none;
  }
  .demolition {
    fill: color-mix(in srgb, var(--thin) 22%, transparent);
    stroke: var(--thin);
    stroke-width: 2;
    stroke-dasharray: 6 4;
    cursor: pointer;
  }
  .demolition.sel {
    stroke-width: 4;
  }
  .demolition.bad,
  .badpart {
    fill: color-mix(in srgb, var(--thin) 35%, transparent);
    stroke: var(--thin);
    stroke-dasharray: 3 3;
  }
  .badpart {
    cursor: pointer;
    stroke-width: 2;
  }
  .badpart.sel {
    stroke-width: 4;
  }
  .xwall {
    fill: transparent;
    stroke: var(--accent);
    stroke-width: 2;
    cursor: pointer;
  }
  .xwall:hover {
    fill: color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .xwall.locked {
    stroke: var(--muted);
    stroke-dasharray: 4 3;
    cursor: not-allowed;
  }
  .preview {
    fill: color-mix(in srgb, var(--accent) 30%, transparent);
    stroke: var(--accent);
    stroke-width: 1.5;
    pointer-events: none;
  }
  .obstacle {
    fill: var(--line);
    stroke: var(--ink);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    cursor: move;
  }
  .obstacle.sel {
    stroke: var(--accent);
    stroke-width: 3;
  }
  .opening {
    cursor: pointer;
  }
  .opening polygon {
    fill: var(--sheet);
    stroke: var(--ink);
    stroke-width: 1.5;
  }
  .opening.window polygon {
    fill: color-mix(in srgb, var(--accent) 25%, var(--sheet));
  }
  .opening .swing {
    fill: none;
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .opening.sel polygon {
    stroke: var(--accent);
    stroke-width: 3;
  }
  .opening.linkable polygon {
    stroke: var(--accent);
    stroke-width: 3;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .passage {
    stroke: var(--reuse);
    stroke-opacity: 0.85;
    stroke-linecap: butt;
    cursor: pointer;
  }
  .passage.sel {
    stroke: var(--accent);
    stroke-opacity: 1;
  }
  .name {
    /* liseré couleur papier : lisible par-dessus un poteau ou une cote */
    paint-order: stroke;
    stroke: var(--sheet);
    stroke-width: 4px;
    stroke-linejoin: round;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    fill: var(--ink);
    text-anchor: middle;
    pointer-events: none;
  }
  .area {
    font-family: var(--font-num);
    font-weight: 500;
    fill: var(--muted);
  }
  .dim {
    cursor: pointer;
  }
  .dim rect {
    fill: var(--sheet);
    stroke: var(--line);
  }
  .dim.sel rect {
    stroke: var(--accent);
    stroke-width: 2;
  }
  .dim text {
    font-family: var(--font-num);
    font-size: 14px;
    fill: var(--ink);
    text-anchor: middle;
    dominant-baseline: central;
  }
  .hit {
    fill: transparent;
    stroke: none;
  }
  .point circle:not(.hit) {
    fill: var(--sheet);
    stroke: var(--accent);
    stroke-width: 2.5;
  }
  .point.sel circle:not(.hit) {
    fill: var(--accent);
  }
  .point,
  .mid {
    cursor: pointer;
  }
  .mid circle:not(.hit) {
    fill: var(--sheet);
    stroke: var(--muted);
    stroke-width: 1.5;
  }
  .mid path {
    stroke: var(--muted);
    stroke-width: 1.5;
  }
  .draft {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }
  .draftpt {
    fill: var(--accent);
  }
  .draftpt.first {
    fill: color-mix(in srgb, var(--accent) 30%, transparent);
    stroke: var(--accent);
    stroke-width: 2;
  }
  .cursor {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
  }
  @keyframes pulse {
    50% {
      stroke-opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .opening.linkable polygon {
      animation: none;
    }
  }
</style>
