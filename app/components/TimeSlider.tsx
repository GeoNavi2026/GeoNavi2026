/* eslint-disable @next/next/no-img-element -- static SVG icons exported from Figma */

// Figma "Time slider": play button, current time, trips-per-hour bars,
// a track with progress + thumb, and hour tick labels.

import type { PointerEvent } from "react";
import { formatHour } from "@/lib/time";

const TICKS = ["12 AM", "6 AM", "12 PM", "6 PM", "11 PM"];
const BAR_HEIGHT = 30;

type TimeSliderProps = {
  /** Total edge weight for each of the 24 hours. */
  totals: number[];
  hour: number;
  onHourChange: (hour: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
};

export default function TimeSlider({ totals, hour, onHourChange, playing, onTogglePlay }: TimeSliderProps) {
  const max = Math.max(1, ...totals);
  const progress = (hour + 0.5) / 24;

  // Each hour owns 1/24 of the track, matching the bars above it.
  function hourAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    return Math.min(23, Math.max(0, Math.floor(fraction * 24)));
  }

  return (
    <div className="flex w-full items-center gap-[16px] rounded-[12px] border border-line bg-surface/94 px-[16px] py-[12px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.3)] backdrop-blur-[6px]">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? "Pause" : "Play"}
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

      <div className="flex w-[76px] shrink-0 flex-col whitespace-nowrap">
        <span className="text-[10px] leading-[14px] font-medium text-ink-muted">TIME</span>
        <span className="text-[18px] leading-[24px] font-semibold text-ink tabular-nums">
          {formatHour(hour)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        <div className="flex h-[30px] w-full items-end gap-[3px]" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => {
            const height = Math.max(3, Math.round((totals[i] / max) * BAR_HEIGHT));
            const color = i < hour
              ? "bg-accent/70"
              : i === hour
                ? "bg-accent"
                : "bg-line-strong/60";
            return <div key={i} className={`min-w-px flex-1 rounded-t-[2px] ${color}`} style={{ height }} />;
          })}
        </div>

        <div
          className="relative h-[16px] w-full cursor-pointer touch-none rounded-[4px] outline-offset-4 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent-text"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onHourChange(hourAt(e));
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) onHourChange(hourAt(e));
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 rounded-[2px] bg-line" />
          <div className="absolute top-[6px] left-0 h-[4px] rounded-[2px] bg-accent" style={{ width: `${progress * 100}%` }} />
          <div className="absolute top-0 size-[16px] -translate-x-1/2" style={{ left: `${progress * 100}%` }}>
            <img src="/figma/slider-thumb.svg" width={22} height={22} alt="" className="absolute top-[-2px] left-[-3px] max-w-none" />
          </div>
          <input
            type="range"
            min={0}
            max={23}
            step={1}
            value={hour}
            onChange={(e) => onHourChange(Number(e.currentTarget.value))}
            aria-label="Time of day"
            aria-valuetext={formatHour(hour)}
            // Keyboard access only; pointer input is handled by the track above.
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          />
        </div>

        <div className="flex w-full justify-between text-[11px] leading-[14px] whitespace-nowrap text-ink-muted">
          {TICKS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
