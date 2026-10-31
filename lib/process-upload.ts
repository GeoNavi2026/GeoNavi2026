import * as duckdb from "@duckdb/duckdb-wasm";
import type { Feature } from "geojson";
import { gpx, kml } from "@tmcw/togeojson";
import shp from "shpjs";
import type { FeatureCollection, Geometry } from "geojson";
import { parseWkbHex } from "./wkb";
import type { DatasetResponse, Edge, Node } from "./types";
import { columnKind, describeRecords, summarizeDataset, TIME_COLUMN, type TableSummary } from "./upload-summary";

export interface UploadResult {
  dataset: DatasetResponse;
  /** The uploaded table as the user sees it: row count and column headers. */
  table: TableSummary;
}

// DuckDB column types that hold numbers.
const NUMERIC_TYPE = /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|UHUGEINT|FLOAT|DOUBLE|REAL|DECIMAL)/i;

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
type GeoFeatureCollection = FeatureCollection<Geometry | null>;

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

function isFeatureCollection(value: unknown): value is GeoFeatureCollection {
  return isObject(value) && value.type === "FeatureCollection" && Array.isArray(value.features);
}

function isWgs84Crs(crs: unknown): boolean {
  if (crs === null || crs === undefined) return true;
  if (typeof crs === "string") return /^(?:EPSG:4326|OGC:CRS84)$/i.test(crs);
  if (!isObject(crs) || !isObject(crs.id)) return false;
  const authority = crs.id.authority;
  const code = crs.id.code;
  return (authority === "EPSG" && (code === 4326 || code === "4326")) ||
    (authority === "OGC" && code === "CRS84");
}

function geoParquetFeatures(rows: unknown[], geometryColumn: string): GeoFeatureCollection {
  const features: Feature[] = rows.map((row, index) => {
    if (!isObject(row) || typeof row.__geonavi_wkb !== "string") {
      throw new Error(`GeoParquet row ${index + 1} has no readable WKB geometry.`);
    }
    const properties = scalarProperties(
      Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== geometryColumn && key !== "__geonavi_wkb")
      )
    ) ?? {};
    return {
      type: "Feature",
      id: jsonId(properties.id, `feature-${index}`),
      geometry: parseWkbHex(row.__geonavi_wkb),
      properties,
    };
  });
  return { type: "FeatureCollection", features };
}

function buildDataset(
  file: File,
  nodes: Node[],
  edges: Edge[],
  description: string
): DatasetResponse {
  if (!nodes.length) throw new Error("The input has no point coordinates.");
  const bbox = [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number];
  const includePoint = ([longitude, latitude]: [number, number]) => {
    bbox[0] = Math.min(bbox[0], longitude);
    bbox[1] = Math.min(bbox[1], latitude);
    bbox[2] = Math.max(bbox[2], longitude);
    bbox[3] = Math.max(bbox[3], latitude);
  };
  for (const { coords } of nodes) includePoint(coords);
  for (const edge of edges) {
    for (const coords of edge.coordinates ?? []) includePoint(coords);
  }
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
      bbox,
    },
    nodes,
    edges,
  };
}

