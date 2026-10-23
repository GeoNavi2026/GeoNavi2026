"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icon exported from Figma */

// Figma pages "2 · Map" and "3 · Customization": sidebar with the uploaded
// file and its columns (each with a style control), the map, the legend and
// the time slider. "New upload" and dropping a file anywhere replace the data
// in place.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  assignChannel,
  channelForColumn,
  computePointStyles,
  DEFAULT_POINT_STYLE,
  profileColumn,
  type PointStyleState,
} from "@/lib/point-style";
import { hourlyTotals } from "@/lib/time";
import { useUpload } from "@/lib/upload-store";
import { UPLOAD_FORMATS_HINT, useFileUpload } from "@/lib/use-file-upload";
import Button from "./Button";
import ColumnItem from "./ColumnItem";
import ColumnStyleControl from "./ColumnStyleControl";
import DashedOutline from "./DashedOutline";
import Logo from "./Logo";
import MapLegend from "./MapLegend";
import TimeSlider from "./TimeSlider";

// MapLibre needs `window`, so never render the map on the server.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#f2efe9]" />,
});

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");

export default function MapScreen() {
  const router = useRouter();
  const { upload, setUpload } = useUpload();

  // Nothing uploaded (e.g. a page refresh): go back to the upload screen.
  useEffect(() => {
    if (!upload) router.replace("/");
  }, [upload, router]);

  const totals = useMemo(() => (upload ? hourlyTotals(upload.dataset) : null), [upload]);
  // Start on the busiest hour.
  const peakHour = totals ? totals.indexOf(Math.max(...totals)) : 0;
  const [chosenHour, setChosenHour] = useState<number | null>(null);
  const hour = chosenHour ?? peakHour;
  const [playing, setPlaying] = useState(false);
  const [pointStyle, setPointStyle] = useState<PointStyleState>(DEFAULT_POINT_STYLE);
  const { busy, error, uploadFile, openPicker, inputProps } = useFileUpload(setUpload);
  // Counts nested dragenter/dragleave pairs so the overlay doesn't flicker over child elements.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  // New data: start from a clean slate (no styles, busiest hour, paused).
  const datasetId = upload?.dataset.meta.id;
  const [stateFor, setStateFor] = useState(datasetId);
  if (stateFor !== datasetId) {
    setStateFor(datasetId);
    setPointStyle(DEFAULT_POINT_STYLE);
    setChosenHour(null);
    setPlaying(false);
  }

  const profiles = useMemo(
    () => new Map((upload?.columns ?? []).map((c) => [c.name, profileColumn(upload!.dataset, c.name)])),
    [upload]
  );
  const pointStyles = useMemo(
    () => (upload ? computePointStyles(upload.dataset, pointStyle, profiles) : null),
    [upload, pointStyle, profiles]
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setChosenHour((h) => ((h ?? peakHour) + 1) % 24), 1000);
    return () => clearInterval(id);
  }, [playing, peakHour]);

  if (!upload) return null;

  return (
    <div
      className="relative flex h-dvh w-full flex-col bg-canvas md:flex-row"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        if (!busy) setDragging(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
      }}
    >
      <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col gap-[20px] overflow-y-auto border-line bg-surface p-[20px] max-md:border-b md:h-full md:max-h-none md:w-[340px] md:border-r">
        <div className="flex w-full items-center justify-between">
          <Logo size="sm" />
          <Button variant="secondary" onClick={openPicker} disabled={busy !== null}>
            New upload
          </Button>
          <input {...inputProps} />
        </div>

        {error && (
          <p role="alert" className="-mt-[8px] text-[13px] leading-[18px] text-[#f87171]">
            {error}
          </p>
        )}

        <div className="flex w-full items-center gap-[12px] rounded-[12px] border border-line bg-canvas p-[12px]">
          <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[10px] bg-accent-soft">
            <img src="/figma/icon-file-spreadsheet.svg" width={20} height={20} alt="" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[2px] whitespace-nowrap">
            <p className="truncate text-[14px] leading-[20px] font-medium text-ink" title={upload.fileName}>
              {upload.fileName}
            </p>
            <p className="text-[12px] leading-[16px] text-ink-muted">
              {plural(upload.rowCount, "row")} · {plural(upload.columns.length, "column")}
            </p>
          </div>
        </div>

        <section className="flex w-full flex-col gap-[12px]" aria-labelledby="columns-heading">
          <div className="flex flex-col gap-[2px]">
            <div className="flex items-center gap-[8px]">
              <h2 id="columns-heading" className="text-[15px] leading-[22px] font-semibold text-ink">
                Columns
              </h2>
              <span className="rounded-full bg-accent-soft px-[8px] py-px text-[12px] leading-[18px] font-medium text-accent-text">
                {upload.columns.length}
              </span>
            </div>
            <p className="text-[12px] leading-[16px] text-ink-muted">Pick a style next to a column to drive the points</p>
          </div>
          <ul className="flex w-full flex-col gap-[2px]">
            {upload.columns.map((column) => (
              <ColumnItem key={column.name} column={column}>
                <ColumnStyleControl
                  column={column.name}
                  positional={column.kind === "lat" || column.kind === "lon"}
                  profile={profiles.get(column.name)!}
                  channel={channelForColumn(pointStyle, column.name)}
                  onChannelChange={(channel) => setPointStyle((s) => assignChannel(s, column.name, channel))}
                  colorScale={pointStyle.colorScale}
                  colorReverse={pointStyle.colorReverse}
                  onColorOptionsChange={(options) => setPointStyle((s) => ({ ...s, ...options }))}
                />
              </ColumnItem>
            ))}
          </ul>
        </section>
      </aside>

      <main className="relative min-h-0 flex-1">
        <MapView dataset={upload.dataset} hour={totals ? hour : null} pointStyles={pointStyles} />
        {/* Legend sits above the time slider when there is one. */}
        <div
          className={`pointer-events-none absolute left-[16px] flex items-end ${
            totals ? "top-[16px] bottom-[154px]" : "top-[16px] bottom-[42px]"
          }`}
        >
          <div className="pointer-events-auto max-h-full">
            <MapLegend key={datasetId} sections={pointStyles?.legend ?? []} />
          </div>
        </div>
        {/* Only datasets with a time column get the time slider. */}
        {totals && (
          <div className="pointer-events-none absolute inset-x-[16px] bottom-[42px]">
            <div className="pointer-events-auto">
              <TimeSlider
                totals={totals}
                hour={hour}
                onHourChange={(h) => {
                  setPlaying(false);
                  setChosenHour(h);
                }}
                playing={playing}
                onTogglePlay={() => setPlaying((p) => !p)}
              />
            </div>
          </div>
        )}
      </main>

      {(dragging || busy) && (
        <div
          role="status"
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-canvas/70 p-4 backdrop-blur-[2px]"
        >
          <div className="relative flex w-[420px] max-w-full flex-col items-center gap-[12px] rounded-[14px] bg-canvas px-[32px] py-[40px]">
            <DashedOutline radius={14} active />
            <span className="flex size-[60px] items-center justify-center rounded-full bg-accent-soft">
              <img src="/figma/icon-cloud-upload.svg" width={28} height={28} alt="" />
            </span>
            <p className="text-center text-[16px] leading-[24px] font-medium text-ink">
              {busy ?? "Drop to replace the current data"}
            </p>
            {!busy && <p className="text-center text-[13px] leading-[18px] text-ink-muted">{UPLOAD_FORMATS_HINT}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
