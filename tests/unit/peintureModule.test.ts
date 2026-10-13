/** Module peinture (docs/peinture/SPEC.md §2, §4, §5) : état, projet → moteur, achats, bibliothèque. */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import type { ResultScope } from '../../src/core/coverage/scope';
import { loadModel3D, modelMeshes } from '../../src/ui/lib/model3d';
import { Doc } from '../../src/ui/lib/pdf/doc';
import { module as manifest } from '../../src/modules/peinture';
import { computePeinture } from '../../src/modules/peinture/core/compute';
import { PAINT_TEMPLATES, validatePaint, type Paint } from '../../src/modules/peinture/core/paint';
import type { PaintPoseSettings, PeintureSpec } from '../../src/modules/peinture/core/types';
import { logic } from '../../src/modules/peinture/logic';
import type { PeintureData } from '../../src/modules/peinture/state/model';
import { PEINTURE_SCHEMA } from '../../src/modules/peinture/state/model';
import type { Project } from '../../src/state/model';
import { elevationOf } from '../../src/modules/peinture/ui/lib/elevation';
import { exports as exportsOf, peintureMeshes } from '../../src/modules/peinture/ui/lib/resultExports';
import { writePeintureResults } from '../../src/modules/peinture/ui/lib/pdf';
import { peintureReport } from '../../src/modules/peinture/ui/lib/results';
import { reduceProject } from '../../src/state/project';
import { planProject, rect, withOpening } from './planFixtures';

const peinture = { ...manifest, ...logic };

/** Blanc mat des modèles types, avec des pots de 1 / 2,5 / 5 / 10 L chiffrés. */
const WHITE = {
  ...PAINT_TEMPLATES[0]!,
  packs: [
    { size: 1, price: 12 },
    { size: 2.5, price: 26 },
    { size: 5, price: 45 },
    { size: 10, price: 80 },
  ],
};
const libraries = { paints: [WHITE, ...PAINT_TEMPLATES.slice(1)] };
const WALLS = ['w0', 'w1', 'w2', 'w3'];

/** Pièce 4 000 × 3 000, hauteur 2 500, porte sur le mur 0 et fenêtre sur le mur 1. */
function room(id: string) {
  let r = rect(id, 4000, 3000, { height: 2500 });
  r = withOpening(r, 0, { kind: 'door', offset: 500, width: 830, sill: 0, height: 2040 });
  return withOpening(r, 1, { kind: 'window', offset: 700, width: 1200, sill: 900, height: 1250 });
}

/** Projet avec une pose de peinture par pièce, sur les quatre murs entiers. */
function project(roomIds = ['r']): Project {
  const rooms = roomIds.map(room);
  const poses = roomIds.map((_, i) => ({ id: `P${i}`, module: 'peinture', name: `Pose ${i + 1}` }));
  const zones = roomIds.flatMap((r, i) =>
    WALLS.map((w) => ({ id: `${r}-${w}`, surface: { room: r, wall: `${r}-${w}` }, cuts: [], pose: `P${i}` })),
  );
  const base = planProject(rooms, {}, { zones, poses });
  const data: PeintureData = {
    poses: Object.fromEntries(poses.map((p) => [p.id, peinture.createPose(base, libraries) as PaintPoseSettings])),
    prices: {},
  };
  return { ...base, modules: { ...base.modules, peinture: { schemaVersion: PEINTURE_SCHEMA, data } } };
}

const dataOf = (p: Project) => p.modules.peinture!.data as PeintureData;
const specOf = (p: Project): PeintureSpec => {
  const r = peinture.toSpec(p, libraries);
  if (!('spec' in r)) throw new Error(JSON.stringify(r));
  return r.spec as PeintureSpec;
};

