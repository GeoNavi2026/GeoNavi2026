import * as duckdb from "@duckdb/duckdb-wasm";
import type { DatasetResponse, Edge, Node } from "./types";

type CsvRow = {
  origin: string | null;
  destination: string | null;
  weight: number | null;
  originLatitude: number | null;
  originLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  [key: string]: unknown;
};

type Scalar = number | string | boolean | null;
type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scalarProperties(value: unknown): Record<string, Scalar> | undefined {
  if (!isObject(value)) return undefined;
  const properties: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean"
    ) {
      properties[key] = entry;
    }
  }
  return Object.keys(properties).length ? properties as Record<string, Scalar> : undefined;
}

function coordinatePair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const [longitude, latitude] = value;
  return typeof longitude === "number" && typeof latitude === "number" &&
    Number.isFinite(longitude) && Number.isFinite(latitude) &&
    longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90
    ? [longitude, latitude]
    : null;
}

function jsonId(value: unknown, fallback: string) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function buildDataset(
  file: File,
  nodes: Node[],
  edges: Edge[],
  description: string
): DatasetResponse {
  if (!nodes.length) throw new Error("The input has no point coordinates.");
  const points = nodes.map(({ coords }) => coords);
  return {
    meta: {
      id: `upload-${crypto.randomUUID()}`,
      name: file.name,
      description,
      source: file.name,
      region: "Uploaded dataset",
      temporal: edges.some((edge) => edge.t !== undefined),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      bbox: [
        Math.min(...points.map(([longitude]) => longitude)),
        Math.min(...points.map(([, latitude]) => latitude)),
        Math.max(...points.map(([longitude]) => longitude)),
        Math.max(...points.map(([, latitude]) => latitude)),
      ],
    },
    nodes,
    edges,
  };
}

function parseJsonDataset(file: File, value: unknown): DatasetResponse {
  if (isObject(value) && Array.isArray(value.nodes) && Array.isArray(value.edges)) {
    const nodes: Node[] = value.nodes.map((entry, index) => {
      if (!isObject(entry)) throw new Error(`Invalid JSON node at index ${index}.`);
      const coords = coordinatePair(entry.coords);
      if (!coords) throw new Error(`Invalid coordinates for JSON node ${index}.`);
      return {
        id: jsonId(entry.id, `node-${index}`),
        coords,
        name: typeof entry.name === "string" ? entry.name : undefined,
        properties: scalarProperties(entry.properties),
      };
    });
    const edges: Edge[] = value.edges.map((entry, index) => {
      if (!isObject(entry) || typeof entry.source !== "string" || typeof entry.target !== "string") {
        throw new Error(`Invalid JSON edge at index ${index}.`);
      }
      const weight = typeof entry.weight === "number" ? entry.weight : Number(entry.weight);
      if (!Number.isFinite(weight)) throw new Error(`Invalid weight for JSON edge ${index}.`);
      return {
        id: jsonId(entry.id, `edge-${index}`),
        source: entry.source,
        target: entry.target,
        weight,
        t: typeof entry.t === "string" ? entry.t : undefined,
        properties: scalarProperties(entry.properties),
      };
    });
    return buildDataset(file, nodes, edges, "Flow data loaded from a JSON dataset.");
  }

  const featureCollection = isObject(value) && value.type === "FeatureCollection" && Array.isArray(value.features)
    ? value
    : isObject(value) && isObject(value.nodes) && isObject(value.edges) &&
        value.nodes.type === "FeatureCollection" && value.edges.type === "FeatureCollection" &&
        Array.isArray(value.nodes.features) && Array.isArray(value.edges.features)
      ? {
          type: "FeatureCollection",
          features: [...value.nodes.features, ...value.edges.features],
        }
      : null;

  if (featureCollection) {
    const nodes: Node[] = [];
    const nodeByCoordinate = new Map<string, string>();
    const edges: Edge[] = [];
    const features = featureCollection.features as unknown[];

    for (const [index, feature] of features.entries()) {
      if (!isObject(feature) || !isObject(feature.geometry)) continue;
      const properties = scalarProperties(feature.properties);
      const geometry = feature.geometry;
      if (geometry.type !== "Point") continue;
      const coords = coordinatePair(geometry.coordinates);
      if (!coords) throw new Error(`Invalid GeoJSON point at feature ${index}.`);
      const id = jsonId(properties?.id ?? feature.id, `point-${index}`);
      nodes.push({ id, coords, name: typeof properties?.name === "string" ? properties.name : id, properties });
      nodeByCoordinate.set(coords.join(","), id);
    }

    for (const [index, feature] of features.entries()) {
      if (!isObject(feature) || !isObject(feature.geometry)) continue;
      const geometry = feature.geometry;
      if (geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) continue;
      const endpoints = [geometry.coordinates[0], geometry.coordinates.at(-1)]
        .map(coordinatePair);
      if (!endpoints[0] || !endpoints[1]) throw new Error(`Invalid GeoJSON line at feature ${index}.`);
      const properties = scalarProperties(feature.properties);
      const source = typeof properties?.source === "string"
        ? properties.source
        : nodeByCoordinate.get(endpoints[0].join(","));
      const target = typeof properties?.target === "string"
        ? properties.target
        : nodeByCoordinate.get(endpoints[1].join(","));
      if (!source || !target) {
        throw new Error(`GeoJSON line ${index} needs source/target properties or matching points.`);
      }
      const weight = typeof properties?.weight === "number" ? properties.weight : Number(properties?.weight ?? 1);
      if (!Number.isFinite(weight)) throw new Error(`Invalid GeoJSON line weight at feature ${index}.`);
      edges.push({
        id: jsonId(properties?.id ?? feature.id, `edge-${index}`),
        source,
        target,
        weight,
        t: typeof properties?.t === "string" ? properties.t : undefined,
        properties,
      });
    }
    return buildDataset(file, nodes, edges, "Point and line data loaded from GeoJSON.");
  }

  throw new Error("JSON must be a GeoNavi dataset or a GeoJSON FeatureCollection.");
}

