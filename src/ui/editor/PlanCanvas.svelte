<script lang="ts">
  /**
   * Plan 2D interactif. Glisser : motif de la zone (aimanté aux bords), ouverture ou angle (pas de 5 mm).
   * Toucher : sélectionner. Molette ou pincement : zoom ; deux doigts ou glisser dans le vide : déplacer la vue.
   * Clavier : flèches pour déplacer l'élément sélectionné, + / − pour zoomer, 0 pour ajuster.
   */
  import { onMount } from 'svelte';
  import { snapOffset } from '../../core';
  import { drawPlan, type PlanColors } from '../../render/plan2d';
  import { hitTest, pieceAt } from '../../render/hitTest';
  import { fitView, panBy, toWorld, zoomAt, type View } from '../../render/view';
  import { app } from '../lib/app.svelte';
  import type { EditorState } from './editorState.svelte';

  let { ed, label }: { ed: EditorState; label: string } = $props();

  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let size = $state({ w: 300, h: 300 });
  let userView = $state.raw<View | null>(null);
  let colorsVersion = $state(0);
  let photosVersion = $state(0);

  const spec = $derived(ed.spec?.surfaces[ed.surfaceIndex]);
  const multi = $derived(ed.surface.zones.length > 1);
  const margins = $derived(
    ed.mode === 'plan'
      ? {
          left: 46,
          top: 46,
          right: multi && ed.surface.split === 'h' ? 58 : 14,
          bottom: multi && ed.surface.split === 'v' ? 46 : 14,
        }
      : { left: 14, top: 14, right: 14, bottom: 14 },
  );
  const base = $derived(fitView(ed.surface.width || 1, ed.surface.height || 1, size.w, size.h, margins));
  const view = $derived(userView ?? base);

  /* couleurs du thème */
  let colors: PlanColors | null = null;
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n: string) => cs.getPropertyValue(n).trim();
    colors = {
      sheet: v('--sheet'),
      paper: v('--paper'),
      ink: v('--ink'),
      muted: v('--muted'),
      line: v('--line'),
      accent: v('--accent'),
      onAccent: v('--on-accent'),
      cut: v('--cut'),
      reuse: v('--reuse'),
      thin: v('--thin'),
      font: v('--font-num') || 'sans-serif',
    };
    colorsVersion++;
  }

  /* photos des carreaux */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- cache d'images, la mise à jour passe par photosVersion
  const images = new Map<string, HTMLImageElement>();
  function photoFor(zone: number): HTMLImageElement | null {
    const tileId = ed.surface.zones[zone]?.tileId;
    const pid = tileId ? app.tile(tileId)?.photoId : null;
    if (!pid) return null;
    app.loadPhoto(pid);
    const url = app.photoUrls[pid];
    if (!url) return null;
    let im = images.get(url);
    if (!im) {
      im = new Image();
      im.onload = () => photosVersion++;
      im.src = url;
      images.set(url, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  $effect(() => {
    // dépendances : données, vue, sélection, thème, photos
    const build = ed.build,
      result = ed.result,
      s = spec;
    void colorsVersion;
    void photosVersion;
    void app.theme;
    void app.photoUrls;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !build || !result || !s || !colors) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlan(ctx, {
      surface: s,
      build,
      plan: result.plan,
      offset: ed.offset,
      view,
      width: size.w,
      height: size.h,
      mode: ed.mode === 'render' ? 'render' : 'plan',
      colors,
      selection: { ...ed.sel, zone: ed.zoneIndex },
      showNumbers: app.showCutNumbers,
      shade: ed.project.settings.shadeVariation,
      photo: photoFor,
      photoSize: (z) => {
        const im = photoFor(z);
        return im ? [im.naturalWidth, im.naturalHeight] : [1, 1];
      },
      photoFlip: (z) => {
        const t = app.tile(ed.surface.zones[z]?.tileId ?? '');
        return !!ed.surface.zones[z]?.photoRandomFlip && t?.orientation !== 'none';
      },
      guides: ed.guides,
      openingCode: (i) => {
        const o = ed.surface.openings[i]!;
        return ({ window: 'F', door: 'Po', socket: 'Pr', trap: 'T', tub: 'B', other: 'R' } as const)[o.type] + (i + 1);
      },
    });
  });

  /* ---------- commandes (barre d'outils) ---------- */
  export function zoomBy(f: number) {
    userView = zoomAt(view, f, size.w / 2, size.h / 2, base.sc);
  }
  export function fit() {
    userView = null;
  }

  /* ---------- pointeurs ---------- */
  type Drag =
    | { kind: 'opening'; index: number; sx: number; sy: number }
    | { kind: 'corner'; index: number; sx: number }
    | { kind: 'zone'; index: number; sx: number; sy: number }
    | { kind: 'pan'; v: View };
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- suivi des doigts, sans rendu
  const pointers = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number; pt: [number, number]; drag: Drag | null; moved: boolean } | null = null;
  let pinch: { d: number; mx: number; my: number; v: View } | null = null;
  let frame = 0;
  let pending: (() => void) | null = null;
  const schedule = (f: () => void) => {
    pending = f;
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        pending?.();
        pending = null;
      });
  };
  const local = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const r5 = (v: number) => Math.round(v / 5) * 5;

  function onpointerdown(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    const [px, py] = local(e);
    pointers.set(e.pointerId, { x: px, y: py });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2, v: view };
      start = null;
      ed.guides = null;
      return;
    }
    if (pointers.size > 2 || !ed.build) return;
    const pt = toWorld(view, px, py);
    let drag: Drag;
    if (e.button === 1 || e.button === 2) drag = { kind: 'pan', v: view };
    else {
      const h = hitTest(spec!, ed.build.layout.rects, pt, 10 / view.sc);
      if (h.kind === 'opening') {
        const o = ed.surface.openings[h.index]!;
        drag = { kind: 'opening', index: h.index, sx: o.x, sy: o.sill };
      } else if (h.kind === 'corner') drag = { kind: 'corner', index: h.index, sx: ed.surface.corners[h.index]!.x };
      else if (h.kind === 'zone') {
        const z = ed.surface.zones[h.index]!;
        drag = { kind: 'zone', index: h.index, sx: z.offsetX, sy: z.offsetY };
      } else drag = { kind: 'pan', v: view };
    }
    start = { x: px, y: py, pt, drag, moved: false };
  }

  function onpointermove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    const [px, py] = local(e);
    pointers.set(e.pointerId, { x: px, y: py });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y),
        mx = (a!.x + b!.x) / 2,
        my = (a!.y + b!.y) / 2;
      const p = pinch;
      userView = panBy(zoomAt(p.v, d / p.d, p.mx, p.my, base.sc), mx - p.mx, my - p.my);
      return;
    }
    if (!start?.drag) return;
    const dX = px - start.x,
      dY = py - start.y;
    if (!start.moved && Math.hypot(dX, dY) < 6) return;
    start.moved = true;
    canvas.classList.add('dragging');
    const g = start.drag,
      s = ed.surface,
      sc = view.sc;
    if (g.kind === 'pan') {
      userView = panBy(g.v, dX, dY);
    } else if (g.kind === 'opening') {
      const o = s.openings[g.index]!;
      if (ed.sel.opening !== g.index) ed.select({ opening: g.index });
      const x = Math.max(0, Math.min(s.width - o.width, r5(g.sx + dX / sc))),
        sill = Math.max(0, Math.min(s.height - o.height, r5(g.sy - dY / sc)));
      schedule(() => ed.updateOpening({ x, sill }, 'drag-opening-' + o.id, g.index));
    } else if (g.kind === 'corner') {
      const c = s.corners[g.index]!;
      if (ed.sel.corner !== g.index) ed.select({ corner: g.index });
      const x = Math.max(10, Math.min(s.width - 10, r5(g.sx + dX / sc)));
      schedule(() => ed.updateCorner({ x }, 'drag-corner-' + c.id, g.index));
    } else {
      const z = s.zones[g.index]!;
      if (ed.zoneIndex !== g.index) ed.select({ zone: g.index });
      const rc = ed.build?.layout.rects[g.index];
      const zs = spec?.zones[g.index];
      if (!rc || !zs) return;
      const r = snapOffset(zs, rc, s.joint, { offsetX: g.sx + dX / sc, offsetY: g.sy + dY / sc }, 8 / sc);
      ed.guides = r.guideX != null || r.guideY != null ? { zone: g.index, x: r.guideX, y: r.guideY } : null;
      schedule(() => ed.updateZone({ offsetX: r.offsetX, offsetY: r.offsetY }, 'drag-zone-' + z.id, g.index));
    }
  }

  function onpointerup(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.classList.remove('dragging');
    ed.guides = null;
    const st = start;
    start = null;
    if (!st || st.moved || e.type !== 'pointerup' || !ed.build) return;
    const g = st.drag;
    if (g?.kind === 'opening') {
      ed.select({ opening: g.index });
      ed.tab = 'openings';
    } else if (g?.kind === 'corner') {
      ed.select({ corner: g.index });
      ed.tab = 'finish';
    } else {
      const i = pieceAt(ed.build.pieces, st.pt);
      if (i >= 0) ed.select({ zone: ed.build.pieces[i]!.zone, piece: i === ed.sel.piece ? -1 : i });
      else if (g?.kind === 'zone') ed.select({ zone: g.index });
      else ed.select({});
    }
  }

  function onkeydown(e: KeyboardEvent) {
    const step = e.shiftKey ? 50 : 5;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (e.key === '+' || e.key === '=') zoomBy(1.25);
    else if (e.key === '-') zoomBy(0.8);
    else if (e.key === '0') fit();
    else if (e.key === 'Escape') ed.select({});
    else if (d) {
      const s = ed.surface;
      const o = s.openings[ed.sel.opening],
        c = s.corners[ed.sel.corner];
      if (o)
        ed.updateOpening(
          { x: Math.max(0, o.x + d[0]! * step), sill: Math.max(0, o.sill - d[1]! * step) },
          'key-opening',
        );
      else if (c) ed.updateCorner({ x: Math.max(10, c.x + d[0]! * step) }, 'key-corner');
      else
        ed.updateZone({ offsetX: ed.zone.offsetX + d[0]! * step, offsetY: ed.zone.offsetY + d[1]! * step }, 'key-zone');
    } else return;
    e.preventDefault();
  }

  onMount(() => {
    readColors();
    const ro = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      size = { w: Math.max(100, r.width), h: Math.max(100, r.height) };
    });
    ro.observe(box);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', readColors);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      userView = zoomAt(view, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, base.sc);
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', readColors);
      canvas.removeEventListener('wheel', wheel);
    };
  });

  // Thème changé dans l'application : relire les couleurs après l'application des variables CSS.
  $effect(() => {
    void app.theme;
    requestAnimationFrame(readColors);
  });
  // Nouvelle surface : vue ajustée.
  $effect(() => {
    void ed.surfaceId;
    userView = null;
  });
</script>

<!-- Le cadre porte le rôle et le clavier ; le canvas n'est qu'une image (manipulation directe au pointeur).
     role="application" : widget à manipulation directe avec son propre clavier (flèches, +, −, 0), focalisable. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="box"
  bind:this={box}
  tabindex="0"
  role="application"
  aria-label={label}
  aria-describedby="plan-help"
  {onkeydown}
>
  <canvas
    bind:this={canvas}
    style="width: {size.w}px; height: {size.h}px"
    aria-hidden="true"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    oncontextmenu={(e) => e.preventDefault()}
  ></canvas>
  <p id="plan-help" class="visually-hidden">
    Glissez dans une zone pour déplacer son motif, ou une ouverture pour la placer. Touchez un carreau pour voir sa
    coupe. Au clavier : flèches pour déplacer l’élément choisi, plus et moins pour zoomer, zéro pour ajuster.
  </p>
</div>

<style>
  .box {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  canvas {
    display: block;
    touch-action: none;
    cursor: grab;
  }
  canvas:global(.dragging) {
    cursor: grabbing;
  }
  .box:focus-visible {
    outline-offset: -3px;
  }
</style>
