/**
 * Plan après travaux (docs/BOITE.md §3 bis) : `derive(site)` démolit puis cloisonne l'état existant avec les
 * booléens de `core/geometry/boolean`, et redonne un `Plan` ordinaire que tous les modules lisent. Pur et
 * déterministe ; mm, repère du plan.
 *
 * - sans travaux valides, le plan renvoyé est `site.existing` lui-même (même référence) ;
 * - les pièces que les travaux ne touchent pas gardent leur objet ;
 * - les booléens perdent l'origine des arêtes : chaque arête de sortie est rattachée à sa source (mur existant,
 *   face de cloison, retour de démolition) par colinéarité, ce qui redonne les murs, leurs épaisseurs, leur verrou
 *   et leurs ouvertures ;
 * - l'identité d'une pièce vient d'une ancre calculée sur l'état existant (aucune mémoire).
 */
import { difference, intersection, regionArea, union, type Region } from '../geometry/boolean';
import { bbox, pointInPolygon, signedArea } from '../geometry/polygon';
import { components, type Component } from '../geometry/rings';
import type { Point, Polygon } from '../geometry/types';
import { fingerprint } from '../hash';
import { labelPoint } from './snap';
import type { Demolition, Id, Obstacle, Partition, Passage, Plan, PlanRoom, Site, Wall, WallOpening } from './types';
import { passageError, validateRoom } from './validate';
import {
  absOutline,
  absPoint,
  boxesOverlap,
  CONTACT_AREA,
  demolitionBand,
  neighborRooms,
  partitionBand,
  partitionExtension,
  partitionFrame,
  SNAP,
  validateWorks,
  type WorksIssue,
} from './works';
import { DEFAULT_WALL_THICKNESS, wallDirection, wallIndex, wallSegment } from './walls';

export interface Derived {
  plan: Plan;
  issues: WorksIssue[];
}

/** Écart toléré entre une arête de sortie et sa source, mm (arrondis des booléens : 0,01). */
const TOL = 0.05;
/** Un morceau ou un trou de moins de 0,1 m² est ignoré, mm². */
const SLIVER = 100_000;
/** Plus petit morceau d'ouverture gardé, mm. */
const MIN_OPENING = 5;

interface GroupResult {
  sig: string;
  members: PlanRoom[];
  /** null : les travaux ne touchent pas ce groupe. */
  pieces: Piece[] | null;
  slivers: number;
}
const groupMemo = new WeakMap<PlanRoom, GroupResult>();
const memo = new WeakMap<Site, Derived>();

/** Plan après travaux, mémoïsé sur `site`. */
export function planAfter(site: Site): Plan {
  return deriveSite(site).plan;
}

/** Plan après travaux et problèmes des travaux, mémoïsés sur `site`. */
export function deriveSite(site: Site): Derived {
  let d = memo.get(site);
  if (!d) {
    d = derive(site);
    memo.set(site, d);
  }
  return d;
}

/* ---------- aides ---------- */

const sub = (p: Point, q: Point): Point => [p[0] - q[0], p[1] - q[1]];
const dot = (p: Point, q: Point) => p[0] * q[0] + p[1] * q[1];
const cross = (p: Point, q: Point) => p[0] * q[1] - p[1] * q[0];
const r2 = (v: number) => Math.round(v * 100) / 100;
const rp = (p: Point): Point => [r2(p[0]), r2(p[1])];
const area = (r: Region) => Math.abs(regionArea(r));
const inPiece = (p: Point, c: Component) => pointInPolygon(p, c.outer) && !c.holes.some((h) => pointInPolygon(p, h));

function unionAll(regions: Region[]): Region {
  return regions.slice(1).reduce((u, r) => union(u, r), regions[0] ?? []);
}

/** Source d'arête : un segment du plan auquel une arête de sortie peut être rattachée. */
interface Src {
  /** Priorité en cas de superposition : 0 cloison, 1 démolition, 2 mur existant. */
  prio: number;
  a: Point;
  b: Point;
  /** Les arêtes de même clé sont des parties d'un même mur. */
  key: string;
  /** Identifiant du premier morceau ; les suivants prennent `~2`, `~3`. */
  baseId: Id;
  thickness: number;
  locked?: Wall['locked'];
  of?: Wall['of'];
  /** Mur existant : ses ouvertures. */
  room?: PlanRoom;
  wall?: Wall;
}

