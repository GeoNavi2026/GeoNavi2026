// Converts a DatasetResponse into GeoJSON the map can render.

import type { FeatureCollection, LineString, Point } from "geojson";
import type { DatasetResponse } from "./types";

export interface NodeProps {
  id: string;
  name: string;
}

export interface EdgeProps {
  id: string;
  source: string;
  target: string;
  sourceName: string;
  targetName: string;
  weight: number;
  /** weight / max weight in the dataset, 0..1, for styling */
  norm: number;
}

export function toGeoJson(dataset: DatasetResponse) {
  const byId = new Map(dataset.nodes.map((n) => [n.id, n]));
  const maxWeight = dataset.edges.reduce(
    (max, edge) => Math.max(max, edge.weight),
    1
  );

  const nodes: FeatureCollection<Point, NodeProps> = {
    type: "FeatureCollection",
    features: dataset.nodes.map((n) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: n.coords },
      properties: { id: n.id, name: n.name ?? n.id },
    })),
  };

  const edges: FeatureCollection<LineString, EdgeProps> = {
    type: "FeatureCollection",
    features: [],
  };

  for (const e of dataset.edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    // Edges only reference node ids; skip any that point at missing nodes.
    if (!source || !target) continue;
    edges.features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [source.coords, target.coords] },
      properties: {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceName: source.name ?? source.id,
        targetName: target.name ?? target.id,
        weight: e.weight,
        norm: e.weight / maxWeight,
      },
    });
  }

  return { nodes, edges };
}
