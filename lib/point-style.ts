// Column-driven point styling: which style channels a column can drive, and
// the resulting colour, size and shape of every point plus the legend.
//
// Rules (Figma page "3 · Customization"):
// - Color: number columns use the Sunset ramp; any other column gets one
//   colour per distinct value (Okabe-Ito up to 7, then rainbow).
// - Size: number columns only.
// - Shape: any column with at most MAX_SHAPE_VALUES distinct values; numbers
//   are treated as categories.
// - A column drives at most one channel, and each channel one column.
// The filter bar at the bottom of the map is separate (see filter-axis.ts);
// `filterOption` says whether a column can drive it.

import type { Hint } from "./format";
import { SHAPES, type ShapeName } from "./shapes";
import { flowStats, filterAvailability, type FilterTarget, type ValueStats } from "./filter-axis";
import type { DatasetResponse } from "./types";


export type StyleChannel = "color" | "size" | "shape";
export const STYLE_CHANNELS: StyleChannel[] = ["color", "size", "shape"];
export type ColorScale = "linear" | "quantile" | "log";

export interface PointStyleState {
  color: string | null;
  size: string | null;
  shape: string | null;
  colorScale: ColorScale;
  colorReverse: boolean;
}

export const DEFAULT_POINT_STYLE: PointStyleState = {
  color: null,
  size: null,
  shape: null,
  colorScale: "linear",
  colorReverse: false,
};

export const SUNSET = ["#fef3c7", "#f97316", "#9a3412"];
export const DEFAULT_POINT_COLOR = "#f97316";
export const MISSING_COLOR = "#a1a1aa";
export const RADIUS = { default: 8, min: 4, max: 13 };
export const MAX_SHAPE_VALUES = SHAPES.length;

type Scalar = number | string | boolean | null | undefined;

function asNumber(value: Scalar): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const isEmpty = (value: Scalar) => value === null || value === undefined || value === "";
const categorySort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export interface ColumnProfile {
  /** True when points (nodes) carry this column; flow-only columns can't style points. */
  onPoints: boolean;
  numeric: boolean;
  uniqueCount: number;
  /** The column's values on flows, for the filter bar. */
  flows: ValueStats;
  /** Named like a time column ("time", "timestamp", …): the filter steps through hours. */
  isTimeColumn: boolean;
  /** What the filter bar hides: points when they carry the column, else flows. */
  filterTarget: FilterTarget | null;
}

export function profileColumn(dataset: DatasetResponse, column: string, isTimeColumn = false): ColumnProfile {
  let keyed = false;
  let numeric = true;
  const unique = new Set<string>();
  for (const node of dataset.nodes) {
    if (!node.properties || !(column in node.properties)) continue;
    keyed = true;
    const value = node.properties[column];
    if (isEmpty(value)) continue;
    unique.add(String(value));
    if (asNumber(value) === null) numeric = false;
  }
  const flows = flowStats(dataset, column);
  // Points and flows can share one table (e.g. GeoParquet), leaving flow
  // columns as empty keys on points: those still belong to flows.
  const onPoints = unique.size > 0 || (keyed && flows.unique === 0);
  return {
    onPoints,
    numeric: onPoints && unique.size > 0 && numeric,
    uniqueCount: unique.size,
    flows,
    isTimeColumn,
    filterTarget: onPoints ? "points" : flows.present ? "flows" : null,
  };
}

export interface ChannelAvailability {
  enabled: boolean;
  /** Formatted for the UI language by i18n's `hint()`. */
  hint: Hint;
}

function colorHint(numeric: boolean, unique: number): Hint {
  if (numeric) return { key: "sunset" };
  return { key: unique <= CATEGORY_COLORS.length ? "colorblind" : "rainbow" };
}

/** Whether a column can drive the filter bar, and how it would step. */
export function filterOption(profile: ColumnProfile): ChannelAvailability {
  return filterAvailability(
    profile.filterTarget === "points"
      ? { present: true, numeric: profile.numeric, unique: profile.uniqueCount }
      : profile.filterTarget === "flows" ? profile.flows : null,
    profile.isTimeColumn
  );
}

/** Style channels for a column on points; flow-only columns can't style points. */
export function channelAvailability(profile: ColumnProfile): Record<StyleChannel, ChannelAvailability> {
  const n = profile.uniqueCount;
  return {
    color: n === 0
      ? { enabled: false, hint: { key: "noValuesOnPoints" } }
      : { enabled: true, hint: colorHint(profile.numeric, n) },
    size: profile.numeric
      ? { enabled: true, hint: { key: "bigger" } }
      : { enabled: false, hint: { key: "numbersOnly" } },
    shape: n === 0
      ? { enabled: false, hint: { key: "noValuesOnPoints" } }
      : n > MAX_SHAPE_VALUES
        ? { enabled: false, hint: { key: "tooMany", n } }
        : { enabled: true, hint: { key: "shapes", n } },
  };
}

/** Assign `channel` to `column`, clearing whatever the column or channel drove before. */
export function assignChannel(state: PointStyleState, column: string, channel: StyleChannel | null): PointStyleState {
  const next = { ...state };
  for (const c of STYLE_CHANNELS) if (next[c] === column) next[c] = null;
  if (channel) next[channel] = column;
  return next;
}

export function channelForColumn(state: PointStyleState, column: string): StyleChannel | null {
  return STYLE_CHANNELS.find((c) => state[c] === column) ?? null;
}

// ---------- Computing styles ----------

export interface PointStyle {
  color?: string;
  radius?: number;
  shape?: ShapeName;
}