interface Sub {
  p: Point;
  q: Point;
  src: Src | null;
}

/** Arête PQ découpée selon les sources colinéaires qui la couvrent. */
function coverEdge(p: Point, q: Point, srcs: Src[]): Sub[] {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (L < 1e-6) return [];
  const d: Point = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  const spans: { lo: number; hi: number; src: Src }[] = [];
  for (const s of srcs) {
    if (Math.abs(cross(sub(s.a, p), d)) > TOL || Math.abs(cross(sub(s.b, p), d)) > TOL) continue;
    const x = dot(sub(s.a, p), d),
      y = dot(sub(s.b, p), d);
    const lo = Math.max(0, Math.min(x, y)),
      hi = Math.min(L, Math.max(x, y));
    if (hi - lo > 0.5) spans.push({ lo, hi, src: s });
  }
  const cuts = [0, L, ...spans.flatMap((s) => [s.lo, s.hi])].sort((x, y) => x - y);
  const marks = cuts.filter((v, i) => i === 0 || v - cuts[i - 1]! > 0.5);
  marks[marks.length - 1] = L;
  const at = (s: number): Point => [p[0] + d[0] * s, p[1] + d[1] * s];
  const out: Sub[] = [];
  for (let i = 0; i + 1 < marks.length; i++) {
    const x = marks[i]!,
      y = marks[i + 1]!,
      mid = (x + y) / 2;
    const cands = spans.filter((s) => s.lo <= mid && mid <= s.hi).sort((m, n) => m.src.prio - n.src.prio);
    const src = cands[0]?.src ?? null;
    const last = out.at(-1);
    if (last && last.src === src) last.q = at(y);
    else if (!src && y - x <= 1.5 && last?.src) last.q = at(y);
    else out.push({ p: at(x), q: at(y), src });
  }
  return out;
}

/** Anneau repris à partir du sommet le plus proche de `start` (numérotation des murs stable). */
function rotated(ring: Polygon, start: Point): Polygon {
  let best = 0,
    bestD = Infinity;
  ring.forEach((p, i) => {
    const d = Math.hypot(p[0] - start[0], p[1] - start[1]);
    if (d < bestD - 1e-6) [best, bestD] = [i, d];
  });
  return [...ring.slice(best), ...ring.slice(0, best)];
}

interface Piece {
  c: Component;
  ring: Polygon;
  subs: Sub[];
  /** Pièce existante dont la pièce dérivée reprend l'identité (null : nouvelle pièce). */
  keeper: PlanRoom | null;
  /** Pièce existante d'où viennent l'origine, le nom et la hauteur. */
  base: PlanRoom;
  id: Id;
  name: string;
  walls: Wall[];
  openings: WallOpening[];
}

/* ---------- dérivation ---------- */

