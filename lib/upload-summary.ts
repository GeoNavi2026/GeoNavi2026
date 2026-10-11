// Describes the table a user uploaded: its row count and column headers,
// shown in the map sidebar's "Columns" list.

import type { DatasetResponse } from "./types";

export type ColumnKind = "text" | "number" | "lat" | "lon" | "time";

export interface ColumnSummary {
  name: string;
  kind: ColumnKind;
}

export interface TableSummary {
  rowCount: number;
  columns: ColumnSummary[];
}

/** Everything the map screen needs about the current upload. */
export interface UploadedData extends TableSummary {
  fileName: string;
  dataset: DatasetResponse;
}

// Matches "lat", "O_lat", "dest-latitude" and camelCase "originLatitude".
const LAT = /(^|[_\s.-])(lat|latitude)$|[a-z](Lat|Latitude)$/i;
const LON = /(^|[_\s.-])(lon|lng|long|longitude)$|[a-z](Lon|Lng|Longitude)$/i;

/** Column names that hold each row's time; they drive the map's time slider. */
export const TIME_COLUMN = /^(t|time|hour|timestamp|datetime|date_?time)$/i;

export function columnKind(name: string, numeric: boolean): ColumnKind {
  if (TIME_COLUMN.test(name)) return "time";
  if (LAT.test(name)) return "lat";
  if (LON.test(name)) return "lon";
  return numeric ? "number" : "text";
}

/** Column summary from plain records: keys in first-seen order, typed by first non-null value. */
export function describeRecords(records: Record<string, unknown>[]): ColumnSummary[] {
  const numeric = new Map<string, boolean | undefined>();
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (numeric.get(key) !== undefined) continue;
      numeric.set(key, value === null || value === undefined ? undefined : typeof value === "number");
    }
  }
  return [...numeric].map(([name, isNumber]) => ({ name, kind: columnKind(name, isNumber ?? false) }));
}

/** Summary for a dataset that didn't come from a user file (e.g. the built-in sample). */
export function summarizeDataset(dataset: DatasetResponse): TableSummary {
  const records = dataset.edges.map(({ id, source, target, weight, t, properties }) => ({
    id,
    source,
    target,
    weight,
    ...(t !== undefined ? { t } : {}),
    ...properties,
  }));
  return { rowCount: records.length, columns: describeRecords(records) };
}
