/**
 * Documents v1 figés, tels qu'enregistrés par l'application avant la boîte à outils (phase 7).
 * Ne jamais les modifier : ils prouvent que les données des utilisateurs se migrent.
 */
const zone = {
  id: 'z1',
  size: 3,
  unit: 'rest',
  tileId: 't1',
  tileUpright: false,
  pattern: 'half',
  angle: 0,
  start: 'corner',
  offsetX: 0,
  offsetY: 0,
  mix: 'solid',
  colorB: '#3f5a6b',
  groutColor: '#8f8a83',
  photoRandomFlip: true,
};

const surface = (id: string, name: string, kind: 'wall' | 'floor', width: number, height: number) => ({
  id,
  name,
  kind,
  width,
  height,
  joint: 3,
  split: 'h',
  zones: [{ ...zone, id: 'z-' + id }],
  openings: [],
  corners: [],
  plinth: null,
  hiddenEdges: { top: true, bottom: true, left: true, right: true },
  junctionsCovered: false,
});

const settings = {
  margin: 10,
  reuseOffcuts: true,
  kerf: 2,
  minOffcut: 20,
  shadeVariation: 0.06,
  optimizerGoal: 'thin',
};

/** Mur seul, sans pièce. */
export const V1_WALL = deepFreeze({
  schemaVersion: 1,
  id: 'p-mur',
  name: 'Mur 300 × 240',
  createdAt: 1700000000000,
  updatedAt: 1700000500000,
  surfaces: [surface('s1', 'Mur', 'wall', 3000, 2400)],
  room: null,
  settings,
  prices: { 'glue|kg': 12.5 },
});

/** Salle de bain : pièce 2,4 × 1,8 m, deux murs et le sol. */
export const V1_ROOM = deepFreeze({
  schemaVersion: 1,
  id: 'p-sdb',
  name: 'Salle de bain',
  createdAt: 1700000000000,
  updatedAt: 1700000900000,
  surfaces: [
    surface('sa', 'Mur A', 'wall', 2400, 2400),
    surface('sb', 'Mur B', 'wall', 1800, 2400),
    surface('sf', 'Sol', 'floor', 2400, 1800),
  ],
  room: { length: 2400, width: 1800, height: 2500, tiledHeight: 2400, walls: { A: 'sa', B: 'sb', floor: 'sf' } },
  settings,
  prices: {},
});

/** Scénario A du mur, enregistré avec son carreau. */
export const V1_SCENARIO = deepFreeze({
  schemaVersion: 1,
  id: 'sc1',
  projectId: 'p-mur',
  slot: 'A',
  name: 'Gris',
  snapshot: {
    project: V1_WALL,
    tiles: [
      {
        schemaVersion: 1,
        id: 't1',
        name: '60 × 30 cm',
        shape: 'rect',
        length: 600,
        width: 300,
        thickness: 9,
        color: '#d8cfc2',
        photoId: null,
        m2PerBox: 1.44,
        pricePerM2: 29.9,
        orientation: 'free',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ],
  },
  metrics: null,
  thumbnailId: null,
  createdAt: 1700000600000,
});

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}
