"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icon exported from Figma */

// Figma pages "2 · Map" and "3 · Customization": sidebar with the uploaded
// file and its columns (each with a style control), the map, the legend and
// the filter bar, which steps through the values of a column picked in it.
// "New upload" and dropping a file anywhere replace the data in place.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  assignChannel,
  channelForColumn,
  computePointStyles,
  DEFAULT_POINT_STYLE,
  filterOption,
  profileColumn,
  type PointStyleState,
} from "@/lib/point-style";
import { buildFilterAxis } from "@/lib/filter-axis";
import { useUpload } from "@/lib/upload-store";
import { useI18n } from "@/lib/i18n";
import { useFileUpload } from "@/lib/use-file-upload";
import Button from "./Button";
import ColumnItem from "./ColumnItem";
import ColumnStyleControl from "./ColumnStyleControl";
import DashedOutline from "./DashedOutline";
import LanguageToggle from "./LanguageToggle";
import Logo from "./Logo";
import MapLegend from "./MapLegend";
import FilterBar, { type FilterColumnOption, type FilterMode } from "./FilterBar";

// MapLibre needs `window`, so never render the map on the server.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#f2efe9]" />,
});

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");
// Room the filter bar takes at the bottom of the map, kept clear when fitting the data.
const FILTER_BAR_SPACE = 210;

