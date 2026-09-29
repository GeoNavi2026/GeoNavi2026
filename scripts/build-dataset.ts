import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { toGeoJson } from "@/lib/to-geojson";
import type { DatasetResponse, Edge, Node } from "@/lib/types";

type CsvRow = {
  Otract: string;
  Dtract: string;
  EST: string;
};

type GeoJsonFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Point" | "LineString";
    coordinates: unknown;
  };
  properties?: Record<string, unknown>;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

const dataDir = "data/test";
const csvFile = `${dataDir}/flow_demo.csv`;
const centroidFile = `${dataDir}/tract_centroids.json`;
const jsonFile = `${dataDir}/flow_demo.json`;
const geoJsonFile = `${dataDir}/flow_demo.geojson`;

function metadata(
  source: string,
  nodes: Node[],
  edges: Edge[]
): DatasetResponse["meta"] {
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
      Math.min(...points.map(([lon]) => lon)),
      Math.min(...points.map(([, lat]) => lat)),
      Math.max(...points.map(([lon]) => lon)),
      Math.max(...points.map(([, lat]) => lat)),
    ],
  };
}

function fromCsv(): DatasetResponse {
  const rows = parse(readFileSync(csvFile), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
  const coords = JSON.parse(
    readFileSync(centroidFile, "utf8")
  ) as Record<string, [number, number]>;
  const ids = new Set(rows.flatMap(({ Otract, Dtract }) => [Otract, Dtract]));
  const nodes = [...ids].map((id) => {
    if (!coords[id]) throw new Error(`Missing coordinates for ${id}`);
    return { id, coords: coords[id], name: id };
  });
  const edges = rows.map(({ Otract, Dtract, EST }, index) => {
    const weight = Number(EST);
    if (!Number.isFinite(weight)) throw new Error(`Invalid EST on row ${index + 2}`);
    return {
      id: `${Otract}->${Dtract}-${index}`,
      source: Otract,
      target: Dtract,
      weight,
    };
  });

  return {
    meta: metadata(csvFile, nodes, edges),
    nodes,
    edges,
  };
}

function coordinatePair(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("GeoJSON coordinates must contain longitude and latitude.");
  }
  return [Number(value[0]), Number(value[1])];
}

function featureId(feature: GeoJsonFeature, fallback: string) {
  const id = feature.properties?.id ?? feature.id;
  return id === undefined ? fallback : String(id);
}

function fromGeoJson(): DatasetResponse {
  const geojson = JSON.parse(
    readFileSync(geoJsonFile, "utf8")
  ) as GeoJsonFeatureCollection;
  const pointFeatures = geojson.features.filter(
    ({ geometry }) => geometry.type === "Point"
  );
  const lineFeatures = geojson.features.filter(
    ({ geometry }) => geometry.type === "LineString"
  );
  const nodes = pointFeatures.map((feature, index) => {
    const id = featureId(feature, `point-${index}`);
    return {
      id,
      coords: coordinatePair(feature.geometry.coordinates),
      name: typeof feature.properties?.name === "string"
        ? feature.properties.name
        : id,
    };
  });
  const edges = lineFeatures.map((feature, index) => {
    const properties = feature.properties ?? {};
    const weight = Number(properties.weight ?? 1);
    if (typeof properties.source !== "string" || typeof properties.target !== "string") {
      throw new Error(`GeoJSON line ${index} needs source and target properties.`);
    }
    return {
      id: featureId(feature, `edge-${index}`),
      source: properties.source,
      target: properties.target,
      weight,
    };
  });

  return {
    meta: metadata(geoJsonFile, nodes, edges),
    nodes,
    edges,
  };
}

let dataset: DatasetResponse;
if (existsSync(csvFile) && existsSync(centroidFile)) {
  dataset = fromCsv();
} else if (existsSync(jsonFile)) {
  dataset = JSON.parse(readFileSync(jsonFile, "utf8")) as DatasetResponse;
} else {  //if (existsSync(geoJsonFile)) {
  dataset = fromGeoJson();
}

mkdirSync("data/test/output", { recursive: true });
writeFileSync(
  "data/test/output/test_geojson.json",
  JSON.stringify(toGeoJson(dataset), null, 2)
);

console.log(`Built ${dataset.edges.length} flows for ${dataset.nodes.length} tracts`);