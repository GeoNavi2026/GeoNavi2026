import { describe, expect, it } from "vitest";
import { extractColumns } from "../lib/column-meta";
import { toGeoJson } from "../lib/to-geojson";
import type { DatasetResponse } from "../lib/types";

const dataset: DatasetResponse = {
  meta: {
    id: "test",
    name: "Test",
    description: "Test",
    source: "test",
    region: "Test",
    temporal: false,
    nodeCount: 2,
    edgeCount: 2,
    bbox: [0, 0, 1, 1],
  },
  nodes: [
    { id: "a", coords: [0, 0], name: "Alpha", properties: { score: 2, group: "B" } },
    { id: "b", coords: [1, 1], properties: { score: 8, group: "A" } },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: 4 },
    { id: "missing", source: "a", target: "unknown", weight: 8 },
  ],
};

describe("dataset metadata and GeoJSON conversion", () => {
  it("extracts numeric ranges and sorted categories", () => {
    expect(extractColumns(dataset.nodes)).toEqual([
      { key: "score", type: "number", min: 2, max: 8 },
      { key: "group", type: "string", categories: ["A", "B"] },
    ]);
    expect(extractColumns([])).toBeUndefined();
  });

  it("converts nodes, normalizes edge weights, and skips broken edges", () => {
    const result = toGeoJson(dataset);
    expect(result.nodes.features).toHaveLength(2);
    expect(result.nodes.features[1].properties).toEqual({ id: "b", name: "b" });
    expect(result.edges.features).toHaveLength(1);
    expect(result.edges.features[0].geometry.coordinates).toEqual([[0, 0], [1, 1]]);
    expect(result.edges.features[0].properties.norm).toBe(0.5);
  });

  it("preserves explicit line coordinates and fallback names", () => {
    const result = toGeoJson({
      ...dataset,
      edges: [{ id: "ab", source: "a", target: "b", weight: 1, coordinates: [[0, 0], [0.5, 0.5], [1, 1]] }],
    });
    expect(result.edges.features[0].geometry.coordinates).toHaveLength(3);
    expect(result.edges.features[0].properties.sourceName).toBe("Alpha");
    expect(result.edges.features[0].properties.targetName).toBe("b");
  });
});
