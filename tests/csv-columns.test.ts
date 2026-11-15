import { describe, expect, it } from "vitest";
import { findFlowColumns, parseNumber } from "../lib/csv-columns";

describe("CSV flow column detection", () => {
  it("finds English and CTPP-style columns", () => {
    expect(findFlowColumns(["Otract", "Dtract", "EST", "O_lat", "O_lon", "D_lat", "D_lon"]))
      .toEqual({
        origin: "Otract",
        destination: "Dtract",
        weight: "EST",
        originLat: "O_lat",
        originLon: "O_lon",
        destinationLat: "D_lat",
        destinationLon: "D_lon",
      });
  });

  it("finds Portuguese names and optional identifiers", () => {
    expect(findFlowColumns(["latitude_origem", "longitude_origem", "latitude_destino", "longitude_destino", "viagens"]))
      .toMatchObject({
        origin: null,
        destination: null,
        weight: "viagens",
        originLat: "latitude_origem",
        destinationLon: "longitude_destino",
      });
  });

  it("reports missing coordinates", () => {
    expect(findFlowColumns(["origin_lat", "origin_lon"])).toEqual({
      missing: ["destination latitude", "destination longitude"],
    });
  });

  it("parses common number formats and rejects invalid values", () => {
    expect(parseNumber(4)).toBe(4);
    expect(parseNumber(" 1,234.5 ")).toBe(1234.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1.234.567")).toBe(1234567);
    expect(parseNumber("-23,55")).toBe(-23.55);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("not-a-number")).toBeNull();
    expect(parseNumber(Infinity)).toBeNull();
  });
});
