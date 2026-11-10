import { describe, expect, it } from "vitest";
import {
  ARROW_IMAGE,
  arrowSdf,
  ICON_UNIT_RADIUS_CSS,
  SHAPES,
  shapeImageName,
  shapePoints,
  shapeSdf,
} from "../lib/shapes";
import { edgeHour } from "../lib/time";

describe("shape and time helpers", () => {
  it("provides names and SVG points for every shape", () => {
    for (const shape of SHAPES) {
      expect(shapeImageName(shape)).toBe(`gn-shape-${shape}`);
      expect(shapePoints(shape, 10)).toContain(",");
      const sdf = shapeSdf(shape);
      expect(sdf.width).toBe(112);
      expect(sdf.height).toBe(112);
      expect(sdf.data).toHaveLength(112 * 112 * 4);
    }
    expect(ICON_UNIT_RADIUS_CSS).toBe(12);
  });

  it("creates an arrow SDF", () => {
    const sdf = arrowSdf();
    expect(ARROW_IMAGE).toBe("gn-arrow");
    expect(sdf.data.some((value) => value > 0)).toBe(true);
  });

  it("extracts valid hours from timestamps and labels", () => {
    expect(edgeHour("2026-03-02T08:15:00")).toBe(8);
    expect(edgeHour("2026-03-02 18:15")).toBe(18);
    expect(edgeHour("8")).toBe(8);
    expect(edgeHour("08:00")).toBe(8);
    expect(edgeHour("")).toBeNull();
    expect(edgeHour("25:00")).toBeNull();
    expect(edgeHour("not-a-time")).toBeNull();
  });
});
