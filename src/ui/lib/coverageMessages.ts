/** Textes des refus de zone ou de pose (règles communes du projet), pour tous les modules. */
import type { CoverageError } from '../../core/coverage';

/** Refus d'une zone ou d'une pose (règles du projet, docs/NAVIGATION.md §4). */
export function coverageText(e: CoverageError): string {
  switch (e.code) {
    case 'surface-missing':
      return 'Cette surface n’existe plus dans le plan.';
    case 'surface-unsupported':
      return 'Ce revêtement ne se pose pas sur ce type de surface.';
    case 'zone-empty':
      return 'La zone est vide : vérifiez les cotes.';
    case 'zone-overlap':
      return 'Cette surface a déjà un autre revêtement. Retirez-le d’abord.';
    case 'pose-mixed':
      return 'Une même pose ne couvre pas à la fois un sol et un mur.';
    case 'pose-extent':
      return 'Cette pose ne peut pas s’étendre à cette surface (pièce non reliée par un passage, ou autre surface).';
  }
}
