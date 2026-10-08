/** Types de géométrie de base, communs à tous les modules. Unités : mm, y vers le bas. */

export type Point = [number, number];
export type Polygon = Point[];
export type Segment = [Point, Point];
/** Boîte englobante [x0, x1, y0, y1]. */
export type BBox = [number, number, number, number];
