/**
 * Découpe de barres 1D (plinthes, seuils, profilés), commune aux modules (docs/parquet/SPEC.md §4.5).
 * Premier ajustement décroissant, puis amélioration locale : on tente de vider la barre la moins remplie.
 * Pur et déterministe, mm.
 */

export interface BarPiece {
  id: string;
  /** Longueur posée. */
  length: number;
  /** Bouts coupés d'onglet (0, 1 ou 2) : chacun ajoute `mitreAllowance`. */
  mitres?: number;
}

export interface BarsInput {
  pieces: BarPiece[];
  barLength: number;
  /** Perte par coupe (trait de scie). */
  kerf: number;
  /** Supplément par coupe d'angle. */
  mitreAllowance?: number;
}

export interface BarCut {
  /** Pièce d'origine ; une pièce plus longue qu'une barre est faite de plusieurs morceaux (part 1, 2…). */
  id: string;
  part: number;
  /** Parts de la pièce ; 1 si elle tient dans une barre. */
  parts: number;
  /** Longueur à couper, suppléments d'onglet compris. */
  length: number;
}

export interface Bar {
  cuts: BarCut[];
  /** Reste de la barre après les coupes (traits de scie déduits). */
  rest: number;
}

export interface BarsResult {
  bars: Bar[];
  /** Restes non nuls, du plus long au plus court. */
  offcuts: number[];
}

const EPS = 1e-6;
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Longueur de la barre consommée par une coupe : la coupe et son trait de scie. */
const use = (c: BarCut, kerf: number) => c.length + kerf;

export function cutBars(input: BarsInput): BarsResult {
  const { barLength: L, kerf } = input;
  const allowance = input.mitreAllowance ?? 0;
  if (!(L > 0)) return { bars: [], offcuts: [] };
  // capacité : n coupes demandent n − 1 traits de scie au plus (la dernière peut finir au bout de la barre)
  const cap = L + kerf;

  /* ---------- morceaux : pièces plus longues qu'une barre découpées en barres entières + reste ---------- */
  const cuts: BarCut[] = [];
  for (const p of input.pieces) {
    let total = p.length + (p.mitres ?? 0) * allowance;
    if (total <= EPS) continue;
    const lens: number[] = [];
    while (total > L + EPS) {
      lens.push(L);
      total -= L;
    }
    lens.push(total);
    lens.forEach((len, k) => cuts.push({ id: p.id, part: k + 1, parts: lens.length, length: round2(len) }));
  }

  /* ---------- barre par barre : le sous-ensemble des coupes restantes qui la remplit le mieux ---------- */
  let left = [...cuts].sort((a, b) => b.length - a.length || a.id.localeCompare(b.id) || a.part - b.part);
  const bars: { cuts: BarCut[]; used: number }[] = [];
  while (left.length) {
    const pick = bestSubset(
      left.map((c) => use(c, kerf)),
      cap,
    );
    bars.push({ cuts: pick.map((i) => left[i]!), used: pick.reduce((t, i) => t + use(left[i]!, kerf), 0) });
    const taken = new Set(pick);
    left = left.filter((_, i) => !taken.has(i));
  }

  /* ---------- amélioration : vider la barre la moins remplie dans les autres, tant que c'est possible ---------- */
  for (let changed = true; changed && bars.length > 1;) {
    changed = false;
    const byFill = [...bars].sort((a, b) => a.used - b.used);
    for (const weak of byFill) {
      const others = bars.filter((b) => b !== weak).map((b) => ({ b, used: b.used, add: [] as BarCut[] }));
      const ok = [...weak.cuts]
        .sort((a, b) => b.length - a.length)
        .every((c) => {
          const need = use(c, kerf);
          // meilleur ajustement : la barre qui restera la plus pleine
          const t = others.filter((o) => o.used + need <= cap + EPS).sort((x, y) => y.used - x.used)[0];
          if (!t) return false;
          t.used += need;
          t.add.push(c);
          return true;
        });
      if (!ok) continue;
      for (const o of others) {
        o.b.cuts.push(...o.add);
        o.b.used = o.used;
      }
      bars.splice(bars.indexOf(weak), 1);
      changed = true;
      break;
    }
  }

  const out: Bar[] = bars.map((b) => ({
    cuts: [...b.cuts].sort((x, y) => y.length - x.length || x.id.localeCompare(y.id) || x.part - y.part),
    rest: round2(Math.max(0, cap - b.used)),
  }));
  return {
    bars: out,
    offcuts: out
      .map((b) => b.rest)
      .filter((r) => r > EPS)
      .sort((a, b) => b - a),
  };
}

/** Pas du calcul de sous-ensemble : 0,1 mm. */
const STEP = 10;

/**
 * Indices du sous-ensemble de longueurs dont la somme est la plus grande sans dépasser `cap` (somme de
 * sous-ensemble au dixième de millimètre). Toujours au moins un élément (le premier, le plus long).
 */
function bestSubset(lengths: number[], cap: number): number[] {
  const C = Math.floor(cap * STEP + EPS);
  const w = lengths.map((l) => Math.ceil(l * STEP - EPS));
  // from[s] = indice de l'élément qui a rendu la somme s atteignable en premier (−1 : pas encore)
  const from = new Int32Array(C + 1).fill(-1);
  const reach = new Uint8Array(C + 1);
  reach[0] = 1;
  for (let i = 0; i < w.length; i++) {
    const wi = w[i]!;
    if (wi > C) continue;
    for (let t = C; t >= wi; t--)
      if (!reach[t] && reach[t - wi]) {
        reach[t] = 1;
        from[t] = i;
      }
    if (reach[C]) break;
  }
  let t = C;
  while (t > 0 && !reach[t]) t--;
  const out: number[] = [];
  while (t > 0) {
    const i = from[t]!;
    out.push(i);
    t -= w[i]!;
  }
  return out.length ? out.sort((a, b) => a - b) : [0];
}

/** Minimum théorique de barres : longueur totale (suppléments et traits compris) / capacité. */
export function minBars(input: BarsInput): number {
  const allowance = input.mitreAllowance ?? 0;
  const total = input.pieces.reduce((t, p) => t + p.length + (p.mitres ?? 0) * allowance, 0);
  return total > 0 ? Math.ceil(total / input.barLength - EPS) : 0;
}