describe('module peinture', () => {
  it('create : aucune pose ; createPose : blanc mat, boiseries des modèles types, ou réglages d’une autre pose', () => {
    expect(peinture.create({ rooms: [], passages: [] })).toEqual({ poses: {}, prices: {} });
    const p = project();
    const fresh = peinture.createPose(p, libraries) as PaintPoseSettings;
    expect(fresh).toMatchObject({ finish: 'modele-blanc-mat', coats: 2, support: 'painted', margin: 0.1 });
    expect(fresh.woodwork.finish).toBe('modele-boiseries');
    const edited = reduceProject(p, {
      type: 'peinture/pose/update',
      poseId: 'P0',
      patch: { coats: 3 },
    } as never);
    expect(peinture.createPose(edited, libraries, 'P0')).toMatchObject({ coats: 3 });
    expect(peinture.createPose(p, { paints: [] })).toMatchObject({ finish: null });
  });

  it('toSpec : zones de murs au repère du mur, ouvertures du mur, longueurs et surface au sol', () => {
    const { poses } = specOf(project());
    expect(poses).toHaveLength(1);
    const { spec } = poses[0]!;
    expect(spec.zones.map((z) => [z.wall, z.openings.map((o) => o.kind)])).toEqual([
      ['r-w0', ['door']],
      ['r-w1', ['window']],
      ['r-w2', []],
      ['r-w3', []],
    ]);
    expect(spec.wallLengths).toEqual({ 'r-w0': 4000, 'r-w1': 3000, 'r-w2': 4000, 'r-w3': 3000 });
    expect(spec.floorArea).toBeCloseTo(12_000_000, 0);
    expect(Object.keys(spec.paints)).toEqual(['modele-blanc-mat', 'modele-boiseries']);
  });

  it('toSpec : module absent ou pose sans mur → erreurs', () => {
    const p = project();
    const bare = { ...p, modules: {} };
    expect(peinture.toSpec(bare, libraries)).toEqual({ errors: [{ code: 'peinture/absent' }] });
    const noZone = { ...p, zones: [] };
    expect(peinture.toSpec(noZone, libraries)).toEqual({ errors: [{ code: 'peinture/no-wall' }] });
  });

  it('cas A de la spec de bout en bout : 31,8068 m², 6 998 mL, 1 × 5 L + 2 × 1 L', () => {
    const r = computePeinture(specOf(project()));
    const pose = r.poses[0]!.result;
    expect(pose.areas.net).toBeCloseTo(31.8068, 4);
    expect(pose.products[0]!.need).toBe(6998);
    const lines = peinture.shopping(r, dataOf(project()), libraries, project());
    expect(lines.map((l) => [l.key, l.quantity, l.unit, l.unitPrice, l.priceFromLibrary])).toEqual([
      ['peinture:modele-blanc-mat:finish:5', 1, 'pot', 45, true],
      ['peinture:modele-blanc-mat:finish:1', 2, 'pot', 12, true],
    ]);
    expect(lines[0]).toMatchObject({ module: 'peinture', group: 'finish', color: '#f4f1ea' });
  });

  it('achats : prix saisi dans le projet, consommables additionnés', () => {
    const p = project();
    const priced = reduceProject(p, {
      type: 'peinture/price',
      key: 'peinture:modele-blanc-mat:finish:5',
      value: 40,
    } as never);
    const consumed = reduceProject(priced, {
      type: 'peinture/pose/update',
      poseId: 'P0',
      patch: { consumables: { masking: true, sheet: false, roller: true, brush: false } },
    } as never);
    const lines = peinture.shopping(computePeinture(specOf(consumed)), dataOf(consumed), libraries, consumed);
    expect(lines.find((l) => l.key.endsWith(':finish:5'))).toMatchObject({ unitPrice: 40, priceFromLibrary: false });
    expect(lines.filter((l) => l.group === 'consumable').map((l) => [l.key, l.quantity])).toEqual([
      ['peinture:consumable:masking', 1],
      ['peinture:consumable:roller', 1],
    ]);
    expect(
      dataOf(
        reduceProject(consumed, {
          type: 'peinture/price',
          key: 'peinture:modele-blanc-mat:finish:5',
          value: null,
        } as never),
      ).prices,
    ).toEqual({});
  });

  it('achats : deux poses du même produit → une seule combinaison de pots', () => {
    const p = project(['r', 's']);
    const lines = peinture.shopping(computePeinture(specOf(p)), dataOf(p), libraries, p);
    // 2 × 6 998 mL = 13 996 mL : 10 L + 5 L (125 €) ou 5 L × 2 + 2,5 L + 1 L × 2 ... : on vérifie couverture et coût
    const litres = lines.reduce((t, l) => t + l.quantity * Number(l.key.split(':').pop()), 0);
    expect(litres).toBeGreaterThanOrEqual(13.996);
    expect(lines.reduce((t, l) => t + l.quantity * l.unitPrice!, 0)).toBeLessThanOrEqual(138);
  });

  it('actions : réglages ajoutés avec la pose, retirés avec elle', () => {
    const p = project();
    const d = dataOf(p);
    const added = peinture.reduce(d, { type: 'pose/added', poseId: 'X', settings: d.poses.P0 }, p.plan);
    expect(Object.keys(added.poses)).toEqual(['P0', 'X']);
    expect(peinture.reduce(added, { type: 'pose/removed', poseId: 'X' }, p.plan).poses).toEqual(d.poses);
    expect(peinture.reduce(d, { type: 'pose/removed', poseId: 'inconnue' }, p.plan)).toBe(d);
    expect(peinture.reduce(d, { type: 'peinture/pose/update', poseId: 'P0', patch: { coats: 2 } }, p.plan)).toBe(d);
  });

  it('résumé : surface et litres de finition', () => {
    const s = peinture.summary(computePeinture(specOf(project())));
    expect(s.text).toBe('31,8 m² à peindre, 7 L de finition');
    expect(s.alerts).toBe(0);
  });
});

