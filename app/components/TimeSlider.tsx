/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Figma "Time slider": play button, current step, a bar per step, a track
// with progress + thumb, and tick labels. Driven by the column assigned to the
// "Time" style: hours of the day, number ranges or distinct values.

import type { PointerEvent } from "react";
import { useI18n } from "@/lib/i18n";

const BAR_HEIGHT = 30;

type TimeSliderProps = {
  /** Column driving the slider, for the accessible name. */
  column: string;
  /** Readout label for each step. */
  labels: string[];
  /** A few labels spread under the track. */
  ticks: string[];
  /** Bar height per step (point count or flow weight). */
  totals: number[];
  step: number;
  onStepChange: (step: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
};

export default function TimeSlider({
  column,
  labels,
  ticks,
  totals,
  step,
  onStepChange,
  playing,
  onTogglePlay,
}: TimeSliderProps) {
  const { t, translateTimeLabel } = useI18n();
  const count = labels.length;
  let max = 1;
  for (const t of totals) if (t > max) max = t;
  const progress = (step + 0.5) / count;

  // Each step owns an equal slice of the track, matching the bars above it.
  function stepAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    return Math.min(count - 1, Math.max(0, Math.floor(fraction * count)));
  }

  return (
    <div className="flex w-full items-center gap-[16px] rounded-[12px] border border-line bg-surface/94 px-[16px] py-[12px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.3)] backdrop-blur-[6px]">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={t(playing ? "slider.pause" : "slider.play")}
        className="flex size-[40px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent hover:bg-[#1d4ed8]"
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

      <div className="flex max-w-[180px] min-w-[76px] shrink-0 flex-col whitespace-nowrap">
        <span className="text-[10px] leading-[14px] font-medium text-ink-muted">{t("slider.heading")}</span>
        <span className="truncate text-[18px] leading-[24px] font-semibold text-ink tabular-nums" title={translateTimeLabel(labels[step])}>
          {translateTimeLabel(labels[step])}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        {/* Bars and track form one drag surface: press anywhere and drag to scrub. */}
        <div
          className="flex cursor-pointer touch-none flex-col gap-[6px] select-none"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            // Stop the browser starting a native image drag or text selection.
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            onStepChange(stepAt(e));
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) onStepChange(stepAt(e));
          }}
        >
          <div className={`flex h-[30px] w-full items-end ${count > 48 ? "gap-px" : "gap-[3px]"}`} aria-hidden>
            {totals.map((_, i) => {
              const height = Math.max(3, Math.round((totals[i] / max) * BAR_HEIGHT));
              const color = i < step
                ? "bg-accent/70"
                : i === step
                  ? "bg-accent"
                  : "bg-line-strong/60";
              return <div key={i} className={`min-w-px flex-1 rounded-t-[2px] ${color}`} style={{ height }} />;
            })}
          </div>

          <div className="relative h-[16px] w-full rounded-[4px] outline-offset-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent-text">
            <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-[2px] bg-line" />
            <div className="absolute top-[6px] left-0 h-[4px] rounded-[2px] bg-accent" style={{ width: `${progress * 100}%` }} />
            <div className="absolute top-0 size-[16px] -translate-x-1/2" style={{ left: `${progress * 100}%` }}>
              <img
                src="/figma/slider-thumb.svg"
                width={22}
                height={22}
                alt=""
                draggable={false}
                className="pointer-events-none absolute top-[-2px] left-[-3px] max-w-none"
              />
            </div>
            <input
              type="range"
              min={0}
              max={count - 1}
              step={1}
              value={step}
              onChange={(e) => onStepChange(Number(e.currentTarget.value))}
              aria-label={t("slider.label", { column })}
              aria-valuetext={translateTimeLabel(labels[step])}
              // Keyboard access only; pointer input is handled by the drag surface.
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
              <span key={i} className={`truncate px-[2px] ${i === step ? "text-ink" : ""}`} title={translateTimeLabel(tick)}>
                {translateTimeLabel(tick)}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex w-full justify-between gap-[8px] text-[11px] leading-[14px] whitespace-nowrap text-ink-muted">
            {ticks.map((tick, i) => (
              <span key={i} className="min-w-0 truncate">
                {translateTimeLabel(tick)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
