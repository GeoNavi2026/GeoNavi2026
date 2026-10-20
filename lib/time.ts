// Hour-of-day helpers for the map's time slider.

import type { DatasetResponse } from "./types";

/**
 * Hour (0–23) of an edge's `t` value, or null if it has none.
 * Accepts timestamps ("2026-03-02T08:15:00", "2026-03-02 08:15") and hour labels ("8", "08:00").
 */
export function edgeHour(t: string | undefined): number | null {
  if (!t) return null;
  const match = /[T ](\d{2}):/.exec(t) ?? /^(\d{1,2})(?::\d{2})?$/.exec(t.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  return hour >= 0 && hour <= 23 ? hour : null;
}

/** Total edge weight per hour, or null when no edge carries a usable time. */
export function hourlyTotals(dataset: DatasetResponse): number[] | null {
  const totals = new Array<number>(24).fill(0);
  let any = false;
  for (const edge of dataset.edges) {
    const hour = edgeHour(edge.t);
    if (hour === null) continue;
    totals[hour] += edge.weight;
    any = true;
  }
  return any ? totals : null;
}

export function formatHour(hour: number) {
  const h12 = hour % 12 || 12;
  return `${h12}:00 ${hour < 12 ? "AM" : "PM"}`;
}
