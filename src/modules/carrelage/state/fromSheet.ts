/**
 * Carreau pré-rempli d'après une fiche produit collée (docs/BOITE.md §11, B1). Pur. Les champs non lus restent
 * ceux du formulaire ; rien n'est enregistré sans validation.
 */
import {
  colorHex,
  dimensionsMm,
  findLength,
  findValue,
  firstNumber,
  normalizeLabel,
  parseSheet,
  price,
  put,
  sheetText,
  type SheetRead,
} from '../../../core/sheet';
import type { Tile } from './model';

export function tileFromSheet(text: string): SheetRead<Tile> {
  const sheet = parseSheet(text);
  const r: SheetRead<Tile> = { fields: {}, read: [] };

  put(r, 'name', findValue(sheet, /^(nom|designation|titre)$/) ?? (sheet.title.length > 8 ? sheet.title : null));

  let length = findLength(sheet, 'cm', /^longueur(?!.*joint)/);
  let width = findLength(sheet, 'cm', /^largeur(?!.*joint)/);
  if (length === null || width === null) {
    const dims = dimensionsMm(findValue(sheet, /^(format|dimensions?)\b/) ?? sheet.title);
    if (dims) [length, width] = dims;
  }
  if (length !== null && width !== null && width > length) [length, width] = [width, length];
  put(r, 'thickness', findLength(sheet, 'mm', /^epaisseur(?!.*usure)/));

  const shape = normalizeLabel(findValue(sheet, /^forme/) ?? '') || sheetText(sheet);
  const hex = /hexagon|tomette/.test(shape);
  if (hex || /octogon/.test(shape)) {
    put(r, 'shape', hex ? 'hex' : 'octo');
    if (length !== null) width = length;
  }
  put(r, 'length', length);
  put(r, 'width', width);

  const m2 = firstNumber(
    findValue(sheet, /^contenance/, /surface.*(boite|carton|colis|paquet)/, /m(²|2) par (boite|carton|colis)/),
  );
  put(r, 'm2PerBox', m2 !== null && m2 > 0 ? m2 : null);

  const p = price(findValue(sheet, /^prix/));
  if (p) put(r, 'pricePerM2', p.per !== 'pack' ? p.amount : m2 ? Math.round((p.amount / m2) * 100) / 100 : null);
  put(r, 'color', colorHex(findValue(sheet, /^couleur/, /^teinte/, /^coloris$/)));
  return r;
}
