// @vitest-environment jsdom

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";

const fixture = (name: string) => fileURLToPath(new NativeUrl(`../data/test/${name}`, import.meta.url));
const NativeUrl = globalThis.URL;

const uploadedFiles = new Map<string, Uint8Array>();
const csvRows = [
  {
    Otract: "A",
    Dtract: "B",
    EST: "2.5",
    O_lat: "40",
    O_lon: "-75",
    D_lat: "41",
    D_lon: "-74",
  },
];

vi.mock("@duckdb/duckdb-wasm", () => {
  class MockConnection {
    async query(sql: string) {
      if (sql.includes("parquet_kv_metadata")) {
        return { toArray: () => [{ toJSON: () => ({ value: JSON.stringify({
          primary_column: "geometry",
          columns: { geometry: { encoding: "WKB", crs: "EPSG:4326" } },
        }) }) }] };
      }
      if (sql.includes('hex("geometry")')) {
        return {
          toArray: () => [{
            toJSON: () => ({
              id: "feature-1",
              name: "Sample point",
              geometry: "01010000000000000000C052C00000000000004440",
              __geonavi_wkb: "01010000000000000000C052C00000000000004440",
            }),
          }],
        };
      }
      if (sql.includes("read_json_objects")) {
        const value = JSON.parse(new TextDecoder().decode(uploadedFiles.get("upload.json")));
        return { toArray: () => [{ toJSON: () => ({ json: JSON.stringify(value) }) }] };
      }
      if (sql.includes("DESCRIBE")) {
        const names = ["Otract", "Dtract", "EST", "O_lat", "O_lon", "D_lat", "D_lon"];
        return {
          toArray: () => names.map((column_name, index) => ({
            toJSON: () => ({ column_name, column_type: index === 2 ? "DOUBLE" : "VARCHAR" }),
          })),
        };
      }
      return {
        toArray: () => csvRows.map((row) => ({
          toJSON: () => ({
            ...row,
            origin: row.Otract,
            destination: row.Dtract,
            weight: Number(row.EST),
            originLatitude: Number(row.O_lat),
            originLongitude: Number(row.O_lon),
            destinationLatitude: Number(row.D_lat),
            destinationLongitude: Number(row.D_lon),
          }),
        })),
      };
    }

    async close() {}
  }

  class MockDatabase {
    async instantiate() {}
    async connect() {
      return new MockConnection();
    }
    async registerFileBuffer(name: string, bytes: Uint8Array) {
      uploadedFiles.set(name, bytes);
    }
    async terminate() {}
  }

  return {
    ConsoleLogger: class {},
    AsyncDuckDB: MockDatabase,
    getJsDelivrBundles: () => ({ mainWorker: "worker.js", mainModule: "duckdb.wasm" }),
    selectBundle: async (bundles: unknown) => bundles,
  };
});

const { processUpload } = await import("../lib/process-upload");

async function file(name: string) {
  const bytes = await readFile(fixture(name));
  const uploaded = new File([bytes], name);
  Object.defineProperties(uploaded, {
    text: { value: async () => new TextDecoder().decode(bytes) },
    arrayBuffer: { value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
  });
  return uploaded;
}

describe("supported upload formats", () => {
  beforeAll(() => {
    vi.stubGlobal("Worker", class { terminate() {} });
    NativeUrl.createObjectURL = () => "blob:test-worker";
    NativeUrl.revokeObjectURL = () => {};
  });

  it("loads a GeoNavi JSON dataset", async () => {
    const result = await processUpload(await file("flow_demo.json"));
    expect(result.dataset.nodes.length).toBeGreaterThan(0);
    expect(result.dataset.edges.length).toBeGreaterThan(0);
  });

  it("loads a GeoJSON feature collection", async () => {
    const result = await processUpload(await file("flow_demo.geojson"));
    expect(result.dataset.nodes.length).toBeGreaterThan(0);
    expect(result.dataset.edges.length).toBeGreaterThan(0);
  });

  it("loads a CSV flow table", async () => {
    const result = await processUpload(await file("flow_demo.csv"));
    expect(result.dataset.edges).toHaveLength(1);
    expect(result.dataset.edges[0]).toMatchObject({ source: "A", target: "B", weight: 2.5 });
  });

  it("loads a GeoParquet file with WKB geometry", async () => {
    const result = await processUpload(await file("flow_demo.parquet"));
    expect(result.dataset.nodes).toHaveLength(1);
    expect(result.dataset.nodes[0].coords).toEqual([-75, 40]);
  });

  it("loads KML point and line features", async () => {
    const result = await processUpload(await file("upload-fixture.kml"));
    expect(result.dataset.nodes.length).toBeGreaterThan(0);
    expect(result.dataset.edges).toHaveLength(1);
  });

  it("loads GPX point and track features", async () => {
    const result = await processUpload(await file("upload-fixture.gpx"));
    expect(result.dataset.nodes.length).toBeGreaterThan(0);
    expect(result.dataset.edges).toHaveLength(1);
  });

  it("loads a zipped shapefile", async () => {
    const result = await processUpload(await file("points.zip"));
    expect(result.dataset.nodes).toHaveLength(1);
    expect(result.dataset.nodes[0].coords).toEqual([-75, 40]);
  });
});
