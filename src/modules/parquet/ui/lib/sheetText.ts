/** Textes de la fiche de coupe et des quantités (écran Résultats et PDF). */
import type { BarCut } from '../../../../core/cutting/bars';
import type { ShoppingLine } from '../../../../core/shopping/types';
import type { SheetGroup, SheetItem } from '../../core/sheet';

const fr = (v: number, d = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: d });
const mm = (v: number) => `${fr(v)} mm`;

/** « C-07 » : identifiant de chute sans le préfixe de la pose. */
export const shortOffcut = (id: string) => id.slice(Math.max(0, id.lastIndexOf('C-')));

export function groupTitle(g: SheetGroup, roomName: (id: string) => string): string {
  return `${roomName(g.room)} — ${g.kind === 'row' ? 'rang' : 'ligne'} ${g.index + 1}`;
}

const variantOf = (v: 'A' | 'B' | null, many = false) => (v ? ` ${many ? 'lames' : 'lame'} ${v}` : '');

/** Une ligne de la fiche : « 6. lame neuve → couper à 842 mm · la chute C-12 (358 mm) va au stock ». */
export function itemText(it: SheetItem, groups: SheetGroup[], roomName: (id: string) => string): string {
  if (it.kind === 'full')
    return it.count === 1
      ? `${it.from}. lame entière${it.variant ? ` ${it.variant}` : ''}`
      : `${it.from}–${it.to}. lames entières × ${it.count}${it.variant ? ` (${variantOf(it.variant, true).trim()})` : ''}`;
  let src: string;
  if ('offcut' in it.source) {
    const o = it.origin && groups[it.origin.group];
    const from = o ? ` (vient de ${groupTitle(o, roomName)}, n° ${it.origin!.n})` : '';
    src = `chute ${shortOffcut(it.source.offcut)}${from}`;
  } else src = `lame neuve${it.variant ? ` ${it.variant}` : ''}`;
  let detail = '';
  if (it.width != null) detail += `, recoupée à ${mm(it.width)} de large`;
  if (it.cutType === 'angled')
    detail += it.edges ? `, coupe en biais (rives ${fr(it.edges[0])} et ${mm(it.edges[1])})` : ', coupe en biais';
  if (it.sameAs) {
    const g = groups[it.sameAs.group];
    const here = g && groups.indexOf(g) === groups.findIndex((x) => x.items.includes(it));
    detail +=
      here || !g
        ? `, même croquis que le n° ${it.sameAs.n}`
        : `, même croquis que ${groupTitle(g, roomName)}, n° ${it.sameAs.n}`;
  }
  if (it.cutType === 'complex') detail += ', découpe à tracer sur place';
  const rest = it.rest.map((r) => ` · la chute ${shortOffcut(r.id)} (${mm(r.length)}) va au stock`).join('');
  if (it.wholeLength)
    return `${it.n}. lame entière${it.variant ? ` ${it.variant}` : ''}${detail.replace(/^, /, ' ')}${rest}`;
  return `${it.n}. ${src} → couper à ${mm(it.length)}${detail}${rest}`;
}

/** « Séjour mur 2 (1/2) » : coupe de plinthe, d'après l'identifiant du morceau (pièce-M<mur>-<n>). */
export function skirtingCutText(c: BarCut, roomName: (id: string) => string): string {
  const m = /^(.*)-(M|O)(\d+)-\d+$/.exec(c.id);
  const where = m ? `${roomName(m[1]!)} ${m[2] === 'M' ? 'mur' : 'obstacle'} ${m[3]}` : c.id;
  return `${mm(c.length)} ${where}${c.parts > 1 ? ` (morceau ${c.part}/${c.parts})` : ''}`;
}

const UNIT: Record<ShoppingLine['unit'], [string, string]> = {
  pack: ['paquet', 'paquets'],
  box: ['carton', 'cartons'],
  roll: ['rouleau', 'rouleaux'],
  bar: ['barre', 'barres'],
  bag: ['sac', 'sacs'],
  sachet: ['sachet', 'sachets'],
  tube: ['tube', 'tubes'],
  cartridge: ['cartouche', 'cartouches'],
  litre: ['litre', 'litres'],
  piece: ['pièce', 'pièces'],
  m2: ['m²', 'm²'],
  m: ['m', 'm'],
};

/** « 7 paquets », « 1 rouleau ». */
export const quantityText = (l: ShoppingLine) => `${fr(l.quantity, 2)} ${UNIT[l.unit][l.quantity > 1 ? 1 : 0]}`;
