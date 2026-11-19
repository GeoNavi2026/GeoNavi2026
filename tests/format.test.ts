import { describe, expect, it } from "vitest";
import {
  formatAxisLabel,
  formatAxisSpan,
  formatHour,
  formatHourTick,
  formatNumber,
  formatValue,
  pluralCategory,
} from "../lib/format";

describe("number and axis formatting", () => {
  it("formats numbers and compact values in both languages", () => {
    expect(formatNumber(18287, "en")).toBe("18,287");
    expect(formatNumber(18287, "pt-BR")).toBe("18.287");
    expect(formatValue(2019, "en")).toBe("2019");
    expect(formatValue(18000, "en")).toBe("18K");
    expect(formatValue(18000, "pt-BR")).toContain("18");
  });

  it("uses language-specific plural rules", () => {
    expect(pluralCategory(1, "en")).toBe("one");
    expect(pluralCategory(2, "en")).toBe("other");
    expect(pluralCategory(0, "pt-BR")).toBe("one");
  });

  it("formats hours and ticks", () => {
    expect(formatHour(0, "en")).toBe("12:00 AM");
    expect(formatHour(18, "en")).toBe("6:00 PM");
    expect(formatHour(6, "pt-BR")).toBe("06:00");
    expect(formatHourTick(0, "en")).toBe("12 AM");
    expect(formatHourTick(18, "pt-BR")).toBe("18h");
  });

  it("formats every axis label kind and spans", () => {
    expect(formatAxisLabel({ kind: "hour", hour: 8 }, "en")).toBe("8:00 AM");
    expect(formatAxisLabel({ kind: "hourTick", hour: 12 }, "en")).toBe("12 PM");
    expect(formatAxisLabel({ kind: "value", value: 12.5 }, "en")).toBe("12.5");
    expect(formatAxisLabel({ kind: "range", from: 1, to: 10 }, "en")).toBe("1–10");
    expect(formatAxisLabel({ kind: "text", text: "bus" }, "en")).toBe("bus");
    expect(formatAxisSpan({ kind: "range", from: 10000, to: 20000 }, { kind: "range", from: 20000, to: 30000 }, "en"))
      .toBe("10K – 30K");
    expect(formatAxisSpan({ kind: "value", value: 1 }, { kind: "text", text: "bus" }, "en"))
      .toBe("1 – bus");
  });
});
