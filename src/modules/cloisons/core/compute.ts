/**
 * Calcul des cloisons (docs/cloisons/SPEC.md §4) : rails, montants, plaques, isolant, consommables, alertes. Pur et
 * déterministe ; mm en entrée, m² en sortie des surfaces.
 */
import { cutBars, type BarPiece } from '../../../core/cutting/bars';
import { chooseFormat, chooseOffsets, layoutPlates, packPlates } from './plates';
import { fullStudLength, layoutRails, layoutStuds, studBarLength } from './studs';
import type {
  Alert,
  CloisonsResult,
  CloisonsSettings,
  CloisonsSpec,
  ConsumableLine,
  InsulationKind,
  PartitionResult,
  PartitionSystem,
  PlateLot,
  PlatePiece,
  SpecPartition,
  Totals,
} from './types';

/** Arrondi au supérieur, insensible aux erreurs de virgule flottante (21,000000000000004 → 21). */
const up = (v: number) => Math.ceil(v - 1e-9);
const m2 = (mm2: number) => mm2 / 1e6;

/** Hauteur maximale de la table pour le système et l'entraxe de la cloison. */
function heightRule(p: SpecPartition, sys: PartitionSystem, s: CloisonsSettings) {
  return s.maxHeights.find((r) => r.system === sys.name && r.spacing === p.spacing);
}

/** Problèmes d'une cloison qui ne l'empêchent pas d'être calculée. */
function softAlerts(p: SpecPartition, sys: PartitionSystem, s: CloisonsSettings, plateWidth: number): Alert[] {
  const out: Alert[] = [];
  const add = (code: string, params?: Alert['params']) => out.push({ code, partition: p.id, params });
  if (Math.abs(sys.thickness - (sys.studWidth + 2 * sys.layers * sys.plateThickness)) > 3)
    add('system-thickness-mismatch');
  const rule = heightRule(p, sys, s);
  if (!rule || rule.max == null) add('height-max-unknown', { system: sys.name, spacing: p.spacing });
  else if (p.height > rule.max)
    add('height-over-max', { max: rule.max, height: p.height, verified: rule.verified ? 1 : 0 });
  if (plateWidth % p.spacing !== 0) add('plate-width-spacing', { width: plateWidth, spacing: p.spacing });
  const full = fullStudLength(p, s);
  for (const o of p.openings) {
    if (o.height > full) add('opening-too-tall', { opening: o.id });
    if (o.offset < 100 || p.length - (o.offset + o.width) < 100) add('opening-near-end', { opening: o.id });
    if (o.width > 1200) add('opening-wide', { opening: o.id });
  }
  if (p.start === 'free' || p.end === 'free') add('free-end');
  if (p.length < 300) add('short-run');
  if ((p.plates.a === 'phonic' || p.plates.b === 'phonic') && !p.insulation) add('phonic-without-insulation');
  if (p.plates.a === 'fire' || p.plates.b === 'fire') add('fire-unchecked');
  for (const face of p.tiledFaces) if (p.plates[face] !== 'hydro') add('wet-face-plate', { face });
  return out;
}

