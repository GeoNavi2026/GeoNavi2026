import { describe, expect, it } from "vitest";
import { columnKind, describeRecords, summarizeDataset, TIME_COLUMN } from "../lib/upload-summary";
import type { DatasetResponse } from "../lib/types";

describe("upload table summaries", () => {
  it("classifies time, coordinate, numeric, and text columns", () => {
    expect(TIME_COLUMN.test("timestamp")).toBe(true);
    expect(columnKind("timestamp", false)).toBe("time");
    expect(columnKind("originLatitude", true)).toBe("lat");
    expect(columnKind("destination_longitude", true)).toBe("lon");
    expect(columnKind("trips", true)).toBe("number");
    expect(columnKind("mode", false)).toBe("text");
  });

  it("uses the first non-null value to infer record columns", () => {
    expect(describeRecords([
      { id: 1, score: null, latitude: 40, mode: "bus" },
      { score: 2, longitude: -75, mode: "rail" },
    ])).toEqual([
      { name: "id", kind: "number" },
      { name: "score", kind: "number" },
      { name: "latitude", kind: "lat" },
      { name: "mode", kind: "text" },
      { name: "longitude", kind: "lon" },
    ]);
  });

  it("summarizes edge rows and preserves temporal columns", () => {
    const dataset: DatasetResponse = {
      meta: {
        id: "test",
        name: "Test",
        description: "Test",
        source: "test",
        region: "Test",
        temporal: true,
        nodeCount: 0,
        edgeCount: 1,
        bbox: [0, 0, 0, 0],
      },
      nodes: [],
      edges: [{ id: "e1", source: "a", target: "b", weight: 3, t: "08:00", properties: { mode: "bus" } }],
    };
    expect(summarizeDataset(dataset)).toEqual({
      rowCount: 1,
      columns: [
        { name: "id", kind: "text" },
        { name: "source", kind: "text" },
        { name: "target", kind: "text" },
        { name: "weight", kind: "number" },
        { name: "t", kind: "time" },
        { name: "mode", kind: "text" },
      ],
    });
  });
});
