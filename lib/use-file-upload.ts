"use client";

// Shared upload behaviour for the upload screen's "Browse files" box and the
// map screen's "New upload" button: same accepted types, size limit,
// processing and error messages.

import { useRef, useState, type ChangeEvent } from "react";
import { getDataset } from "./api";
import { useI18n, type MessageKey } from "./i18n";
import { summarizeDataset, type UploadedData } from "./upload-summary";

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const UPLOAD_ACCEPT = [
  ".csv,.json,.geojson,.parquet,.geoparquet,.kml,.gpx,.zip",
  "text/csv,application/json,application/geo+json,application/vnd.google-earth.kml+xml,application/gpx+xml,application/zip",
].join(",");
const SAMPLE_DATASET_ID = "gnv-commute";

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/**
 * A status or error message, kept untranslated so it follows language
 * changes: a dictionary key with its values, or a pipeline error's English text.
 */
type Message = { key: MessageKey; vars?: Record<string, string> } | { pipelineError: string };

type Options = {
  /** Keep the "Processing…" message after success, e.g. while navigating away. */
  keepBusyOnSuccess?: boolean;
};

export function useFileUpload(onLoaded: (upload: UploadedData) => void, { keepBusyOnSuccess = false }: Options = {}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyMessage, setBusy] = useState<Message | null>(null);
  const [errorMessage, setError] = useState<Message | null>(null);
  const { t, translateMessage } = useI18n();
  // Translated at render, so a language switch updates them.
  const render = (m: Message | null) =>
    m === null ? null : "pipelineError" in m ? translateMessage(m.pipelineError) : t(m.key, m.vars);
  const busy = render(busyMessage);
  const error = render(errorMessage);

  async function run(message: Message, load: () => Promise<UploadedData>) {
    setBusy(message);
    setError(null);
    try {
      onLoaded(await load());
      if (!keepBusyOnSuccess) setBusy(null);
    } catch (err) {
      setError({ pipelineError: errorText(err) });
      setBusy(null);
    }
  }

  function uploadFile(file: File) {
    if (busy) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError({ key: "upload.tooLarge" });
      return;
    }
    void run({ key: "upload.processing", vars: { name: file.name } }, async () => {
      const { processUpload } = await import("./process-upload");
      const { dataset, table } = await processUpload(file);
      return { fileName: file.name, dataset, ...table };
    });
  }

  function loadSample() {
    if (busy) return;
    void run({ key: "upload.loadingSample" }, async () => {
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
