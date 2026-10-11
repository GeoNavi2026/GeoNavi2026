"use client";
/* eslint-disable @next/next/no-img-element -- static SVG icon exported from Figma */

// Figma page "1 · Upload": title card with a drag-and-drop upload box over the globe.

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { getDataset } from "@/lib/api";
import { useUpload } from "@/lib/upload-store";
import { summarizeDataset } from "@/lib/upload-summary";
import Button from "./Button";
import GlobeGraphic from "./GlobeGraphic";
import Logo from "./Logo";

const MAX_BYTES = 50 * 1024 * 1024;
const SAMPLE_DATASET_ID = "gnv-commute";
const ACCEPT = ".csv,.json,.geojson,text/csv,application/json,application/geo+json";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export default function UploadScreen() {
  const router = useRouter();
  const { setUpload } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      setError("That file is larger than 50 MB.");
      return;
    }
    setBusy(`Processing ${file.name}…`);
    setError(null);
    try {
      const { processUpload } = await import("@/lib/process-upload");
      const { dataset, table } = await processUpload(file);
      setUpload({ fileName: file.name, dataset, ...table });
      router.push("/explore");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function loadSample() {
    setBusy("Loading the sample dataset…");
    setError(null);
    try {
      const dataset = await getDataset(SAMPLE_DATASET_ID);
      setUpload({ fileName: dataset.meta.name, dataset, ...summarizeDataset(dataset) });
      router.push("/explore");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) void handleFile(file);
  }

  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-canvas px-4 py-10">
      <GlobeGraphic />

      <div className="relative flex w-[600px] max-w-full flex-col items-center gap-[32px] rounded-[20px] border border-line bg-[rgb(2_3_8/0.82)] p-[48px] shadow-[0px_2px_6px_0px_rgba(0,0,0,0.04),0px_12px_40px_0px_rgba(0,0,0,0.06)] backdrop-blur-[12px] max-sm:p-[24px]">
        <div className="flex w-full flex-col items-center gap-[14px]">
          <Logo size="lg" as="h1" />
          <p className="text-center text-[17px] leading-[26px] text-ink-muted">
            Upload flow data and explore it on an interactive map.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="relative flex w-full flex-col items-center gap-[12px] rounded-[14px] bg-canvas px-[32px] py-[40px]"
        >
          {/* Dashed 1.5px outline with the Figma 8/6 dash pattern (CSS dashed can't set dash length). */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <rect
              x="0.75"
              y="0.75"
              rx="13.25"
              style={{ width: "calc(100% - 1.5px)", height: "calc(100% - 1.5px)" }}
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="8 6"
              className={`transition-colors ${dragging ? "stroke-accent-text" : "stroke-line-strong"}`}
            />
          </svg>
          <span className="flex size-[60px] items-center justify-center rounded-full bg-accent-soft">
            <img src="/figma/icon-cloud-upload.svg" width={28} height={28} alt="" />
          </span>
          <p className="text-center text-[16px] leading-[24px] font-medium text-ink">
            {busy ?? "Drag and drop your data file here"}
          </p>
          <p className="text-[13px] leading-[18px] text-ink-muted">or</p>
          <Button onClick={() => inputRef.current?.click()} disabled={busy !== null}>
            Browse files
          </Button>
          <p className="text-[13px] leading-[18px] text-ink-muted">CSV or GeoJSON · up to 50 MB</p>
          {error && (
            <p role="alert" className="text-center text-[13px] leading-[18px] text-[#f87171]">
              {error}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) void handleFile(file);
            }}
          />
        </div>

        <p className="flex flex-wrap justify-center gap-[6px] text-[14px] leading-[20px]">
          <span className="text-ink-muted">Don&apos;t have a file?</span>
          <button
            type="button"
            onClick={loadSample}
            disabled={busy !== null}
            className="cursor-pointer font-medium text-accent-text hover:underline disabled:cursor-default"
          >
            Try the sample dataset
          </button>
        </p>
      </div>
    </main>
  );
}
