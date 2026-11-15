import { describe, expect, it } from "vitest";
import {
  allIdentifiers,
  buildFilterAxis,
  edgeValue,
  filterAvailability,
  flowStats,
  NUMBER_BINS,
  MAX_FILTER_STEPS,
} from "../lib/filter-axis";
import type { DatasetResponse, Edge } from "../lib/types";

const dataset = (nodes: DatasetResponse["nodes"], edges: Edge[]): DatasetResponse => ({
  meta: {
    id: "test",
    name: "Test",
    description: "Test dataset",
    source: "test",
    region: "Test",
    temporal: edges.some((edge) => edge.t !== undefined),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    bbox: [0, 0, 1, 1],
  },
  nodes,
  edges,
});

const nodes = [
  { id: "n1", coords: [0, 0] as [number, number], properties: { group: "10", score: 2 } },
  { id: "n2", coords: [1, 1] as [number, number], properties: { group: "2", score: 8 } },
  { id: "n3", coords: [2, 2] as [number, number], properties: { group: null, score: 5 } },
];

const edges: Edge[] = [
  { id: "e1", source: "n1", target: "n2", weight: 3, t: "2024-01-01T01:00:00Z", properties: { mode: "bus", score: 2 } },
  { id: "e2", source: "n2", target: "n3", weight: 7, t: "2024-01-01T13:00:00Z", properties: { mode: "rail", score: 8 } },
  { id: "e3", source: "n3", target: "n1", weight: 5, properties: { mode: "bus", score: 5 } },
];

describe("filter-axis helpers", () => {
  it("reads edge properties before built-in edge fields", () => {
    const edge = { ...edges[0], properties: { weight: 99 } };
    expect(edgeValue(edge, "weight")).toBe(99);
    expect(edgeValue(edge, "source")).toBe("n1");
    expect(edgeValue(edge, "missing")).toBeUndefined();
  });

  it("recognizes identifier values as categories, not quantities", () => {
    expect(allIdentifiers([12001000101, 12001000102])).toBe(true);
    expect(allIdentifiers([12001000101, 2])).toBe(false);
    expect(allIdentifiers([])).toBe(false);
  });

  it("summarizes flow values and numeric classification", () => {
    expect(flowStats(dataset(nodes, edges), "score")).toEqual({
      present: true,
      numeric: true,
      unique: 3,
    });
    expect(flowStats(dataset(nodes, edges), "mode")).toMatchObject({
      present: true,
      numeric: false,
      unique: 2,
    });
    expect(flowStats(dataset(nodes, edges), "missing")).toEqual({
      present: false,
      numeric: false,
      unique: 0,
    });
  });

  it("selects filter availability for empty, single, time, range, and high-cardinality data", () => {
    expect(filterAvailability(null, false)).toEqual({ enabled: false, hint: { key: "noValues" } });
    expect(filterAvailability({ present: true, numeric: true, unique: 1 }, false)).toEqual({
      enabled: false,
      hint: { key: "needsTwo" },
    });
    expect(filterAvailability({ present: true, numeric: true, unique: 2 }, true)).toEqual({
      enabled: true,
      hint: { key: "hours" },
    });
    expect(filterAvailability({ present: true, numeric: true, unique: NUMBER_BINS + 1 }, false)).toEqual({
      enabled: true,
      hint: { key: "rangeSteps", n: NUMBER_BINS },
    });
    expect(filterAvailability({ present: true, numeric: false, unique: MAX_FILTER_STEPS + 1 }, false)).toEqual({
      enabled: false,
      hint: { key: "tooMany", n: MAX_FILTER_STEPS + 1 },
    });
  });

  it("builds sorted categorical axes and weighted flow totals", () => {
    const axis = buildFilterAxis(dataset(nodes, edges), "mode", "flows", false);
    expect(axis.labels).toEqual([
      { kind: "text", text: "bus" },
      { kind: "text", text: "rail" },
    ]);
    expect(axis.stepOf).toEqual(new Map([["e1", 0], ["e2", 1], ["e3", 0]]));
    expect(axis.totals).toEqual([8, 7]);
    expect(axis.ticks).toEqual(axis.labels);
  });

  it("builds a 24-hour axis and ignores invalid time values", () => {
    const axis = buildFilterAxis(dataset(nodes, edges), "t", "flows", true);
    expect(axis.labels).toHaveLength(24);
    expect(axis.ticks).toEqual([
      { kind: "hourTick", hour: 0 },
      { kind: "hourTick", hour: 6 },
      { kind: "hourTick", hour: 12 },
      { kind: "hourTick", hour: 18 },
      { kind: "hourTick", hour: 23 },
    ]);
    expect(axis.stepOf).toEqual(new Map([["e1", 1], ["e2", 13]]));
    expect(axis.totals[1]).toBe(3);
    expect(axis.totals[13]).toBe(7);
  });

  it("bins more than 24 numeric values and spreads long ticks", () => {
    const manyEdges = Array.from({ length: 25 }, (_, index) => ({
      id: `e${index}`,
      source: "n1",
      target: "n2",
      weight: 1,
      properties: { score: index },
    }));
    const axis = buildFilterAxis(dataset(nodes, manyEdges), "score", "flows", false);
    expect(axis.labels).toHaveLength(NUMBER_BINS);
    expect(axis.ticks).toHaveLength(3);
    expect(axis.stepOf.get("e0")).toBe(0);
    expect(axis.stepOf.get("e24")).toBe(NUMBER_BINS - 1);
    expect(axis.totals.reduce((sum, value) => sum + value, 0)).toBe(25);
  });
});
