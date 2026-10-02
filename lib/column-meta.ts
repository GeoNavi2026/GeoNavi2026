import type { ColumnMeta } from "./types";

/** Maximum number of distinct string values before we stop listing categories. */
const MAX_CATEGORIES = 50;

type PropertiesHolder = { properties?: Record<string, number | string> };

/**
 * Scan an array of nodes or edges and return metadata for every property key
 * found across their `properties` maps.
 */
export function extractColumns(items: PropertiesHolder[]): ColumnMeta[] | undefined {
  const stats = new Map<
    string,
    { type: "number" | "string"; min: number; max: number; categories: Set<string> }
  >();

  for (const item of items) {
    if (!item.properties) continue;
    for (const [key, value] of Object.entries(item.properties)) {
      let entry = stats.get(key);
      if (!entry) {
        entry = {
          type: typeof value === "number" ? "number" : "string",
          min: Infinity,
          max: -Infinity,
          categories: new Set(),
        };
        stats.set(key, entry);
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        entry.min = Math.min(entry.min, value);
        entry.max = Math.max(entry.max, value);
      } else if (typeof value === "string") {
        if (entry.categories.size < MAX_CATEGORIES) {
          entry.categories.add(value);
        }
      }
    }
  }

  if (stats.size === 0) return undefined;

  return [...stats].map(([key, { type, min, max, categories }]): ColumnMeta => {
    const col: ColumnMeta = { key, type };
    if (type === "number" && Number.isFinite(min) && Number.isFinite(max)) {
      col.min = min;
      col.max = max;
    }
    if (type === "string" && categories.size > 0 && categories.size <= MAX_CATEGORIES) {
      col.categories = [...categories].sort();
    }
    return col;
  });
}
