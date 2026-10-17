/** État → entrée moteur de la maçonnerie : sans mur pour l'instant (murets : phase suivante). */
import type { ModuleError } from '../../types';
import type { MaconnerieSpec } from '../core/compute';

export function toSpec(): { spec: MaconnerieSpec } | { errors: ModuleError[] } {
  return { errors: [{ code: 'maconnerie/no-wall' }] };
}
