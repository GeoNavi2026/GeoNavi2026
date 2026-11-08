// Look of the flow lines themselves, independent of any column: a colour, a
// dash pattern, whether the dashes move along the flow, and whether each flow
// shows an arrowhead. (Column-driven colour and width live in point-style.ts;
// a flow's column colour wins over the colour chosen here.)

export const DASH_STYLES = ["solid", "dashed", "dotted", "dashdot", "longdash"] as const;
export type DashStyle = (typeof DASH_STYLES)[number];

/**
 * Colours offered for the flow lines, picked to read on the light base map.
 * `name` is the suffix of the `line.color.*` message that labels the swatch.
 */
export const LINE_COLORS = [
  { name: "blue", value: "#2563eb" },
  { name: "red", value: "#dc2626" },
  { name: "orange", value: "#ea580c" },
  { name: "green", value: "#16a34a" },
  { name: "purple", value: "#9333ea" },
  { name: "black", value: "#18181b" },
  { name: "gray", value: "#71717a" },
] as const;

/** Light and dark end of the default colour, which ramps with each flow's weight. */
export const WEIGHT_RAMP = ["#60a5fa", "#1d4ed8"] as const;

export interface FlowLineStyle {
  /** One colour for every flow as "#rrggbb", or null for the default: light to dark blue by weight. */
  color: string | null;
  dash: DashStyle;
  /** Slide the dashes along each flow, from its origin to its destination. */
  animate: boolean;
  /** Draw an arrowhead on each flow, pointing the way it goes. */
  arrows: boolean;
}

export const DEFAULT_LINE_STYLE: FlowLineStyle = { color: null, dash: "solid", animate: false, arrows: false };

/**
 * Dash patterns as MapLibre reads `line-dasharray`: alternating dash and gap
 * lengths, in multiples of the line's width (so they scale with thick flows).
 * Solid has none.
 */
export const DASH_PATTERNS: Record<DashStyle, readonly number[] | null> = {
  solid: null,
  dashed: [3, 2],
  dotted: [1, 1.5],
  dashdot: [4, 1.5, 1, 1.5],
  longdash: [7, 3],
};

// Arrowheads and moving dashes are drawn only while at most this many flows are
// shown: past it they are clutter, and every animation frame redraws all flows.
// MapLibre also fails outright on ~65k icons in one tile (which a zoomed-out
// map of a big dataset reaches). Filtering or isolating brings them back.
export const MAX_DECORATED_FLOWS = 10_000;

const sum = (values: readonly number[]) => values.reduce((total, v) => total + v, 0);

/**
 * `pattern` moved `shift` further along the line (0 < shift < one period), as a
 * dash array. The line starts partway through the pattern: from the point
 * `period - shift` into it, then the rest of the pattern, so everything seen
 * moves toward the end of the line.
 */
function shiftedPattern(pattern: readonly number[], shift: number): number[] {
  const cut = sum(pattern) - shift;
  const before: number[] = [];
  const after: number[] = [];
  // Whether the first segment after the cut is a dash (even index) or a gap.
  let startsWithDash = true;
  let start = 0;
  pattern.forEach((length, i) => {
    const end = start + length;
    if (end <= cut) before.push(length);
    else {
      if (start >= cut) after.push(length);
      else {
        // The cut falls inside this segment: its first part ends the array and
        // the rest starts it. (The ends join seamlessly when both are dashes.)
        before.push(cut - start);
        after.push(end - cut);
      }
      if (after.length === 1) startsWithDash = i % 2 === 0;
    }
    start = end;
  });
  // A dash array has to start with a dash: a zero-length one is invisible.
  return startsWithDash ? [...after, ...before] : [0, ...after, ...before];
}


export function dashFrames(pattern: readonly number[], steps: number): number[][] {
  const period = sum(pattern);
  return Array.from({ length: steps }, (_, i) => (i === 0 ? [...pattern] : shiftedPattern(pattern, (period * i) / steps)));
}
