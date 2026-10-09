/** Fonctions du contrat de module (docs/BOITE.md §2) propres au parquet, hors écrans. */
import type { Point, Polygon } from '../../../core/geometry/types';
import type { Plan, PlanRoom } from '../../../core/plan/types';
import { wallDirection, wallLength, wallSegment } from '../../../core/plan/walls';
import type { ShoppingLine } from '../../../core/shopping/types';
import type { Project } from '../../../state/model';
import type { Libraries, ModuleError, ModuleSummary } from '../../types';
import type { Board } from '../core/board';
import { defaultMargin } from '../core/defaults';
import type { LayoutSpec, ParquetResult, ParquetSpec } from '../core/types';
import type { Action } from './actions';
import { PARQUET_ID, type Layout, type ParquetData } from './model';

export const parquetData = (p: Project): ParquetData | null => (p.modules[PARQUET_ID]?.data as ParquetData) ?? null;

const boardsOf = (libraries: Libraries) => (libraries.boards ?? []) as readonly Board[];

/** Marge d'achat : saisie, sinon conseillée pour le motif et l'angle de la première pose. */
export function marginOf(d: ParquetData): number {
  if (d.settings.marginPct != null) return d.settings.marginPct;
  const l = d.layouts[0];
  return l ? defaultMargin(l.pattern, l.angle) : 5;
}

/** Projet → entrée du moteur : pièces du plan au repère d'ensemble, lame de la bibliothèque, marge résolue. */
export function toSpec(project: Project, libraries: Libraries): { spec: ParquetSpec } | { errors: ModuleError[] } {
  const d = parquetData(project);
  if (!d) return { errors: [{ code: 'parquet/absent' }] };
  const boards = boardsOf(libraries);
  const layouts = d.layouts
    .map((l) => layoutSpec(l, project.plan, boards.find((b) => b.id === l.boardId) ?? null))
    .filter((l): l is LayoutSpec => !!l);
  if (!layouts.length) return { errors: [{ code: 'parquet/no-room' }] };
  const { marginPct: _, ...settings } = d.settings;
  return { spec: { layouts, settings: { ...settings, marginPct: marginOf(d) }, accessories: d.accessories } };
}

function layoutSpec(l: Layout, plan: Plan, board: Board | null): LayoutSpec | null {
  const rooms = l.rooms.map((id) => plan.rooms.find((r) => r.id === id)).filter((r): r is PlanRoom => !!r);
  if (!rooms.length) return null;
  const at = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];
  const ref = referenceWall(l, rooms);
  return {
    id: l.id,
    rooms: rooms.map((r) => ({
      id: r.id,
      outline: r.outline.map((p) => at(r, p)),
      obstacles: r.obstacles.map((o): Polygon => o.outline.map((p) => at(r, p))),
      openings: r.openings.flatMap((o) => {
        const i = r.walls.findIndex((w) => w.id === o.wall);
        if (i < 0) return [];
        const [a] = wallSegment(r, i);
        const u = wallDirection(r, i);
        const p0: Point = [a[0] + u[0] * o.offset, a[1] + u[1] * o.offset];
        const p1: Point = [p0[0] + u[0] * o.width, p0[1] + u[1] * o.width];
        return [{ segment: [at(r, p0), at(r, p1)], kind: o.kind }];
      }),
    })),
    passages: [], // continuité entre pièces : P3
    board: board && {
      id: board.id,
      lengths: board.lengths,
      lengthMix: board.lengthMix,
      width: board.width,
      thickness: board.thickness,
      handed: board.handed,
      boardsPerPack: board.boardsPerPack,
    },
    pattern: l.pattern,
    angle: l.angle,
    referenceDirection: ref,
    axis: typeof l.axis === 'string' ? l.axis : l.axis.point,
    offset: l.offset,
    method: l.method,
    rules: l.rules,
    breaks: l.breaks,
    seed: l.seed,
  };
}

/** Direction du mur de référence ; par défaut le plus long mur de la première pièce. */
export function referenceWall(l: Layout, rooms: PlanRoom[]): Point {
  const room = (l.reference && rooms.find((r) => r.id === l.reference!.room)) || rooms[0]!;
  let i = l.reference ? room.walls.findIndex((w) => w.id === l.reference!.wall) : -1;
  if (i < 0) i = room.walls.reduce((best, _, k) => (wallLength(room, k) > wallLength(room, best) ? k : best), 0);
  const u = wallDirection(room, i);
  return u[0] === 0 && u[1] === 0 ? [1, 0] : u;
}

/** « 52 lames, 11,9 m², perte 7 % » ; alertes : avertissements et erreurs du calcul. */
export function summary(r: ParquetResult): ModuleSummary {
  const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  return {
    text: `${fr(r.totals.boards)} lame${r.totals.boards > 1 ? 's' : ''}, ${fr(r.totals.area, 1)} m², perte ${fr(r.totals.wastePct)} %`,
    alerts: r.layouts.reduce((t, l) => t + l.warnings.length + l.errors.length, 0),
  };
}

/**
 * Lignes d'achat : paquets de chaque lame, ceil(lames utilisées × (1 + marge) / lames par paquet), par variante
 * si la lame a des lames A et B (SPEC §4.6). Accessoires (sous-couche, plinthes…) : P4.
 */
export function shopping(r: ParquetResult, d: ParquetData, libraries: Libraries): ShoppingLine[] {
  const boards = boardsOf(libraries);
  const margin = marginOf(d) / 100;
  const used = new Map<string, { A: number; B: number; plain: number }>();
  r.layouts.forEach((lr) => {
    const l = d.layouts.find((x) => x.id === lr.id);
    if (!l) return;
    const u = used.get(l.boardId) ?? { A: 0, B: 0, plain: 0 };
    for (const b of lr.boards) u[b.variant ?? 'plain']++;
    used.set(l.boardId, u);
  });
  const lines: ShoppingLine[] = [];
  for (const [id, u] of used) {
    const b = boards.find((x) => x.id === id);
    if (!b) continue;
    for (const [variant, n] of Object.entries(u) as ['A' | 'B' | 'plain', number][]) {
      if (!n) continue;
      const suffix = variant === 'plain' ? '' : ':' + variant;
      const key = `parquet:board:${id}${suffix}`;
      const packs = Math.ceil((n * (1 + margin)) / b.boardsPerPack);
      const own = d.prices[key];
      const price = own != null && own > 0 ? own : b.pricePerPack;
      lines.push({
        module: PARQUET_ID,
        key,
        group: 'covering',
        label: b.name + (variant === 'plain' ? '' : ` (lames ${variant})`),
        quantity: packs,
        unit: 'pack',
        detail: `${n} lame${n > 1 ? 's' : ''} + ${Math.round(margin * 100)} % (${b.boardsPerPack} par paquet)`,
        unitPrice: price ?? null,
        priceFromLibrary: price != null && !(own != null && own > 0),
        color: b.color,
      });
    }
  }
  return lines;
}

export const priceAction = (key: string, value: number | null): Action => ({ type: 'parquet/price', key, value });
