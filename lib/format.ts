/**
 * Number for legends and slider labels. Large values are compacted
 * (18000 → "18K"); below 10,000 the full value is kept, so years and other
 * small values stay distinct (2019, not "2K").
 */
export const formatValue = (n: number) =>
  Math.abs(n) >= 10_000
    ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : new Intl.NumberFormat("en", { maximumFractionDigits: 2, useGrouping: false }).format(n);
