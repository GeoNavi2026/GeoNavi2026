/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Filter bar at the bottom of the map (Figma "Time slider", generalised): a
// column picker, a One/Many mode toggle, play button, current selection, a bar
// per step, a track and tick labels. It steps through the values of the picked
// column (hours of the day, number ranges or distinct values) and the map
// shows only the points or flows in the selected steps.
//
// One: click or drag picks a single step.
// Many: drag selects a range; Ctrl/⌘-click toggles single steps; Shift-click
// extends the range from where the last drag started.

import { useRef, type PointerEvent } from "react";
import type { FilterAxis } from "@/lib/filter-axis";
import type { Hint } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const BAR_HEIGHT = 30;

export type FilterMode = "one" | "many";

export type FilterColumnOption = {
  name: string;
  /** Named like a time column; picked by default. */
  isTime: boolean;
  enabled: boolean;
  /** How the column would step, or why it can't be used. */
  hint: Hint;
};

type FilterBarProps = {
  options: FilterColumnOption[];
  /** Picked column, or null for no filter (everything shown). */
  column: string | null;
  onColumnChange: (column: string | null) => void;
  /** Steps of the picked column; null when no column is picked. */
  axis: FilterAxis | null;
  mode: FilterMode;
  onModeChange: (mode: FilterMode) => void;
  /** Selected steps, sorted; one step in "one" mode. */
  selection: number[];
  onSelectionChange: (steps: number[]) => void;
  playing: boolean;
  onTogglePlay: () => void;
};

const range = (a: number, b: number) =>
  Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);

/** True when the steps are one run of neighbours, e.g. [3, 4, 5]. */
const contiguous = (steps: number[]) => steps.every((s, i) => i === 0 || s === steps[i - 1] + 1);

