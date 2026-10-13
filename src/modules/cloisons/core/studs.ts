/**
 * Montants et rails d'une cloison (docs/cloisons/SPEC.md §4.1 et §4.2). Repère de la cloison : x le long de l'axe
 * depuis le départ. Pur ; mm.
 */
import type { CloisonsSettings, RailPiece, SpecPartition, Stud, StudRole } from './types';

/** Longueur d'un montant plein. */
export const fullStudLength = (p: Pick<SpecPartition, 'height'>, s: Pick<CloisonsSettings, 'studClearance'>) =>
  p.height - s.studClearance;

/** Plus petite longueur de montant vendue qui contient `length` ; null si aucune. */
export function studBarLength(length: number, s: Pick<CloisonsSettings, 'studLengths'>): number | null {
  const sorted = [...s.studLengths].sort((a, b) => a - b);
  return sorted.find((l) => l >= length - 1e-6) ?? null;
}

/** Nombre de montants d'une extrémité : doublé avec `ends: 'double'`, toujours pour un bout libre. */
const endCount = (p: SpecPartition, free: boolean) => (free || p.reinforcement.ends === 'double' ? 2 : 1);

/**
 * Montants de la cloison, dans l'ordre des abscisses : extrémités, baies (doublées), liaisons en T, trame ; un
 * montant de trame trop près d'un montant renforcé est supprimé, un montant de trame dans une baie devient un
 * montant court au-dessus du linteau.
 */
export function layoutStuds(p: SpecPartition, s: CloisonsSettings): Stud[] {
  const full = fullStudLength(p, s);
  const L = p.length;
  const out: { x: number; length: number; role: StudRole }[] = [];
  const push = (x: number, role: StudRole, n = 1, length = full) => {
    for (let i = 0; i < n; i++) out.push({ x, length, role });
  };

  push(0, 'start', endCount(p, p.start === 'free'));
  push(L, 'end', endCount(p, p.end === 'free'));
  // un angle de deux cloisons demande un montant de plus (appui des plaques de l'autre cloison)
  if (p.reinforcement.junctions === 'double') {
    if (p.start === 'partition-corner') push(0, 'corner');
    if (p.end === 'partition-corner') push(L, 'corner');
  }
  for (const o of p.openings)
    for (const edge of [o.offset, o.offset + o.width])
      if (edge > s.studMinGap && edge < L - s.studMinGap) push(edge, 'jamb', 2);
  for (const x of p.junctions) push(x, 'junction', p.reinforcement.junctions === 'double' ? 2 : 1);

  const reinforced = out.map((q) => q.x);
  for (let k = 1; k * p.spacing < L - 0.5; k++) {
    const x = k * p.spacing;
    if (reinforced.some((r) => Math.abs(r - x) < s.studMinGap)) continue;
    const op = p.openings.find((o) => x > o.offset && x < o.offset + o.width);
    if (!op) push(x, 'grid');
    else if (full - op.height > 0) push(x, 'cripple', 1, full - op.height);
  }
  const order: Record<StudRole, number> = { start: 0, corner: 1, jamb: 2, junction: 2, grid: 2, cripple: 2, end: 3 };
  out.sort((a, b) => a.x - b.x || order[a.role] - order[b.role]);
  return out.map((q, i) => ({ id: `${p.id}#s${i + 1}`, ...q }));
}

/**
 * Rails de la cloison : rail haut continu, rail bas interrompu aux baies, un linteau par baie (largeur de la baie plus
 * l'appui de chaque côté).
 */
export function layoutRails(p: SpecPartition, s: CloisonsSettings): RailPiece[] {
  const L = p.length;
  const out: RailPiece[] = [{ id: `${p.id}#top`, kind: 'top', x0: 0, x1: L, length: L }];
  const spans = [...p.openings].sort((a, b) => a.offset - b.offset);
  let x = 0;
  const bottom = (x0: number, x1: number) => {
    if (x1 - x0 > 0.5)
      out.push({
        id: `${p.id}#bottom${out.filter((r) => r.kind === 'bottom').length + 1}`,
        kind: 'bottom',
        x0,
        x1,
        length: x1 - x0,
      });
  };
  for (const o of spans) {
    bottom(x, Math.min(L, o.offset));
    x = Math.max(x, o.offset + o.width);
  }
  bottom(x, L);
  spans.forEach((o, i) =>
    out.push({
      id: `${p.id}#lintel${i + 1}`,
      kind: 'lintel',
      x0: o.offset - s.lintelBearing,
      x1: o.offset + o.width + s.lintelBearing,
      length: o.width + 2 * s.lintelBearing,
    }),
  );
  return out;
}
