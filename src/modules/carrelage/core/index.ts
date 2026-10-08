/** API publique du moteur de calepinage. */
export * from './types';
export { EPS } from '../../../core/constants';
export { hash } from '../../../core/hash';
export { area, bbox, centroid, pointInPolygon } from '../../../core/geometry/polygon';
export { snapOffset, type SnapResult } from './layout/snap';
export { PATTERNS, pattern } from './patterns/registry';
export type { PatternModule, PatternGeo, Cell } from './patterns/types';
export { layoutZones, rowThickness, zoneLength, type ZoneLayout, type ZoneRect } from './layout/zones';
export { OPENING_DEFAULTS, hasReveal, isCutout, openingRect } from './layout/openings';
export type { RevealGeometry } from './layout/reveals';
export {
  buildSurface,
  validateSurface,
  MAX_TILES,
  type SurfaceBuild,
  type SurfaceResult,
} from './cutting/buildSurface';
export { planCuts } from './cutting/planCuts';
export { computeProject, type ProjectResult } from './project';
export { glueAdvice, type GlueAdvice, type GlueNote, type Notch } from './rules/glue';
export { orderLine, metrics, type Metrics, type OrderLine } from './shopping/order';
export { shoppingItems, edgeLengths, type ShoppingItem, type PriceUnit } from './shopping/items';
export type { ZoneGlue } from './shopping/glue';
export { evaluateZone, scoreOf, type ZoneScore, type ZonePlacement } from './optimizer/evaluate';
export { optimizeZones, optimizeZonesSync, type OptimizeProgress, type OptimizeResult } from './optimizer/optimize';