function parseFeatureCollection(
  file: File,
  featureCollection: GeoFeatureCollection,
  description: string
): DatasetResponse {
  const nodes: Node[] = [];
  const nodeById = new Map<string, Node>();
  const nodeByCoordinate = new Map<string, string>();
  const edges: Edge[] = [];
  const edgeIds = new Set<string>();
  const features = featureCollection.features as unknown[];

  function addNode(candidateId: string, coords: [number, number], properties?: Record<string, Scalar>) {
    const existing = nodeById.get(candidateId);
    if (existing) {
      if (existing.coords[0] !== coords[0] || existing.coords[1] !== coords[1]) {
        throw new Error(`Point id "${candidateId}" has conflicting coordinates.`);
      }
      return candidateId;
    }

    const node: Node = {
      id: candidateId,
      coords,
      name: typeof properties?.name === "string" ? properties.name : candidateId,
      properties,
    };
    nodes.push(node);
    nodeById.set(candidateId, node);
    const coordinateKey = coords.join(",");
    if (!nodeByCoordinate.has(coordinateKey)) nodeByCoordinate.set(coordinateKey, candidateId);
    return candidateId;
  }

  function ensureEndpoint(candidateId: string | undefined, coords: [number, number]) {
    const coordinateKey = coords.join(",");
    const id = candidateId ?? nodeByCoordinate.get(coordinateKey) ?? `endpoint-${coordinateKey}`;
    return addNode(id, coords);
  }

  for (const [index, feature] of features.entries()) {
    if (!isObject(feature) || !isObject(feature.geometry)) continue;
    const geometry = feature.geometry;
    const properties = scalarProperties(feature.properties);
    if (geometry.type !== "Point" && geometry.type !== "MultiPoint") continue;

    const positions = geometry.type === "Point"
      ? [geometry.coordinates]
      : Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    for (const [partIndex, position] of positions.entries()) {
      const coords = coordinatePair(position);
      if (!coords) throw new Error(`Invalid point coordinates in feature ${index}.`);
      const featureId = jsonId(properties?.id ?? feature.id, `point-${index}`);
      const id = geometry.type === "Point" ? featureId : `${featureId}-${partIndex + 1}`;
      addNode(id, coords, properties);
    }
  }

  for (const [index, feature] of features.entries()) {
    if (!isObject(feature) || !isObject(feature.geometry)) continue;
    const geometry = feature.geometry;
    if (geometry.type !== "LineString" && geometry.type !== "MultiLineString") continue;

    const properties = scalarProperties(feature.properties);
    const parts = geometry.type === "LineString"
      ? [geometry.coordinates]
      : Array.isArray(geometry.coordinates) ? geometry.coordinates : [];

    for (const [partIndex, part] of parts.entries()) {
      if (!Array.isArray(part) || part.length < 2) {
        throw new Error(`Line feature ${index} must contain at least two coordinates.`);
      }
      const lineCoordinates: [number, number][] = [];
      for (const position of part) {
        const point = coordinatePair(position);
        if (!point) throw new Error(`Invalid line coordinates in feature ${index}.`);
        lineCoordinates.push(point);
      }
      const first = lineCoordinates[0];
      const last = lineCoordinates[lineCoordinates.length - 1];
      const sourceId = typeof properties?.source === "string" || typeof properties?.source === "number"
        ? String(properties.source)
        : undefined;
      const targetId = typeof properties?.target === "string" || typeof properties?.target === "number"
        ? String(properties.target)
        : undefined;
      const source = ensureEndpoint(sourceId, first);
      const target = ensureEndpoint(targetId, last);
      const rawWeight = properties?.weight;
      const weight = rawWeight === undefined ? 1 : Number(rawWeight);
      if (!Number.isFinite(weight)) throw new Error(`Invalid line weight in feature ${index}.`);

      const featureId = jsonId(properties?.id ?? feature.id, `line-${index}`);
      const baseId = parts.length > 1 ? `${featureId}-${partIndex + 1}` : featureId;
      let id = baseId;
      let suffix = 2;
      while (edgeIds.has(id)) id = `${baseId}-${suffix++}`;
      edgeIds.add(id);
      edges.push({
        id,
        source,
        target,
        coordinates: lineCoordinates,
        weight,
        t: typeof properties?.t === "string" ? properties.t : undefined,
        properties,
      });
    }
  }

  if (!nodes.length) {
    throw new Error(
      "The file contains no supported point or line features. Polygon geometries are not supported yet."
    );
  }
  return buildDataset(file, nodes, edges, description);
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

  const featureCollection = isFeatureCollection(value)
    ? value
    : isObject(value) && isObject(value.nodes) && isObject(value.edges) &&
        isFeatureCollection(value.nodes) && isFeatureCollection(value.edges)
      ? {
          type: "FeatureCollection" as const,
          features: [...value.nodes.features, ...value.edges.features],
        }
      : null;

  if (featureCollection) {
    return parseFeatureCollection(file, featureCollection, "Point and line data loaded from GeoJSON.");
  }

  throw new Error("JSON must be a GeoNavi dataset or a GeoJSON FeatureCollection.");
}

