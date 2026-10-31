// Point shapes for the "Shape" style. Each shape is a polygon in unit
// coordinates (radius ~1, y down), drawn as SVG in the legend and as an SDF
// icon on the map so MapLibre can recolour and outline it per point.

export const SHAPES = ["circle", "square", "triangle", "diamond", "star", "cross"] as const;
export type ShapeName = (typeof SHAPES)[number];

type Point = [number, number];

function regular(count: number, radius: number, rotation = -Math.PI / 2): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rotation + (i / count) * Math.PI * 2;
    return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
}

function star(): Point[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 1.2 : 0.5;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

function cross(): Point[] {
  const w = 0.32, e = 1.0;
  return [[-w, -e], [w, -e], [w, -w], [e, -w], [e, w], [w, w], [w, e], [-w, e], [-w, w], [-e, w], [-e, -w], [-w, -w]];
}

export const SHAPE_POLYGONS: Record<ShapeName, Point[]> = {
  circle: regular(48, 1),
  square: [[-0.88, -0.88], [0.88, -0.88], [0.88, 0.88], [-0.88, 0.88]],
  triangle: [[0, -1.05], [1.1, 0.85], [-1.1, 0.85]],
  diamond: [[0, -1.15], [1.15, 0], [0, 1.15], [-1.15, 0]],
  star: star(),
  cross: cross(),
};

/** SVG `points` attribute for a shape drawn in a `size`×`size` box. */
export function shapePoints(shape: ShapeName, size: number) {
  const scale = size / 2 / 1.2;
  return SHAPE_POLYGONS[shape]
    .map(([x, y]) => `${(size / 2 + x * scale).toFixed(2)},${(size / 2 + y * scale).toFixed(2)}`)
    .join(" ");
}

// ---------- SDF icons ----------

/** Image size, in image pixels. Icons are added with pixelRatio 2. */
const IMAGE_SIZE = 112;
/** Unit radius in image pixels: a size-1 icon has a 12 CSS px radius. */
const UNIT_RADIUS = 24;
export const ICON_UNIT_RADIUS_CSS = UNIT_RADIUS / 2;
/** MapLibre's SDF shader expects 1/8 of the value range per pixel, edge at 0.75. */
const SDF_RADIUS = 8;

export const shapeImageName = (shape: ShapeName) => `gn-shape-${shape}`;

function distanceToSegment(px: number, py: number, [ax, ay]: Point, [bx, by]: Point) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function inside(px: number, py: number, poly: Point[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Single-channel signed distance field for a shape, as RGBA image data. */
export const shapeSdf = (shape: ShapeName) => polygonSdf(SHAPE_POLYGONS[shape]);

// Notched arrowhead pointing along +x: placed on a flow line, it points the
// way the flow goes.
const ARROW: Point[] = [[1.1, 0], [-0.8, -0.85], [-0.35, 0], [-0.8, 0.85]];
export const ARROW_IMAGE = "gn-arrow";
export const arrowSdf = () => polygonSdf(ARROW);

function polygonSdf(unitPoly: Point[]) {
  const poly = unitPoly.map(([x, y]) => [x * UNIT_RADIUS, y * UNIT_RADIUS] as Point);
  const data = new Uint8Array(IMAGE_SIZE * IMAGE_SIZE * 4);
  const c = IMAGE_SIZE / 2;
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      const px = x + 0.5 - c, py = y + 0.5 - c;
      let d = Infinity;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        d = Math.min(d, distanceToSegment(px, py, poly[j], poly[i]));
      }
      if (inside(px, py, poly)) d = -d;
      const value = Math.round(255 * (0.75 - d / SDF_RADIUS));
      data[(y * IMAGE_SIZE + x) * 4 + 3] = Math.max(0, Math.min(255, value));
    }
  }
  return { width: IMAGE_SIZE, height: IMAGE_SIZE, data };
}
