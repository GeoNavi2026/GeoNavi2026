import { describe, expect, it } from "vitest";
import { EXPORT_FORMATS, exportFileName, exportResolutions } from "../lib/map-export";

describe("map export", () => {
  it("offers PNG and JPEG only", () => {
    expect(EXPORT_FORMATS).toEqual(["png", "jpeg"]);
  });

  it("sizes the current view at the screen's pixel ratio", () => {
    const [view] = exportResolutions(1100, 900, 2);
    expect(view).toEqual({ id: "view", scale: 2, width: 2200, height: 1800 });
  });

  it("never exports the current view below 1×", () => {
    const [view] = exportResolutions(1100, 900, 0.5);
    expect(view.scale).toBe(1);
    expect([view.width, view.height]).toEqual([1100, 900]);
  });

  it("scales Full HD and 4K to their widths, keeping the view's shape", () => {
    const [, fhd, uhd] = exportResolutions(1100, 900);
    expect(fhd).toMatchObject({ id: "fhd", width: 1920, height: 1571 });
    expect(uhd).toMatchObject({ id: "4k", width: 3840, height: 3142 });
    expect(uhd.scale).toBeCloseTo(3840 / 1100);
  });

  it("caps sizes at what the GPU can render", () => {
    const [view, fhd, uhd] = exportResolutions(684, 768, 2, 4096 / 768);
    expect([view.width, view.height]).toEqual([1368, 1536]);
    expect([fhd.width, fhd.height]).toEqual([1920, 2156]);
    expect([uhd.width, uhd.height]).toEqual([3648, 4096]);
  });

  it("names the file after the upload, the format and the day", () => {
    const day = new Date(2026, 10, 5);
    expect(exportFileName("flows_hourly.csv", "png", day)).toBe("flows_hourly-map-2026-11-05.png");
    expect(exportFileName("tracts.demo.geojson", "jpeg", day)).toBe("tracts.demo-map-2026-11-05.jpg");
  });

  it("keeps file names safe and non-empty", () => {
    const day = new Date(2026, 0, 1);
    expect(exportFileName('a/b:c*?"<>|.csv', "png", day)).toBe("a-b-c-map-2026-01-01.png");
    expect(exportFileName(".csv", "png", day)).toBe("geonavi-map-2026-01-01.png");
  });
});
