import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import type { DatasetResponse, Edge, Node } from "./types";

type CtppRow = {
  Otract: string;
  Dtract: string;
  EST: string;
  O_lat: string;
  O_lon: string;
  D_lat: string;
  D_lon: string;
};

const dataDir = join(process.cwd(), "data/test");
const outputFile = join(dataDir, "output/test_dataset.json");
const ctppJsonFile = join(dataDir, "ctpp2017_2021_FL_spatial.json");
const ctppCsvFile = join(dataDir, "ctpp2017_2021_FL_spatial.csv");
const flowJsonFile = join(dataDir, "flow_demo.json");
const flowGeoJsonFile = join(dataDir, "flow_demo.geojson");

function metadata(source: string, nodes: Node[], edges: Edge[]): DatasetResponse["meta"] {
  const points = nodes.map(({ coords }) => coords);
  return {
    id: "csv-test",
    name: "CSV Test",
    description: "Generated from OD flow data.",
    source,
    region: "Test region",
    temporal: edges.some((edge) => edge.t !== undefined),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    bbox: [
      Math.min(...points.map(([longitude]) => longitude)),
      Math.min(...points.map(([, latitude]) => latitude)),
      Math.max(...points.map(([longitude]) => longitude)),
      Math.max(...points.map(([, latitude]) => latitude)),
    ],
  };
}

function fromCtppCsv(): DatasetResponse {
  const rows = parse(readFileSync(ctppCsvFile), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CtppRow[];
  const coordinates = new Map<string, [number, number]>();
  const edges: Edge[] = rows.map((row, index) => {
    const originCoords: [number, number] = [Number(row.O_lon), Number(row.O_lat)];
    const destinationCoords: [number, number] = [Number(row.D_lon), Number(row.D_lat)];
    const weight = Number(row.EST);

    if (!row.Otract || !row.Dtract || !Number.isFinite(weight)) {
      throw new Error(`Invalid CTPP row ${index + 2}`);
    }

    for (const [id, coords] of [
      [row.Otract, originCoords],
      [row.Dtract, destinationCoords],
    ] as [string, [number, number]][]) {
      if (!coords.every(Number.isFinite)) {
        throw new Error(`Invalid coordinates for tract ${id} on CTPP row ${index + 2}`);
      }
      const existing = coordinates.get(id);
      if (existing && (existing[0] !== coords[0] || existing[1] !== coords[1])) {
        throw new Error(`Inconsistent coordinates for tract ${id}.`);
      }
      coordinates.set(id, coords);
    }

    return {
      id: `${row.Otract}->${row.Dtract}-${index}`,
      source: row.Otract,
      target: row.Dtract,
      weight,
    };
  });
  const nodes = [...coordinates].map(([id, coords]) => ({ id, coords, name: id }));

  return { meta: metadata(ctppCsvFile, nodes, edges), nodes, edges };
}

function coordinatePair(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("GeoJSON coordinates must contain longitude and latitude.");
  }
  return [Number(value[0]), Number(value[1])];
}

function fromGeoJson(): DatasetResponse {
  const geojson = JSON.parse(readFileSync(flowGeoJsonFile, "utf8")) as {
    features: Array<{
      id?: string | number;
      geometry: { type: string; coordinates: unknown };
      properties?: Record<string, unknown>;
    }>;
  };
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const [index, feature] of geojson.features.entries()) {
    const properties = feature.properties ?? {};
    const id = String(properties.id ?? feature.id ?? `feature-${index}`);
    if (feature.geometry.type === "Point") {
      nodes.push({
        id,
        coords: coordinatePair(feature.geometry.coordinates),
        name: typeof properties.name === "string" ? properties.name : id,
      });
    }
  }
  for (const [index, feature] of geojson.features.entries()) {
    const properties = feature.properties ?? {};
    if (
      feature.geometry.type !== "LineString" ||
      typeof properties.source !== "string" ||
      typeof properties.target !== "string"
    ) continue;
    edges.push({
      id: String(properties.id ?? feature.id ?? `edge-${index}`),
      source: properties.source,
      target: properties.target,
      weight: Number(properties.weight ?? 1),
    });
  }

  return { meta: metadata(flowGeoJsonFile, nodes, edges), nodes, edges };
}

function selectDataset(): DatasetResponse {
  if (existsSync(ctppJsonFile)) {
    return JSON.parse(readFileSync(ctppJsonFile, "utf8")) as DatasetResponse;
  }
  if (existsSync(ctppCsvFile)) {
    const dataset = fromCtppCsv();
    writeFileSync(ctppJsonFile, JSON.stringify(dataset, null, 2));
    return dataset;
  }
  if (existsSync(flowJsonFile)) {
    return JSON.parse(readFileSync(flowJsonFile, "utf8")) as DatasetResponse;
  }
  if (existsSync(flowGeoJsonFile)) return fromGeoJson();
  throw new Error("No supported hardcoded dataset was found in data/test.");
}

export function ensureDataset(): DatasetResponse {
  const dataset = selectDataset();
  mkdirSync(join(dataDir, "output"), { recursive: true });
  writeFileSync(outputFile, JSON.stringify(dataset, null, 2));
  return dataset;
}
