// Column-driven styling of points and flows: which style channels a column
// can drive, and the resulting colour, size and shape of every point, colour
// and width of every flow, plus the legend.
//
// Rules (Figma page "3 · Customization"):
// - Color: number columns use the Sunset ramp; any other column gets one
//   colour per distinct value (Okabe-Ito up to 7, then rainbow, up to
//   MAX_COLOR_VALUES).
// - Size: number columns only.
// - Shape: any column with at most MAX_SHAPE_VALUES distinct values; numbers
//   are treated as categories.
// - Flow columns (values on flows, not points) style the flows instead:
//   Color (blue ramp for numbers, categories as for points) and Width
//   (numbers only).
// - A column drives at most one channel, and each channel one column.
// The filter bar at the bottom of the map is separate (see filter-axis.ts);
// `filterOption` says whether a column can drive it.

import type { Hint } from "./format";
import { SHAPES, type ShapeName } from "./shapes";
import {
  allIdentifiers,
  edgeValue,
  flowStats,
  filterAvailability,
  MAX_FILTER_STEPS,
  type FilterTarget,
  type ValueStats,
} from "./filter-axis";
import type { DatasetResponse } from "./types";


export type StyleChannel = "color" | "size" | "shape";
export const STYLE_CHANNELS: StyleChannel[] = ["color", "size", "shape"];
export type FlowChannel = "color" | "width";
export const FLOW_CHANNELS: FlowChannel[] = ["color", "width"];
export type ColorScale = "linear" | "quantile" | "log";
/** What a style applies to: points, or flows (for flow-only columns). */
export type StyleTarget = "points" | "flows";

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

export interface FlowStyleState {
  color: string | null;
  width: string | null;
  colorScale: ColorScale;
  colorReverse: boolean;
}

export const DEFAULT_FLOW_STYLE: FlowStyleState = {
  color: null,
  width: null,
  colorScale: "linear",
  colorReverse: false,
};

