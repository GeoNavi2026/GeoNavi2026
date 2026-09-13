// Shared data contract between the API, the pipeline, and the frontend.

export interface Node {
  id: string;
  /** [longitude, latitude] — GeoJSON order */
  coords: [number, number];
  name?: string;
  properties?: Record<string, number | string>;
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
  properties?: Record<string, number | string>;
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
}

/** GET /api/datasets */
export type CatalogResponse = DatasetMeta[];

/** GET /api/datasets/[id] */
export interface DatasetResponse {
  meta: DatasetMeta;
  nodes: Node[];
  edges: Edge[];
}