/** Table summary for a GeoJSON upload: one row per feature, columns from feature properties. */
function describeJson(value: unknown): TableSummary | null {
  const features = isObject(value) && value.type === "FeatureCollection" && Array.isArray(value.features)
    ? value.features
    : isObject(value) && isObject(value.nodes) && isObject(value.edges) &&
        Array.isArray(value.nodes.features) && Array.isArray(value.edges.features)
      ? [...value.nodes.features, ...value.edges.features]
      : null;
  if (!features) return null;
  const records = features.map((feature) =>
    isObject(feature) && isObject(feature.properties) ? feature.properties : {}
  );
  return { rowCount: features.length, columns: describeRecords(records) };
}

/** Upload result for formats parsed as features (KML, GPX, shapefile, GeoParquet). */
function featureUpload(dataset: DatasetResponse, collection: unknown): UploadResult {
  return { dataset, table: describeJson(collection) ?? summarizeDataset(dataset) };
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

export async function processUpload(file: File): Promise<UploadResult> {
  const isKml = /\.kml$/i.test(file.name);
  const isGpx = /\.gpx$/i.test(file.name);
  const isShapefileArchive = /\.zip$/i.test(file.name);
  const isGeoParquet = /\.(geo)?parquet$/i.test(file.name);
  const isJson = /\.(geojson|json)$/i.test(file.name);
  const isCsv = /\.csv$/i.test(file.name);
  if (!isKml && !isGpx && !isShapefileArchive && !isGeoParquet && !isJson && !isCsv) {
    throw new Error(
      "Unsupported file type. Choose CSV, JSON, GeoJSON, GeoParquet, KML, GPX, or a ZIP shapefile."
    );
  }

  if (isKml || isGpx) {
    const xml = new DOMParser().parseFromString(await file.text(), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error(`Could not parse ${isKml ? "KML" : "GPX"} XML.`);
    const collection = isKml ? kml(xml) : gpx(xml);
    return featureUpload(
      parseFeatureCollection(file, collection, `Point and line data loaded from ${isKml ? "KML" : "GPX"}.`),
      collection
    );
  }

  if (isShapefileArchive) {
    const parsed = await shp(await file.arrayBuffer());
    const collections = isFeatureCollection(parsed)
      ? [parsed]
      : Object.values(parsed).filter(isFeatureCollection);
    if (!collections.length) {
      throw new Error("The ZIP archive does not contain a readable shapefile.");
    }
    const collection: GeoFeatureCollection = {
      type: "FeatureCollection",
      features: collections.flatMap(({ features }) => features),
    };
    return featureUpload(
      parseFeatureCollection(file, collection, "Point and line data loaded from a zipped shapefile."),
      collection
    );
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
      const filename = isJson ? "upload.json" : isGeoParquet ? "upload.parquet" : "upload.csv";
      await db.registerFileBuffer(filename, new Uint8Array(await file.arrayBuffer()));

      if (isGeoParquet) {
        const metadataResult = await connection.query(
          // value is a BLOB; CAST to VARCHAR escapes quotes as \x22, so decode it as UTF-8 instead.
          `SELECT decode(value) AS value
           FROM parquet_kv_metadata('${filename}')
           WHERE key = 'geo'`
        );
        const metadataRows = metadataResult.toArray();
        if (metadataRows.length !== 1) {
          throw new Error("The Parquet file is missing GeoParquet metadata.");
        }
        const metadataValue = metadataRows[0].toJSON() as { value?: unknown };
        if (typeof metadataValue.value !== "string") {
          throw new Error("Could not read the GeoParquet metadata.");
        }
        const geoMetadata: unknown = JSON.parse(metadataValue.value);
        if (!isObject(geoMetadata) || typeof geoMetadata.primary_column !== "string" ||
            !isObject(geoMetadata.columns)) {
          throw new Error("The GeoParquet metadata does not define a primary geometry column.");
        }
        const geometryColumn = geoMetadata.primary_column;
        const columnMetadata = geoMetadata.columns[geometryColumn];
        if (!isObject(columnMetadata) || columnMetadata.encoding !== "WKB") {
          throw new Error("Only GeoParquet files using WKB geometry encoding are supported.");
        }
        if (!isWgs84Crs(columnMetadata.crs)) {
          throw new Error("GeoParquet uploads must use WGS 84 (EPSG:4326 / OGC:CRS84).");
        }

        // Read geometry as raw WKB bytes rather than DuckDB's GEOMETRY type, which hex() rejects.
        await connection.query("SET enable_geoparquet_conversion = false");
        const quotedGeometryColumn = `"${geometryColumn.replace(/"/g, '""')}"`;
        const result = await connection.query(
          `SELECT *, hex(${quotedGeometryColumn}) AS "__geonavi_wkb" FROM read_parquet('${filename}')`
        );
        const features = geoParquetFeatures(
          result.toArray().map((row) => row.toJSON()),
          geometryColumn
        );
        return featureUpload(
          parseFeatureCollection(file, features, "Point and line data loaded from GeoParquet."),
          features
        );
      }

      if (isJson) {
        const maximumObjectSize = Math.max(16 * 1024 * 1024, file.size + 1);
        const result = await connection.query(
          `SELECT json FROM read_json_objects(
            '${filename}',
            format = 'unstructured',
            maximum_object_size = ${maximumObjectSize}
          )`
        );
        const objects = result.toArray().map((row) => {
          const value = row.toJSON() as { json?: unknown };
          if (typeof value.json !== "string") {
            throw new Error("DuckDB did not return a JSON object for the upload.");
          }
          return JSON.parse(value.json) as unknown;
        });
        if (objects.length !== 1) {
          throw new Error("JSON uploads must contain one dataset or GeoJSON object.");
        }
        const dataset = parseJsonDataset(file, objects[0]);
        return { dataset, table: describeJson(objects[0]) ?? summarizeDataset(dataset) };
      }

      const columns = await connection.query(
        `DESCRIBE SELECT * FROM read_csv_auto('${filename}', all_varchar = true)`
      );
      const columnNames = new Set(
        columns.toArray().map((row) => String((row.toJSON() as { column_name: unknown }).column_name))
      );
      const requiredColumns = ["Otract", "Dtract", "EST", "O_lat", "O_lon", "D_lat", "D_lon"];
      const missingColumns = requiredColumns.filter((column) => !columnNames.has(column));
      if (missingColumns.length) {
        throw new Error(`CSV is missing required flow columns: ${missingColumns.join(", ")}.`);
      }

      const typed = await connection.query(
        `DESCRIBE SELECT * FROM read_csv_auto('${filename}')`
      );
      const csvColumns = typed.toArray().map((row) => {
        const { column_name, column_type } = row.toJSON() as { column_name: unknown; column_type: unknown };
        const name = String(column_name);
        return { name, kind: columnKind(name, NUMERIC_TYPE.test(String(column_type))) };
      });
      // A column like "time" or "timestamp" becomes each edge's `t`.
      const timeColumn = csvColumns.find(({ name }) => TIME_COLUMN.test(name))?.name;

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
        FROM read_csv_auto('${filename}', all_varchar = true)
      `);

      const rows = result.toArray().map(
        (row) => row.toJSON() as unknown as CsvRow
      );
      if (!rows.length) throw new Error(`The ${isJson ? "JSON" : "CSV"} file has no rows.`);

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
          t: timeColumn ? String(row[timeColumn] ?? "").trim() || undefined : undefined,
          // Every column but the coordinates stays on the flow, so endpoint and
          // weight columns (Otract, EST, …) can drive the filter bar and styles.
          properties: scalarProperties(
            Object.fromEntries(
              Object.entries(row).filter(([key]) =>
                ![
                  "O_lat", "O_lon", "D_lat", "D_lon",
                  "originLatitude", "originLongitude", "destinationLatitude", "destinationLongitude",
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

      return {
        dataset: buildDataset(file, nodes, edges, "Flow data loaded from a CSV upload."),
        table: { rowCount: rows.length, columns: csvColumns },
      };
    } finally {
      await connection.close();
    }
  } finally {
    URL.revokeObjectURL(workerUrl);
    await db.terminate();
    worker.terminate();
  }
}