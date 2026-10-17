import {
  MATERIAL_SCHEMA,
  type Binder,
  type JointRange,
  type LayingTechnique,
  type Material,
  type MaterialFamily,
} from './types';

export { MATERIAL_SCHEMA };

export const FAMILY_LABEL: Record<MaterialFamily, string> = {
  parpaing: 'Parpaing',
  brique: 'Brique',
  'beton-cellulaire': 'Béton cellulaire',
  'carreau-platre': 'Carreau de plâtre',
  'pave-verre': 'Brique de verre',
};

export const BINDER_LABEL: Record<Binder, string> = {
  mortier: 'Mortier',
  'mortier-semi-epais': 'Mortier semi-épais',
  'joint-mince': 'Colle à joint mince',
  colle: 'Colle',
  'mortier-colle': 'Mortier-colle',
};

const joint = (min: number, def: number, max: number): JointRange => ({ min, def, max });

/** Technique par défaut d'une famille (valeurs indicatives : docs/materiaux/SPEC.md). */
export function defaultLaying(family: MaterialFamily): LayingTechnique {
  switch (family) {
    case 'parpaing':
    case 'brique':
      return {
        jointH: joint(10, 12, 15),
        jointV: null,
        bond: 'running',
        minOverlap: 100,
        binder: 'mortier',
        binderPerM2: null,
        cutAllowed: true,
        reinforcement: null,
      };
    case 'beton-cellulaire':
      return {
        jointH: joint(1, 3, 3),
        jointV: null,
        bond: 'running',
        minOverlap: 100,
        binder: 'joint-mince',
        binderPerM2: null,
        cutAllowed: true,
        reinforcement: null,
      };
    case 'carreau-platre':
      return {
        jointH: joint(1, 3, 5),
        jointV: joint(1, 3, 5),
        bond: 'running',
        minOverlap: 100,
        binder: 'colle',
        binderPerM2: null,
        cutAllowed: true,
        reinforcement: null,
      };
    case 'pave-verre':
      return {
        jointH: joint(10, 15, 30),
        jointV: joint(10, 15, 30),
        bond: 'stack',
        minOverlap: 0,
        binder: 'mortier',
        binderPerM2: null,
        cutAllowed: false,
        reinforcement: { diameter: { min: 4.5, max: 6 }, minCover: 15 },
      };
  }
}

export function createMaterial(id: string, now: number, o: Partial<Material> = {}): Material {
  const family = o.family ?? 'parpaing';
  return {
    schemaVersion: MATERIAL_SCHEMA,
    id,
    name: '',
    family,
    length: 500,
    height: 200,
    thickness: 200,
    weight: null,
    laying: defaultLaying(family),
    createdAt: now,
    updatedAt: now,
    ...o,
  };
}

interface Template {
  name: string;
  family: MaterialFamily;
  length: number;
  height: number;
  thickness: number;
  weight?: number;
  binder?: Partial<LayingTechnique>;
}

/**
 * Modèles types (relevé fabricants du 2026-10-17, indicatif). Sans poids ni liant : fiche sans source trouvée, à
 * compléter dans la bibliothèque.
 */
const TEMPLATES: Template[] = [
  {
    name: 'Parpaing creux 20×20×50',
    family: 'parpaing',
    length: 500,
    height: 200,
    thickness: 200,
    weight: 17,
    binder: { binderPerM2: 37.5 },
  },
  { name: 'Parpaing creux 15×20×50', family: 'parpaing', length: 500, height: 200, thickness: 150, weight: 13.8 },
  { name: 'Parpaing creux 10×20×50', family: 'parpaing', length: 500, height: 200, thickness: 100, weight: 9.9 },
  { name: 'Parpaing creux 7,5×20×50', family: 'parpaing', length: 500, height: 200, thickness: 75, weight: 8.3 },
  { name: 'Parpaing plein 20×20×50', family: 'parpaing', length: 500, height: 200, thickness: 200 },
  { name: 'Parpaing plein 10×20×50', family: 'parpaing', length: 500, height: 200, thickness: 100 },
  { name: 'Brique de cloison 5 cm', family: 'brique', length: 400, height: 200, thickness: 50 },
  { name: 'Brique plâtrière 7 cm', family: 'brique', length: 400, height: 200, thickness: 70 },
  { name: 'Brique alvéolaire 20 cm', family: 'brique', length: 500, height: 250, thickness: 200 },
  { name: 'Brique monomur 30 cm', family: 'brique', length: 500, height: 250, thickness: 300 },
  { name: 'Béton cellulaire 7,5 cm', family: 'beton-cellulaire', length: 600, height: 250, thickness: 75 },
  {
    name: 'Béton cellulaire 10 cm',
    family: 'beton-cellulaire',
    length: 600,
    height: 250,
    thickness: 100,
    binder: { binderPerM2: 2.6 },
  },
  {
    name: 'Béton cellulaire 15 cm',
    family: 'beton-cellulaire',
    length: 600,
    height: 250,
    thickness: 150,
    binder: { binder: 'mortier-colle', binderPerM2: 5.25 },
  },
  {
    name: 'Béton cellulaire 20 cm',
    family: 'beton-cellulaire',
    length: 600,
    height: 250,
    thickness: 200,
    binder: { binder: 'mortier-colle', binderPerM2: 7.25 },
  },
  { name: 'Carreau de plâtre 5 cm', family: 'carreau-platre', length: 660, height: 500, thickness: 50 },
  {
    name: 'Carreau de plâtre 7 cm',
    family: 'carreau-platre',
    length: 660,
    height: 500,
    thickness: 70,
    weight: 23.15,
    binder: { binderPerM2: 1.8 },
  },
  {
    name: 'Carreau de plâtre 10 cm',
    family: 'carreau-platre',
    length: 660,
    height: 500,
    thickness: 100,
    weight: 33,
    binder: { binderPerM2: 1.8 },
  },
  { name: 'Brique de verre 19×19×8', family: 'pave-verre', length: 190, height: 190, thickness: 80, weight: 2.4 },
  {
    name: 'Brique de verre 19×19×8 colorée',
    family: 'pave-verre',
    length: 190,
    height: 190,
    thickness: 80,
    weight: 2.4,
  },
  {
    name: 'Brique de verre 19×19×8 texturée',
    family: 'pave-verre',
    length: 190,
    height: 190,
    thickness: 80,
    weight: 2.4,
  },
  { name: 'Brique de verre 24×24×8', family: 'pave-verre', length: 240, height: 240, thickness: 80, weight: 2.4 },
  { name: 'Brique de verre 30×30×10', family: 'pave-verre', length: 300, height: 300, thickness: 100 },
];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Modèles types de la bibliothèque (posés une seule fois ; un modèle supprimé ne revient pas). */
export function templateMaterials(now = 0): Material[] {
  return TEMPLATES.map((t) => {
    const laying = { ...defaultLaying(t.family), ...t.binder };
    return createMaterial(`modele-${slug(t.name)}`, now, {
      name: t.name,
      family: t.family,
      length: t.length,
      height: t.height,
      thickness: t.thickness,
      weight: t.weight ?? null,
      laying,
    });
  });
}

/** Erreurs d'un matériau : codes (le texte est écrit par l'interface). */
export function validateMaterial(m: Material): string[] {
  const out: string[] = [];
  if (!m.name.trim()) out.push('name');
  if (!(m.length > 0)) out.push('length');
  if (!(m.height > 0)) out.push('height');
  if (!(m.thickness > 0)) out.push('thickness');
  const j = m.laying.jointH;
  if (!(j.min >= 0 && j.min <= j.def && j.def <= j.max)) out.push('joint');
  return out;
}