export default function MapScreen() {
  const router = useRouter();
  const { upload, setUpload } = useUpload();
  const { t, plural } = useI18n();

  // Nothing uploaded (e.g. a page refresh): go back to the upload screen.
  useEffect(() => {
    if (!upload) router.replace("/");
  }, [upload, router]);

  // Selected filter steps (sorted); null until the user picks, meaning the busiest step.
  const [chosenSteps, setChosenSteps] = useState<number[] | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("one");
  // Points whose flows are isolated by double-click (separate from the filter bar).
  const [isolated, setIsolated] = useState<string[] | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pointStyle, setPointStyle] = useState<PointStyleState>(DEFAULT_POINT_STYLE);
  // Column picked in the filter bar; undefined until the user picks one (or "No filter").
  const [filterChoice, setFilterChoice] = useState<string | null | undefined>(undefined);
  const { busy, error, uploadFile, openPicker, inputProps } = useFileUpload(setUpload);
  // Counts nested dragenter/dragleave pairs so the overlay doesn't flicker over child elements.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  // New data: start from a clean slate (no styles, paused).
  const datasetId = upload?.dataset.meta.id;
  const [stateFor, setStateFor] = useState(datasetId);
  if (stateFor !== datasetId) {
    setStateFor(datasetId);
    setPointStyle(DEFAULT_POINT_STYLE);
    setFilterChoice(undefined);
    setFilterMode("one");
    setIsolated(null);
    setChosenSteps(null);
    setPlaying(false);
  }

  const profiles = useMemo(
    () =>
      new Map(
        (upload?.columns ?? []).map((c) => [c.name, profileColumn(upload!.dataset, c.name, c.kind === "time")])
      ),
    [upload]
  );
  // Columns whose values are on points or flows (not lat/lon, and not the
  // structural CSV columns that become flow endpoints and weights); unusable
  // ones stay listed, disabled, with the reason.
  const filterOptions = useMemo<FilterColumnOption[]>(
    () =>
      (upload?.columns ?? [])
        .filter((c) => c.kind !== "lat" && c.kind !== "lon" && profiles.get(c.name)?.filterTarget)
        .map((c) => ({ name: c.name, isTime: c.kind === "time", ...filterOption(profiles.get(c.name)!) })),
    [upload, profiles]
  );
  // Until the user picks, filter by the first usable time column, if any.
  const filterColumn =
    filterChoice !== undefined ? filterChoice : (filterOptions.find((o) => o.isTime && o.enabled)?.name ?? null);

  // A different filter column: start on its busiest step, paused.
  const [stepFor, setStepFor] = useState(filterColumn);
  if (stepFor !== filterColumn) {
    setStepFor(filterColumn);
    setChosenSteps(null);
    setPlaying(false);
  }

  const filterAxis = useMemo(() => {
    const profile = filterColumn ? profiles.get(filterColumn) : undefined;
    if (!upload || !filterColumn || !profile?.filterTarget) return null;
    return buildFilterAxis(upload.dataset, filterColumn, profile.filterTarget, profile.isTimeColumn);
  }, [upload, filterColumn, profiles]);
  let peakStep = 0;
  if (filterAxis) for (let i = 1; i < filterAxis.totals.length; i++) if (filterAxis.totals[i] > filterAxis.totals[peakStep]) peakStep = i;
  const stepCount = filterAxis?.labels.length ?? 1;
  const selection = chosenSteps ?? [peakStep];
  const selectSteps = (steps: number[]) => {
    setPlaying(false);
    setChosenSteps([...new Set(steps)].sort((a, b) => a - b));
  };
  const pointStyles = useMemo(
    () => (upload ? computePointStyles(upload.dataset, pointStyle, profiles) : null),
    [upload, pointStyle, profiles]
  );

  // Esc shows every flow again.
  useEffect(() => {
    if (!isolated) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsolated(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isolated]);

  useEffect(() => {
    if (!playing) return;
    // Move the whole selection one step forward, wrapping around.
    const id = setInterval(
      () =>
        setChosenSteps((steps) =>
          (steps ?? [peakStep]).map((s) => (s + 1) % stepCount).sort((a, b) => a - b)
        ),
      1000
    );
    return () => clearInterval(id);
  }, [playing, peakStep, stepCount]);

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
          <Logo size="sm" as="h1" />
          <Button variant="secondary" onClick={openPicker} disabled={busy !== null}>
            {t("map.newUpload")}
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
              {plural(upload.rowCount, "map.rows")} · {plural(upload.columns.length, "map.columns")}
            </p>
          </div>
        </div>

        <section className="flex w-full flex-col gap-[12px]" aria-labelledby="columns-heading">
          <div className="flex flex-col gap-[2px]">
            <div className="flex items-center gap-[8px]">
              <h2 id="columns-heading" className="text-[15px] leading-[22px] font-semibold text-ink">
                {t("map.columnsHeading")}
              </h2>
              <span className="rounded-full bg-accent-soft px-[8px] py-px text-[12px] leading-[18px] font-medium text-accent-text">
                {upload.columns.length}
              </span>
            </div>
            <p className="text-[12px] leading-[16px] text-ink-muted">{t("map.columnsHint")}</p>
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

        {/* screen readers */}
        <p className="sr-only" aria-live="polite">
          {t("map.summary", { points: plural(upload.dataset.nodes.length, "map.points"), flows: plural(upload.dataset.edges.length, "map.flows") })}
        </p>

        <MapView
          dataset={upload.dataset}
          pointStyles={pointStyles}
          filter={filterAxis ? { target: filterAxis.target, stepOf: filterAxis.stepOf, steps: selection } : null}
          bottomInset={FILTER_BAR_SPACE}
          isolated={isolated}
          onPointDoubleClick={(id, { additive }) => {
            // Isolate the flows starting or ending at this point. Ctrl/⌘ adds or
            // removes it from the isolated points; double-clicking the only
            // isolated point again shows every flow. Without flows, keep the zoom.
            if (!upload.dataset.edges.length) return false;
            setIsolated((current) => {
              if (additive) {
                const without = (current ?? []).filter((p) => p !== id);
                const next = without.length < (current ?? []).length ? without : [...without, id];
                return next.length ? next : null;
              }
              return current?.length === 1 && current[0] === id ? null : [id];
            });
            return true;
          }}
        />
        {isolated && (
          <div className="absolute top-[16px] left-[16px] flex max-w-[calc(100%-200px)] items-center gap-[6px] rounded-full border border-line bg-surface/94 py-[4px] pr-[4px] pl-[12px] shadow-[0px_2px_10px_0px_rgba(0,0,0,0.3)]">
            <span className="truncate text-[12px] leading-[16px] font-medium text-ink" aria-live="polite">
              {isolated.length === 1
                ? t("isolate.one", { name: upload.dataset.nodes.find((n) => n.id === isolated[0])?.name ?? isolated[0] })
                : plural(isolated.length, "isolate.many")}
            </span>
            <button
              type="button"
              onClick={() => setIsolated(null)}
              aria-label={t("isolate.clear")}
              title={t("isolate.clear")}
              className="flex size-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/10"
            >
              <img src="/figma/icon-close.svg" width={12} height={12} alt="" />
            </button>
          </div>
        )}
        {/* left of zoom */}
        <div className="absolute top-[16px] right-[62px]">
          <LanguageToggle />
        </div>
        {/* Legend sits above the filter bar. */}
        <div className="pointer-events-none absolute top-[16px] bottom-[164px] left-[16px] flex items-end">
          <div className="pointer-events-auto max-h-full">
            <MapLegend key={datasetId} sections={pointStyles?.legend ?? []} />
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-[16px] bottom-[42px]">
          <div className="pointer-events-auto">
            <FilterBar
              options={filterOptions}
              column={filterColumn}
              onColumnChange={setFilterChoice}
              axis={filterAxis}
              mode={filterMode}
              onModeChange={(mode) => {
                setFilterMode(mode);
                // Back to one value: keep the first selected step.
                if (mode === "one") selectSteps([selection[0]]);
              }}
              selection={filterMode === "one" ? [selection[0]] : selection}
              onSelectionChange={selectSteps}
              playing={playing}
              onTogglePlay={() => setPlaying((p) => !p)}
            />
          </div>
        </div>
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
              {busy ?? t("map.dropReplace")}
            </p>
            {!busy && <p className="text-center text-[13px] leading-[18px] text-ink-muted">{t("upload.formats")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
