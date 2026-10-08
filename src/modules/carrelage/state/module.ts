/** Fonctions du contrat de module (docs/BOITE.md §2) propres au carrelage, hors écrans. */
import { bbox } from '../../../core/geometry/polygon';
import type { Plan } from '../../../core/plan/types';
import type { Project, Tile } from '../../../state/model';
import type { Libraries, ModuleError, ModuleSummary } from '../../types';
import { count, m2 } from '../../../ui/lib/format';
import type { ProjectResult, ProjectSpec } from '../core';
import { carrelageView, DEFAULT_SETTINGS, type CarrelageData } from './data';
import { createSurface } from './factories';
import { toProjectSpec } from './selectors';

/**
 * Données initiales quand on active le carrelage sur un projet : un sol aux dimensions de la première pièce
 * du plan (sinon un mur 300 × 240), sans carreau choisi (l'éditeur demande d'en choisir un).
 */
export function create(plan: Plan): CarrelageData {
  const room = plan.rooms[0];
  const surface = room
    ? (() => {
        const [x0, x1, y0, y1] = bbox(room.outline);
        return createSurface('', { name: 'Sol', kind: 'floor', width: x1 - x0, height: y1 - y0 });
      })()
    : createSurface('');
  return { surfaces: [surface], room: null, settings: { ...DEFAULT_SETTINGS }, prices: {} };
}

/** Projet → entrée du moteur ; bibliothèque de carreaux sous `libraries.tiles`. */
export function toSpec(project: Project, libraries: Libraries): { spec: ProjectSpec } | { errors: ModuleError[] } {
  const view = carrelageView(project);
  if (!view) return { errors: [{ code: 'carrelage/absent' }] };
  return { spec: toProjectSpec(view, (libraries.tiles ?? []) as readonly Tile[]).spec };
}

/** « 46 carreaux, 12,4 m² » ; alertes : coupes fines et surfaces en erreur. */
export function summary(result: ProjectResult): ModuleSummary {
  const m = result.metrics;
  return {
    text: `${count(m.order, 'carreau', 'carreaux')}, ${m2(m.m2)}`,
    alerts: m.thin + result.surfaces.filter((s) => !s.ok).length,
  };
}
