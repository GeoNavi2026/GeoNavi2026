// The "Time" style: turns a column into ordered steps for the time slider,
// and says which step each point or flow falls in.
//
// - Time columns (timestamps or hours) step through the 24 hours of the day.
// - Number columns step through each value, or 24 even ranges when there are
//   more than 24 distinct values.
// - Text columns step through each distinct value (up to MAX_FILTER_STEPS).

import type { AxisLabel, Hint } from "./format";
import { edgeHour } from "./time";
import type { DatasetResponse, Edge } from "./types";

export const MAX_FILTER_STEPS = 100;
export const NUMBER_BINS = 24;
// Hours labelled under the slider when it steps through the day.
const HOUR_TICKS = [0, 6, 12, 18, 23];

type Scalar = number | string | boolean | null | undefined;
export type FilterTarget = "points" | "flows";

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
function items(dataset: DatasetResponse, column: string, target: FilterTarget) {
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

export interface FilterAvailability {
  enabled: boolean;
  /** Formatted for the UI language by i18n's `hint()`. */
  hint: Hint;
}

export function filterAvailability(stats: ValueStats | null, isTimeColumn: boolean): FilterAvailability {
  if (!stats?.present || stats.unique === 0) return { enabled: false, hint: { key: "noValues" } };
  if (stats.unique < 2) return { enabled: false, hint: { key: "needsTwo" } };
  if (isTimeColumn) return { enabled: true, hint: { key: "hours" } };
  if (stats.numeric && stats.unique > NUMBER_BINS) return { enabled: true, hint: { key: "rangeSteps", n: NUMBER_BINS } };
  if (stats.unique > MAX_FILTER_STEPS) return { enabled: false, hint: { key: "tooMany", n: stats.unique } };
  return { enabled: true, hint: { key: "valueSteps", n: stats.unique } };
}

export interface FilterAxis {
  column: string;
  target: FilterTarget;
  /** Readout label for each step, as raw values (formatted per language by the slider). */
  labels: AxisLabel[];
  /** Labels under the track: one per step when they're the same length as `labels`, else spread out. */
  ticks: AxisLabel[];
  /** Points: number of points per step. Flows: total weight per step. */
  totals: number[];
  /** Step of each point or flow id; items without a value are absent. */
  stepOf: Map<string, number>;
}

// Short lists label every step (centred under its bar); long ones show a few.
const PER_STEP_TICKS = 8;

function spreadTicks(labels: AxisLabel[]) {
  if (labels.length <= PER_STEP_TICKS) return labels;
  return [labels[0], labels[Math.floor((labels.length - 1) / 2)], labels[labels.length - 1]];
}

export function buildFilterAxis(
  dataset: DatasetResponse,
  column: string,
  target: FilterTarget,
  isTimeColumn: boolean
): FilterAxis {
  const rows = items(dataset, column, target).filter((r) => !isEmpty(r.value));
  const stepOf = new Map<string, number>();
  let labels: AxisLabel[];
  let ticks: AxisLabel[];
  let stepFor: (value: Scalar) => number | null;

  const hours = isTimeColumn ? rows.map((r) => edgeHour(String(r.value))) : [];
  if (isTimeColumn && hours.some((h) => h !== null)) {
    labels = Array.from({ length: 24 }, (_, hour) => ({ kind: "hour", hour }));
    ticks = HOUR_TICKS.map((hour) => ({ kind: "hourTick", hour }));
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
      labels = Array.from({ length: NUMBER_BINS }, (_, i) => ({ kind: "range", from: min + i * width, to: min + (i + 1) * width }));
      ticks = [min, (min + max) / 2, max].map((value) => ({ kind: "value", value }));
      stepFor = (v) => Math.min(NUMBER_BINS - 1, Math.floor((asNumber(v)! - min) / width));
    } else {
      const sorted = numeric
        ? distinct.sort((a, b) => Number(a) - Number(b))
        : distinct.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const index = new Map(sorted.map((v, i) => [v, i]));
      // Long whole numbers (tract ids, codes) are identifiers: show them as
      // written, since compacting would turn every one into "12B".
      const ids = numeric && (numbers as number[]).every((n) => Number.isInteger(n) && Math.abs(n) >= 1e7);
      labels = sorted.map((v): AxisLabel => (numeric && !ids ? { kind: "value", value: Number(v) } : { kind: "text", text: v }));
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