function coordinates(
  longitude: number | null,
  latitude: number | null,
  tractId: string,
  rowNumber: number
): [number, number] {
  if (
    longitude === null || latitude === null ||
    !Number.isFinite(longitude) || !Number.isFinite(latitude) ||
    longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90
  ) {
    throw new Error(`Invalid coordinates for tract ${tractId} on CSV row ${rowNumber}.`);
  }
  return [longitude, latitude];
}

export async function processUpload(file: File): Promise<DatasetResponse> {
  if (/\.(geojson|json)$/i.test(file.name)) {
    return parseJsonDataset(file, JSON.parse(await file.text()));
  }
  if (!/\.csv$/i.test(file.name)) {
    throw new Error("Unsupported file type. Choose a CSV, JSON, or GeoJSON file.");
  }

  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], {
      type: "text/javascript",
    })
  );
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);

  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const connection = await db.connect();

    try {
      await db.registerFileBuffer(
        "flows.csv",
        new Uint8Array(await file.arrayBuffer())
      );

      const result = await connection.query(`
        SELECT
          *,
          trim(Otract) AS origin,
          trim(Dtract) AS destination,
          try_cast(nullif(trim(EST), '') AS DOUBLE) AS weight,
          try_cast(nullif(trim(O_lat), '') AS DOUBLE) AS originLatitude,
          try_cast(nullif(trim(O_lon), '') AS DOUBLE) AS originLongitude,
          try_cast(nullif(trim(D_lat), '') AS DOUBLE) AS destinationLatitude,
          try_cast(nullif(trim(D_lon), '') AS DOUBLE) AS destinationLongitude
        FROM read_csv_auto('flows.csv', all_varchar = true)
      `);

      const rows = result.toArray().map(
        (row) => row.toJSON() as unknown as CsvRow
      );
      if (!rows.length) throw new Error("The CSV has no flow rows.");

      const coordinatesByTract = new Map<string, [number, number]>();
      const edges: Edge[] = rows.map((row, index) => {
        const { origin, destination, weight } = row;
        if (!origin || !destination || weight === null || !Number.isFinite(weight)) {
          throw new Error(`Invalid CSV row ${index + 2}`);
        }

        const originCoords = coordinates(
          row.originLongitude,
          row.originLatitude,
          origin,
          index + 2
        );
        const destinationCoords = coordinates(
          row.destinationLongitude,
          row.destinationLatitude,
          destination,
          index + 2
        );

        for (const [tractId, point] of [
          [origin, originCoords],
          [destination, destinationCoords],
        ] as [string, [number, number]][]) {
          const existing = coordinatesByTract.get(tractId);
          if (existing && (existing[0] !== point[0] || existing[1] !== point[1])) {
            throw new Error(`Inconsistent coordinates for tract ${tractId}.`);
          }
          coordinatesByTract.set(tractId, point);
        }

        return {
          id: `${origin}->${destination}-${index}`,
          source: origin,
          target: destination,
          weight,
          properties: scalarProperties(
            Object.fromEntries(
              Object.entries(row).filter(([key]) =>
                ![
                  "Otract", "Dtract", "EST", "O_lat", "O_lon", "D_lat", "D_lon",
                  "origin", "destination", "weight", "originLatitude", "originLongitude",
                  "destinationLatitude", "destinationLongitude",
                ].includes(key)
              )
            )
          ),
        };
      });

      const nodes: Node[] = [...coordinatesByTract].map(([id, coords]) => ({
        id,
        coords,
        name: id,
      }));
      const points = nodes.map(({ coords }) => coords);

      return buildDataset(file, nodes, edges, "Flow data loaded from a CSV upload.");
    } finally {
      await connection.close();
    }
  } finally {
    URL.revokeObjectURL(workerUrl);
    await db.terminate();
    worker.terminate();
  }
}