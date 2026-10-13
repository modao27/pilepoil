/**
 * Projet → entrée du moteur des cloisons (docs/cloisons/SPEC.md §3). Les cloisons sont celles de `project.site` qui ont
 * passé la validation des travaux ; chacune est mise dans son repère (x le long de l'axe depuis la face d'appui du
 * départ) : longueur du corps, appuis des deux bouts, liaisons en T, portes, hauteur, faces carrelées. Pur ; mm.
 */
import { intersection } from '../../../core/geometry/boolean';
import { pointInPolygon } from '../../../core/geometry/polygon';
import type { Point, Polygon } from '../../../core/geometry/types';
import { deriveSite } from '../../../core/plan/derive';
import type { Demolition, Id, Partition } from '../../../core/plan/types';
import { wallIndex } from '../../../core/plan/walls';
import { absOutline, absWallBands, partitionBand, partitionFrame, segDistance, SNAP } from '../../../core/plan/works';
import type { Project } from '../../../state/model';
import type { Libraries, ModuleError } from '../../types';
import type { CloisonsSpec, End, PartitionSystem, SpecPartition } from '../core/types';
import { CLOISONS_ID, defaultPartitionSettings, type CloisonsData, type PartitionSettings } from './model';

export const cloisonsData = (p: Project): CloisonsData | null =>
  (p.modules[CLOISONS_ID]?.data as CloisonsData | undefined) ?? null;

export const systemsOf = (libraries: Libraries): readonly PartitionSystem[] =>
  (libraries.systems ?? []) as readonly PartitionSystem[];

const sub = (p: Point, q: Point): Point => [p[0] - q[0], p[1] - q[1]];
const dot = (p: Point, q: Point) => p[0] * q[0] + p[1] * q[1];

/** Hauteur sous plafond quand rien n'est connu. */
const DEFAULT_HEIGHT = 2500;

/** Système d'une cloison : celui qu'on a choisi, sinon le premier de même épaisseur, sinon le premier. */
export function systemFor(
  s: PartitionSettings | undefined,
  q: Pick<Partition, 'thickness'>,
  systems: readonly PartitionSystem[],
): PartitionSystem | undefined {
  const chosen = s?.system ? systems.find((x) => x.id === s.system) : undefined;
  return chosen ?? systems.find((x) => Math.abs(x.thickness - q.thickness) < 1) ?? systems[0];
}

/** Partie de l'axe de la cloison qui est dans un polygone : abscisses [début, fin] depuis le point a ; null si aucune. */
function axisInside(q: Partition, poly: Polygon): [number, number] | null {
  const f = partitionFrame(q);
  const strip = partitionBand({ ...q, thickness: 2, align: 'center' });
  const hit = intersection([strip], [poly]);
  if (!hit.length) return null;
  const ts = hit.flat().map((p) => dot(sub(p, f.a), f.u));
  return [Math.min(...ts), Math.max(...ts)];
}

/** Le point est sur le bord du polygone, à `d` près. */
const onEdge = (p: Point, ring: Polygon, d: number) =>
  ring.some((v, i) => segDistance(p, v, ring[(i + 1) % ring.length]!) <= d);

/** Le point est dans le polygone ou sur son bord, à `d` près. */
const near = (p: Point, ring: Polygon, d: number) => pointInPolygon(p, ring) || onEdge(p, ring, d);

interface Body {
  s0: number;
  s1: number;
  start: End;
  end: End;
  /** Cloisons qui s'arrêtent sur celle-ci : [identifiant, abscisse le long de l'axe depuis a]. */
  tees: [Id, number][];
}

