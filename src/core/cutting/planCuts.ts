import type { CutPlan, CutTile, Piece, ProductGroup, Settings } from '../types';
import { polyReuse } from './polyReuse';
import { biasComplement, pieceDims, pieceNeed, placeInPoly, placeRect } from './rectReuse';
import type { CutContext, RectStock, Stock } from './stock';

/** Réglages de découpe normalisés comme legacy (kerf négatif ou absent → 0). */
export function cutContext(s: Settings): CutContext {
  return { orientation: s.orientation, kerf: Math.max(0, s.kerf || 0), minOffcut: s.minOffcut };
}

/**
 * Plan de découpe du projet [planCuts] : regroupement par produit sur toutes les surfaces, puis pour chaque
 * produit, pièces coupées par aire décroissante, chacune dans la plus petite chute compatible, sinon un
 * nouveau carreau. Carreaux numérotés de 1 à n sur tout le projet.
 */
export function planCuts(pieces: Piece[], settings: Settings): CutPlan {
  const ctx = cutContext(settings);
  const source: (number | null)[] = pieces.map(() => null);
  const reused: boolean[] = pieces.map(() => false);
  const groups = new Map<string, ProductGroup>();
  const seen = new Map<string, Set<string>>();

  pieces.forEach((pc, i) => {
    let g = groups.get(pc.key);
    if (!g) {
      g = {
        key: pc.key,
        shape: pc.shape,
        tileWidth: pc.tW,
        tileHeight: pc.tH,
        tileArea: pc.tA,
        label: pc.label,
        color: pc.color,
        m2PerBox: pc.m2PerBox,
        kind: pc.kind,
        zones: [],
        full: 0,
        cuts: [],
        tiles: [],
      };
      groups.set(pc.key, g);
      seen.set(pc.key, new Set());
    }
    const zk = pc.surface + '|' + pc.zone,
      zs = seen.get(pc.key)!;
    if (!zs.has(zk)) {
      zs.add(zk);
      g.zones.push({ surface: pc.surface, zone: pc.zone });
    }
    if (pc.full) g.full++;
    else g.cuts.push(i);
  });

  let num = 0;
  const assign = (i: number, t: CutTile, isReused: boolean) => {
    t.pieces.push(i);
    source[i] = t.n;
    reused[i] = isReused;
  };
  for (const g of groups.values()) {
    const newTile = (): CutTile => {
      const t: CutTile = { n: ++num, pieces: [] };
      g.tiles.push(t);
      return t;
    };
    const cuts = g.cuts.map((i) => ({ pc: pieces[i]!, i }));
    if (!settings.reuseOffcuts || g.shape === 'cab' || (g.shape !== 'rect' && !cuts.every(({ pc }) => pc.pparts))) {
      for (const { i } of cuts) assign(i, newTile(), false);
      continue;
    }
    if (g.shape !== 'rect') {
      polyReuse(cuts, newTile, assign, ctx);
      continue;
    }
    rectGroupReuse(cuts, g.tileWidth, g.tileHeight, newTile, assign, ctx);
  }
  return { groups: [...groups.values()], source, reused };
}

function rectGroupReuse(
  cuts: { pc: Piece; i: number }[],
  W: number,
  H: number,
  newTile: () => CutTile,
  assign: (i: number, t: CutTile, reused: boolean) => void,
  ctx: CutContext,
): void {
  const stock: Stock[] = [];
  cuts
    .slice()
    .sort((a, b) => pieceNeed(b.pc) - pieceNeed(a.pc))
    .forEach(({ pc, i }) => {
      const [pw, ph] = pieceDims(pc);
      let best: { i: number; area: number; rems: Stock[] } | null = null;
      for (let k = 0; k < stock.length; k++) {
        const s0 = stock[k]!;
        if (best && s0.area >= best.area) continue;
        let rems: Stock[] | null = null;
        if (s0.type === 'rect') {
          const p = placeRect(pw, ph, pc.req, s0, ctx);
          if (p) rems = p.rems;
        } else if (placeInPoly(pc, s0, W, H, ctx)) rems = [];
        if (rems) best = { i: k, area: s0.area, rems };
      }
      if (best) {
        const s0 = stock.splice(best.i, 1)[0]!;
        assign(i, s0.tile, true);
        stock.push(...best.rems);
        return;
      }
      const t = newTile();
      assign(i, t, false);
      let rems: Stock[] | null = pc.rect ? null : biasComplement(pc, W, H, ctx, t);
      if (!rems) {
        const fresh: RectStock = {
          type: 'rect',
          w: W,
          h: H,
          area: W * H,
          f: { L: true, R: true, T: true, B: true },
          tile: t,
        };
        const p = placeRect(pw, ph, pc.req, fresh, ctx);
        rems = p ? p.rems : [];
      }
      stock.push(...rems);
    });
}