export function computeCloisons(spec: CloisonsSpec): CloisonsResult {
  const s = spec.settings;
  const parts: PartitionResult[] = [];
  const railPool = new Map<string, BarPiece[]>();
  const studPool = new Map<string, { barLength: number; pieces: BarPiece[] }>();
  const platePool = new Map<string, { type: PlateLot['type']; thickness: number; pieces: PlatePiece[] }>();
  const insulation: Totals['insulation'] = {};
  const need = { screw25: 0, screw35: 0, tape: 0, compound: 0, resilient: 0, fixings: 0, bead: 0, wood: 0 };
  const insulationArea: Partial<Record<InsulationKind, number>> = {};

  for (const p of spec.partitions) {
    const alerts: Alert[] = [];
    const sys = spec.systems[p.system];
    const full = fullStudLength(p, s);
    const bar = studBarLength(full, s);
    const plateHeight = p.height - s.plateGap;
    const fmt = chooseFormat(plateHeight, s);
    if (!sys || bar === null || !fmt) {
      if (!sys) alerts.push({ code: p.system ? 'system-missing' : 'no-system', partition: p.id });
      else if (bar === null) alerts.push({ code: 'no-stud-length', partition: p.id, params: { length: full } });
      else alerts.push({ code: 'no-plate-format', partition: p.id, params: { height: plateHeight } });
      parts.push({ id: p.id, ok: false, studs: [], rails: [], plates: [], offsets: [], insulationArea: 0, alerts });
      continue;
    }
    alerts.push(...softAlerts(p, sys, s, fmt.width));

    const studs = layoutStuds(p, s);
    const rails = layoutRails(p, s);
    const { offsets, alerts: jointAlerts } = chooseOffsets(p, sys.layers, fmt.width, s);
    alerts.push(...jointAlerts);
    const plates: PlatePiece[] = [];
    for (const { face, layer, offset } of offsets)
      plates.push(...layoutPlates(p, face, layer, offset, fmt.width, plateHeight));

    // lots de barres : rails par largeur d'ossature, montants par largeur et longueur de barre
    const railKey = String(sys.studWidth);
    railPool.set(railKey, [...(railPool.get(railKey) ?? []), ...rails.map((r) => ({ id: r.id, length: r.length }))]);
    const studKey = `${sys.studWidth}:${bar}`;
    const lot = studPool.get(studKey) ?? { barLength: bar, pieces: [] };
    lot.pieces.push(...studs.map((q) => ({ id: q.id, length: q.length })));
    studPool.set(studKey, lot);

    // lots de plaques : un par type et épaisseur, pour tout le projet
    for (const piece of plates) {
      const key = `${piece.type}:${sys.plateThickness}`;
      const pool = platePool.get(key) ?? { type: piece.type, thickness: sys.plateThickness, pieces: [] };
      pool.pieces.push(piece);
      platePool.set(key, pool);
    }

    // isolant : cavité = longueur × hauteur moins les baies
    const cavity = p.length * p.height - p.openings.reduce((a, o) => a + o.width * Math.min(o.height, p.height), 0);
    const cavityM2 = m2(Math.max(0, cavity));
    if (p.insulation) insulationArea[p.insulation.kind] = (insulationArea[p.insulation.kind] ?? 0) + cavityM2;

    // consommables
    const area = (layerOf: (l: number) => boolean) =>
      m2(plates.filter((q) => layerOf(q.layer)).reduce((a, q) => a + q.area, 0));
    need.screw25 += s.ratios.screw25.perM2 * area((l) => l === 1);
    need.screw35 += s.ratios.screw35.perM2 * area((l) => l > 1);
    const total = area(() => true);
    need.tape += s.ratios.jointTape.perM2 * total;
    need.compound += s.ratios.jointCompound.kgPerM2 * total;
    const wallEnds = [p.start, p.end].filter((e) => e === 'wall').length;
    const railLength = rails.filter((r) => r.kind !== 'lintel').reduce((a, r) => a + r.length, 0);
    need.resilient += (railLength + wallEnds * full) / 1000;
    const fix = (len: number) => up(len / s.ratios.fixing.spacing) + 1;
    need.fixings +=
      rails.filter((r) => r.kind !== 'lintel').reduce((a, r) => a + fix(r.length), 0) + wallEnds * fix(full);
    const freeEnds = [p.start, p.end].filter((e) => e === 'free').length;
    const corners = [p.start, p.end].filter((e) => e === 'partition-corner').length;
    need.bead += ((2 * freeEnds + corners) * p.height) / 1000;
    if (p.reinforcement.woodInsert) need.wood += p.openings.reduce((a, o) => a + (2 * (o.height + 100)) / 1000, 0);

    parts.push({ id: p.id, ok: true, studs, rails, plates, offsets, insulationArea: cavityM2, alerts });
  }

  const totals: Totals = {
    rails: {},
    studs: {},
    plates: [],
    insulation,
    consumables: [],
    demolishedArea: spec.demolishedArea,
  };
  for (const [key, pieces] of [...railPool].sort(([a], [b]) => a.localeCompare(b)))
    totals.rails[key] = cutBars({ pieces, barLength: s.railBar, kerf: s.kerf });
  for (const [key, lot] of [...studPool].sort(([a], [b]) => a.localeCompare(b)))
    totals.studs[key] = cutBars({ pieces: lot.pieces, barLength: lot.barLength, kerf: s.kerf });
  for (const [, pool] of [...platePool].sort(([a], [b]) => a.localeCompare(b))) {
    const { sheets, offcuts } = packPlates(
      pool.pieces,
      s.plateFormats,
      s.minOffcut,
      `${pool.type[0]!.toUpperCase()}${pool.thickness}-`,
    );
    const purchased = Object.fromEntries(Object.entries(sheets).map(([k, n]) => [k, up(n * (1 + s.plateMargin))]));
    totals.plates.push({ type: pool.type, thickness: pool.thickness, sheets, purchased, offcuts });
  }
  for (const [kind, areaM2] of Object.entries(insulationArea) as [InsulationKind, number][])
    insulation[kind] = {
      area: areaM2,
      packs: up((areaM2 * (1 + s.insulationMargin)) / s.insulationPack.m2),
      unit: s.insulationPack.unit,
    };

  const r = s.ratios;
  const line = (key: ConsumableLine['key'], n: number, unit: ConsumableLine['unit'], pack: number) => {
    if (n > 0) totals.consumables.push({ key, need: n, unit, pack, packs: up(n / pack) });
  };
  line('screw25', up(need.screw25), 'piece', r.screw25.pack);
  line('screw35', up(need.screw35), 'piece', r.screw35.pack);
  line('jointTape', need.tape, 'm', r.jointTape.pack);
  line('jointCompound', need.compound, 'kg', r.jointCompound.pack);
  line('resilientStrip', need.resilient, 'm', r.resilientStrip.pack);
  line('fixing', need.fixings, 'piece', r.fixing.pack);
  line('cornerBead', need.bead, 'm', r.cornerBead.pack);
  line('woodInsert', need.wood, 'm', r.woodInsert.pack);

  return { partitions: parts, totals, alerts: parts.flatMap((q) => q.alerts) };
}
