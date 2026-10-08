/**
 * Évalue une saisie numérique avec calcul simple : « 240-12 », « 2 × 60 + 3 », « 120,5 / 2 », « (300+3)*4 ».
 * Virgule ou point décimal, espaces ignorés. Renvoie null si la saisie n'est pas valide. Sans eval.
 */
export function evaluate(input: string): number | null {
  const src = input.replace(/\s+/g, '').replace(/,/g, '.').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (!src) return null;
  let i = 0;

  const peek = () => src[i];
  function expr(): number | null {
    let v = term();
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = src[i++];
      const r = term();
      if (r == null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number | null {
    let v = factor();
    while (v != null && (peek() === '*' || peek() === '/')) {
      const op = src[i++];
      const r = factor();
      if (r == null || (op === '/' && r === 0)) return null;
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function factor(): number | null {
    if (peek() === '-') {
      i++;
      const v = factor();
      return v == null ? null : -v;
    }
    if (peek() === '+') {
      i++;
      return factor();
    }
    if (peek() === '(') {
      i++;
      const v = expr();
      if (v == null || src[i++] !== ')') return null;
      return v;
    }
    const m = /^\d+(?:\.\d*)?|^\.\d+/.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  }

  const v = expr();
  return v != null && i === src.length && Number.isFinite(v) ? v : null;
}

/** Nombre affiché en français, sans zéros inutiles. */
export function formatNumber(v: number, decimals = 1): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: decimals, useGrouping: false });
}
