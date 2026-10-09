/**
 * Projet v1 (sortie de l'import legacy) → entrée du moteur, comme avant le carrelage bâti sur le plan :
 * surfaces rectangulaires avec leurs angles, pièce A–D. Sert au test de parité de l'import.
 */
import type { ProjectSpec, RoomSpec } from '../../src/modules/carrelage/core';
import type { CarrelageProjectV1, Tile } from '../../src/modules/carrelage/state/model';
import { surfaceSpec } from '../../src/modules/carrelage/state/selectors';

export function v1Spec(p: CarrelageProjectV1, library: readonly Tile[]): { spec: ProjectSpec; missing: string[] } {
  const tiles = new Map(library.map((t) => [t.id, t]));
  const index = new Map(p.surfaces.map((s, i) => [s.id, i]));
  const missing = p.surfaces.flatMap((s) => s.zones.filter((z) => !tiles.has(z.tileId)).map((z) => z.id));
  let room: RoomSpec | null = null;
  if (p.room) {
    const walls: RoomSpec['walls'] = {};
    for (const [k, id] of Object.entries(p.room.walls)) {
      const i = id != null ? index.get(id) : undefined;
      if (i != null) walls[k as keyof RoomSpec['walls']] = i;
    }
    room = { length: p.room.length, width: p.room.width, walls };
  }
  const { margin, reuseOffcuts, kerf, minOffcut } = p.settings;
  return {
    spec: {
      surfaces: p.surfaces.map((s) => surfaceSpec(s, tiles)),
      settings: { margin, reuseOffcuts, kerf, minOffcut },
      room,
    },
    missing,
  };
}