export type LegendSection =
  | { channel: "color"; column: string; kind: "ramp"; min: number; max: number; reverse: boolean }
  | { channel: "color"; column: string; kind: "categories"; items: { label: string; color: string }[] }
  | { channel: "size"; column: string; items: { value: number; radius: number }[] }
  | { channel: "shape"; column: string; items: { label: string; shape: ShapeName }[] };

export interface PointStyles {
  byNode: Map<string, PointStyle>;
  legend: LegendSection[];
  /** True when any channel is active (styled points get a dark outline). */
  active: boolean;
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function sunsetColor(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const seg = clamped <= 0.5 ? 0 : 1;
  const local = seg === 0 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const a = hexToRgb(SUNSET[seg]), b = hexToRgb(SUNSET[seg + 1]);
  const mix = a.map((v, i) => Math.round(v + (b[i] - v) * local));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Okabe-Ito colorblind-safe palette, minus its black: black disappears on the
// dark legend and merges with the dark outline styled points get.
export const CATEGORY_COLORS = [
  "#E69F00", "#56B4E9", "#009E73", "#F0E442",
  "#0072B2", "#D55E00", "#CC79A7",
];

export function rainbowColor(index: number, count: number) {
  const fitsPalette = count <= CATEGORY_COLORS.length;
  if (fitsPalette) return CATEGORY_COLORS[index];

  const hue = Math.round((index / Math.max(1, count)) * 360);
  return `hsl(${hue}, 72%, 55%)`;
}

function numericValues(dataset: DatasetResponse, column: string) {
  const values: number[] = [];
  for (const node of dataset.nodes) {
    const n = asNumber(node.properties?.[column]);
    if (n !== null) values.push(n);
  }
  return values;
}

function range(values: number[]) {
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

function categories(dataset: DatasetResponse, column: string) {
  const unique = new Set<string>();
  for (const node of dataset.nodes) {
    const value = node.properties?.[column];
    if (!isEmpty(value)) unique.add(String(value));
  }
  return [...unique].sort(categorySort);
}

/** 0..1 position of `value` on the colour ramp for the chosen scale. */
function scaler(values: number[], scale: ColorScale) {
  const { min, max } = range(values);
  const span = max - min || 1;
  if (scale === "log") {
    return min > 0
      ? (v: number) => (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min) || 1)
      : (v: number) => Math.log1p(v - min) / (Math.log1p(span) || 1);
  }
  if (scale === "quantile") {
    const sorted = [...values].sort((a, b) => a - b);
    return (v: number) => {
      let lo = 0, hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] < v) lo = mid + 1;
        else hi = mid;
      }
      return sorted.length > 1 ? lo / (sorted.length - 1) : 0;
    };
  }
  return (v: number) => (v - min) / span;
}

export function computePointStyles(
  dataset: DatasetResponse,
  state: PointStyleState,
  profiles: Map<string, ColumnProfile>
): PointStyles {
  const byNode = new Map<string, PointStyle>();
  const legend: LegendSection[] = [];
  const styleOf = (id: string) => {
    let s = byNode.get(id);
    if (!s) byNode.set(id, (s = {}));
    return s;
  };

  if (state.color) {
    const column = state.color;
    if (profiles.get(column)?.numeric) {
      const values = numericValues(dataset, column);
      const { min, max } = range(values);
      const t = scaler(values, state.colorScale);
      for (const node of dataset.nodes) {
        const n = asNumber(node.properties?.[column]);
        const pos = n === null ? null : t(n);
        styleOf(node.id).color = pos === null ? MISSING_COLOR : sunsetColor(state.colorReverse ? 1 - pos : pos);
      }
      legend.push({ channel: "color", column, kind: "ramp", min, max, reverse: state.colorReverse });
    } else {
      const cats = categories(dataset, column);
      const colorOf = new Map(cats.map((c, i) => [c, rainbowColor(i, cats.length)]));
      for (const node of dataset.nodes) {
        const value = node.properties?.[column];
        styleOf(node.id).color = isEmpty(value) ? MISSING_COLOR : colorOf.get(String(value));
      }
      legend.push({ channel: "color", column, kind: "categories", items: cats.map((c) => ({ label: c, color: colorOf.get(c)! })) });
    }
  }

  if (state.size) {
    const column = state.size;
    const { min, max } = range(numericValues(dataset, column));
    const span = max - min || 1;
    // Area-proportional: radius grows with the square root of the value.
    const radiusOf = (v: number) => RADIUS.min + Math.sqrt((v - min) / span) * (RADIUS.max - RADIUS.min);
    for (const node of dataset.nodes) {
      const n = asNumber(node.properties?.[column]);
      styleOf(node.id).radius = n === null ? RADIUS.min : radiusOf(n);
    }
    const samples = min === max ? [min] : [min, (min + max) / 2, max];
    legend.push({ channel: "size", column, items: samples.map((v) => ({ value: v, radius: radiusOf(v) })) });
  }

  if (state.shape) {
    const column = state.shape;
    const cats = categories(dataset, column).slice(0, MAX_SHAPE_VALUES);
    const shapeOf = new Map(cats.map((c, i) => [c, SHAPES[i]]));
    for (const node of dataset.nodes) {
      const value = node.properties?.[column];
      styleOf(node.id).shape = isEmpty(value) ? "circle" : shapeOf.get(String(value)) ?? "circle";
    }
    legend.push({ channel: "shape", column, items: cats.map((c) => ({ label: c, shape: shapeOf.get(c)! })) });
  }

  return { byNode, legend, active: legend.length > 0 };
}