export function derive(site: Site): Derived {
  const issues = validateWorks(site);
  const dropped = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.id));
  const partitions = site.partitions
    .filter((q) => !dropped.has(q.id))
    .map((q) =>
      q.openings.some((o) => dropped.has(o.id)) ? { ...q, openings: q.openings.filter((o) => !dropped.has(o.id)) } : q,
    );
  const demolitions = site.demolitions.filter((d) => !dropped.has(d.id));
  if (!partitions.length && !demolitions.length) return { plan: site.existing, issues };

  const rooms = site.existing.rooms;
  const outIssues: WorksIssue[] = [...issues];

  // groupes de pièces réunies par des démolitions
  const parent = new Map<Id, Id>(rooms.map((r) => [r.id, r.id]));
  const find = (x: Id): Id => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  const bands = new Map<Id, Polygon[]>();
  const demSources: { d: Demolition; room: PlanRoom; i: number }[] = [];
  for (const d of demolitions) {
    const room = rooms.find((r) => r.id === d.room)!;
    const i = wallIndex(room, d.wall);
    const next = neighborRooms(site, room, i, d);
    for (const n of next) parent.set(find(n.id), find(room.id));
    demSources.push({ d, room, i });
  }
  for (const { d, room, i } of demSources) {
    const key = find(room.id);
    bands.set(key, [...(bands.get(key) ?? []), demolitionBand(room, i, d.from, d.to, SNAP)]);
  }
  const groups = new Map<Id, PlanRoom[]>();
  for (const r of rooms) groups.set(find(r.id), [...(groups.get(find(r.id)) ?? []), r]);

  // bandes des cloisons (prolongées là où elles mordent dans un mur)
  const partBands = partitions.map((q) => {
    const [ea, eb] = partitionExtension(site, q);
    return { q, band: partitionBand(q, ea, eb) };
  });

  const derivedByFirst = new Map<Id, PlanRoom[]>();
  const touched = new Set<Id>();
  const allPieces: Piece[] = [];
  const pieceGroups: { rooms: PlanRoom[]; pieces: Piece[] }[] = [];

  for (const [key, members] of groups) {
    const dems = demSources.filter((x) => find(x.room.id) === key);
    const gbox = bbox([...members.flatMap((r) => absOutline(r)), ...(bands.get(key) ?? []).flat()]);
    const cand = partBands.filter(({ band }) => boxesOverlap(gbox, bbox(band)));
    if (!cand.length && !dems.length) continue;
    // le gros du calcul (booléens, arêtes) ne dépend que des pièces du groupe, des bandes voisines et des
    // démolitions : inchangé, il est repris tel quel (glisser une cloison ne recalcule que son groupe)
    const sig = JSON.stringify([
      cand.map((c) => [c.q.id, c.band]),
      dems.map((x) => [x.d.id, x.d.from, x.d.to, x.room.id, x.i]),
    ]);
    let hit = groupMemo.get(members[0]!);
    if (
      !hit ||
      hit.sig !== sig ||
      hit.members.length !== members.length ||
      hit.members.some((r, i) => r !== members[i])
    ) {
      hit = computeGroup(members, key, cand, dems);
      hit.sig = sig;
      hit.members = members;
      groupMemo.set(members[0]!, hit);
    }
    if (!hit.pieces) continue;
    for (let n = 0; n < hit.slivers; n++)
      outIssues.push({ code: 'derive/sliver', id: members[0]!.id, severity: 'warning' });
    const pieces = hit.pieces;
    pieceGroups.push({ rooms: members, pieces });
    allPieces.push(...pieces);
    for (const r of members) touched.add(r.id);
    derivedByFirst.set(members[0]!.id, []);
  }

  nameWalls(allPieces, partitions, outIssues);

  // pièces dérivées, dans l'ordre du plan
  for (const g of pieceGroups) {
    const first = g.rooms[0]!.id;
    derivedByFirst.set(
      first,
      g.pieces.map((p) => toRoom(p, g.rooms, outIssues)),
    );
  }
  const outRooms: PlanRoom[] = [];
  for (const r of rooms) {
    if (!touched.has(r.id)) outRooms.push(r);
    else if (derivedByFirst.has(r.id)) outRooms.push(...derivedByFirst.get(r.id)!);
  }

  const plan: Plan = {
    rooms: outRooms,
    passages: derivePassages(site, outRooms, partitions, touched, outIssues),
  };
  for (const r of outRooms)
    if (!rooms.includes(r) && validateRoom(r).length)
      outIssues.push({ code: 'derive/invalid-room', id: r.id, severity: 'error' });
  return { plan, issues: dedupe(outIssues) };

  function computeGroup(
    members: PlanRoom[],
    key: Id,
    cand: { q: Partition; band: Polygon }[],
    dems: typeof demSources,
  ): GroupResult {
    const region = unionAll([...members.map((r) => [absOutline(r)]), ...(bands.get(key) ?? []).map((b) => [b])]);
    const cutters = cand.filter(({ band }) => area(intersection(region, [band])) > CONTACT_AREA);
    if (!cutters.length && !dems.length) return { sig: '', members, pieces: null, slivers: 0 };
    const left = cutters.length
      ? difference(
          region,
          cutters.map((c) => c.band),
        )
      : region;
    const all = components(left);
    const comps = all.filter((c) => area([c.outer, ...c.holes]) >= SLIVER);
    const srcs = sourcesOf(
      members,
      dems,
      cutters.map((c) => c.q),
    );
    return { sig: '', members, pieces: buildPieces(members, comps, srcs), slivers: all.length - comps.length };
  }

  /* ----- sources d'arêtes d'un groupe ----- */
  function sourcesOf(members: PlanRoom[], dems: typeof demSources, cuts: Partition[]): Src[] {
    const out: Src[] = [];
    for (const q of cuts) {
      const f = partitionFrame(q);
      const line = (d: number): [Point, Point] => [
        [f.a[0] + f.nl[0] * d, f.a[1] + f.nl[1] * d],
        [f.b[0] + f.nl[0] * d, f.b[1] + f.nl[1] * d],
      ];
      const [aa, ab] = line(f.wl),
        [ba, bb] = line(-f.wr);
      const mk = (face: 'a' | 'b' | 'start' | 'end', s: [Point, Point]): Src => ({
        prio: 0,
        a: s[0],
        b: s[1],
        key: `${q.id}:${face}`,
        baseId: `${q.id}:${face}`,
        thickness: q.thickness,
        of: { partition: q.id, face },
      });
      out.push(mk('a', [aa, ab]), mk('b', [ba, bb]), mk('start', [ba, aa]), mk('end', [bb, ab]));
    }
    for (const { d, room, i } of dems) {
      const [s] = wallSegment(room, i);
      const start = absPoint(room, s),
        u = wallDirection(room, i),
        t = room.walls[i]!.thickness;
      const n: Point = [u[1], -u[0]];
      const end = (x: number, tag: '1' | '2'): Src => ({
        prio: 1,
        a: [start[0] + u[0] * x, start[1] + u[1] * x],
        b: [start[0] + u[0] * x + n[0] * t, start[1] + u[1] * x + n[1] * t],
        key: `${d.id}:${tag}`,
        baseId: `${d.id}:${tag}`,
        thickness: t,
      });
      out.push(end(d.from, '1'), end(d.to, '2'));
    }
    for (const r of members)
      r.walls.forEach((w, i) => {
        const [p, q] = wallSegment(r, i);
        out.push({
          prio: 2,
          a: absPoint(r, p),
          b: absPoint(r, q),
          key: `${r.id}~${w.id}`,
          baseId: w.id,
          thickness: w.thickness,
          locked: w.locked,
          room: r,
          wall: w,
        });
      });
    return out;
  }
}

