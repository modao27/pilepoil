/**
 * Encollage indicatif, pose intérieure (repères NF DTU 52.2 et fiches mortiers-colles) [glueAdvice].
 * S = surface d'un carreau en cm².
 */

export type Notch = 'U3' | 'U6' | 'U9' | 'U9-or-DL20' | 'DL20';
/** mosaic : peigne fin ; deformable : C2 S1 conseillé ; large-format : C2 S1, support très plan ;
 *  beyond-dtu : hors DTU, avis technique du fabricant ; elongated : double encollage contre le tuilage. */
export type GlueNote = 'mosaic' | 'deformable' | 'large-format' | 'beyond-dtu' | 'elongated';

export interface GlueAdvice {
  notch: Notch;
  double: boolean;
  /** Consommation en kg/m², double encollage compris. */
  kgPerM2: number;
  notes: GlueNote[];
  /** Surface d'un carreau en cm². */
  S: number;
}

/** Consommation de base par spatule (kg/m²) ; +1,5 en double encollage. */
export const DOUBLE_GLUE_EXTRA = 1.5;

export function glueAdvice(tileArea: number, fw: number, fh: number, kind: 'wall' | 'floor'): GlueAdvice {
  const S = tileArea / 100,
    floor = kind === 'floor';
  const long = Math.max(fw, fh),
    short = Math.min(fw, fh),
    ratio = short > 0 ? long / short : 1;
  let notch: Notch, dbl: boolean, kg: number;
  const notes: GlueNote[] = [];
  if (S <= 50) {
    notch = 'U3';
    dbl = false;
    kg = 2;
    notes.push('mosaic');
  } else if (S <= 500) {
    notch = 'U6';
    dbl = false;
    kg = 3;
  } else if (floor && S <= 1100) {
    notch = 'U9';
    dbl = false;
    kg = 4.5;
  } else if (S <= 2200) {
    notch = 'U9';
    dbl = true;
    kg = 4.5;
  } else if (S <= 3600) {
    notch = floor ? 'U9-or-DL20' : 'U9';
    dbl = true;
    kg = floor ? 6 : 5;
    notes.push('deformable');
  } else if (floor && S <= 10000) {
    notch = 'DL20';
    dbl = true;
    kg = 7.5;
    notes.push('large-format');
  } else {
    notch = 'DL20';
    dbl = true;
    kg = 7.5;
    notes.push('beyond-dtu');
  }
  if (!dbl && ratio >= 3 && long >= 600) {
    dbl = true;
    notes.push('elongated');
  }
  if (dbl) kg += DOUBLE_GLUE_EXTRA;
  return { notch, double: dbl, kgPerM2: kg, notes, S };
}

/** Colle vendue en sacs de 25 kg. */
export const GLUE_BAG_KG = 25;