/** Longueur du corps, appuis et liaisons de chaque cloison (repère du plan). */
function bodies(project: Project, list: Partition[]): Map<Id, Body> {
  const existing = project.site.existing.rooms;
  const out = new Map<Id, Body>();
  const wallBands = existing.flatMap((r) => absWallBands(r));
  for (const q of list) {
    const f = partitionFrame(q);
    let s0 = 0,
      s1 = f.length;
    const others = list.filter((o) => o.id !== q.id);
    for (const poly of [...others.map((o) => partitionBand(o)), ...wallBands]) {
      const iv = axisInside(q, poly);
      if (!iv) continue;
      if (iv[0] <= 1) s0 = Math.max(s0, iv[1]);
      if (iv[1] >= f.length - 1) s1 = Math.min(s1, iv[0]);
    }
    out.set(q.id, { s0, s1, start: 'free', end: 'free', tees: [] });
  }
  // appuis : une autre cloison (T ou angle), sinon un mur, sinon rien
  for (const q of list) {
    const f = partitionFrame(q);
    const body = out.get(q.id)!;
    const ends: [Point, 'start' | 'end'][] = [
      [f.a, 'start'],
      [f.b, 'end'],
    ];
    for (const [e, which] of ends) {
      let kind: End = 'free';
      const onto = list.find((o) => o.id !== q.id && near(e, partitionBand(o), SNAP));
      if (onto) {
        const fo = partitionFrame(onto);
        const t = Math.max(0, Math.min(fo.length, dot(sub(e, fo.a), fo.u)));
        const corner = t <= onto.thickness + SNAP || t >= fo.length - onto.thickness - SNAP;
        kind = corner ? 'partition-corner' : 'partition-t';
        if (!corner) out.get(onto.id)!.tees.push([q.id, t]);
      } else if (
        existing.some((r) => onEdge(e, absOutline(r), SNAP) || absWallBands(r).some((b) => pointInPolygon(e, b)))
      ) {
        kind = 'wall';
      }
      body[which] = kind;
    }
  }
  return out;
}

const demolishedArea = (project: Project, ok: (d: Demolition) => boolean): number =>
  project.site.demolitions.filter(ok).reduce((sum, d) => {
    const room = project.site.existing.rooms.find((r) => r.id === d.room);
    return room && wallIndex(room, d.wall) >= 0 ? sum + ((d.to - d.from) * room.height) / 1e6 : sum;
  }, 0);

/** Projet → entrée du moteur ; erreurs bloquantes sans lever d'exception. */
export function toSpec(project: Project, libraries: Libraries): { spec: CloisonsSpec } | { errors: ModuleError[] } {
  const d = cloisonsData(project);
  if (!d) return { errors: [{ code: 'cloisons/absent' }] };
  const failed = new Set(
    deriveSite(project.site)
      .issues.filter((i) => i.severity === 'error')
      .map((i) => i.id),
  );
  const list = project.site.partitions
    .filter((q) => !failed.has(q.id))
    .map((q) =>
      q.openings.some((o) => failed.has(o.id)) ? { ...q, openings: q.openings.filter((o) => !failed.has(o.id)) } : q,
    );
  if (!list.length) return { errors: [{ code: 'cloisons/no-partition' }] };

  const systems = systemsOf(libraries);
  const body = bodies(project, list);
  const carrelage = new Set(project.poses.filter((p) => p.module === 'carrelage').map((p) => p.id));
  const tiled = (q: Id, face: 'a' | 'b') =>
    project.zones.some((z) => {
      const w = z.surface.wall;
      return !!w && carrelage.has(z.pose) && (w === `${q}:${face}` || w.startsWith(`${q}:${face}~`));
    });

  const partitions = list.map((q, n): SpecPartition => {
    const own = Object.hasOwn(d.partitions, q.id) ? d.partitions[q.id] : undefined;
    const s = own ?? defaultPartitionSettings();
    const b = body.get(q.id)!;
    const rooms = project.plan.rooms.filter((r) => r.walls.some((w) => w.of?.partition === q.id));
    const height = s.height ?? (rooms.length ? Math.min(...rooms.map((r) => r.height)) : DEFAULT_HEIGHT);
    const length = Math.max(0, b.s1 - b.s0);
    return {
      id: q.id,
      name: `Cloison ${n + 1}${rooms.length ? ' · ' + [...new Set(rooms.map((r) => r.name))].sort().join(' / ') : ''}`,
      system: systemFor(own, q, systems)?.id ?? '',
      length,
      height,
      spacing: s.spacing,
      plates: s.plates,
      insulation: s.insulation,
      reinforcement: s.reinforcement,
      start: b.start,
      end: b.end,
      junctions: b.tees.map(([, t]) => t - b.s0).filter((x) => x > 0 && x < length),
      openings: q.openings
        .map((o) => ({ id: o.id, kind: o.kind, offset: o.offset - b.s0, width: o.width, height: o.height }))
        .filter((o) => o.offset >= 0 && o.offset + o.width <= length + 0.5),
      tiledFaces: (['a', 'b'] as const).filter((f) => tiled(q.id, f)),
    };
  });

  return {
    spec: {
      partitions,
      systems: Object.fromEntries(systems.map((x) => [x.id, x])),
      settings: d.settings,
      demolishedArea: demolishedArea(project, (x) => !failed.has(x.id)),
    },
  };
}
