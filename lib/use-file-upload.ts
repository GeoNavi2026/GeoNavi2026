"use client";

// Shared upload behaviour for the upload screen's "Browse files" box and the
// map screen's "New upload" button: same accepted types, size limit,
// processing and error messages.

import { useRef, useState, type ChangeEvent } from "react";
import { getDataset } from "./api";
import { summarizeDataset, type UploadedData } from "./upload-summary";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const UPLOAD_ACCEPT = [
  ".csv,.json,.geojson,.parquet,.geoparquet,.kml,.gpx,.zip",
  "text/csv,application/json,application/geo+json,application/vnd.google-earth.kml+xml,application/gpx+xml,application/zip",
].join(",");
export const UPLOAD_FORMATS_HINT = "CSV, GeoJSON, GeoParquet, KML, GPX or zipped shapefile · up to 50 MB";
const SAMPLE_DATASET_ID = "gnv-commute";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

type Options = {
  /** Keep the "Processing…" message after success, e.g. while navigating away. */
  keepBusyOnSuccess?: boolean;
};

export function useFileUpload(onLoaded: (upload: UploadedData) => void, { keepBusyOnSuccess = false }: Options = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(message: string, load: () => Promise<UploadedData>) {
    setBusy(message);
    setError(null);
    try {
      onLoaded(await load());
      if (!keepBusyOnSuccess) setBusy(null);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  function uploadFile(file: File) {
    if (busy) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is larger than 50 MB.");
      return;
    }
    void run(`Processing ${file.name}…`, async () => {
      const { processUpload } = await import("./process-upload");
      const { dataset, table } = await processUpload(file);
      return { fileName: file.name, dataset, ...table };
    });
  }

  function loadSample() {
    if (busy) return;
    void run("Loading the sample dataset…", async () => {
      const dataset = await getDataset(SAMPLE_DATASET_ID);
      return { fileName: dataset.meta.name, dataset, ...summarizeDataset(dataset) };
    });
  }

  /** Spread onto a hidden `<input>`; call `openPicker()` to show the file dialog. */
  const inputProps = {
    ref: inputRef,
    type: "file" as const,
    accept: UPLOAD_ACCEPT,
    className: "hidden",
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.currentTarget.files?.[0];
      e.currentTarget.value = "";
      if (file) uploadFile(file);
    },
  };

  return {
    busy,
    error,
    uploadFile,
    loadSample,
    openPicker: () => inputRef.current?.click(),
    inputProps,
  };
}