export default function FilterBar({
  options,
  column,
  onColumnChange,
  axis,
  mode,
  onModeChange,
  selection,
  onSelectionChange,
  playing,
  onTogglePlay,
}: FilterBarProps) {
  const { t, hint, plural, formatAxisLabel, formatAxisSpan } = useI18n();
  // Where the current drag (or the last one) started, for range selection.
  const anchor = useRef<number | null>(null);
  const labels = axis?.labels ?? [];
  const ticks = axis?.ticks ?? [];
  const totals = axis?.totals ?? [];
  const count = labels.length;
  const selected = new Set(selection);
  const first = selection[0] ?? 0;
  const last = selection[selection.length - 1] ?? 0;

  // Ordered values (hours, numbers) read as a span; text values are only
  // neighbours alphabetically, so they're listed instead.
  const ordered = axis !== null && labels[first]?.kind !== "text";
  const current = !axis
    ? t("filter.all")
    : selection.length === 1
      ? formatAxisLabel(labels[first])
      : !ordered
        ? selection.map((s) => formatAxisLabel(labels[s])).join(", ")
        : contiguous(selection)
          ? formatAxisSpan(labels[first], labels[last])
          : plural(selection.length, "filter.selected");
  // Full list for the tooltip when separate values are picked.
  const currentDetail = axis && selection.length > 1 ? selection.map((s) => formatAxisLabel(labels[s])).join(", ") : current;

  let max = 1;
  for (const total of totals) if (total > max) max = total;

  // Each step owns an equal slice of the track, matching the bars above it.
  function stepAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    return Math.min(count - 1, Math.max(0, Math.floor(fraction * count)));
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // Stop the browser starting a native image drag or text selection.
    e.preventDefault();
    const step = stepAt(e);
    if (mode === "many" && (e.ctrlKey || e.metaKey)) {
      // Toggle one step; keep at least one selected.
      const next = selected.has(step) ? selection.filter((s) => s !== step) : [...selection, step].sort((a, b) => a - b);
      if (next.length) onSelectionChange(next);
      anchor.current = step;
      return;
    }
    if (mode === "many" && e.shiftKey && anchor.current !== null) {
      onSelectionChange(range(anchor.current, step));
      return;
    }
    anchor.current = step;
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelectionChange([step]);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const step = stepAt(e);
    onSelectionChange(mode === "many" && anchor.current !== null ? range(anchor.current, step) : [step]);
  }

  return (
    <div className="flex w-full items-center gap-[16px] rounded-[12px] border border-line bg-surface/94 px-[16px] py-[12px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.3)] backdrop-blur-[6px]">
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={!axis}
        aria-label={t(playing ? "slider.pause" : "slider.play")}
        className="flex size-[40px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent hover:bg-[#1d4ed8] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-accent"
      >
        {playing ? (
          <span className="flex gap-[4px]" aria-hidden>
            <span className="h-[14px] w-[4px] rounded-[1px] bg-white" />
            <span className="h-[14px] w-[4px] rounded-[1px] bg-white" />
          </span>
        ) : (
          <img src="/figma/icon-play.svg" width={18} height={18} alt="" />
        )}
      </button>

      <div className="flex w-[300px] shrink-0 flex-col gap-[4px] max-sm:w-[180px]">
        <div className="flex min-w-0 items-center gap-[8px]">
          <label className="flex min-w-0 flex-1 items-center gap-[8px]">
            <span className="shrink-0 text-[10px] leading-[14px] font-medium text-ink-muted">{t("filter.heading")}</span>
            <select
              value={column ?? ""}
              onChange={(e) => onColumnChange(e.currentTarget.value || null)}
              aria-label={t("filter.column")}
              className="h-[24px] min-w-0 flex-1 cursor-pointer truncate rounded-[6px] border border-line bg-chip px-[6px] font-mono text-[12px] leading-[16px] text-ink scheme-dark outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent-text"
            >
              <option value="">{t("filter.none")}</option>
              {options.map((o) => (
                <option key={o.name} value={o.name} disabled={!o.enabled} title={hint(o.hint)}>
                  {/* The reason a column can't be used stays visible in the list. */}
                  {o.enabled ? o.name : `${o.name} (${hint(o.hint)})`}
                </option>
              ))}
            </select>
          </label>
          <div role="radiogroup" aria-label={t("filter.mode")} className="flex shrink-0 gap-[2px] rounded-[6px] bg-canvas p-[2px]">
            {(["one", "many"] as FilterMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                disabled={!axis}
                onClick={() => onModeChange(m)}
                title={m === "many" ? t("filter.manyHint") : undefined}
                className={`cursor-pointer rounded-[4px] px-[7px] py-[2px] text-[11px] leading-[16px] font-medium outline-offset-1 focus-visible:outline-2 focus-visible:outline-accent-text disabled:cursor-default disabled:opacity-40 ${
                  mode === m ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t(m === "one" ? "filter.one" : "filter.many")}
              </button>
            ))}
          </div>
        </div>
        <span
          className={`truncate text-[18px] leading-[24px] font-semibold tabular-nums ${axis ? "text-ink" : "text-ink-muted"}`}
          title={currentDetail}
          aria-live="polite"
        >
          {current}
        </span>
      </div>

      {axis ? (
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          {/* Bars and track form one surface: press, drag or Ctrl/⌘-click to select. */}
          <div
            className="flex cursor-pointer touch-none flex-col gap-[6px] select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            // On a Mac, Ctrl-click is a right-click; keep the menu from opening over a toggle.
            onContextMenu={(e) => {
              if (mode === "many" && e.ctrlKey) e.preventDefault();
            }}
            title={mode === "many" ? t("filter.manyHint") : undefined}
          >
            <div className={`flex h-[30px] w-full items-end ${count > 48 ? "gap-px" : "gap-[3px]"}`} aria-hidden>
              {totals.map((total, i) => {
                const height = Math.max(3, Math.round((total / max) * BAR_HEIGHT));
                // One: earlier steps tinted as "played". Many: only selected steps.
                const color = selected.has(i)
                  ? "bg-accent"
                  : mode === "one" && i < first
                    ? "bg-accent/70"
                    : "bg-line-strong/60";
                return <div key={i} className={`min-w-px flex-1 rounded-t-[2px] ${color}`} style={{ height }} />;
              })}
            </div>

            <div className="relative h-[16px] w-full rounded-[4px] outline-offset-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent-text">
              <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-[2px] bg-line" />
              {mode === "one" ? (
                <>
                  <div
                    className="absolute top-[6px] left-0 h-[4px] rounded-[2px] bg-accent"
                    style={{ width: `${((first + 0.5) / count) * 100}%` }}
                  />
                  <div className="absolute top-0 size-[16px] -translate-x-1/2" style={{ left: `${((first + 0.5) / count) * 100}%` }}>
                    <img
                      src="/figma/slider-thumb.svg"
                      width={22}
                      height={22}
                      alt=""
                      draggable={false}
                      className="pointer-events-none absolute top-[-2px] left-[-3px] max-w-none"
                    />
                  </div>
                </>
              ) : (
                // Many: a highlighted segment under each selected step.
                selection.map((s) => (
                  <div
                    key={s}
                    className="absolute top-[4px] h-[8px] rounded-[2px] bg-accent"
                    style={{ left: `${(s / count) * 100}%`, width: `${(1 / count) * 100}%` }}
                  />
                ))
              )}
              <input
                type="range"
                min={0}
                max={count - 1}
                step={1}
                value={first}
                // Keyboard: move the selection (all selected steps) by one step.
                onChange={(e) => {
                  const shift = Number(e.currentTarget.value) - first;
                  const moved = selection.map((s) => s + shift);
                  if (moved.every((s) => s >= 0 && s < count)) onSelectionChange(moved);
                }}
                aria-label={t("slider.label", { column: axis.column })}
                aria-valuetext={current}
                // Keyboard access only; pointer input is handled by the surface above.
                className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
              />
            </div>
          </div>

          {ticks.length === count ? (
            // One label per step, centred under its bar.
            <div
              className="grid w-full text-center text-[11px] leading-[14px] whitespace-nowrap text-ink-muted"
              style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
            >
              {ticks.map((tick, i) => (
                <span key={i} className={`truncate px-[2px] ${selected.has(i) ? "text-ink" : ""}`} title={formatAxisLabel(tick)}>
                  {formatAxisLabel(tick)}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex w-full justify-between gap-[8px] text-[11px] leading-[14px] whitespace-nowrap text-ink-muted">
              {ticks.map((tick, i) => (
                <span key={i} className="min-w-0 truncate">
                  {formatAxisLabel(tick)}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[72px] min-w-0 flex-1 items-center justify-center rounded-[8px] border border-dashed border-line-strong/60 px-[12px] text-center text-[12px] leading-[16px] text-ink-muted">
          {t("filter.empty")}
        </div>
      )}
    </div>
  );
}