describe('bibliothèque de peintures', () => {
  it('chaque modèle type est valide, les identifiants sont uniques', () => {
    for (const t of PAINT_TEMPLATES) expect(validatePaint(t), t.name).toEqual([]);
    expect(new Set(PAINT_TEMPLATES.map((t) => t.id)).size).toBe(PAINT_TEMPLATES.length);
  });

  it('contrôles du formulaire', () => {
    const base = PAINT_TEMPLATES[0]!;
    expect(validatePaint({ ...base, name: ' ' })).toEqual(['name/empty']);
    expect(validatePaint({ ...base, yield: 0 })).toEqual(['yield/invalid']);
    expect(validatePaint({ ...base, packs: [] })).toEqual(['packs/empty']);
    expect(validatePaint({ ...base, packs: [{ size: 0, price: null }] })).toEqual(['packs/invalid']);
    // un enduit n’a pas de rendement par couche
    expect(validatePaint({ ...PAINT_TEMPLATES[4]!, yield: 0 })).toEqual([]);
  });

  it('la bibliothèque est déclarée, l’enregistrement des modèles types ne partage pas les pots', () => {
    expect(manifest.library).toMatchObject({ id: 'paints', store: 'paints' });
    const a = manifest.library!.templates!() as Paint[];
    a[0]!.packs.push({ size: 99, price: null });
    expect((manifest.library!.templates!() as Paint[])[0]!.packs).toHaveLength(PAINT_TEMPLATES[0]!.packs.length);
  });
});

describe('résultats et élévation', () => {
  it('zones : surface de chaque mur de la pose', () => {
    const { zones } = computePeinture(specOf(project())).poses[0]!.result;
    expect(zones.map((z) => [z.wall, +z.gross.toFixed(2), +z.openings.toFixed(4), +z.net.toFixed(4)])).toEqual([
      ['r-w0', 10, 1.6932, 8.3068],
      ['r-w1', 7.5, 1.5, 6],
      ['r-w2', 10, 0, 10],
      ['r-w3', 7.5, 0, 7.5],
    ]);
  });

  it('rapport : surface de la portée (une pièce) et commande de la pose', () => {
    const p = project(['r', 's']);
    const result = computePeinture(specOf(p));
    const input = { project: p, libraries, result };
    const room = peintureReport({ ...input, scope: { kind: 'room', room: 's' } });
    expect(room).toHaveLength(1);
    expect(room[0]!.figures[0]).toEqual({ label: 'Surface à peindre', value: '31,8 m²' });
    expect(room[0]!.orderNote).toBe('Pour toute la pose');
    expect(peintureReport({ ...input, scope: { kind: 'project' } })).toHaveLength(2);
    expect(peintureReport({ ...input, scope: { kind: 'pose', pose: 'P1' } }).map((r) => r.pose)).toEqual(['P1']);
  });

  it('élévation : murs côte à côte, partie peinte et ouvertures du mur', () => {
    const p = project();
    const e = elevationOf(p, p.zones);
    expect(e.walls.map((w) => [w.label, w.x0, w.length, w.openings.length])).toEqual([
      ['Pièce, mur 1', 0, 4000, 1],
      ['Pièce, mur 2', 4400, 3000, 1],
      ['Pièce, mur 3', 7800, 4000, 0],
      ['Pièce, mur 4', 12200, 3000, 0],
    ]);
    expect(e.width).toBe(15200);
    expect(e.height).toBe(2500);
    // mur peint sur une partie seulement : la région suit la coupe
    const cut = elevationOf(p, [
      {
        ...p.zones[0]!,
        cuts: [
          {
            line: [
              [0, 1200],
              [4000, 1200],
            ],
            side: -1,
          },
        ],
      },
    ]);
    expect(cut.walls[0]!.painted[0]!.every(([, y]) => y <= 1200)).toBe(true);
  });
});

