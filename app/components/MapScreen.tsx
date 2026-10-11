"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icon exported from Figma */

// Figma page "2 · Map": sidebar with the uploaded file and its columns,
// the map, and the time slider.

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hourlyTotals } from "@/lib/time";
import { useUpload } from "@/lib/upload-store";
import Button from "./Button";
import ColumnItem from "./ColumnItem";
import Logo from "./Logo";
import TimeSlider from "./TimeSlider";

// MapLibre needs `window`, so never render the map on the server.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#f2efe9]" />,
});

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

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

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setChosenHour((h) => ((h ?? peakHour) + 1) % 24), 1000);
    return () => clearInterval(id);
  }, [playing, peakHour]);

  if (!upload) return null;

  return (
    <div className="flex h-dvh w-full flex-col bg-canvas md:flex-row">
      <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col gap-[20px] overflow-y-auto border-line bg-surface p-[20px] max-md:border-b md:h-full md:max-h-none md:w-[340px] md:border-r">
        <div className="flex w-full items-center justify-between">
          <Logo size="sm" />
          <Button
            variant="secondary"
            onClick={() => {
              setUpload(null);
              router.push("/");
            }}
          >
            New upload
          </Button>
        </div>

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
            <p className="text-[12px] leading-[16px] text-ink-muted">Column titles from your uploaded file</p>
          </div>
          <ul className="flex w-full flex-col gap-[2px]">
            {upload.columns.map((column) => (
              <ColumnItem key={column.name} column={column} />
            ))}
          </ul>
        </section>
      </aside>

      <main className="relative min-h-0 flex-1">
        <MapView dataset={upload.dataset} hour={totals ? hour : null} />
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
    </div>
  );
}
