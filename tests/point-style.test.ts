import { describe, expect, it } from "vitest";
import {
  assignChannel,
  channelAvailability,
  channelForColumn,
  computeFlowStyles,
  computePointStyles,
  DEFAULT_FLOW_STYLE,
  DEFAULT_POINT_STYLE,
  FLOW_WIDTH,
  flowChannelAvailability,
  profileColumn,
  rampColor,
  rainbowColor,
} from "../lib/point-style";
import type { DatasetResponse, Edge } from "../lib/types";

const edges: Edge[] = [
  { id: "e1", source: "n1", target: "n2", weight: 2, properties: { amount: 2, kind: "bus" } },
  { id: "e2", source: "n2", target: "n3", weight: 8, properties: { amount: 8, kind: "rail" } },
];

const dataset: DatasetResponse = {
  meta: {
    id: "test",
    name: "Test",
    description: "Test dataset",
    source: "test",
    region: "Test",
    temporal: false,
    nodeCount: 3,
    edgeCount: 2,
    bbox: [0, 0, 1, 1],
  },
  nodes: [
    { id: "n1", coords: [0, 0], properties: { amount: 1, kind: "bus", missing: null } },
    { id: "n2", coords: [1, 1], properties: { amount: 5, kind: "rail", missing: "x" } },
    { id: "n3", coords: [2, 2], properties: { amount: 9, kind: "bus", missing: null } },
  ],
  edges,
};

const profiles = new Map([
  ["amount", profileColumn(dataset, "amount")],
  ["kind", profileColumn(dataset, "kind")],
]);

describe("point-style logic", () => {
  it("interpolates and clamps ramp colors", () => {
    expect(rampColor(["#000000", "#808080", "#ffffff"], -1)).toBe("#000000");
    expect(rampColor(["#000000", "#808080", "#ffffff"], 0.5)).toBe("#808080");
    expect(rampColor(["#000000", "#808080", "#ffffff"], 2)).toBe("#ffffff");
    expect(rainbowColor(0, 2)).toBe("#E69F00");
    expect(rainbowColor(8, 9)).toMatch(/^hsl\(/);
  });

  it("profiles numeric, categorical, and flow-only columns", () => {
    expect(profiles.get("amount")).toMatchObject({
      onPoints: true,
      numeric: true,
      uniqueCount: 3,
      filterTarget: "points",
    });
    expect(profiles.get("kind")).toMatchObject({
      onPoints: true,
      numeric: false,
      uniqueCount: 2,
    });
    expect(profileColumn(dataset, "amount").flows).toMatchObject({
      present: true,
      numeric: true,
      unique: 2,
    });
  });

  it("reports channel availability and assigns channels exclusively", () => {
    expect(channelAvailability(profiles.get("amount")!).size.enabled).toBe(true);
    expect(channelAvailability(profiles.get("kind")!).size.enabled).toBe(false);
    expect(flowChannelAvailability(profiles.get("amount")!).width.enabled).toBe(true);

    const state = { color: "kind", size: null, shape: "kind" };
    expect(assignChannel(state, ["color", "size", "shape"] as const, "amount", "color"))
      .toEqual({ color: "amount", size: null, shape: "kind" });
    expect(channelForColumn({ color: "amount", size: null, shape: "kind" }, ["color", "size", "shape"], "kind"))
      .toBe("shape");
  });

  it("computes numeric point colors, sizes, and legends", () => {
    const result = computePointStyles(dataset, {
      ...DEFAULT_POINT_STYLE,
      color: "amount",
      size: "amount",
      colorReverse: true,
    }, profiles);
    expect(result.active).toBe(true);
    expect(result.byNode.get("n1")?.radius).toBe(4);
    expect(result.byNode.get("n3")?.radius).toBe(13);
    expect(result.byNode.get("n1")?.color).toBe("#9a3412");
    expect(result.legend).toHaveLength(2);
  });

  it("computes categorical point shapes and missing colors", () => {
    const result = computePointStyles(dataset, {
      ...DEFAULT_POINT_STYLE,
      color: "missing",
      shape: "kind",
    }, new Map([
      ["missing", profileColumn(dataset, "missing")],
      ["kind", profiles.get("kind")!],
    ]));
    expect(result.byNode.get("n1")?.color).toBe("#a1a1aa");
    expect(result.byNode.get("n2")?.color).not.toBe("#a1a1aa");
    expect(result.byNode.get("n1")?.shape).toBe("circle");
    expect(result.legend).toHaveLength(2);
  });

  it("computes flow colors and widths", () => {
    const flowProfiles = new Map([["amount", profileColumn(dataset, "amount")]]);
    const result = computeFlowStyles(dataset, {
      ...DEFAULT_FLOW_STYLE,
      color: "amount",
      width: "amount",
    }, flowProfiles);
    expect(result.byEdge.get("e1")?.width).toBe(FLOW_WIDTH.min);
    expect(result.byEdge.get("e2")?.width).toBe(FLOW_WIDTH.max);
    expect(result.byEdge.get("e1")?.color).toBe("#93c5fd");
    expect(result.legend).toHaveLength(2);
  });
});
