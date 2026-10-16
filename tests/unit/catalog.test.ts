/** Catalogues de modèles types (références Leroy Merlin et génériques) : chaque entrée est valide et cohérente. */
import { describe, expect, it } from 'vitest';
import { TILE_CATALOG } from '../../src/modules/carrelage/state/catalog';
import { packMismatch, validateBoard } from '../../src/modules/parquet/core/board';
import { BOARD_CATALOG } from '../../src/modules/parquet/core/catalog';
import { PAINT_CATALOG } from '../../src/modules/peinture/core/catalog';
import { validatePaint } from '../../src/modules/peinture/core/paint';
import { libraries } from '../../src/modules/registry';
import { LEGACY_TEMPLATE_PREFIX } from '../../src/state/seeding';

describe('catalogues de modèles types', () => {
  it('au moins 20 références par bibliothèque, identifiants uniques', () => {
    for (const id of ['tiles', 'boards', 'paints']) {
      const items = libraries.find((l) => l.id === id)!.templates!();
      expect(items.length, id).toBeGreaterThanOrEqual(20);
      expect(new Set(items.map((x) => x.id)).size, id).toBe(items.length);
    }
  });

  it('les nouveaux modèles ne portent pas le préfixe des modèles d’avant B1', () => {
    for (const x of [...TILE_CATALOG, ...BOARD_CATALOG, ...PAINT_CATALOG])
      expect(x.id.startsWith(LEGACY_TEMPLATE_PREFIX), x.id).toBe(false);
  });

  it('carreaux : longueur ≥ largeur > 0, épaisseur et surface par boîte renseignées', () => {
    for (const t of TILE_CATALOG) {
      expect(t.length, t.name).toBeGreaterThanOrEqual(t.width);
      expect(t.width, t.name).toBeGreaterThan(0);
      expect(t.thickness, t.name).toBeGreaterThan(0);
      expect(t.m2PerBox, t.name).toBeGreaterThan(0);
      expect(t.color, t.name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('lames : valides et surface du paquet cohérente avec les lames', () => {
    for (const b of BOARD_CATALOG) {
      expect(validateBoard(b), b.name).toEqual([]);
      expect(packMismatch(b), b.name).toBe(false);
    }
  });

  it('peintures : valides, une finition a une teinte, un apprêt ou un enduit n’en a pas', () => {
    for (const p of PAINT_CATALOG) {
      expect(validatePaint(p), p.name).toEqual([]);
      expect(p.color !== null, p.name).toBe(p.role === 'finish');
    }
  });
});
