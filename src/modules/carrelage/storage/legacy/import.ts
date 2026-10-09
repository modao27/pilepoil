import type { Id, Photo } from '../../../../state/model';
import type { Tile } from '../../state/model';
import type { Db } from '../../../../storage/db';
import { getPref, putItem, saveProject, savePhoto, setPref } from '../../../../storage/repo';
import { migrateProject } from '../../../../storage/migrations';
import { convertLegacy } from './convert';
import { LEGACY_EXPORT_FORMAT, LEGACY_KEYS, type LegacyStorage } from './format';

export interface ImportSummary {
  projectId: Id | null;
  surfaces: number;
  tiles: number;
  photos: number;
  scenarios: number;
  palette: boolean;
}

/** Lit les clés legacy d'un localStorage (même origine que legacy). */
export function readLocalStorage(ls: Pick<Storage, 'getItem'>): LegacyStorage {
  const out = {} as LegacyStorage;
  for (const k of LEGACY_KEYS) {
    try {
      out[k] = ls.getItem(k);
    } catch {
      out[k] = null;
    }
  }
  return out;
}

export class LegacyFileError extends Error {}

/** Lit un fichier « Exporter mes données » de legacy. */
export function parseLegacyExport(text: string): LegacyStorage {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    throw new LegacyFileError('Ce fichier n’est pas un export de l’ancienne version : contenu illisible.');
  }
  const f = o as { format?: unknown; data?: Record<string, unknown> };
  if (f?.format !== LEGACY_EXPORT_FORMAT || !f.data || typeof f.data !== 'object') {
    throw new LegacyFileError('Ce fichier n’est pas un export de l’ancienne version. Choisissez le fichier « calepinage-export ».');
  }
  const out = {} as LegacyStorage;
  for (const k of LEGACY_KEYS) out[k] = typeof f.data[k] === 'string' ? (f.data[k] as string) : null;
  return out;
}

/** dataURL base64 → Blob, sans réseau. */
export function dataUrlToBlob(url: string): Blob {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error('Image illisible.');
  const data = m[2] ? atob(m[3]!) : decodeURIComponent(m[3]!);
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

async function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== 'function') return { width: 0, height: 0 };
  try {
    const bmp = await createImageBitmap(blob);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: 0, height: 0 };
  }
}

/** Convertit et écrit les données legacy. Renvoie null s'il n'y a rien à importer. */
export async function importLegacy(db: Db, store: LegacyStorage, now = Date.now()): Promise<ImportSummary | null> {
  const r = convertLegacy(store, now);
  if (!r.project && !r.palette) return null;
  const saved = new Set<Id>();
  for (const p of r.photos) {
    try {
      const blob = dataUrlToBlob(p.dataUrl);
      const photo: Photo = { id: p.id, blob, ...(await imageSize(blob)), createdAt: now };
      await savePhoto(db, photo);
      saved.add(p.id);
    } catch {
      // photo illisible : le carreau garde sa couleur, la référence est retirée plus bas
    }
  }
  const ref = (id: Id | null) => (id && saved.has(id) ? id : null);
  const fixTile = (t: Tile): Tile => (t.photoId === ref(t.photoId) ? t : { ...t, photoId: null });
  for (const t of r.tiles) await putItem(db, 'tiles', fixTile(t));
  // projet v1 : migré avant écriture (plan gardé, carrelage vide : pas de conversion, PLAN C2) ; scénarios ignorés
  if (r.project) await saveProject(db, migrateProject(r.project).doc);
  const photos = saved.size;
  if (r.palette) await setPref(db, 'palette', r.palette);
  if (r.project) await setPref(db, 'lastProjectId', r.project.id);
  await setPref(db, 'legacyImport', { at: now, projectId: r.project?.id ?? null });
  return {
    projectId: r.project?.id ?? null,
    surfaces: r.project?.surfaces.length ?? 0,
    tiles: r.tiles.length,
    photos,
    scenarios: 0,
    palette: !!r.palette,
  };
}

/**
 * Import automatique au premier lancement : une seule fois, et seulement si legacy a laissé des données
 * dans le localStorage de cette origine. Les clés legacy ne sont jamais effacées.
 */
export async function autoImportLegacy(db: Db, ls: Pick<Storage, 'getItem'>): Promise<ImportSummary | null> {
  if (await getPref(db, 'legacyImport')) return null;
  return importLegacy(db, readLocalStorage(ls));
}

/**
 * Message après import : « Données de l'ancienne version importées : 2 carreaux. Le carrelage est à refaire sur
 * le plan. » (les surfaces ne sont pas converties, PLAN C2).
 */
export function importMessage(s: ImportSummary): string {
  const tiles = `${s.tiles} carreau${s.tiles > 1 ? 'x' : ''}`;
  return `Données de l’ancienne version importées : ${tiles}.${s.surfaces ? ' Le carrelage est à refaire sur le plan.' : ''}`;
}