/** Morceaux d'un groupe : identité, arêtes rattachées à leurs sources. */
function buildPieces(members: PlanRoom[], comps: Component[], srcs: Src[]): Piece[] {
  const anchors = members.map((r) => {
    const a = labelPoint(r.outline);
    return absPoint(r, a);
  });
  const claimed = new Map<number, PlanRoom>();
  const absorbed = new Set<Id>();
  members.forEach((r, k) => {
    const j = comps.findIndex((c) => inPiece(anchors[k]!, c));
    if (j < 0) return;
    if (claimed.has(j)) absorbed.add(r.id);
    else claimed.set(j, r);
  });
  // pièce dont l'ancre est tombée dans une cloison : le morceau qui lui ressemble le plus et qui n'a pas d'ancre
  for (const r of members) {
    if (absorbed.has(r.id) || [...claimed.values()].includes(r)) continue;
    let best = -1,
      bestA = 0;
    comps.forEach((c, j) => {
      if (claimed.has(j)) return;
      const a = area(intersection([c.outer, ...c.holes], [absOutline(r)]));
      if (a > bestA) [best, bestA] = [j, a];
    });
    if (best >= 0) claimed.set(best, r);
  }

  const pieces: Piece[] = comps.map((c, j) => {
    const keeper = claimed.get(j) ?? null;
    let base = keeper;
    if (!base) {
      let bestA = -1;
      for (const r of members) {
        const a = area(intersection([c.outer, ...c.holes], [absOutline(r)]));
        if (a > bestA) [base, bestA] = [r, a];
      }
    }
    const start = absPoint(base!, base!.outline[0]!);
    const ring = rotated(c.outer, start);
    const subs = ring.flatMap((p, k) => coverEdge(p, ring[(k + 1) % ring.length]!, srcs));
    return {
      c,
      ring,
      subs,
      keeper,
      base: base!,
      id: keeper?.id ?? '',
      name: keeper?.name ?? '',
      walls: [],
      openings: [],
    };
  });

  // nouvelles pièces : identifiant tiré des travaux qui les bordent, nom numéroté dans l'ordre du coin haut gauche
  const fresh = pieces.filter((p) => !p.keeper);
  const used = new Set(pieces.filter((p) => p.keeper).map((p) => p.id));
  const byBase = new Map<Id, Piece[]>();
  for (const p of fresh) byBase.set(p.base.id, [...(byBase.get(p.base.id) ?? []), p]);
  for (const list of byBase.values()) {
    list.sort((p, q) => corner(p.c.outer)[1] - corner(q.c.outer)[1] || corner(p.c.outer)[0] - corner(q.c.outer)[0]);
    list.forEach((p, n) => {
      const bound = [
        ...new Set(p.subs.flatMap((s) => (s.src && s.src.prio < 2 ? [s.src.key.split(':')[0]!] : []))),
      ].sort();
      let id = `${p.base.id}~${fingerprint(bound).slice(0, 8)}`;
      for (let k = 2; used.has(id); k++) id = `${p.base.id}~${fingerprint(bound).slice(0, 8)}~${k}`;
      used.add(id);
      p.id = id;
      p.name = `${p.base.name} (${n + 2})`;
    });
  }
  return pieces;
}

