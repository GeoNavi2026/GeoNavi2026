// The "Time" style: turns a column into ordered steps for the time slider,
// and says which step each point or flow falls in.
//
// - Time columns (timestamps or hours) step through the 24 hours of the day.
// - Number columns step through each value, or 24 even ranges when there are
//   more than 24 distinct values.
// - Text columns step through each distinct value (up to MAX_TIME_STEPS).

import { formatValue } from "./format";
import { edgeHour, formatHour } from "./time";
import type { DatasetResponse, Edge } from "./types";

export const MAX_TIME_STEPS = 100;
export const NUMBER_BINS = 24;
const HOUR_TICKS = ["12 AM", "6 AM", "12 PM", "6 PM", "11 PM"];

type Scalar = number | string | boolean | null | undefined;
export type TimeTarget = "points" | "flows";

// Fields every flow has; a column with one of these names reads it directly.
const EDGE_FIELDS = new Set(["id", "source", "target", "weight", "t"]);

export function edgeValue(edge: Edge, column: string): Scalar {
  if (edge.properties && column in edge.properties) return edge.properties[column];
  if (EDGE_FIELDS.has(column)) return edge[column as keyof Edge] as Scalar;
  return undefined;
}

const isEmpty = (v: Scalar) => v === null || v === undefined || v === "";
const asNumber = (v: Scalar) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Values of a column on points or flows, with each item's id and weight. */
function items(dataset: DatasetResponse, column: string, target: TimeTarget) {
  return target === "points"
    ? dataset.nodes.map((n) => ({ id: n.id, value: n.properties?.[column] as Scalar, weight: 1 }))
    : dataset.edges.map((e) => ({ id: e.id, value: edgeValue(e, column), weight: e.weight }));
}

export interface ValueStats {
  present: boolean;
  numeric: boolean;
  unique: number;
}

/** Whether flows carry a column, and what its values look like there. */
export function flowStats(dataset: DatasetResponse, column: string): ValueStats {
  let present = false, numeric = true;
  const unique = new Set<string>();
  for (const edge of dataset.edges) {
    const v = edgeValue(edge, column);
    if (v === undefined) continue;
    present = true;
    if (isEmpty(v)) continue;
    unique.add(String(v));
    if (asNumber(v) === null) numeric = false;
  }
  return { present, numeric: present && unique.size > 0 && numeric, unique: unique.size };
}

export interface TimeAvailability {
  enabled: boolean;
  hint: string;
}

export function timeAvailability(stats: ValueStats | null, isTimeColumn: boolean): TimeAvailability {
  if (!stats?.present || stats.unique === 0) return { enabled: false, hint: "No values" };
  if (stats.unique < 2) return { enabled: false, hint: "Needs at least 2 values" };
  if (isTimeColumn) return { enabled: true, hint: "Step through the 24 hours" };
  if (stats.numeric && stats.unique > NUMBER_BINS) return { enabled: true, hint: `${NUMBER_BINS} steps across the range` };
  if (stats.unique > MAX_TIME_STEPS) return { enabled: false, hint: `Too many unique values (${stats.unique.toLocaleString()})` };
  return { enabled: true, hint: `${stats.unique} steps, one per value` };
}

export interface TimeAxis {
  column: string;
  target: TimeTarget;
  /** Readout label for each step. */
  labels: string[];
  /** Labels under the track: one per step when they're the same length as `labels`, else spread out. */
  ticks: string[];
  /** Points: number of points per step. Flows: total weight per step. */
  totals: number[];
  /** Step of each point or flow id; items without a value are absent. */
  stepOf: Map<string, number>;
}

// Short lists label every step (centred under its bar); long ones show a few.
const PER_STEP_TICKS = 8;

function spreadTicks(labels: string[]) {
  if (labels.length <= PER_STEP_TICKS) return labels;
  return [labels[0], labels[Math.floor((labels.length - 1) / 2)], labels[labels.length - 1]];
}

export function buildTimeAxis(
  dataset: DatasetResponse,
  column: string,
  target: TimeTarget,
  isTimeColumn: boolean
): TimeAxis {
  const rows = items(dataset, column, target).filter((r) => !isEmpty(r.value));
  const stepOf = new Map<string, number>();
  let labels: string[];
  let ticks: string[];
  let stepFor: (value: Scalar) => number | null;

  const hours = isTimeColumn ? rows.map((r) => edgeHour(String(r.value))) : [];
  if (isTimeColumn && hours.some((h) => h !== null)) {
    labels = Array.from({ length: 24 }, (_, h) => formatHour(h));
    ticks = HOUR_TICKS;
    stepFor = (v) => edgeHour(String(v));
  } else {
    const numbers = rows.map((r) => asNumber(r.value));
    const numeric = numbers.every((n) => n !== null);
    const distinct = [...new Set(rows.map((r) => String(r.value)))];
    if (numeric && distinct.length > NUMBER_BINS) {
      let min = Infinity, max = -Infinity;
      for (const n of numbers as number[]) {
        if (n < min) min = n;
        if (n > max) max = n;
      }
      const width = (max - min) / NUMBER_BINS || 1;
      labels = Array.from({ length: NUMBER_BINS }, (_, i) => `${formatValue(min + i * width)}–${formatValue(min + (i + 1) * width)}`);
      ticks = [formatValue(min), formatValue((min + max) / 2), formatValue(max)];
      stepFor = (v) => Math.min(NUMBER_BINS - 1, Math.floor((asNumber(v)! - min) / width));
    } else {
      const sorted = numeric
        ? distinct.sort((a, b) => Number(a) - Number(b))
        : distinct.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const index = new Map(sorted.map((v, i) => [v, i]));
      labels = numeric ? sorted.map((v) => formatValue(Number(v))) : sorted;
      ticks = spreadTicks(labels);
      stepFor = (v) => index.get(String(v)) ?? null;
    }
  }

  const totals = new Array<number>(labels.length).fill(0);
  for (const row of rows) {
    const step = stepFor(row.value);
    if (step === null) continue;
    stepOf.set(row.id, step);
    totals[step] += row.weight;
  }
  return { column, target, labels, ticks, totals, stepOf };
}
