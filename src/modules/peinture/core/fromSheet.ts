/**
 * Peinture pré-remplie d'après une fiche produit collée (docs/BOITE.md §11, B1). Pur. Une fiche décrit un pot :
 * sa contenance et son prix donnent un conditionnement. Rendement lu s'il est donné (plus petite valeur d'une
 * fourchette), sinon celui du formulaire reste.
 */
import {
  colorHex,
  findValue,
  firstNumber,
  lowestNumber,
  normalizeLabel,
  parseSheet,
  price,
  put,
  sheetText,
  volume,
  type SheetRead,
} from '../../../core/sheet';
import type { Paint } from './paint';
import type { PaintRole, PaintSheen, PaintUse } from './types';

function sheenOf(s: string): PaintSheen | null {
  if (/velours/.test(s)) return 'velvet';
  if (/satin/.test(s)) return 'satin';
  if (/brillant|laque/.test(s)) return 'gloss';
  if (/\bmat\b/.test(s)) return 'mat';
  return null;
}

export function paintFromSheet(text: string): SheetRead<Paint> {
  const sheet = parseSheet(text);
  const r: SheetRead<Paint> = { fields: {}, read: [] };
  const all = sheetText(sheet);
  const name = findValue(sheet, /^(nom|designation|titre)$/) ?? (sheet.title.length > 8 ? sheet.title : null);
  put(r, 'name', name);
  put(r, 'brand', findValue(sheet, /^marque/));

  const n = normalizeLabel(name ?? '') || all;
  const role: PaintRole = /sous-couche|primaire|impression|fixateur/.test(n)
    ? 'primer'
    : /enduit/.test(n)
      ? 'filler'
      : 'finish';
  put(r, 'role', role);
  if (role === 'finish') {
    put(r, 'sheen', sheenOf(normalizeLabel(findValue(sheet, /^aspect/, /^finition/) ?? '')) ?? sheenOf(n));
    const tint = findValue(sheet, /^nom de la teinte/, /^teinte/, /^couleur/);
    const hex = colorHex(tint);
    if (tint && hex) put(r, 'color', { name: tint, hex });
  }

  const dest = normalizeLabel([findValue(sheet, /^destination/), findValue(sheet, /^piece/)].join(' '));
  const uses: PaintUse[] = [];
  if (/mur|plafond/.test(dest)) uses.push('walls');
  if (/boiserie|porte|radiateur|bois/.test(dest)) uses.push('woodwork');
  if (/salle de bain|cuisine|humide/.test(dest)) uses.push('humid');
  put(r, 'uses', uses.length ? uses : null);

  if (role !== 'filler') put(r, 'yield', lowestNumber(findValue(sheet, /^rendement/)));
  const coats = firstNumber(findValue(sheet, /nombre de couches/, /^couches/));
  put(r, 'coats', coats !== null && coats >= 1 ? Math.round(coats) : null);

  const declared = findValue(sheet, /^capacite/, /^contenance/, /^volume/, /^poids net/);
  const size = declared !== undefined ? volume(declared) : volume(name ?? undefined, true);
  const p = price(findValue(sheet, /^prix/));
  if (size !== null && size > 0) put(r, 'packs', [{ size, price: p && p.per !== 'm2' ? p.amount : null }]);
  return r;
}