const corner = (ring: Polygon): Point => [Math.min(...ring.map((p) => p[0])), Math.min(...ring.map((p) => p[1]))];

type Part = { piece: Piece; sub: Sub; at: number };

/** Ouverture à reporter sur les morceaux d'un mur : position le long de la source, identifiant du premier morceau. */
interface OpeningDef {
  id: Id;
  kind: WallOpening['kind'];
  offset: number;
  width: number;
  sill: number;
  height: number;
}

/** Identifiants des murs et ouvertures : le premier morceau d'un mur (abscisse la plus petite) garde l'identifiant. */
function nameWalls(pieces: Piece[], partitions: Partition[], issues: WorksIssue[]): void {
  const bySrc = new Map<string, Part[]>();
  pieces.forEach((piece, pi) =>
    piece.subs.forEach((s) => {
      if (!s.src) return;
      const u = unit(s.src);
      const at = Math.min(dot(sub(s.p, s.src.a), u), dot(sub(s.q, s.src.a), u)) + pi * 1e-9;
      bySrc.set(s.src.key, [...(bySrc.get(s.src.key) ?? []), { piece, sub: s, at }]);
    }),
  );
  for (const piece of pieces) piece.openings = [];
  const wallOf = new Map<Sub, Wall>();
  for (const list of bySrc.values()) {
    list.sort((x, y) => x.at - y.at);
    list.forEach(({ sub: s }, k) => {
      const src = s.src!;
      wallOf.set(s, {
        id: k ? `${src.baseId}~${k + 1}` : src.baseId,
        thickness: src.thickness,
        ...(src.locked ? { locked: src.locked } : {}),
        ...(src.of ? { of: src.of } : {}),
      });
    });
  }
  for (const piece of pieces) {
    const seen = new Set<Id>();
    let gap = 0;
    piece.walls = piece.subs.map((s) => {
      let w: Wall = s.src ? { ...wallOf.get(s)! } : { id: `${piece.id}~g${++gap}`, thickness: DEFAULT_WALL_THICKNESS };
      while (seen.has(w.id)) w = { ...w, id: w.id + '~r' };
      seen.add(w.id);
      return w;
    });
  }

  const wallId = (piece: Piece, s: Sub) => piece.walls[piece.subs.indexOf(s)]!.id;
  const place = (list: Part[], o: OpeningDef, warn: Id | null) => {
    let n = 0,
      placed = 0;
    for (const { piece, sub: s } of list) {
      const src = s.src!;
      const u = unit(src);
      const ps = dot(sub(s.p, src.a), u),
        pq = dot(sub(s.q, src.a), u);
      const lo = Math.max(o.offset, Math.min(ps, pq)),
        hi = Math.min(o.offset + o.width, Math.max(ps, pq));
      if (hi - lo < MIN_OPENING) continue;
      piece.openings.push({
        id: n ? `${o.id}~${n + 1}` : o.id,
        kind: o.kind,
        wall: wallId(piece, s),
        offset: r2(ps <= pq ? lo - ps : ps - hi),
        width: r2(hi - lo),
        sill: o.sill,
        height: o.height,
      });
      n++;
      placed += hi - lo;
    }
    // une ouverture coupée ou rognée (cloison ou démolition qui tombe dessus) est signalée
    if (warn && n > 0 && (n > 1 || o.width - placed > 1))
      issues.push({ code: 'partition/over-opening', id: warn, severity: 'warning' });
  };

  for (const list of bySrc.values()) {
    const src = list[0]!.sub.src!;
    if (!src.wall) continue;
    for (const o of src.room!.openings.filter((x) => x.wall === src.wall!.id)) {
      place(list, { id: o.id, kind: o.kind, offset: o.offset, width: o.width, sill: o.sill, height: o.height }, o.id);
    }
  }
  for (const q of partitions)
    for (const face of ['a', 'b'] as const) {
      const list = bySrc.get(`${q.id}:${face}`);
      if (!list) continue;
      list.sort((x, y) => x.at - y.at);
      for (const o of q.openings)
        place(
          list,
          { id: `${o.id}:${face}`, kind: 'door', offset: o.offset, width: o.width, sill: 0, height: o.height },
          null,
        );
    }
}