describe('3D et PDF', () => {
  /** Aire totale des triangles d'un maillage, m². */
  function area(positions: number[]): number {
    let t = 0;
    for (let i = 0; i < positions.length; i += 9) {
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9) as number[];
      const u = [bx! - ax!, by! - ay!, bz! - az!];
      const v = [cx! - ax!, cy! - ay!, cz! - az!];
      t += Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2;
    }
    return t;
  }
  const inputOf = (p: Project, scope: ResultScope) => ({
    project: p,
    libraries,
    result: computePeinture(specOf(p)),
    scope,
  });

  it('maillage : murs peints à la couleur du produit, baies découpées, devant le plâtre', () => {
    const p = project();
    const [mesh] = peintureMeshes(inputOf(p, { kind: 'project' }));
    expect(mesh!.key).toBe('paint');
    // les 31,8068 m² nets : murs entiers moins la porte et la fenêtre
    expect(area(mesh!.positions)).toBeCloseTo(31.8068, 2);
    const ys = mesh!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(2.5 + 1e-9);
    // blanc du modèle type, en couleur linéaire
    expect(mesh!.colors[0]).toBeGreaterThan(0.8);
  });

  it('maillage : la portée limite les murs (une pièce, une pose)', () => {
    const p = project(['r', 's']);
    const all = area(peintureMeshes(inputOf(p, { kind: 'project' }))[0]!.positions);
    const room = area(peintureMeshes(inputOf(p, { kind: 'room', room: 's' }))[0]!.positions);
    const pose = area(peintureMeshes(inputOf(p, { kind: 'pose', pose: 'P0' }))[0]!.positions);
    expect(all).toBeCloseTo(2 * 31.8068, 2);
    expect(room).toBeCloseTo(31.8068, 2);
    expect(pose).toBeCloseTo(31.8068, 2);
  });

  it('maillage : mur peint à mi-hauteur seulement', () => {
    const p = project();
    const half = {
      ...p,
      zones: p.zones.map((z) =>
        z.surface.wall === 'r-w2'
          ? {
              ...z,
              cuts: [
                {
                  line: [
                    [0, 1000],
                    [4000, 1000],
                  ] as [[number, number], [number, number]],
                  side: -1 as const,
                },
              ],
            }
          : z,
      ),
    };
    // mur 3 : 4 m × 1 m au lieu de 4 m × 2,5 m
    expect(area(peintureMeshes(inputOf(half, { kind: 'project' }))[0]!.positions)).toBeCloseTo(31.8068 - 6, 2);
  });

  it('exports : les maillages se posent sur l’enveloppe (overlay)', () => {
    expect(exportsOf.overlay).toBe(true);
  });

  it('PDF : résumé, murs, pots à commander', async () => {
    const p = project();
    const d = new Doc();
    writePeintureResults(d, inputOf(p, { kind: 'project' }));
    const doc = await getDocument({ data: new Uint8Array(d.pdf.output('arraybuffer')) }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++)
      text += (await (await doc.getPage(i)).getTextContent()).items.map((x) => ('str' in x ? x.str : '')).join(' ');
    expect(text).toContain('Peinture');
    expect(text).toContain('Surface à peindre');
    expect(text).toContain('Pièce, mur 1');
    expect(text).toContain('31,8 m');
    expect(text).toMatch(/1 × 5 L \+ 2 × 1 L/);
    expect(text).toContain('69,00');
  });
});

describe('maquette 3D', () => {
  it('la peinture ne remplace pas le plâtre des murs : l’enveloppe reste entière', async () => {
    const p = project();
    const libs = await loadModel3D();
    const scope = { kind: 'project' } as const;
    const bare = modelMeshes(libs, p, scope, [], libraries);
    const entry = { module: 'peinture', project: p, result: computePeinture(specOf(p)), exports: exportsOf };
    const painted = modelMeshes(libs, p, scope, [entry], libraries);
    const verts = (ms: typeof bare, key: string) => ms.find((m) => m.key === key)?.positions.length ?? 0;
    expect(verts(painted, 'plaster')).toBe(verts(bare, 'plaster'));
    expect(verts(painted, 'paint')).toBeGreaterThan(0);
    expect(verts(bare, 'paint')).toBe(0);
  });
});
