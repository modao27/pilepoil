/** Affichage des nombres avec leur unité (conventions de CLAUDE.md). */
const fr = (v: number, max = 1, min = 0) =>
  v.toLocaleString('fr-FR', { maximumFractionDigits: max, minimumFractionDigits: min });

/** Carreaux et coupes : mm. */
export const mm = (v: number) => `${fr(v)} mm`;
/** Surfaces, ouvertures, zones : cm. */
export const cm = (v: number) => `${fr(v / 10)} cm`;
export const m2 = (v: number) => `${fr(v, 2)} m²`;
export const euros = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
export const count = (n: number, one: string, many: string) => `${fr(n, 0)} ${n > 1 ? many : one}`;

/** Dimensions d'un carreau « 60 × 30 cm » (entiers en cm, sinon mm). */
export function tileSize(length: number, width: number, shape: string): string {
  const unitCm = length % 10 === 0 && width % 10 === 0;
  const f = (v: number) => (unitCm ? fr(v / 10) : fr(v));
  const u = unitCm ? 'cm' : 'mm';
  return shape === 'hex' || shape === 'octo' ? `${f(length)} ${u}` : `${f(length)} × ${f(width)} ${u}`;
}

export function dateShort(ms: number): string {
  const d = new Date(ms),
    now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? 'aujourd’hui à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      });
}
