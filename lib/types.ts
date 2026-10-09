// Shared data contract between the API, the pipeline, and the frontend.

/** Describes a single property column found on nodes or edges. */
export interface ColumnMeta {
  /** Property key as it appears in `properties`. */
  key: string;
  /** "number" or "string" — inferred from the first non-null value. */
  type: "number" | "string";
  /** Human-readable label (defaults to `key` when absent). */
  label?: string;
  /** Minimum value when type is "number". */
  min?: number;
  /** Maximum value when type is "number". */
  max?: number;
  /** Unique values when type is "string" and cardinality is low. */
  categories?: string[];
}

export interface Node {
  id: string;
  /** [longitude, latitude] � GeoJSON order */
  coords: [number, number];
  name?: string;
  properties?: Record<string, number | string | boolean | null>;
}

export interface Edge {
  id: string;
  /** Node.id */
  source: string;
  /** Node.id */
  target: string;
  /** Flow volume, trip count, or other magnitude */
  weight: number;
  /** ISO 8601 timestamp or bucket label, for time-aware views */
  t?: string;
  properties?: Record<string, number | string | boolean | null>;
}

export interface DatasetMeta {
  id: string;
  name: string;
  description: string;
  /** Where the data came from */
  source: string;
  /** e.g. "Gainesville, FL" */
  region: string;
  /** True if any edge carries a `t` value */
  temporal: boolean;
  nodeCount: number;
  edgeCount: number;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
  /** Property columns available on nodes. */
  nodeColumns?: ColumnMeta[];
  /** Property columns available on edges. */
  edgeColumns?: ColumnMeta[];
}

/** GET /api/datasets */
export type CatalogResponse = DatasetMeta[];

/** GET /api/datasets/[id] */
export interface DatasetResponse {
  meta: DatasetMeta;
  nodes: Node[];
  edges: Edge[];
}
