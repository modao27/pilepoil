<script lang="ts">
  /** Description de l'élément touché sur le plan (pièce, ouverture, angle) [info]. */
  import { pattern } from '../../modules/carrelage';
  import { cm } from '../lib/format';
  import type { EditorState } from './editorState.svelte';

  let { ed }: { ed: EditorState } = $props();

  const NAME = {
    window: 'Fenêtre',
    door: 'Porte',
    socket: 'Prise',
    trap: 'Trappe',
    tub: 'Baignoire',
    other: 'Réservation',
  };
  const SIDE = { L: 'tableau gauche', R: 'tableau droit', T: 'linteau', B: 'appui' };
  const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');

  const text = $derived.by(() => {
    const s = ed.surface;
    const c = s.corners[ed.sel.corner];
    if (c)
      return `Angle ${ed.sel.corner + 1} : ${c.type === 'in' ? 'rentrant' : 'sortant'} à ${Math.round(c.angle)}°, à ${cm(c.x)} du bord gauche.`;
    const o = s.openings[ed.sel.opening];
    if (o)
      return `${NAME[o.type]} ${ed.sel.opening + 1} : ${cm(o.width)} × ${cm(o.height)}, à ${cm(o.x)} du bord gauche, ${s.kind === 'floor' ? 'à' : 'allège'} ${cm(o.sill)}.`;
    const pc = ed.build?.pieces[ed.sel.piece];
    if (!pc || !ed.result)
      return 'Glissez dans une zone pour déplacer son motif, ou une ouverture pour la placer. Touchez un carreau pour voir sa coupe.';
    const z = s.zones[pc.zone]!;
    const pre = pc.reveal
      ? `${NAME[s.openings[pc.reveal.opening]!.type]} ${pc.reveal.opening + 1}, ${SIDE[pc.reveal.side]}. `
      : pc.plinth
        ? 'Plinthe. '
        : `Zone ${pc.zone + 1}, ${pc.kind === 'cab' ? 'cabochon' : pattern(z.pattern).name}. `;
    const d = `${mm(pc.pw)} × ${mm(pc.ph)} mm`;
    if (pc.full)
      return `${pre}Pièce entière : ${mm(pc.fw)} × ${mm(pc.fh)} mm${pc.drill ? ', perçage pour une prise' : ''}.`;
    let t =
      pre +
      (pc.rect
        ? `Coupe droite : ${d}`
        : pc.notch
          ? `Coupe en encoche autour de l’ouverture, encombrement ${d}`
          : `Coupe biaise, encombrement ${d}`);
    if (pc.thin) t += ', coupe fine';
    const gi = ed.offset + ed.sel.piece;
    const n = ed.result.plan.source[gi];
    if (n != null) {
      const tile = ed.result.plan.groups.flatMap((g) => g.tiles).find((x) => x.n === n);
      const others = (tile?.pieces.length ?? 1) - 1;
      t += `. Carreau n° ${n}${ed.result.plan.reused[gi] ? ', taillé dans une chute' : ''}${others > 0 ? ` (${others + 1} pièces dans ce carreau)` : ''}`;
    }
    const nr = Object.values(pc.req).filter(Boolean).length;
    if (pc.shape === 'rect' && nr)
      t += `. Bords d’usine côté joints (${nr} côté${nr > 1 ? 's' : ''}), coupe contre le bord`;
    if (pc.atFold) t += '. Coupé dans l’angle';
    if (pc.drill) t += '. Perçage à la scie cloche pour la prise';
    if (pc.vis.length) t += '. Coupe apparente sur un bord visible : prévoir un profilé ou un polissage';
    return t + '.';
  });
</script>

<p class="info" aria-live="polite">{text}</p>

<style>
  .info {
    font-size: var(--fs-sm);
    color: var(--muted);
    min-height: 2.8em;
  }
</style>