export const SUNSET = ["#fef3c7", "#f97316", "#9a3412"];
// Flows default to blue, so their number ramp stays blue; its light end is
// darker than Sunset's so thin lines stay visible on the base map.
export const FLOW_RAMP = ["#93c5fd", "#2563eb", "#172554"];
/** Flow line width in px: the default scales by weight, a Width column by its values. */
export const FLOW_WIDTH = { min: 1.5, max: 10 };
export const DEFAULT_POINT_COLOR = "#f97316";
export const MISSING_COLOR = "#a1a1aa";
export const RADIUS = { default: 8, min: 4, max: 13 };
export const MAX_SHAPE_VALUES = SHAPES.length;
// Past this many categories the rainbow's neighbouring colours look the same
// and the legend runs to thousands of rows.
export const MAX_COLOR_VALUES = MAX_FILTER_STEPS;

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
  const numbers: number[] = [];
  for (const node of dataset.nodes) {
    if (!node.properties || !(column in node.properties)) continue;
    keyed = true;
    const value = node.properties[column];
    if (isEmpty(value)) continue;
    const n = asNumber(value);
    if (n === null) numeric = false;
    else if (!unique.has(String(value))) numbers.push(n);
    unique.add(String(value));
  }
  const flows = flowStats(dataset, column);
  // Points and flows can share one table (e.g. GeoParquet), leaving flow
  // columns as empty keys on points: those still belong to flows.
  const onPoints = unique.size > 0 || (keyed && flows.unique === 0);
  return {
    onPoints,
    // Ids (see allIdentifiers) count as text: one colour per value, no size.
    numeric: onPoints && unique.size > 0 && numeric && !allIdentifiers(numbers),
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

function colorOption(numeric: boolean, unique: number, target: StyleTarget): ChannelAvailability {
  if (unique === 0) return { enabled: false, hint: { key: target === "points" ? "noValuesOnPoints" : "noValues" } };
  if (numeric) return { enabled: true, hint: { key: target === "points" ? "sunset" : "blues" } };
  if (unique > MAX_COLOR_VALUES) return { enabled: false, hint: { key: "tooMany", n: unique } };
  return { enabled: true, hint: { key: unique <= CATEGORY_COLORS.length ? "colorblind" : "rainbow" } };
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
    color: colorOption(profile.numeric, n, "points"),
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

/** Style channels for a flow-only column. */
export function flowChannelAvailability(profile: ColumnProfile): Record<FlowChannel, ChannelAvailability> {
  const { unique, numeric } = profile.flows;
  return {
    color: colorOption(numeric, unique, "flows"),
    width: numeric
      ? { enabled: true, hint: { key: "wider" } }
      : { enabled: false, hint: { key: "numbersOnly" } },
  };
}

/** Assign `channel` to `column`, clearing whatever the column or channel drove before. */
export function assignChannel<C extends string, S extends Record<C, string | null>>(
  state: S,
  channels: readonly C[],
  column: string,
  channel: C | null
): S {
  const next = { ...state };
  for (const c of channels) if (next[c] === column) (next as Record<C, string | null>)[c] = null;
  if (channel) (next as Record<C, string | null>)[channel] = column;
  return next;
}

export function channelForColumn<C extends string>(
  state: Record<C, string | null>,
  channels: readonly C[],
  column: string
): C | null {
  return channels.find((c) => state[c] === column) ?? null;
}

// ---------- Computing styles ----------

export interface PointStyle {
  color?: string;
  radius?: number;
  shape?: ShapeName;
}

type ColorSection =
  | { channel: "color"; column: string; kind: "ramp"; min: number; max: number; stops: string[] }
  | { channel: "color"; column: string; kind: "categories"; items: { label: string; color: string }[] };

export type LegendSection =
  | (ColorSection & { target: StyleTarget })
  | { target: "points"; channel: "size"; column: string; items: { value: number; radius: number }[] }
  | { target: "points"; channel: "shape"; column: string; items: { label: string; shape: ShapeName }[] }
  | { target: "flows"; channel: "width"; column: string; items: { value: number; width: number }[] };

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

/** Colour at 0..1 along a three-stop ramp. */
export function rampColor(stops: string[], t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  const seg = clamped <= 0.5 ? 0 : 1;
  const local = seg === 0 ? clamped / 0.5 : (clamped - 0.5) / 0.5;
  const a = hexToRgb(stops[seg]), b = hexToRgb(stops[seg + 1]);
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

type Item = { id: string; value: Scalar };

const pointItems = (dataset: DatasetResponse, column: string): Item[] =>
  dataset.nodes.map((n) => ({ id: n.id, value: n.properties?.[column] }));
const flowItems = (dataset: DatasetResponse, column: string): Item[] =>
  dataset.edges.map((e) => ({ id: e.id, value: edgeValue(e, column) }));

function numericValues(items: Item[]) {
  const values: number[] = [];
  for (const item of items) {
    const n = asNumber(item.value);
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

function categories(items: Item[]) {
  const unique = new Set<string>();
  for (const { value } of items) if (!isEmpty(value)) unique.add(String(value));
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

/** Colour per item: a ramp for numbers (missing values grey), else one colour per value. */
function colorBy(items: Item[], numeric: boolean, scale: ColorScale, reverse: boolean, ramp: string[]) {
  const colorOf = new Map<string, string>();
  if (numeric) {
    const values = numericValues(items);
    const { min, max } = range(values);
    const t = scaler(values, scale);
    const stops = reverse ? [...ramp].reverse() : ramp;
    for (const { id, value } of items) {
      const n = asNumber(value);
      colorOf.set(id, n === null ? MISSING_COLOR : rampColor(stops, t(n)));
    }
    return { colorOf, section: { channel: "color", kind: "ramp", min, max, stops } as const };
  }
  const cats = categories(items);
  const paletteOf = new Map(cats.map((c, i) => [c, rainbowColor(i, cats.length)]));
  for (const { id, value } of items) colorOf.set(id, isEmpty(value) ? MISSING_COLOR : paletteOf.get(String(value))!);
  const legendItems = cats.map((c) => ({ label: c, color: paletteOf.get(c)! }));
  return { colorOf, section: { channel: "color", kind: "categories", items: legendItems } as const };
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
    const { colorOf, section } = colorBy(
      pointItems(dataset, state.color),
      profiles.get(state.color)?.numeric ?? false,
      state.colorScale,
      state.colorReverse,
      SUNSET
    );
    for (const [id, color] of colorOf) styleOf(id).color = color;
    legend.push({ target: "points", column: state.color, ...section });
  }

  if (state.size) {
    const column = state.size;
    const { min, max } = range(numericValues(pointItems(dataset, column)));
    const span = max - min || 1;
    // Area-proportional: radius grows with the square root of the value.
    const radiusOf = (v: number) => RADIUS.min + Math.sqrt((v - min) / span) * (RADIUS.max - RADIUS.min);
    for (const node of dataset.nodes) {
      const n = asNumber(node.properties?.[column]);
      styleOf(node.id).radius = n === null ? RADIUS.min : radiusOf(n);
    }
    const samples = min === max ? [min] : [min, (min + max) / 2, max];
    legend.push({ target: "points", channel: "size", column, items: samples.map((v) => ({ value: v, radius: radiusOf(v) })) });
  }

  if (state.shape) {
    const column = state.shape;
    const cats = categories(pointItems(dataset, column)).slice(0, MAX_SHAPE_VALUES);
    const shapeOf = new Map(cats.map((c, i) => [c, SHAPES[i]]));
    for (const node of dataset.nodes) {
      const value = node.properties?.[column];
      styleOf(node.id).shape = isEmpty(value) ? "circle" : shapeOf.get(String(value)) ?? "circle";
    }
    legend.push({ target: "points", channel: "shape", column, items: cats.map((c) => ({ label: c, shape: shapeOf.get(c)! })) });
  }

  return { byNode, legend, active: legend.length > 0 };
}

export interface FlowStyle {
  color?: string;
  width?: number;
}

export interface FlowStyles {
  byEdge: Map<string, FlowStyle>;
  legend: LegendSection[];
}

export function computeFlowStyles(
  dataset: DatasetResponse,
  state: FlowStyleState,
  profiles: Map<string, ColumnProfile>
): FlowStyles {
  const byEdge = new Map<string, FlowStyle>();
  const legend: LegendSection[] = [];
  const styleOf = (id: string) => {
    let s = byEdge.get(id);
    if (!s) byEdge.set(id, (s = {}));
    return s;
  };

  if (state.color) {
    const { colorOf, section } = colorBy(
      flowItems(dataset, state.color),
      profiles.get(state.color)?.flows.numeric ?? false,
      state.colorScale,
      state.colorReverse,
      FLOW_RAMP
    );
    for (const [id, color] of colorOf) styleOf(id).color = color;
    legend.push({ target: "flows", column: state.color, ...section });
  }

  if (state.width) {
    const column = state.width;
    const items = flowItems(dataset, column);
    const { min, max } = range(numericValues(items));
    const span = max - min || 1;
    const widthOf = (v: number) => FLOW_WIDTH.min + ((v - min) / span) * (FLOW_WIDTH.max - FLOW_WIDTH.min);
    for (const { id, value } of items) {
      const n = asNumber(value);
      styleOf(id).width = n === null ? FLOW_WIDTH.min : widthOf(n);
    }
    const samples = min === max ? [min] : [min, (min + max) / 2, max];
    legend.push({ target: "flows", channel: "width", column, items: samples.map((v) => ({ value: v, width: widthOf(v) })) });
  }

  return { byEdge, legend };
}
