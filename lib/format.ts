// Number and time formatting for the UI language. lib/ code hands the UI raw
// numbers (legend values, slider steps, hint counts); components format them
// here so separators, suffixes and clock style follow the selected language.

export type Lang = "en" | "pt-BR";

const LOCALE: Record<Lang, string> = { en: "en-US", "pt-BR": "pt-BR" };

// Intl formatters are costly to build; keep one per language.
const cache = new Map<string, Intl.NumberFormat | Intl.PluralRules>();
function cached<T extends Intl.NumberFormat | Intl.PluralRules>(key: string, make: () => T): T {
  let value = cache.get(key) as T | undefined;
  if (!value) cache.set(key, (value = make()));
  return value;
}

/** Full number with grouping: 18287 → "18,287" (en) / "18.287" (pt-BR). */
export function formatNumber(n: number, lang: Lang) {
  return cached(`number:${lang}`, () => new Intl.NumberFormat(LOCALE[lang])).format(n);
}

/**
 * Compact number for legends and slider labels. Large values are compacted
 * (18000 → "18K" / "18 mil"); below 10,000 the full value is kept, so years
 * and other small values stay distinct (2019, not "2K").
 */
export function formatValue(n: number, lang: Lang) {
  const formatter = Math.abs(n) >= 10_000
    ? cached(`compact:${lang}`, () => new Intl.NumberFormat(LOCALE[lang], { notation: "compact", maximumFractionDigits: 1 }))
    : cached(`value:${lang}`, () => new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 2, useGrouping: false }));
  return formatter.format(n);
}

/** CLDR plural category, so pt-BR treats 0 as singular like 1. */
export function pluralCategory(count: number, lang: Lang): "one" | "other" {
  return cached(`plural:${lang}`, () => new Intl.PluralRules(LOCALE[lang])).select(count) === "one" ? "one" : "other";
}

/** Slider readout for an hour of the day: "6:00 PM" (en) / "18:00" (pt-BR). */
export function formatHour(hour: number, lang: Lang) {
  if (lang === "pt-BR") return `${String(hour).padStart(2, "0")}:00`;
  return `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;
}

/** Short hour tick under the slider: "6 PM" (en) / "18h" (pt-BR). */
export function formatHourTick(hour: number, lang: Lang) {
  if (lang === "pt-BR") return `${hour}h`;
  return `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
}

/** A Time slider step or tick, described with raw values so it can be formatted per language. */
export type AxisLabel =
  | { kind: "hour"; hour: number }
  | { kind: "hourTick"; hour: number }
  | { kind: "value"; value: number }
  | { kind: "range"; from: number; to: number }
  | { kind: "text"; text: string };

export function formatAxisLabel(label: AxisLabel, lang: Lang) {
  switch (label.kind) {
    case "hour":
      return formatHour(label.hour, lang);
    case "hourTick":
      return formatHourTick(label.hour, lang);
    case "value":
      return formatValue(label.value, lang);
    case "range":
      return `${formatValue(label.from, lang)}–${formatValue(label.to, lang)}`;
    case "text":
      return label.text;
  }
}

/**
 * Menu hint from lib/ code, as a message key plus raw count. The UI turns it
 * into text with i18n's `hint()`, formatting `n` for the selected language.
 */
export type Hint =
  | {
      key:
        | "pointsOnly"
        | "noValuesOnPoints"
        | "sunset"
        | "rainbow"
        | "colorblind"
        | "bigger"
        | "numbersOnly"
        | "noValues"
        | "needsTwo"
        | "hours";
    }
  | { key: "tooMany" | "shapes" | "rangeSteps" | "valueSteps"; n: number };
