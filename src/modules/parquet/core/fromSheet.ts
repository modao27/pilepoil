/**
 * Lame pré-remplie d'après une fiche produit collée (docs/BOITE.md §11, B1). Pur. Le nombre de lames par paquet,
 * s'il manque, est déduit de la surface du paquet et des dimensions d'une lame.
 */
import {
  colorHex,
  findLength,
  findValue,
  firstNumber,
  parseSheet,
  productName,
  price,
  put,
  sheetText,
  type SheetRead,
} from '../../../core/sheet';
import type { Board, BoardKind } from './board';

function kindOf(text: string): BoardKind | null {
  if (/pvc|vinyle|spc|lvt/.test(text)) return 'vinyl';
  if (/stratifie/.test(text)) return 'laminate';
  if (/contrecolle|plaque/.test(text)) return 'engineered';
  if (/massif/.test(text)) return 'solid';
  return null;
}

export function boardFromSheet(text: string): SheetRead<Board> {
  const sheet = parseSheet(text);
  const r: SheetRead<Board> = { fields: {}, read: [] };
  const all = sheetText(sheet);

  put(r, 'name', productName(sheet));
  put(
    r,
    'kind',
    kindOf(findValue(sheet, /^type de (bois|sol|produit|lame)/, /^matiere/)?.toLowerCase() ?? '') ?? kindOf(all),
  );

  const length = findLength(sheet, 'cm', /^longueur/);
  const width = findLength(sheet, 'cm', /^largeur/);
  put(r, 'lengths', length !== null ? [length] : null);
  put(r, 'width', width);
  put(r, 'thickness', findLength(sheet, 'mm', /^epaisseur totale/, /^epaisseur(?!.*usure)/));

  const m2 = firstNumber(findValue(sheet, /^contenance/, /surface.*(paquet|colis|boite|pack)/));
  put(r, 'm2PerPack', m2 !== null && m2 > 0 ? m2 : null);
  let n = firstNumber(findValue(sheet, /^nombre de (lames|dalles)/, /lames par (paquet|colis|boite|pack)/));
  if (n === null && m2 && length && width) n = Math.round((m2 * 1e6) / (length * width));
  put(r, 'boardsPerPack', n !== null && n >= 1 ? Math.round(n) : null);

  const handed = /baton rompu|point de hongrie|chevron/.test(all);
  if (handed) put(r, 'handed', true);
  if (/rainure|languette|a coller|a clouer/.test(all) || handed) put(r, 'profile', 'tongue-groove');
  else if (/clip|clic|click/.test(all)) put(r, 'profile', 'click');

  const p = price(findValue(sheet, /^prix/));
  if (p) put(r, 'pricePerPack', p.per !== 'm2' ? p.amount : m2 ? Math.round(p.amount * m2 * 100) / 100 : null);
  put(r, 'color', colorHex(findValue(sheet, /^couleur/, /^teinte/, /^essence/)));
  return r;
}