function unit(s: Src): Point {
  const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
  return [(s.b[0] - s.a[0]) / l, (s.b[1] - s.a[1]) / l];
}

function dedupe(list: WorksIssue[]): WorksIssue[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = `${i.code}|${i.id}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}

/** Pièce du plan à partir d'un morceau. */
function toRoom(p: Piece, members: PlanRoom[], issues: WorksIssue[]): PlanRoom {
  void issues;
  const o = p.base.origin;
  const outline: Polygon = p.subs.map((s) => rp([s.p[0] - o[0], s.p[1] - o[1]]));
  const obstacles: Obstacle[] = [];
  for (const r of members)
    for (const ob of r.obstacles) {
      const abs = ob.outline.map((q) => absPoint(r, q));
      const c: Point = [abs.reduce((s, q) => s + q[0], 0) / abs.length, abs.reduce((s, q) => s + q[1], 0) / abs.length];
      if (inPiece(c, p.c)) obstacles.push({ ...ob, outline: abs.map((q) => rp([q[0] - o[0], q[1] - o[1]])) });
    }
  p.c.holes
    .filter((h) => Math.abs(signedArea(h)) >= SLIVER)
    .forEach((h, k) =>
      obstacles.push({
        id: `${p.id}~hole${k + 1}`,
        kind: 'other',
        outline: [...h].reverse().map((q) => rp([q[0] - o[0], q[1] - o[1]])),
      }),
    );
  return {
    id: p.id,
    name: p.name,
    outline,
    walls: p.walls,
    obstacles,
    openings: p.openings,
    height: p.base.height,
    origin: o,
  };
}

function derivePassages(
  site: Site,
  rooms: PlanRoom[],
  partitions: Partition[],
  touched: Set<Id>,
  issues: WorksIssue[],
): Passage[] {
  const plan: Plan = { rooms, passages: [] };
  const roomOf = new Map<Id, Id>();
  for (const r of rooms) for (const o of r.openings) roomOf.set(o.id, r.id);
  const out: Passage[] = [];
  for (const p of site.existing.passages) {
    if (!touched.has(p.a.room) && !touched.has(p.b.room)) {
      out.push(p);
      continue;
    }
    const ra = roomOf.get(p.a.opening),
      rb = roomOf.get(p.b.opening);
    if (!ra || !rb) continue;
    const q: Passage = { ...p, a: { room: ra, opening: p.a.opening }, b: { room: rb, opening: p.b.opening } };
    if (passageError(plan, q.a, q.b)) issues.push({ code: 'derive/passage-lost', id: p.id, severity: 'warning' });
    else out.push(q);
  }
  for (const q of partitions)
    for (const o of q.openings) {
      const ra = roomOf.get(`${o.id}:a`),
        rb = roomOf.get(`${o.id}:b`);
      if (!ra || !rb || ra === rb) continue;
      const pass: Passage = {
        id: `${o.id}:p`,
        a: { room: ra, opening: `${o.id}:a` },
        b: { room: rb, opening: `${o.id}:b` },
      };
      if (!passageError(plan, pass.a, pass.b)) out.push(pass);
    }
  return out;
}
