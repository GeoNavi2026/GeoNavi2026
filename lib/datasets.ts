import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractColumns } from "./column-meta";
import type { DatasetMeta, DatasetResponse } from "./types";

/**
 * Directory where pipeline-generated dataset JSON files are stored.
 * Each file must conform to the DatasetResponse shape with a unique `meta.id`.
 */
const DATASETS_DIR = join(process.cwd(), "data", "datasets");

/** Built-in sample so the app always has something to show. */
const SAMPLE_DATASET: DatasetResponse = {
  meta: {
    id: "gnv-commute",
    name: "Gainesville Commute Flows",
    description: "Sample home-to-work flows between census tracts.",
    source: "Sample data (not real)",
    region: "Gainesville, FL",
    temporal: false,
    nodeCount: 4,
    edgeCount: 4,
    bbox: [-82.42, 29.61, -82.3, 29.69],
  },
  nodes: [
    { id: "n1", coords: [-82.3248, 29.6516], name: "Downtown" },
    { id: "n2", coords: [-82.4102, 29.6789], name: "Northwest" },
    { id: "n3", coords: [-82.351, 29.642], name: "Campus" },
    { id: "n4", coords: [-82.37, 29.62], name: "South" },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n3", weight: 412 },
    { id: "e2", source: "n2", target: "n3", weight: 287 },
    { id: "e3", source: "n4", target: "n1", weight: 155 },
    { id: "e4", source: "n3", target: "n1", weight: 390 },
  ],
};

function isDatasetResponse(value: unknown): value is DatasetResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.meta === "object" &&
    obj.meta !== null &&
    typeof (obj.meta as Record<string, unknown>).id === "string" &&
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.edges)
  );
}

/**
 * Scan the datasets directory and return every valid DatasetResponse
 * keyed by its `meta.id`. The built-in sample is always included.
 */
function loadDatasets(): Map<string, DatasetResponse> {
  const datasets = new Map<string, DatasetResponse>();

  // Always include the built-in sample
  datasets.set(SAMPLE_DATASET.meta.id, SAMPLE_DATASET);

  if (!existsSync(DATASETS_DIR)) return datasets;

  for (const file of readdirSync(DATASETS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const filepath = join(DATASETS_DIR, file);
    try {
      const data: unknown = JSON.parse(readFileSync(filepath, "utf-8"));
      if (isDatasetResponse(data)) {
        // Auto-populate column metadata if the file doesn't already have it
        if (!data.meta.nodeColumns) {
          data.meta.nodeColumns = extractColumns(data.nodes);
        }
        if (!data.meta.edgeColumns) {
          data.meta.edgeColumns = extractColumns(data.edges);
        }
        datasets.set(data.meta.id, data);
      } else {
        console.warn(`Skipping ${file}: does not match DatasetResponse shape.`);
      }
    } catch (err) {
      console.warn(`Skipping ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return datasets;
}

/** Return the catalog of every available dataset's metadata. */
export function getCatalog(): DatasetMeta[] {
  const datasets = loadDatasets();
  return [...datasets.values()].map((d) => d.meta);
}

/** Return a single dataset by id, or null if not found. */
export function getDatasetById(id: string): DatasetResponse | null {
  const datasets = loadDatasets();
  return datasets.get(id) ?? null;
}
