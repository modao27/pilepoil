/** Fonctions du contrat de module (docs/BOITE.md §2) propres au parquet, hors écrans. */
import type { Point, Polygon, Segment } from '../../../core/geometry/types';
import type { Plan, PlanRoom } from '../../../core/plan/types';
import { floorHoles } from '../../../core/plan/equipment';
import type { Zone } from '../../../core/coverage/types';
import { basesOf, floorSpans, NO_CONTEXT, type ProjectContext, type WallBase } from '../../../core/coverage/wallBase';
import { wallDirection, wallLength, wallSegment } from '../../../core/plan/walls';
import type { ShoppingLine } from '../../../core/shopping/types';
import type { Project } from '../../../state/model';
import type { Libraries, ModuleError, ModuleSummary } from '../../types';
import type { Board } from '../core/board';
import { accessoryNeeds } from '../core/accessories';
import { defaultMargin } from '../core/defaults';
import type { LayoutSpec, ParquetResult, ParquetSpec, ZoneBound } from '../core/types';
import type { Action } from './actions';
import { createParquetData, PARQUET_ID, type Layout, type ParquetData, type ParquetPose } from './model';
import { layoutsOf, newPoseSettings, parquetData } from './poses';

export { parquetData };

export const create = (): ParquetData => createParquetData();

/** Réglages d'une nouvelle pose (contrat de module). */
export const createPose = (project: Project, libraries: Libraries, like?: string): ParquetPose =>
  newPoseSettings(parquetData(project), boardsOf(libraries), like);

const boardsOf = (libraries: Libraries) => (libraries.boards ?? []) as readonly Board[];

/** Marge d'achat (fraction) : saisie, sinon conseillée pour le motif et l'angle de la première pose. */
export function marginOf(d: ParquetData): number {
  if (d.settings.margin != null) return d.settings.margin;
  const l = Object.values(d.poses)[0];
  return l ? defaultMargin(l.pattern, l.angle) : 0.05;
}

/** Projet → entrée du moteur : pièces du plan au repère d'ensemble, lame de la bibliothèque, marge résolue. */
export function toSpec(
  project: Project,
  libraries: Libraries,
  context: ProjectContext = NO_CONTEXT,
): { spec: ParquetSpec } | { errors: ModuleError[] } {
  const d = parquetData(project);
  if (!d) return { errors: [{ code: 'parquet/absent' }] };
  const boards = boardsOf(libraries);
  const layouts = layoutsOf(project)
    .map((l) => layoutSpec(l, project.plan, boards.find((b) => b.id === l.boardId) ?? null, context))
    .filter((l): l is LayoutSpec => !!l);
  if (!layouts.length) return { errors: [{ code: 'parquet/no-room' }] };
  return { spec: { layouts, settings: { ...d.settings, margin: marginOf(d) }, accessories: d.accessories } };
}

function layoutSpec(l: Layout, plan: Plan, board: Board | null, context: ProjectContext): LayoutSpec | null {
  const rooms = l.rooms.map((id) => plan.rooms.find((r) => r.id === id)).filter((r): r is PlanRoom => !!r);
  if (!rooms.length) return null;
  const at = (r: PlanRoom, p: Point): Point => [r.origin[0] + p[0], r.origin[1] + p[1]];
  const ref = referenceWall(l, rooms);
  // limites de la zone de la pose dans chaque pièce (une zone par pièce : la première)
  const zoneOf = (r: PlanRoom): Zone | undefined => l.zones.find((z) => z.surface.room === r.id);
  const bounds = (r: PlanRoom): ZoneBound[] =>
    (zoneOf(r)?.cuts ?? []).map((c) => ({ line: c.line.map((p) => at(r, p)) as Segment, side: c.side }));
  /** Contour et trous de la zone, au repère du plan. */
  const contour = (r: PlanRoom): { area?: Polygon; holes?: Polygon[] } => {
    const z = zoneOf(r);
    const move = (poly: Polygon): Polygon => poly.map((p) => at(r, p));
    return {
      ...(z?.area ? { area: move(z.area) } : {}),
      ...(z?.holes?.length ? { holes: z.holes.map(move) } : {}),
    };
  };
  /** Murs carrelés depuis le sol (autre module) : pas de plinthe le long. */
  const noSkirting = (r: PlanRoom): { noSkirting?: Record<number, [number, number][]> } => {
    const out: Record<number, [number, number][]> = {};
    r.walls.forEach((w, i) => {
      const tiled = basesOf(context, r.id, w.id).filter((b) => b.kind === 'tiled');
      if (tiled.length) out[i] = tiled.map((b) => [b.from, b.to]);
    });
    return Object.keys(out).length ? { noSkirting: out } : {};
  };
  return {
    id: l.id,
    rooms: rooms.map((r) => ({
      id: r.id,
      outline: r.outline.map((p) => at(r, p)),
      obstacles: floorHoles(r).map((o): Polygon => o.outline.map((p) => at(r, p))),
      openings: r.openings.flatMap((o) => {
        const i = r.walls.findIndex((w) => w.id === o.wall);
        if (i < 0) return [];
        return [{ segment: openingSegment(r, i, o.offset, o.width).map((q) => at(r, q)) as Segment, kind: o.kind }];
      }),
      bounds: bounds(r),
      ...contour(r),
      ...noSkirting(r),
    })),
    passages: plan.passages.flatMap((p) => {
      const ra = rooms.find((r) => r.id === p.a.room),
        rb = rooms.find((r) => r.id === p.b.room);
      const o = ra?.openings.find((x) => x.id === p.a.opening);
      const i = o && ra ? ra.walls.findIndex((w) => w.id === o.wall) : -1;
      if (!ra || !rb || !o || i < 0) return [];
      return [
        {
          id: p.id,
          a: ra.id,
          b: rb.id,
          segment: openingSegment(ra, i, o.offset, o.width).map((q) => at(ra, q)) as Segment,
          width: o.width,
          depth: ra.walls[i]!.thickness,
        },
      ];
    }),
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

/**
 * Pied des murs des sols posés (contrat `wallBases`) : plinthe peignable si les plinthes sont prévues, sinon sol sans
 * plinthe ; sur tous les murs des pièces des poses, portes retirées (comme `core/skirting`).
 */
export function wallBases(project: Project): WallBase[] {
  const d = parquetData(project);
  if (!d) return [];
  const sk = d.accessories.skirting;
  const rooms = new Set(layoutsOf(project).flatMap((l) => l.rooms));
  return project.plan.rooms
    .filter((r) => rooms.has(r.id))
    .flatMap((r) =>
      r.walls.flatMap((w, i) =>
        floorSpans(r, i).map(([from, to]): WallBase => ({
          room: r.id,
          wall: w.id,
          from,
          to,
          kind: sk.enabled ? 'skirting' : 'bare',
          height: sk.enabled ? sk.height : 0,
          paintable: sk.enabled,
          module: PARQUET_ID,
        })),
      ),
    );
}

/** Ouverture sur le mur i, repère de la pièce. */
function openingSegment(r: PlanRoom, i: number, offset: number, width: number): Segment {
  const [a] = wallSegment(r, i);
  const u = wallDirection(r, i);
  const p0: Point = [a[0] + u[0] * offset, a[1] + u[1] * offset];
  return [p0, [p0[0] + u[0] * width, p0[1] + u[1] * width]];
}

/** Direction du mur de référence ; par défaut le plus long mur de la première pièce. */
export function referenceWall(l: Pick<Layout, 'reference'>, rooms: PlanRoom[]): Point {
  const room = (l.reference && rooms.find((r) => r.id === l.reference!.room)) || rooms[0]!;
  let i = l.reference ? room.walls.findIndex((w) => w.id === l.reference!.wall) : -1;
  if (i < 0) i = room.walls.reduce((best, _, k) => (wallLength(room, k) > wallLength(room, best) ? k : best), 0);
  const u = wallDirection(room, i);
  return u[0] === 0 && u[1] === 0 ? [1, 0] : u;
}

/** « 52 lames, 11,9 m², chutes 7 % » ; alertes : avertissements et erreurs du calcul. */
export function summary(r: ParquetResult): ModuleSummary {
  const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
  return {
    text: `${fr(r.totals.boards)} lame${r.totals.boards > 1 ? 's' : ''}, ${fr(r.totals.area, 1)} m², chutes ${fr(r.totals.wastePct)} %`,
    alerts: r.layouts.reduce((t, l) => t + l.warnings.length + l.errors.length, 0),
  };
}

/**
 * Lignes d'achat : paquets de chaque lame, ceil(lames utilisées × (1 + marge) / lames par paquet), par variante
 * si la lame a des lames A et B (SPEC §4.6). Accessoires (sous-couche, plinthes…) : P4.
 */
export function shopping(r: ParquetResult, d: ParquetData, libraries: Libraries): ShoppingLine[] {
  const boards = boardsOf(libraries);
  const margin = marginOf(d);
  const used = new Map<string, { A: number; B: number; plain: number }>();
  r.layouts.forEach((lr) => {
    const l = Object.hasOwn(d.poses, lr.id) ? d.poses[lr.id]! : null;
    if (!l) return;
    const u = used.get(l.boardId) ?? { A: 0, B: 0, plain: 0 };
    for (const b of lr.boards) u[b.variant ?? 'plain']++;
    used.set(l.boardId, u);
  });
  const lines: ShoppingLine[] = [];
  for (const [id, u] of used) {
    const b = boards.find((x) => x.id === id);
    if (!b) continue;
    // une lame sans lames A et B ne se commande pas en deux références : tout va sur la ligne unique
    const counts = b.handed ? u : { A: 0, B: 0, plain: u.A + u.B + u.plain };
    for (const [variant, n] of Object.entries(counts) as ['A' | 'B' | 'plain', number][]) {
      if (!n) continue;
      const suffix = variant === 'plain' ? '' : ':' + variant;
      const key = `parquet:board:${id}${suffix}`;
      const packs = Math.ceil((n * (1 + margin)) / b.boardsPerPack);
      const own = d.prices[key];
      const price = own != null ? own : b.pricePerPack;
      lines.push({
        module: PARQUET_ID,
        key,
        group: 'covering',
        label: b.name + (variant === 'plain' ? '' : ` (lames ${variant})`),
        quantity: packs,
        unit: 'pack',
        detail: `${n} lame${n > 1 ? 's' : ''} + ${Math.round(margin * 100)} % (${b.boardsPerPack} par paquet)`,
        unitPrice: price ?? null,
        priceFromLibrary: price != null && !(own != null),
        color: b.color,
      });
    }
  }
  return [...lines, ...accessoryLines(r, d)];
}

/** Sous-couche, pare-vapeur, plinthes, seuils, colle ou fixations (quantités : core/accessories). */
function accessoryLines(r: ParquetResult, d: ParquetData): ShoppingLine[] {
  const fr = (v: number, k = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: k });
  const methods = Object.fromEntries(Object.entries(d.poses).map(([id, l]) => [id, l.method]));
  const line = (
    key: string,
    group: ShoppingLine['group'],
    label: string,
    quantity: number,
    unit: ShoppingLine['unit'],
    detail: string,
  ): ShoppingLine => {
    const own = d.prices[`parquet:${key}`];
    return {
      module: PARQUET_ID,
      key: `parquet:${key}`,
      group,
      label,
      quantity,
      unit,
      detail,
      unitPrice: own != null ? own : null,
    };
  };
  return accessoryNeeds(r, methods, d.accessories).map((n) => {
    switch (n.kind) {
      case 'underlay':
        return line(
          'underlay',
          'underlay',
          'Sous-couche',
          n.rolls,
          'roll',
          `${fr(n.area, 1)} m² + ${fr(n.overlap * 100)} % de recouvrement (${fr(n.m2PerRoll)} m² par rouleau)`,
        );
      case 'vapor-barrier':
        return line(
          'vapor-barrier',
          'underlay',
          'Pare-vapeur',
          n.rolls,
          'roll',
          `${fr(n.area, 1)} m² avec recouvrement et remontée (${fr(n.m2PerRoll)} m² par rouleau)`,
        );
      case 'skirting':
        return line(
          'skirting',
          'finish',
          'Plinthes',
          n.bars,
          'bar',
          `${fr(n.length / 1000, 1)} m, barres de ${fr(n.barLength / 1000, 2)} m`,
        );
      case 'threshold':
        return line(
          'threshold',
          'finish',
          'Barres de seuil',
          n.bars,
          'bar',
          `${n.count} seuil${n.count > 1 ? 's' : ''}, barres de ${fr(n.barLength / 10)} cm`,
        );
      case 'glue':
        return line(
          'glue',
          'consumable',
          'Colle à parquet',
          n.units,
          'piece',
          `${fr(n.area, 1)} m², ${fr(n.m2PerUnit)} m² par seau`,
        );
      case 'fixings':
        return line(
          'fixings',
          'consumable',
          'Clous ou agrafes',
          n.units,
          'piece',
          `${fr(n.area, 1)} m², ${fr(n.perM2)} par m²`,
        );
    }
  });
}

export const priceAction = (key: string, value: number | null): Action => ({ type: 'parquet/price', key, value });
